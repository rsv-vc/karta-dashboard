-- After seeding leads with explicit ids (L-1001…), move the id sequence past
-- the highest one so create_lead() never collides. Admin only.
create or replace function public.sync_lead_sequence()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max bigint;
begin
  if not private.is_admin() then
    raise exception 'Only admins can do this' using errcode = '42501';
  end if;
  select coalesce(max(substring(id from 3)::bigint), 1000) into v_max from public.leads where id ~ '^L-[0-9]+$';
  perform setval('public.lead_number_seq', v_max);
  return v_max;
end;
$$;

revoke all on function public.sync_lead_sequence() from public, anon;
grant execute on function public.sync_lead_sequence() to authenticated;
