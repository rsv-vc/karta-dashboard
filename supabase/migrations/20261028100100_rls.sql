-- Row Level Security. The rule that matters most: a sales agent can never read
-- another agent's lead row. The masked directory and duplicate check are the
-- only ways other agents' leads are visible, and they expose 5 columns.

-- Helpers (private schema: not exposed through the API) -----------------------
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  );
$$;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active');
$$;

-- The demo's frozen "today" (app_settings.today) with the real IST time of day.
create or replace function private.app_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select today from public.app_settings), (now() at time zone 'Asia/Kolkata')::date);
$$;

create or replace function private.app_now()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select (private.app_today() + (now() at time zone 'Asia/Kolkata')::time) at time zone 'Asia/Kolkata';
$$;

revoke all on function private.is_admin(), private.is_active_user(), private.app_today(), private.app_now() from public, anon;
grant execute on function private.is_admin(), private.is_active_user(), private.app_today(), private.app_now() to authenticated;

-- Enable RLS everywhere -----------------------------------------------------------
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_stage_history enable row level security;
alter table public.lead_activities enable row level security;
alter table public.monthly_targets enable row level security;

-- app_settings: readable by signed-in users, changed only via SQL.
create policy "signed-in users read settings" on public.app_settings
  for select to authenticated using (true);

-- profiles: everyone signed in can see the team; people edit only name/title.
create policy "signed-in users read profiles" on public.profiles
  for select to authenticated using (true);
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));
revoke update on public.profiles from authenticated, anon;
grant update (name, title) on public.profiles to authenticated;

-- leads: own rows for agents, everything for admins.
create policy "owners and admins read leads" on public.leads
  for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin()));
-- New leads go through public.create_lead(); direct inserts are for admins (seeding).
create policy "admins insert leads" on public.leads
  for insert to authenticated with check ((select private.is_admin()));
create policy "owners and admins update leads" on public.leads
  for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin()))
  with check (owner_id = (select auth.uid()) or (select private.is_admin()));
create policy "admins delete leads" on public.leads
  for delete to authenticated using ((select private.is_admin()));

-- Stage, closing and ownership change only through the vetted functions below,
-- so history and activities can never drift from the lead row.
create or replace function private.guard_lead_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.via_function', true), '') <> 'on' then
    if new.stage is distinct from old.stage or new.closed_at is distinct from old.closed_at then
      raise exception 'Change the stage with change_lead_stage()' using errcode = '42501';
    end if;
    if new.owner_id is distinct from old.owner_id then
      raise exception 'Reassign leads with reassign_leads()' using errcode = '42501';
    end if;
    if new.created_at is distinct from old.created_at or new.id is distinct from old.id then
      raise exception 'Lead id and creation time cannot change' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger leads_guard_update
before update on public.leads
for each row execute function private.guard_lead_update();

-- History and activities follow the parent lead's visibility (the subquery is
-- itself filtered by the leads policy). Writes go through functions; direct
-- writes are for admins only (seeding).
create policy "read history of visible leads" on public.lead_stage_history
  for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy "admins write history" on public.lead_stage_history
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "read activities of visible leads" on public.lead_activities
  for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy "admins write activities" on public.lead_activities
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Targets: your own, or all for admins.
create policy "read own targets" on public.monthly_targets
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "admins write targets" on public.monthly_targets
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Masked views of other agents' leads --------------------------------------------
create or replace function public.lead_directory()
returns table (id text, company_name text, poc_name text, owner_id uuid, stage public.lead_stage)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.company_name, l.poc_name, l.owner_id, l.stage
  from public.leads l
  where private.is_active_user()
  order by l.id;
$$;

-- Same masked columns; matches lib/selectors.ts: exact normalized name, or one
-- name is the other plus extra words (shorter side at least 6 characters).
create or replace function public.find_possible_duplicates(p_name text, p_exclude_id text default null)
returns table (id text, company_name text, poc_name text, owner_id uuid, stage public.lead_stage)
language sql
stable
security definer
set search_path = ''
as $$
  with t as (select private.normalize_company(p_name) as target)
  select l.id, l.company_name, l.poc_name, l.owner_id, l.stage
  from public.leads l, t
  where private.is_active_user()
    and t.target <> ''
    and (p_exclude_id is null or l.id <> p_exclude_id)
    and (
      private.normalize_company(l.company_name) = t.target
      or (
        least(char_length(private.normalize_company(l.company_name)), char_length(t.target)) >= 6
        and (
          private.normalize_company(l.company_name) like t.target || ' %'
          or t.target like private.normalize_company(l.company_name) || ' %'
        )
      )
    )
  order by l.id;
$$;

revoke all on function public.lead_directory(), public.find_possible_duplicates(text, text) from public, anon;
grant execute on function public.lead_directory(), public.find_possible_duplicates(text, text) to authenticated;
