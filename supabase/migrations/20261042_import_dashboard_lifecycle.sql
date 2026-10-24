-- U4 Import: the dashboard count and the lifecycle clean-up (BR41.12, BR42.4, NFR1.51, NFR1.56).
--
-- 1. `dashboard_import_conflicts` (U3's function, called by `dashboard_get`) had a body that returned zero until
--    the import existed. Its body is replaced here: for a super admin it is the number of the asking account's own
--    import conflicts that have no decision yet, in runs that are previewed, confirmed or interrupted; for every
--    other caller it is zero. Only the asking super admin's runs count: a run belongs to the super admin who started
--    it (BR41.7), and a count of another admin's open conflicts would tell that it exists.
--
-- 2. `lifecycle_run` (the wrapper of 20261038) now also clears what an import may still hold about the family
--    that left. The history of an import holds file names, sheet names, row numbers, counts and fixed texts, and no
--    person's name, so nothing personal is left there. The staged rows of an open run are the one place where a
--    name could still be: the staged rows matched to the family, and the task rows that name it as the assigned
--    family, are deleted. The run's fingerprint then no longer matches its remaining rows, so the commit of that
--    run answers IMPORT_FINGERPRINT_CHANGED and the admin uploads the workbook again, without the family.

create or replace function dashboard_import_conflicts(p_organization_id uuid) returns integer
language sql stable security definer set search_path from current
as $$
  select case when has_super_scope(p_organization_id) then (
    select count(*)::integer
      from import_conflicts c join import_runs r on r.id = c.import_run_id
     where r.organization_id = p_organization_id and r.started_by_account_id = auth.uid()
       and r.status in ('previewed', 'confirmed', 'interrupted') and c.resolution is null)
  else 0 end
$$;

-- Deletes the staged rows that name or are matched to a family that the lifecycle removed. Internal.
create or replace function import_after_lifecycle(p_organization_id uuid, p_family_id uuid, p_family_name text)
returns integer
language plpgsql set search_path from current
as $$
declare v_count integer;
begin
  delete from import_staged_rows s
   where s.organization_id = p_organization_id
     and ((s.matched_record_type = 'family' and s.matched_record_id = p_family_id)
          or (p_family_name is not null and s.payload ->> 'Család' = p_family_name));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function lifecycle_run(
  p_idempotency_key text, p_family_id uuid, p_expected_version integer, p_confirmed boolean
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_result jsonb;
  v_parents uuid[];
  v_org uuid;
  v_name text;
begin
  select coalesce(array_agg(p.id), '{}'::uuid[]) into v_parents from parents p where p.family_id = p_family_id;
  select f.organization_id, f.display_name into v_org, v_name from families f where f.id = p_family_id;
  v_result := lifecycle_run_core(p_idempotency_key, p_family_id, p_expected_version, p_confirmed);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_lifecycle(p_family_id, v_parents);
    perform import_after_lifecycle(v_org, p_family_id, v_name);
  end if;
  return v_result;
end $$;

revoke all on function import_after_lifecycle(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function lifecycle_run(text, uuid, integer, boolean) from public, anon, authenticated, service_role;
grant execute on function lifecycle_run(text, uuid, integer, boolean) to authenticated;
