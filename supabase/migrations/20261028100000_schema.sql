-- Karta Lead Tracker schema. Mirrors types/lead.ts and types/user.ts.

create schema if not exists private;

-- Enums ----------------------------------------------------------------------
create type public.app_role as enum ('admin', 'sales_agent');
create type public.user_status as enum ('active', 'inactive');
create type public.lead_stage as enum ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost');
create type public.lead_source as enum ('linkedin', 'referral', 'cold_email', 'cold_call', 'website', 'event', 'partner');
create type public.lead_priority as enum ('low', 'medium', 'high');
create type public.company_size as enum ('1-10', '11-50', '51-200', '201-1000', '1000+');
create type public.activity_type as enum ('call', 'email', 'meeting', 'note', 'stage_change');

-- App settings: the frozen "today" for the demo (null = real date) ------------
create table public.app_settings (
  id boolean primary key default true check (id),
  today date
);
insert into public.app_settings (id, today) values (true, null);

-- People ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text not null unique,
  role public.app_role not null default 'sales_agent',
  title text not null default '',
  status public.user_status not null default 'active',
  joined_at date not null default current_date
);

-- Leads ----------------------------------------------------------------------
create sequence public.lead_number_seq start 1001;

create table public.leads (
  id text primary key default ('L-' || nextval('public.lead_number_seq')),
  company_name text not null check (char_length(company_name) between 2 and 120),
  poc_name text not null,
  poc_designation text not null default '',
  poc_email text not null,
  poc_phone text not null,
  poc_linkedin text,
  industry text not null,
  company_size public.company_size not null,
  city text not null,
  source public.lead_source not null,
  stage public.lead_stage not null default 'new',
  priority public.lead_priority not null default 'medium',
  deal_value bigint not null check (deal_value >= 0),
  currency text not null default 'INR',
  owner_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  closed_at timestamptz,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  -- Integrity rules from lib/validation.ts
  constraint closed_matches_stage check ((closed_at is not null) = (stage in ('won', 'lost'))),
  constraint no_follow_up_when_closed check (stage not in ('won', 'lost') or next_follow_up_at is null)
);

create table public.lead_stage_history (
  id bigint generated always as identity primary key,
  lead_id text not null references public.leads (id) on delete cascade,
  stage public.lead_stage not null,
  start_at timestamptz not null,
  end_at timestamptz,
  check (end_at is null or end_at >= start_at)
);
-- Exactly one current stage per lead.
create unique index lead_stage_history_one_current on public.lead_stage_history (lead_id) where end_at is null;

create table public.lead_activities (
  id bigint generated always as identity primary key,
  lead_id text not null references public.leads (id) on delete cascade,
  type public.activity_type not null,
  description text not null check (char_length(description) between 1 and 1000),
  at timestamptz not null,
  by_user_id uuid not null references public.profiles (id)
);

create table public.monthly_targets (
  user_id uuid not null references public.profiles (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  won_value bigint not null check (won_value >= 0),
  new_leads integer not null check (new_leads >= 0),
  primary key (user_id, month)
);

-- Indexes --------------------------------------------------------------------
create index leads_owner_id_idx on public.leads (owner_id);
create index leads_stage_idx on public.leads (stage);
create index leads_next_follow_up_idx on public.leads (next_follow_up_at);
create index lead_stage_history_lead_idx on public.lead_stage_history (lead_id, start_at);
create index lead_activities_lead_idx on public.lead_activities (lead_id, at);
create index lead_activities_by_user_idx on public.lead_activities (by_user_id);

-- Company-name normalization for duplicate checks (matches lib/selectors.ts):
-- lowercase, punctuation to spaces, drop legal suffix words.
create or replace function private.normalize_company(name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_to_string(array(
    select w
    from unnest(string_to_array(trim(regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g')), ' ')) as w
    where w <> '' and w not in ('private', 'pvt', 'limited', 'ltd', 'llp', 'inc')
  ), ' '), '');
$$;

create index leads_company_normalized_idx on public.leads (private.normalize_company(company_name));

-- updated_at maintenance --------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger leads_touch_updated_at
before update on public.leads
for each row execute function private.touch_updated_at();
