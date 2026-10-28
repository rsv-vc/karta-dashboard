-- Team management. Admins create members (nobody signs themselves up) and set
-- temporary passwords; the rules that must hold whoever calls live here:
-- - Email rule: employees (admins) need a company address; sales agents need a
--   company address or one on the admins' allowlist. Demo accounts are exempt.
-- - admin_update_member: no self-demotion or self-deactivation, at least one
--   active admin, and nobody leaves the sales team while owning active leads.

alter table public.app_settings
  add column company_domains text[] not null default '{getkarta.ai}';

alter table public.profiles
  add column must_change_password boolean not null default false,
  add column is_demo boolean not null default false;

-- The seeded demo team (scripts/seed-users-sql.ts) keeps its example addresses.
update public.profiles set is_demo = true
where id in (
  '6f1c2a10-0b6e-4d2a-9b1a-000000000001', '6f1c2a10-0b6e-4d2a-9b1a-000000000002',
  '6f1c2a10-0b6e-4d2a-9b1a-000000000003', '6f1c2a10-0b6e-4d2a-9b1a-000000000004',
  '6f1c2a10-0b6e-4d2a-9b1a-000000000005'
);

-- Outside addresses admins allow for sales agents --------------------------------
create table public.allowed_emails (
  email text primary key check (email = lower(email) and email like '_%@_%._%'),
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now()
);
create index allowed_emails_added_by_idx on public.allowed_emails (added_by);

alter table public.allowed_emails enable row level security;
create policy "admins read allowed emails" on public.allowed_emails
  for select to authenticated using ((select private.is_admin()));
create policy "admins add allowed emails" on public.allowed_emails
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins remove allowed emails" on public.allowed_emails
  for delete to authenticated using ((select private.is_admin()));

-- Email rule ---------------------------------------------------------------------
create or replace function private.email_allowed(p_email text, p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(lower(p_email), '@', 2) = any (select unnest(company_domains) from public.app_settings)
    or (p_role = 'sales_agent' and exists (select 1 from public.allowed_emails where email = lower(p_email)));
$$;
revoke all on function private.email_allowed(text, public.app_role) from public, anon, authenticated;

create or replace function private.check_member_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_demo or private.email_allowed(new.email, new.role) then
    return new;
  end if;
  if new.role = 'admin' then
    raise exception 'Employees need a company email address' using errcode = '22023';
  end if;
  raise exception 'Use a company email address, or add this one to the allowed outside emails first'
    using errcode = '22023';
end;
$$;
revoke all on function private.check_member_email() from public, anon, authenticated;

create trigger profiles_check_email
  before insert or update of email, role, is_demo on public.profiles
  for each row execute function private.check_member_email();

-- admin_update_member --------------------------------------------------------------
create or replace function public.admin_update_member(
  p_id uuid,
  p_role public.app_role,
  p_status public.user_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_current public.profiles%rowtype;
begin
  if not private.is_admin() then
    raise exception 'Only admins can manage the team' using errcode = '42501';
  end if;

  select * into v_current from public.profiles where id = p_id for update;
  if not found then
    raise exception 'This member no longer exists' using errcode = 'P0002';
  end if;
  if p_id = v_uid and (p_role <> 'admin' or p_status <> 'active') then
    raise exception 'You cannot remove your own admin access' using errcode = '22023';
  end if;

  -- Leaving the sales team (deactivated, or now an employee) needs an empty book.
  if v_current.role = 'sales_agent' and (p_role <> 'sales_agent' or p_status <> 'active')
    and exists (select 1 from public.leads where owner_id = p_id and stage not in ('won', 'lost')) then
    raise exception 'Move their active leads to another agent first' using errcode = '22023';
  end if;

  if (p_role <> 'admin' or p_status <> 'active') and not exists (
    select 1 from public.profiles where id <> p_id and role = 'admin' and status = 'active'
  ) then
    raise exception 'The team needs at least one active admin' using errcode = '22023';
  end if;

  update public.profiles set role = p_role, status = p_status where id = p_id;
end;
$$;
revoke all on function public.admin_update_member(uuid, public.app_role, public.user_status) from public, anon;
grant execute on function public.admin_update_member(uuid, public.app_role, public.user_status) to authenticated;
