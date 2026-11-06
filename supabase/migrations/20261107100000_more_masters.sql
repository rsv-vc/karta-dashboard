-- Investor requests: competitor, use case and direction on each account (each
-- with its own master), and two reason lists for stage 8: Lost reasons and
-- Why stuck (Deprioritised). A reason's kind says which one an account is.

-- A copy of what changes.
create table private.reason_lists_backup as
  select id, label, position, active from public.drop_reasons;
create table private.reason_lists_backup_leads as
  select id as lead_id, drop_reason_id, drop_note from public.leads where drop_reason_id is not null;
revoke all on private.reason_lists_backup, private.reason_lists_backup_leads from public, anon, authenticated;

-- Reasons: a kind, and the investors' lists -------------------------------------------------
alter table public.drop_reasons
  add column kind text not null default 'lost' check (kind in ('lost', 'stuck')),
  drop constraint drop_reasons_label_key,
  add constraint drop_reasons_kind_label_key unique (kind, label);

-- Renaming in place moves every account already using a reason onto the new list.
update public.drop_reasons d set label = m.label, position = m.position
from (values
  ('Price too high', 'Pricing', 1),
  ('Chose another vendor', 'Chose competitor', 2),
  ('No budget this cycle', 'No budget', 3),
  ('Timing: revisit next quarter', 'Deferred', 4),
  ('Management did not approve', 'Mgmt said no', 5),
  ('Went silent after the meeting', 'Went cold', 6),
  ('Wrong contact / no decision-maker', 'Wrong contact', 7),
  ('Other', 'Other', 11)
) as m(old_label, label, position)
where d.label = m.old_label;

insert into public.drop_reasons (label, kind, position) values
  ('Low volume', 'lost', 8),
  ('Building in-house', 'lost', 9),
  ('Product gap', 'lost', 10),
  ('No response / gone quiet', 'stuck', 1),
  ('Wrong contact / need decision-maker', 'stuck', 2),
  ('Low volume / weak use case', 'stuck', 3),
  ('Scheduling', 'stuck', 4),
  ('Awaiting their feedback / approval', 'stuck', 5),
  ('Pending on Karta (bot / recordings / pricing)', 'stuck', 6),
  ('Waiting on their data / recordings', 'stuck', 7),
  ('Security / IT review', 'stuck', 8),
  ('POC results not convincing', 'stuck', 9),
  ('Pricing / commercials', 'stuck', 10),
  ('Legal / procurement', 'stuck', 11),
  ('Bot shared', 'stuck', 12),
  ('Client testing on own', 'stuck', 13),
  ('Pricing under their internal approval', 'stuck', 14),
  ('Use case unclear', 'stuck', 15);

-- Old reasons with no place on the new lists: removed, or retired if an account still uses one.
delete from public.drop_reasons d
where d.label in ('Existing vendor / contract in place', 'Lack of trust / references', 'Use case not a fit', 'Internal priorities changed')
  and not exists (select 1 from public.leads l where l.drop_reason_id = d.id);
update public.drop_reasons
  set active = false
  where label in ('Existing vendor / contract in place', 'Lack of trust / references', 'Use case not a fit', 'Internal priorities changed');

-- New masters ---------------------------------------------------------------------------------
create table public.competitors (
  name text primary key check (char_length(name) between 1 and 60),
  position integer not null default 0,
  active boolean not null default true
);
insert into public.competitors (name, position) values
  ('None', 1), ('Unknown', 2), ('Gnani', 3), ('Haptik', 4), ('Ozonetel', 5), ('Ubona', 6),
  ('Yellow.ai', 7), ('Skit.ai', 8), ('Exotel', 9), ('Multiple vendors', 10), ('In-house', 11), ('Other', 12);

create table public.use_cases (
  name text primary key check (char_length(name) between 1 and 60),
  position integer not null default 0,
  active boolean not null default true
);
insert into public.use_cases (name, position) values
  ('Lead qual call', 1), ('Sales call', 2), ('KYC call', 3), ('Welcome call', 4), ('Interview call', 5),
  ('Inbound call', 6), ('Retention call', 7), ('Collection call', 8), ('First transaction', 9),
  ('In app lending', 10), ('Reminder', 11), ('Appointment booking', 12), ('Negotiation agent', 13);

create table public.directions (
  name text primary key check (char_length(name) between 1 and 60),
  position integer not null default 0,
  active boolean not null default true
);
insert into public.directions (name, position) values ('Inbound', 1), ('Outbound', 2), ('Both', 3);

do $$
declare t text;
begin
  foreach t in array array['competitors', 'use_cases', 'directions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "signed-in users read %1$s" on public.%1$I for select to authenticated using ((select private.is_active_user()))', t);
    execute format('create policy "admins add %1$s" on public.%1$I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy "admins update %1$s" on public.%1$I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy "admins delete %1$s" on public.%1$I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end $$;

-- Accounts point at each master; renaming an entry renames it on every account.
alter table public.leads
  add column competitor text references public.competitors (name) on update cascade,
  add column use_case text references public.use_cases (name) on update cascade,
  add column direction text references public.directions (name) on update cascade;
create index leads_competitor_idx on public.leads (competitor);
create index leads_use_case_idx on public.leads (use_case);
create index leads_direction_idx on public.leads (direction);

-- change_lead_stage: the activity says when it is stuck rather than lost --------------------------
create or replace function public.change_lead_stage(
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
      || case when v_dropping then ': ' || case when v_reason.kind = 'stuck' then 'Stuck - ' else '' end || v_reason.label else '' end
      || coalesce(case when v_dropping then ' (' || v_detail || ')' else ': ' || v_detail end, ''),
    v_at, (select auth.uid())
  );
  perform set_config('app.via_function', 'off', true);
end;
$$;

-- create_lead takes the new fields ---------------------------------------------------------------
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
    discovery_date, discovery_month, competitor, use_case, direction,
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
    nullif(p ->> 'competitor', ''), nullif(p ->> 'use_case', ''), nullif(p ->> 'direction', ''),
    v_owner, v_at, nullif(p ->> 'next_follow_up_at', '')::timestamptz
  )
  returning id into v_id;

  insert into public.lead_stage_history (lead_id, stage, start_at) values (v_id, 'intro_discovery', v_at);
  insert into public.lead_activities (lead_id, type, description, at, by_user_id)
  values (v_id, 'note', 'Account created', v_at, v_uid);
  return v_id;
end;
$$;
