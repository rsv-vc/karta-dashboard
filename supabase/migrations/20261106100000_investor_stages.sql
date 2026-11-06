-- The investors' pipeline: eight stages replace the eleven from the sales MIS.
--
--   1 Intro/Discovery      <- Not met yet, No-show, Discovery done, Follow-up / deep dive
--   2 Product demo         <- Bot / technical round, POC pitched
--   3 POC accepted         <- POC approved
--   4 POC integration
--   5 POC live             <- POC ongoing
--   6 Agreement executed
--   7 Revenue generation   <- Won
--   8 Lost / Deprioritised <- Lost, Deferred
--
-- Agreement executed and Revenue generation both count as won: closed_at is the
-- date the deal was first won. Lost / Deprioritised can re-open and keeps any
-- reconnect date. Only Revenue generation is final. A discovery is "held" when
-- it has a date or the account is past stage 1, so the discovery figures carry
-- over: Not met yet and No-show accounts have no discovery date.

-- A copy of what changes, in case anything needs checking or putting back.
create table private.stage_model_backup_leads as
  select id as lead_id, stage::text as stage, closed_at, next_follow_up_at, drop_reason_id, drop_note, now() as backed_up_at
  from public.leads;
create table private.stage_model_backup_history as
  select id, lead_id, stage::text as stage, start_at, end_at from public.lead_stage_history;
create table private.stage_model_backup_reasons as
  select id, label, applies_to from public.drop_reasons;
revoke all on private.stage_model_backup_leads, private.stage_model_backup_history, private.stage_model_backup_reasons
  from public, anon, authenticated;

-- Everything that depends on the old enum ------------------------------------------------
drop function public.change_lead_stage(text, public.lead_stage, text, text, bigint, bigint);
drop function public.lead_directory();
drop function public.find_possible_duplicates(text, text);
drop function private.can_move_stage(public.lead_stage, public.lead_stage);
drop function private.stage_label(public.lead_stage);
alter table public.leads drop constraint closed_matches_stage, drop constraint no_follow_up_when_closed;
alter table public.leads alter column stage drop default;
drop table public.stage_settings;

alter type public.lead_stage rename to lead_stage_old;
create type public.lead_stage as enum (
  'intro_discovery', 'product_demo', 'poc_accepted', 'poc_integration', 'poc_live',
  'agreement_executed', 'revenue_generation', 'lost'
);

create function private.map_stage_investor(p text) returns text language sql immutable set search_path = '' as $$
  select case p
    when 'not_met' then 'intro_discovery'
    when 'no_show' then 'intro_discovery'
    when 'discovery_done' then 'intro_discovery'
    when 'follow_up' then 'intro_discovery'
    when 'technical_round' then 'product_demo'
    when 'poc_pitched' then 'product_demo'
    when 'poc_approved' then 'poc_accepted'
    when 'poc_ongoing' then 'poc_live'
    when 'won' then 'revenue_generation'
    when 'deferred' then 'lost'
    when 'lost' then 'lost'
  end;
$$;

alter table public.leads
  alter column stage type public.lead_stage using private.map_stage_investor(stage::text)::public.lead_stage;
alter table public.leads alter column stage set default 'intro_discovery';
alter table public.lead_stage_history
  alter column stage type public.lead_stage using private.map_stage_investor(stage::text)::public.lead_stage;
drop type public.lead_stage_old;
drop function private.map_stage_investor(text);

-- Consecutive history rows that now share a stage become one row --------------------------
create temporary table stage_history_runs on commit drop as
  with marked as (
    select id, lead_id, stage, start_at, end_at,
      lag(stage) over (partition by lead_id order by start_at, id) as previous
    from public.lead_stage_history
  ), runs as (
    select *, count(*) filter (where previous is distinct from stage) over (partition by lead_id order by start_at, id) as run
    from marked
  )
  select lead_id, run,
    (array_agg(id order by start_at, id))[1] as keep_id,
    array_agg(id order by start_at, id) as ids,
    (array_agg(end_at order by start_at desc, id desc))[1] as last_end
  from runs group by lead_id, run;
