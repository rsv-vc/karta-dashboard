-- Phase 12: masters (industries, cities, pricing, stages, drop-off reasons),
-- required drop-off reasons, agents' masked view without stages, and a
-- per-person "notifications seen" marker. Read by everyone signed in; written
-- by admins (employees).

-- Industries: the segment list and its average volume for the calculator ----------------
create table public.industries (
  name text primary key check (char_length(name) between 1 and 60),
  avg_calls_per_month integer check (avg_calls_per_month is null or avg_calls_per_month >= 0),
  minutes_per_call numeric(6, 2) not null default 5 check (minutes_per_call > 0),
  position integer not null default 0,
  active boolean not null default true
);
insert into public.industries (name, avg_calls_per_month, minutes_per_call, position) values
  ('Bank', 1500000, 5, 1),
  ('Insurance', 1000000, 5, 2),
  ('NBFC', 800000, 5, 3),
  ('Housing finance', 800000, 5, 4),
  ('Wealth & AMC', 800000, 5, 5),
  ('Fintech', 500000, 5, 6),
  ('Healthcare', null, 5, 7),
  ('Other', null, 5, 8)
on conflict (name) do nothing;
-- Accounts point at an industry; renaming one renames it on every account.
insert into public.industries (name, position)
  select distinct industry, 100 from public.leads where industry not in (select name from public.industries);
alter table public.leads
  add constraint leads_industry_fkey foreign key (industry) references public.industries (name) on update cascade;

-- Cities ----------------------------------------------------------------------------------
create table public.cities (
  name text primary key check (char_length(name) between 1 and 60),
  position integer not null default 0,
  active boolean not null default true
);
insert into public.cities (name, position) values
  ('Mumbai', 1), ('Bengaluru', 2), ('Delhi NCR', 3), ('Pune', 4), ('Hyderabad', 5),
  ('Chennai', 6), ('Ahmedabad', 7), ('Kolkata', 8)
on conflict (name) do nothing;
insert into public.cities (name, position)
  select distinct city, 100 from public.leads where city is not null and city <> '' and city not in (select name from public.cities);

-- Pricing defaults (the calculator's fallbacks) ---------------------------------------------
alter table public.app_settings
  add column price_per_minute numeric(6, 2) not null default 4 check (price_per_minute >= 0),
  add column price_low numeric(6, 2) not null default 3 check (price_low >= 0),
  add column price_high numeric(6, 2) not null default 5 check (price_high >= 0),
  add column minutes_per_call numeric(6, 2) not null default 5 check (minutes_per_call > 0),
  add column contract_months smallint not null default 12 check (contract_months between 1 and 120);

-- Stages: names and score points (order and movement rules stay in code) --------------------
create table public.stage_settings (
  stage public.lead_stage primary key,
  label text not null check (char_length(label) between 1 and 40),
  points smallint not null check (points between 0 and 20)
);
insert into public.stage_settings (stage, label, points) values
  ('not_met', 'Not met yet', 1),
  ('no_show', 'No-show', 2),
  ('discovery_done', 'Discovery done', 5),
  ('follow_up', 'Follow-up / deep dive', 9),
  ('technical_round', 'Bot / technical round', 11),
  ('poc_pitched', 'POC pitched', 12),
  ('poc_approved', 'POC approved', 13),
  ('poc_ongoing', 'POC ongoing', 14),
  ('won', 'Won', 15),
  ('deferred', 'Deferred', 3),
  ('lost', 'Lost', 0)
on conflict (stage) do nothing;

-- Activity text uses the configured names.
create or replace function private.stage_label(p public.lead_stage)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select label from public.stage_settings where stage = p), initcap(replace(p::text, '_', ' ')));
$$;
revoke all on function private.stage_label(public.lead_stage) from public, anon;
grant execute on function private.stage_label(public.lead_stage) to authenticated;

-- Drop-off reasons ----------------------------------------------------------------------------
create table public.drop_reasons (
  id bigint generated always as identity primary key,
  label text not null unique check (char_length(label) between 2 and 80),
  applies_to text not null default 'both' check (applies_to in ('lost', 'deferred', 'both')),
  position integer not null default 0,
  active boolean not null default true
);
insert into public.drop_reasons (label, applies_to, position) values
  ('Price too high', 'both', 1),
  ('No budget this cycle', 'both', 2),
  ('Chose another vendor', 'lost', 3),
  ('Existing vendor / contract in place', 'both', 4),
  ('Management did not approve', 'both', 5),
  ('Lack of trust / references', 'both', 6),
  ('Went silent after the meeting', 'both', 7),
  ('Wrong contact / no decision-maker', 'both', 8),
  ('Use case not a fit', 'lost', 9),
  ('Timing: revisit next quarter', 'deferred', 10),
  ('Internal priorities changed', 'both', 11),
  ('Other', 'both', 99)
on conflict (label) do nothing;

alter table public.leads
  add column drop_reason_id bigint references public.drop_reasons (id),
  add column drop_note text not null default '' check (char_length(drop_note) <= 300);
create index leads_drop_reason_idx on public.leads (drop_reason_id);

-- Notifications: each person's "seen up to" marker ----------------------------------------------
alter table public.profiles add column notifications_seen_at timestamptz;
grant update (notifications_seen_at) on public.profiles to authenticated;

-- RLS for the masters ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['industries', 'cities', 'stage_settings', 'drop_reasons'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "signed-in users read %1$s" on public.%1$I for select to authenticated using ((select private.is_active_user()))', t);
    execute format('create policy "admins add %1$s" on public.%1$I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy "admins update %1$s" on public.%1$I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy "admins delete %1$s" on public.%1$I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end $$;
-- Pricing lives in app_settings (read by everyone; admins may change it).
create policy "admins update settings" on public.app_settings
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
revoke update on public.app_settings from authenticated, anon;
grant update (price_per_minute, price_low, price_high, minutes_per_call, contract_months) on public.app_settings to authenticated;

-- Agents' masked view: company, contact and owner only (stage for their own and for admins) -------
drop function public.lead_directory();
drop function public.find_possible_duplicates(text, text);

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

-- change_lead_stage: a reason from the list is required for Lost and Deferred ----------------------
drop function public.change_lead_stage(text, public.lead_stage, text, text, bigint);

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
  v_closing boolean := p_to in ('won', 'lost');
  v_dropping boolean := p_to in ('lost', 'deferred');
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
    select * into v_reason from public.drop_reasons
      where id = p_reason_id and active and applies_to in ('both', p_to::text);
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
    closed_at = case when v_closing then v_at else null end,
    next_follow_up_at = case when v_closing then null else next_follow_up_at end,
    deal_value = case when p_to = 'won' and coalesce(p_final_deal_value, 0) > 0 then p_final_deal_value else deal_value end,
    drop_reason_id = case when v_dropping then v_reason.id else drop_reason_id end,
    drop_note = case when v_dropping then left(trim(coalesce(nullif(p_lost_reason, ''), p_note, '')), 300) else drop_note end,
    discovery_date = case
      when discovery_date is null and p_to not in ('not_met', 'no_show', 'deferred', 'lost')
        then (v_at at time zone 'Asia/Kolkata')::date else discovery_date end,
    discovery_month = case
      when discovery_month is null and p_to not in ('not_met', 'no_show', 'deferred', 'lost')
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
