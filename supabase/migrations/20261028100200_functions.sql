-- Atomic lead mutations. These run as SECURITY DEFINER with explicit permission
-- checks (owner or admin), so agents need no direct write access to history or
-- activities and cannot bypass the rules through the API. The rules mirror
-- lib/leads/mutations.ts, which stays as the tested reference.

-- Who may change this lead: its owner or an admin, both active.
create or replace function private.can_edit_lead(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user() and (p_owner = (select auth.uid()) or private.is_admin());
$$;
revoke all on function private.can_edit_lead(uuid) from public, anon;
grant execute on function private.can_edit_lead(uuid) to authenticated;

-- create_lead ------------------------------------------------------------------
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

  -- Agents own what they create; admins pick an active sales agent.
  if private.is_admin() then
    v_owner := nullif(p ->> 'owner_id', '')::uuid;
  else
    v_owner := v_uid;
  end if;
  if not exists (
    select 1 from public.profiles where id = v_owner and role = 'sales_agent' and status = 'active'
  ) then
    raise exception 'Pick an active sales agent as the owner' using errcode = '22023';
  end if;

  insert into public.leads (
    company_name, poc_name, poc_designation, poc_email, poc_phone, poc_linkedin,
    industry, company_size, city, source, stage, priority, deal_value, notes,
    owner_id, created_at, next_follow_up_at
  ) values (
    trim(p ->> 'company_name'), trim(p ->> 'poc_name'), trim(p ->> 'poc_designation'),
    lower(trim(p ->> 'poc_email')), p ->> 'poc_phone', nullif(trim(p ->> 'poc_linkedin'), ''),
    p ->> 'industry', (p ->> 'company_size')::public.company_size, p ->> 'city',
    (p ->> 'source')::public.lead_source, 'new', (p ->> 'priority')::public.lead_priority,
    (p ->> 'deal_value')::bigint, coalesce(trim(p ->> 'notes'), ''),
    v_owner, v_at, nullif(p ->> 'next_follow_up_at', '')::timestamptz
  )
  returning id into v_id;

  insert into public.lead_stage_history (lead_id, stage, start_at) values (v_id, 'new', v_at);
  insert into public.lead_activities (lead_id, type, description, at, by_user_id)
  values (v_id, 'note', 'Lead created', v_at, v_uid);
  return v_id;
end;
$$;

-- change_lead_stage ---------------------------------------------------------------
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
  v_order public.lead_stage[] := array['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won']::public.lead_stage[];
  v_lead public.leads;
  v_next public.lead_stage;
  v_last_start timestamptz;
  v_at timestamptz;
  v_closing boolean := p_to in ('won', 'lost');
  v_detail text;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found or not private.can_edit_lead(v_lead.owner_id) then
    raise exception 'You can only change leads you own' using errcode = '42501';
  end if;
  if v_lead.stage in ('won', 'lost') then
    raise exception 'A % lead cannot move to %', initcap(v_lead.stage::text), initcap(p_to::text) using errcode = '22023';
  end if;

  v_next := v_order[array_position(v_order, v_lead.stage) + 1];
  if p_to <> v_next and p_to <> 'lost' then
    raise exception 'A % lead cannot move to %', initcap(v_lead.stage::text), initcap(p_to::text) using errcode = '22023';
  end if;
  if p_to = 'lost' and char_length(trim(coalesce(p_lost_reason, ''))) < 3 then
    raise exception 'Say why the lead was lost' using errcode = '22023';
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
    deal_value = case when p_to = 'won' and coalesce(p_final_deal_value, 0) > 0 then p_final_deal_value else deal_value end
  where id = p_lead_id;

  v_detail := nullif(trim(case when p_to = 'lost' then p_lost_reason else coalesce(p_note, '') end), '');
  insert into public.lead_activities (lead_id, type, description, at, by_user_id)
  values (
    p_lead_id, 'stage_change',
    'Moved from ' || initcap(v_lead.stage::text) || ' to ' || initcap(p_to::text) || coalesce(': ' || v_detail, ''),
    v_at, (select auth.uid())
  );
  perform set_config('app.via_function', 'off', true);
end;
$$;

-- log_activity ---------------------------------------------------------------------
create or replace function public.log_activity(
  p_lead_id text,
  p_type public.activity_type,
  p_description text,
  p_date date,
  p_next_follow_up date default null
)
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
  if v_lead.stage in ('won', 'lost') then
    raise exception 'Closed leads cannot take new activities' using errcode = '22023';
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

-- reassign_leads -------------------------------------------------------------------
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
    raise exception 'Only admins can reassign leads' using errcode = '42501';
  end if;
  if coalesce(array_length(p_lead_ids, 1), 0) not between 1 and 50 then
    raise exception 'Move between 1 and 50 leads at a time' using errcode = '22023';
  end if;
  select name into v_to_name from public.profiles where id = p_to and role = 'sales_agent' and status = 'active';
  if v_to_name is null then
    raise exception 'Pick an active sales agent' using errcode = '22023';
  end if;
  if (select count(*) from public.leads where id = any(p_lead_ids)) <> array_length(p_lead_ids, 1) then
    raise exception 'Some of these leads no longer exist' using errcode = '22023';
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

revoke all on function
  public.create_lead(jsonb),
  public.change_lead_stage(text, public.lead_stage, text, text, bigint),
  public.log_activity(text, public.activity_type, text, date, date),
  public.reassign_leads(text[], uuid)
from public, anon;
grant execute on function
  public.create_lead(jsonb),
  public.change_lead_stage(text, public.lead_stage, text, text, bigint),
  public.log_activity(text, public.activity_type, text, date, date),
  public.reassign_leads(text[], uuid)
to authenticated;