delete from public.lead_stage_history h using stage_history_runs r
  where h.id = any(r.ids) and h.id <> r.keep_id;
update public.lead_stage_history h set end_at = r.last_end
  from stage_history_runs r where h.id = r.keep_id;

-- Accounts that were Deferred are now closed as Lost / Deprioritised (reconnect dates stay) --
select set_config('app.via_function', 'on', true);
update public.leads l set closed_at = (
    select h.start_at from public.lead_stage_history h where h.lead_id = l.id and h.end_at is null
  )
  where l.stage = 'lost' and l.closed_at is null;
select set_config('app.via_function', 'off', true);

alter table public.leads
  add constraint closed_matches_stage
    check ((closed_at is not null) = (stage in ('agreement_executed', 'revenue_generation', 'lost'))),
  add constraint no_follow_up_when_closed check (stage <> 'revenue_generation' or next_follow_up_at is null);

-- Stage names and score points --------------------------------------------------------------
create table public.stage_settings (
  stage public.lead_stage primary key,
  label text not null check (char_length(label) between 1 and 40),
  points smallint not null check (points between 0 and 20)
);
insert into public.stage_settings (stage, label, points) values
  ('intro_discovery', 'Intro/Discovery', 5),
  ('product_demo', 'Product demo', 9),
  ('poc_accepted', 'POC accepted', 12),
  ('poc_integration', 'POC integration', 13),
  ('poc_live', 'POC live', 14),
  ('agreement_executed', 'Agreement executed', 15),
  ('revenue_generation', 'Revenue generation', 15),
  ('lost', 'Lost / Deprioritised', 0);
alter table public.stage_settings enable row level security;
create policy "signed-in users read stage_settings" on public.stage_settings
  for select to authenticated using ((select private.is_active_user()));
create policy "admins add stage_settings" on public.stage_settings
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update stage_settings" on public.stage_settings
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete stage_settings" on public.stage_settings
  for delete to authenticated using ((select private.is_admin()));

create function private.stage_label(p public.lead_stage)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select label from public.stage_settings where stage = p), initcap(replace(p::text, '_', ' ')));
$$;
revoke all on function private.stage_label(public.lead_stage) from public, anon;
grant execute on function private.stage_label(public.lead_stage) to authenticated;

-- A record on each account of what its stage became -------------------------------------------
insert into public.lead_activities (lead_id, type, description, at, by_user_id)
select b.lead_id, 'note',
  'Pipeline stages updated: ' ||
    case b.stage
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
      else 'Lost'
    end || ' is now ' || private.stage_label(l.stage),
  greatest(private.app_now(), l.created_at + interval '1 minute'), l.owner_id
from private.stage_model_backup_leads b join public.leads l on l.id = b.lead_id;

-- One stage for drop-offs, so every reason applies to it ---------------------------------------
alter table public.drop_reasons drop column applies_to;

-- Moves ----------------------------------------------------------------------------------------
create function private.can_move_stage(p_from public.lead_stage, p_to public.lead_stage)
returns boolean language sql immutable set search_path = '' as $$
  with main as (
    select array['intro_discovery', 'product_demo', 'poc_accepted', 'poc_integration', 'poc_live',
                 'agreement_executed', 'revenue_generation']::public.lead_stage[] as path
  )
  select case
    when p_from = 'revenue_generation' or p_from = p_to then false
    when p_to = 'lost' then true
    when p_from = 'lost' then true
    else array_position(path, p_to) > array_position(path, p_from)
  end
  from main;
$$;
revoke all on function private.can_move_stage(public.lead_stage, public.lead_stage) from public, anon;
grant execute on function private.can_move_stage(public.lead_stage, public.lead_stage) to authenticated;

