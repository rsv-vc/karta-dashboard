-- Phase 11: the Karta sales MIS model (docs/prompts/phase-11-real-data.md).
-- - Stages follow the workbook's Scoring Guide; existing rows are mapped across.
-- - New account fields: discovery month/date, volume, the three score inputs,
--   next step, and the source tracker's raw status. Contact details, city and
--   company size become optional (the workbook keeps contacts elsewhere).
-- - Admins can own accounts too; agents still own only their own.

-- Stages --------------------------------------------------------------------------
drop function public.change_lead_stage(text, public.lead_stage, text, text, bigint);
drop function public.lead_directory();
drop function public.find_possible_duplicates(text, text);

alter type public.lead_stage rename to lead_stage_old;
create type public.lead_stage as enum (
  'not_met', 'no_show', 'discovery_done', 'follow_up', 'technical_round',
  'poc_pitched', 'poc_approved', 'poc_ongoing', 'won', 'deferred', 'lost'
);

create or replace function private.map_old_stage(p text)
returns text language sql immutable set search_path = '' as $$
  select case p
    when 'new' then 'not_met'
    when 'contacted' then 'discovery_done'
    when 'qualified' then 'follow_up'
    when 'proposal' then 'poc_pitched'
    when 'negotiation' then 'poc_ongoing'
    else p end;
$$;

alter table public.leads drop constraint closed_matches_stage, drop constraint no_follow_up_when_closed;
alter table public.leads alter column stage drop default;
alter table public.leads
  alter column stage type public.lead_stage using private.map_old_stage(stage::text)::public.lead_stage;
alter table public.leads alter column stage set default 'not_met';
alter table public.lead_stage_history
  alter column stage type public.lead_stage using private.map_old_stage(stage::text)::public.lead_stage;
drop function private.map_old_stage(text);
drop type public.lead_stage_old;

alter table public.leads
  add constraint closed_matches_stage check ((closed_at is not null) = (stage in ('won', 'lost'))),
  add constraint no_follow_up_when_closed check (stage not in ('won', 'lost') or next_follow_up_at is null);

-- Display names, used in activity text ("Moved from POC pitched to Won").
create or replace function private.stage_label(p public.lead_stage)
returns text language sql immutable set search_path = '' as $$
  select case p
    when 'not_met' then 'Not met yet'
    when 'no_show' then 'No-show'
    when 'discovery_done' then 'Discovery done'
    when 'follow_up' then 'Follow-up / deep dive'
    when 'technical_round' then 'Bot / technical round'
    when 'poc_pitched' then 'POC pitched'
    when 'poc_approved' then 'POC approved'
    when 'poc_ongoing' then 'POC ongoing'
    when 'won' then 'Won'
    when 'deferred' then 'Deferred'
    when 'lost' then 'Lost' end;
$$;
revoke all on function private.stage_label(public.lead_stage) from public, anon;
grant execute on function private.stage_label(public.lead_stage) to authenticated;

-- Sources ------------------------------------------------------------------------------
alter type public.lead_source add value if not exists 'pipeloom';
alter type public.lead_source add value if not exists 'voice_bot';
alter type public.lead_source add value if not exists 'head_of_growth';
-- Imported customers whose channel the tracker never recorded.
alter type public.lead_source add value if not exists 'unknown';

-- Account fields ---------------------------------------------------------------------
alter table public.leads
  alter column poc_email drop not null,
  alter column poc_phone drop not null,
  alter column city drop not null,
  alter column company_size drop not null,
  alter column deal_value set default 0,
  add column discovery_month date check (discovery_month is null or extract(day from discovery_month) = 1),
  add column discovery_date date,
  add column volume integer check (volume is null or volume >= 0),
  add column responsiveness smallint not null default 0 check (responsiveness between 0 and 10),
  add column decision_access smallint not null default 0 check (decision_access between 0 and 10),
  add column timing_budget smallint not null default 0 check (timing_budget between 0 and 5),
  add column next_step text not null default '' check (char_length(next_step) <= 200),
  add column source_status text check (source_status is null or char_length(source_status) <= 200);

-- Masked views (recreated with the new stage type) ------------------------------------
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
  order by l.company_name;
$$;

