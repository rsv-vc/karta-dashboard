-- Volume and deal value calculator (lib/deal-calculator.ts).
-- The four inputs are stored; empty means "use the default" (industry average
-- calls for the segment, 5 minutes a call, ₹4 a minute, 12 months). volume is
-- now minutes a month and deal_value the calculated contract value; the app
-- computes both from the inputs on every save.

alter table public.leads
  add column calls_per_month integer check (calls_per_month is null or calls_per_month >= 0),
  add column minutes_per_call numeric(6, 2) check (minutes_per_call is null or minutes_per_call > 0),
  add column price_per_minute numeric(6, 2) check (price_per_minute is null or price_per_minute >= 0),
  add column contract_months smallint check (contract_months is null or contract_months between 1 and 120);

comment on column public.leads.volume is 'Minutes a month = calls_per_month (or the segment average) × minutes_per_call (or 5).';
comment on column public.leads.deal_value is 'Rupees = volume × price_per_minute (or ₹4) × contract_months (or 12).';

-- Until now volume held the workbook's figure (calls a month): keep it as the calls input.
update public.leads set calls_per_month = volume where volume is not null;

-- create_lead stores the calculator inputs too (volume and deal_value arrive calculated).
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
    owner_id, created_at, next_follow_up_at
  ) values (
    trim(p ->> 'company_name'), trim(p ->> 'poc_name'), coalesce(trim(p ->> 'poc_designation'), ''),
    nullif(lower(trim(p ->> 'poc_email')), ''), nullif(trim(p ->> 'poc_phone'), ''), nullif(trim(p ->> 'poc_linkedin'), ''),
    p ->> 'industry', nullif(p ->> 'company_size', '')::public.company_size, nullif(trim(p ->> 'city'), ''),
    (p ->> 'source')::public.lead_source, 'not_met', coalesce(nullif(p ->> 'priority', ''), 'medium')::public.lead_priority,
    coalesce((p ->> 'deal_value')::bigint, 0), coalesce(trim(p ->> 'notes'), ''),
    nullif(p ->> 'volume', '')::integer,
    nullif(p ->> 'calls_per_month', '')::integer, nullif(p ->> 'minutes_per_call', '')::numeric,
    nullif(p ->> 'price_per_minute', '')::numeric, nullif(p ->> 'contract_months', '')::smallint,
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