create function public.change_lead_stage(
  p_lead_id text,
  p_to public.lead_stage,
  p_note text default '',
  p_lost_reason text default '',
  p_final_deal_value bigint default null,
  p_reason_id bigint default null
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
  v_won boolean := p_to in ('agreement_executed', 'revenue_generation');
  v_dropping boolean := p_to = 'lost';
  v_reason public.drop_reasons;
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
  if v_dropping then
    select * into v_reason from public.drop_reasons where id = p_reason_id and active;
    if not found then
      raise exception 'Pick a reason for marking it %', lower(private.stage_label(p_to)) using errcode = '22023';
    end if;
  end if;

  select max(start_at) into v_last_start from public.lead_stage_history where lead_id = p_lead_id;
  v_at := greatest(private.app_now(), v_last_start + interval '1 minute');

  perform set_config('app.via_function', 'on', true);
  update public.lead_stage_history set end_at = v_at where lead_id = p_lead_id and end_at is null;
  insert into public.lead_stage_history (lead_id, stage, start_at) values (p_lead_id, p_to, v_at);

  update public.leads set
    stage = p_to,
    -- The win date is the first time it was won; Agreement executed -> Revenue generation keeps it.
    closed_at = case
      when v_dropping then v_at
      when v_won and v_lead.stage in ('agreement_executed', 'revenue_generation') then v_lead.closed_at
      when v_won then v_at
      else null end,
    next_follow_up_at = case when p_to = 'revenue_generation' then null else next_follow_up_at end,
    deal_value = case when v_won and coalesce(p_final_deal_value, 0) > 0 then p_final_deal_value else deal_value end,
    drop_reason_id = case when v_dropping then v_reason.id else null end,
    drop_note = case when v_dropping then left(trim(coalesce(nullif(p_lost_reason, ''), p_note, '')), 300) else '' end,
    discovery_date = case
      when discovery_date is null and p_to not in ('intro_discovery', 'lost')
        then (v_at at time zone 'Asia/Kolkata')::date else discovery_date end,
    discovery_month = case
      when discovery_date is null and p_to not in ('intro_discovery', 'lost')
        then date_trunc('month', v_at at time zone 'Asia/Kolkata')::date else discovery_month end
  where id = p_lead_id;

  v_detail := nullif(trim(case when v_dropping then coalesce(nullif(p_lost_reason, ''), p_note, '') else coalesce(p_note, '') end), '');
  insert into public.lead_activities (lead_id, type, description, at, by_user_id)
  values (
    p_lead_id, 'stage_change',
    'Moved from ' || private.stage_label(v_lead.stage) || ' to ' || private.stage_label(p_to)
      || case when v_dropping then ': ' || v_reason.label else '' end
      || coalesce(case when v_dropping then ' (' || v_detail || ')' else ': ' || v_detail end, ''),
    v_at, (select auth.uid())
  );
  perform set_config('app.via_function', 'off', true);
end;
$$;
revoke all on function public.change_lead_stage(text, public.lead_stage, text, text, bigint, bigint) from public, anon;
grant execute on function public.change_lead_stage(text, public.lead_stage, text, text, bigint, bigint) to authenticated;

-- Agents' masked view: company, contact and owner only (stage for their own and for admins) -------
create function public.lead_directory()
returns table (id text, company_name text, poc_name text, owner_id uuid, stage public.lead_stage)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.company_name, l.poc_name, l.owner_id,
    case when private.is_admin() or l.owner_id = (select auth.uid()) then l.stage end
  from public.leads l
  where private.is_active_user()
  order by l.id;
$$;

create function public.find_possible_duplicates(p_name text, p_exclude_id text default null)
returns table (id text, company_name text, poc_name text, owner_id uuid, stage public.lead_stage)
language sql
stable
security definer
set search_path = ''
as $$
  with t as (select private.normalize_company(p_name) as target)
  select l.id, l.company_name, l.poc_name, l.owner_id,
    case when private.is_admin() or l.owner_id = (select auth.uid()) then l.stage end
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
revoke all on function public.lead_directory(), public.find_possible_duplicates(text, text) from public, anon;
grant execute on function public.lead_directory(), public.find_possible_duplicates(text, text) to authenticated;

-- Functions that name stages in their bodies ---------------------------------------------------
create or replace function public.log_activity(p_lead_id text, p_type public.activity_type, p_description text, p_date date, p_next_follow_up date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_today date := private.app_today();
  v_at timestamptz;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found or not private.can_edit_lead(v_lead.owner_id) then
    raise exception 'You can only change leads you own' using errcode = '42501';
  end if;
  if p_type = 'stage_change' then
    raise exception 'Use change_lead_stage() to move a lead' using errcode = '22023';
  end if;
  if v_lead.stage = 'revenue_generation' then
    raise exception 'Accounts generating revenue cannot take new activities' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_description, ''))) < 3 then
    raise exception 'Describe what happened' using errcode = '22023';
  end if;
  if p_date < (v_lead.created_at at time zone 'Asia/Kolkata')::date or p_date > v_today then
    raise exception 'The activity date must be between the lead''s creation and today' using errcode = '22023';
  end if;
  if p_next_follow_up is not null and p_next_follow_up < v_today then
    raise exception 'Pick today or a later date for the follow-up' using errcode = '22023';
  end if;

  -- Today's activities use the current time; past ones are placed at midday.
  v_at := case when p_date = v_today then private.app_now()
               else (p_date + time '12:00') at time zone 'Asia/Kolkata' end;
  v_at := greatest(v_at, v_lead.created_at + interval '1 minute');

  insert into public.lead_activities (lead_id, type, description, at, by_user_id)
  values (p_lead_id, p_type, trim(p_description), v_at, (select auth.uid()));

  update public.leads set
    last_contacted_at = case
      when p_type in ('call', 'email', 'meeting') and (last_contacted_at is null or v_at > last_contacted_at) then v_at
      else last_contacted_at end,
    next_follow_up_at = case
      when p_next_follow_up is not null then (p_next_follow_up + time '10:00') at time zone 'Asia/Kolkata'
      else next_follow_up_at end
  where id = p_lead_id;
