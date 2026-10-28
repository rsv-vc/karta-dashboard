-- "for all" admin policies also applied to SELECT, so reads evaluated two
-- permissive policies. Split them into insert/update/delete only.

drop policy "admins write history" on public.lead_stage_history;
create policy "admins insert history" on public.lead_stage_history
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update history" on public.lead_stage_history
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete history" on public.lead_stage_history
  for delete to authenticated using ((select private.is_admin()));

drop policy "admins write activities" on public.lead_activities;
create policy "admins insert activities" on public.lead_activities
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update activities" on public.lead_activities
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete activities" on public.lead_activities
  for delete to authenticated using ((select private.is_admin()));

drop policy "admins write targets" on public.monthly_targets;
create policy "admins insert targets" on public.monthly_targets
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update targets" on public.monthly_targets
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete targets" on public.monthly_targets
  for delete to authenticated using ((select private.is_admin()));