-- create_lead: admins may own (or assign to any active member); agents own theirs --------
create or replace function public.create_lead(p jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
  v_at timestamptz := private.app_now();
  v_id text;
begin
  if not private.is_active_user() then
    raise exception 'You need to sign in' using errcode = '42501';
  end if;

  v_owner := case when private.is_admin() then coalesce(nullif(p ->> 'owner_id', '')::uuid, v_uid) else v_uid end;
  if not exists (select 1 from public.profiles where id = v_owner and status = 'active') then
    raise exception 'Pick an active team member as the owner' using errcode = '22023';
  end if;

  insert into public.leads (
    company_name, poc_name, poc_designation, poc_email, poc_phone, poc_linkedin,
    industry, company_size, city, source, stage, priority, deal_value, notes,
    volume, responsiveness, decision_access, timing_budget, next_step,
    owner_id, created_at, next_follow_up_at
  ) values (
    trim(p ->> 'company_name'), trim(p ->> 'poc_name'), coalesce(trim(p ->> 'poc_designation'), ''),
    nullif(lower(trim(p ->> 'poc_email')), ''), nullif(trim(p ->> 'poc_phone'), ''), nullif(trim(p ->> 'poc_linkedin'), ''),
    p ->> 'industry', nullif(p ->> 'company_size', '')::public.company_size, nullif(trim(p ->> 'city'), ''),
    (p ->> 'source')::public.lead_source, 'not_met', coalesce(nullif(p ->> 'priority', ''), 'medium')::public.lead_priority,
    coalesce((p ->> 'deal_value')::bigint, 0), coalesce(trim(p ->> 'notes'), ''),
    nullif(p ->> 'volume', '')::integer,
    coalesce((p ->> 'responsiveness')::smallint, 0), coalesce((p ->> 'decision_access')::smallint, 0),
    coalesce((p ->> 'timing_budget')::smallint, 0), coalesce(trim(p ->> 'next_step'), ''),
    v_owner, v_at, nullif(p ->> 'next_follow_up_at', '')::timestamptz
  )
  returning id into v_id;

  insert into public.lead_stage_history (lead_id, stage, start_at) values (v_id, 'not_met', v_at);
  insert into public.lead_activities (lead_id, type, description, at, by_user_id)
  values (v_id, 'note', 'Account created', v_at, v_uid);
  return v_id;
end;
$$;

-- change_lead_stage ----------------------------------------------------------------------
-- Forward along the main path (skipping allowed), No-show only before discovery,
-- Deferred and Lost from any open stage, No-show and Deferred can re-open onto
-- the main path, Won and Lost are final.
create or replace function private.can_move_stage(p_from public.lead_stage, p_to public.lead_stage)
returns boolean language sql immutable set search_path = '' as $$
  with main as (
    select array['not_met', 'discovery_done', 'follow_up', 'technical_round', 'poc_pitched',
                 'poc_approved', 'poc_ongoing', 'won']::public.lead_stage[] as path
  )
  select case
    when p_from in ('won', 'lost') or p_from = p_to then false
    when p_to = 'lost' then true
    when p_to = 'deferred' then true
    when p_to = 'no_show' then p_from = 'not_met'
    when p_from in ('no_show', 'deferred') then true
    else array_position(path, p_to) > array_position(path, p_from)
  end
  from main;
$$;
revoke all on function private.can_move_stage(public.lead_stage, public.lead_stage) from public, anon;
grant execute on function private.can_move_stage(public.lead_stage, public.lead_stage) to authenticated;

create or replace function public.change_lead_stage(
  p_lead_id text,
  p_to public.lead_stage,
  p_note text default '',
  p_lost_reason text default '',
  p_final_deal_value bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_last_start timestamptz;
  v_at timestamptz;
  v_closing boolean := p_to in ('won', 'lost');
  v_detail text;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found or not private.can_edit_lead(v_lead.owner_id) then
    raise exception 'You can only change accounts you own' using errcode = '42501';
  end if;
  if not private.can_move_stage(v_lead.stage, p_to) then
    raise exception 'An account at % cannot move to %', private.stage_label(v_lead.stage), private.stage_label(p_to)
      using errcode = '22023';
  end if;
  if p_to = 'lost' and char_length(trim(coalesce(p_lost_reason, ''))) < 3 then
    raise exception 'Say why the account was lost' using errcode = '22023';
  end if;

  -- Keep history strictly ordered even if the previous change is "later today".
  select max(start_at) into v_last_start from public.lead_stage_history where lead_id = p_lead_id;
  v_at := greatest(private.app_now(), v_last_start + interval '1 minute');

  perform set_config('app.via_function', 'on', true);
  update public.lead_stage_history set end_at = v_at where lead_id = p_lead_id and end_at is null;
  insert into public.lead_stage_history (lead_id, stage, start_at) values (p_lead_id, p_to, v_at);

  update public.leads set
    stage = p_to,
    closed_at = case when v_closing then v_at else null end,
    next_follow_up_at = case when v_closing then null else next_follow_up_at end,
    deal_value = case when p_to = 'won' and coalesce(p_final_deal_value, 0) > 0 then p_final_deal_value else deal_value end,
    -- The first discovery held dates the account's discovery month.
    discovery_date = case
      when discovery_date is null and p_to not in ('not_met', 'no_show', 'deferred', 'lost')
        then (v_at at time zone 'Asia/Kolkata')::date else discovery_date end,
    discovery_month = case
      when discovery_month is null and p_to not in ('not_met', 'no_show', 'deferred', 'lost')
        then date_trunc('month', v_at at time zone 'Asia/Kolkata')::date else discovery_month end
  where id = p_lead_id;

  v_detail := nullif(trim(case when p_to = 'lost' then p_lost_reason else coalesce(p_note, '') end), '');
  insert into public.lead_activities (lead_id, type, description, at, by_user_id)
  values (
    p_lead_id, 'stage_change',
    'Moved from ' || private.stage_label(v_lead.stage) || ' to ' || private.stage_label(p_to) || coalesce(': ' || v_detail, ''),
    v_at, (select auth.uid())
  );
  perform set_config('app.via_function', 'off', true);
end;
$$;

-- reassign_leads: to any active member (admins can own accounts) -------------------------
create or replace function public.reassign_leads(p_lead_ids text[], p_to uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_moved integer := 0;
  v_at timestamptz := private.app_now();
  v_to_name text;
begin
  if not private.is_admin() then
    raise exception 'Only admins can reassign accounts' using errcode = '42501';
  end if;
  if coalesce(array_length(p_lead_ids, 1), 0) not between 1 and 200 then
    raise exception 'Move between 1 and 200 accounts at a time' using errcode = '22023';
  end if;
  select name into v_to_name from public.profiles where id = p_to and status = 'active';
  if v_to_name is null then
    raise exception 'Pick an active team member' using errcode = '22023';
  end if;
  if (select count(*) from public.leads where id = any(p_lead_ids)) <> array_length(p_lead_ids, 1) then
    raise exception 'Some of these accounts no longer exist' using errcode = '22023';
  end if;

  perform set_config('app.via_function', 'on', true);
  for v_lead in select * from public.leads where id = any(p_lead_ids) and owner_id <> p_to for update loop
    insert into public.lead_activities (lead_id, type, description, at, by_user_id)
    values (
      v_lead.id, 'note',
      'Reassigned from ' || (select name from public.profiles where id = v_lead.owner_id) || ' to ' || v_to_name,
      greatest(v_at, v_lead.created_at + interval '1 minute'),
      (select auth.uid())
    );
    update public.leads set owner_id = p_to where id = v_lead.id;
    v_moved := v_moved + 1;
  end loop;
  perform set_config('app.via_function', 'off', true);
  return v_moved;
end;
$$;

-- admin_update_member: only deactivation needs an empty book now ---------------------------
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

  if p_status <> 'active'
    and exists (select 1 from public.leads where owner_id = p_id and stage not in ('won', 'lost')) then
    raise exception 'Move their open accounts to someone else first' using errcode = '22023';
  end if;

  if (p_role <> 'admin' or p_status <> 'active') and not exists (
    select 1 from public.profiles where id <> p_id and role = 'admin' and status = 'active'
  ) then
    raise exception 'The team needs at least one active admin' using errcode = '22023';
  end if;

  update public.profiles set role = p_role, status = p_status where id = p_id;
end;
$$;

revoke all on function
  public.change_lead_stage(text, public.lead_stage, text, text, bigint),
  public.lead_directory(),
  public.find_possible_duplicates(text, text)
from public, anon;
grant execute on function
  public.change_lead_stage(text, public.lead_stage, text, text, bigint),
  public.lead_directory(),
  public.find_possible_duplicates(text, text)
to authenticated;

-- Funnel health tracker (the workbook's "Funnel Health" tab) -------------------------------
create type public.action_status as enum ('open', 'started', 'scheduled', 'pending_approval', 'under_review', 'done');

create table public.funnel_actions (
  id bigint generated always as identity primary key,
  funnel smallint not null check (funnel between 1 and 3),
  problem text not null check (char_length(problem) between 3 and 500),
  fix text not null default '' check (char_length(fix) <= 500),
  owner_label text not null default '' check (char_length(owner_label) <= 120),
  due_label text not null default '' check (char_length(due_label) <= 60),
  status public.action_status not null default 'open',
  position integer not null default 0,
  updated_at timestamptz not null default now()
);
create index funnel_actions_order_idx on public.funnel_actions (funnel, position);
create trigger funnel_actions_touch before update on public.funnel_actions
  for each row execute function private.touch_updated_at();

alter table public.funnel_actions enable row level security;
create policy "signed-in users read funnel actions" on public.funnel_actions
  for select to authenticated using ((select private.is_active_user()));
create policy "admins add funnel actions" on public.funnel_actions
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update funnel actions" on public.funnel_actions
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete funnel actions" on public.funnel_actions
  for delete to authenticated using ((select private.is_admin()));