end;
$$;

create or replace function public.admin_update_member(p_id uuid, p_role public.app_role, p_status public.user_status)
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
    and exists (select 1 from public.leads where owner_id = p_id and stage not in ('agreement_executed', 'revenue_generation', 'lost')) then
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
    volume, calls_per_month, minutes_per_call, price_per_minute, contract_months,
    responsiveness, decision_access, timing_budget, next_step,
    discovery_date, discovery_month,
    owner_id, created_at, next_follow_up_at
  ) values (
    trim(p ->> 'company_name'), trim(p ->> 'poc_name'), coalesce(trim(p ->> 'poc_designation'), ''),
    nullif(lower(trim(p ->> 'poc_email')), ''), nullif(trim(p ->> 'poc_phone'), ''), nullif(trim(p ->> 'poc_linkedin'), ''),
    p ->> 'industry', nullif(p ->> 'company_size', '')::public.company_size, nullif(trim(p ->> 'city'), ''),
    (p ->> 'source')::public.lead_source, 'intro_discovery', coalesce(nullif(p ->> 'priority', ''), 'medium')::public.lead_priority,
    coalesce((p ->> 'deal_value')::bigint, 0), coalesce(trim(p ->> 'notes'), ''),
    nullif(p ->> 'volume', '')::integer,
    nullif(p ->> 'calls_per_month', '')::integer, nullif(p ->> 'minutes_per_call', '')::numeric,
    nullif(p ->> 'price_per_minute', '')::numeric, nullif(p ->> 'contract_months', '')::smallint,
    coalesce((p ->> 'responsiveness')::smallint, 0), coalesce((p ->> 'decision_access')::smallint, 0),
    coalesce((p ->> 'timing_budget')::smallint, 0), coalesce(trim(p ->> 'next_step'), ''),
    nullif(p ->> 'discovery_date', '')::date,
    date_trunc('month', nullif(p ->> 'discovery_date', '')::date)::date,
    v_owner, v_at, nullif(p ->> 'next_follow_up_at', '')::timestamptz
  )
  returning id into v_id;

  insert into public.lead_stage_history (lead_id, stage, start_at) values (v_id, 'intro_discovery', v_at);
  insert into public.lead_activities (lead_id, type, description, at, by_user_id)
  values (v_id, 'note', 'Account created', v_at, v_uid);
  return v_id;
end;
$$;
