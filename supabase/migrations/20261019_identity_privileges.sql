-- U2 identity and access: the sign-in service's service-role key reaches the database only through
-- named functions (BR2.23), and the superseded first-migration audit table is dropped when nothing uses
-- it (BR2.22).

-- The superseded audit table of the first migration. Dropped only when the catalogue shows nothing that
-- mentions it: no function body, policy of another table, view or foreign key.
do $$
begin
  if to_regclass('app_audit_events') is not null
     and not exists (select 1 from pg_proc p where p.pronamespace = current_schema()::regnamespace
                       and p.prosrc ilike '%app_audit_events%')
     and not exists (select 1 from pg_policies where schemaname = current_schema() and tablename <> 'app_audit_events'
                       and (coalesce(qual, '') ilike '%app_audit_events%' or coalesce(with_check, '') ilike '%app_audit_events%'))
     and not exists (select 1 from pg_views where schemaname = current_schema() and definition ilike '%app_audit_events%')
     and not exists (select 1 from pg_constraint where confrelid = to_regclass('app_audit_events'))
  then
    drop table app_audit_events;
  end if;
end $$;

-- No table or sequence right for the service-role key anywhere in the schema, now or by default for
-- tables that later migrations create (a later unit that needs more adds a named function instead).
do $$
declare v_schema text := current_schema();
begin
  execute format('revoke all on all tables in schema %I from service_role', v_schema);
  execute format('revoke all on all sequences in schema %I from service_role', v_schema);
  execute format('alter default privileges in schema %I revoke all on tables from service_role', v_schema);
  execute format('alter default privileges in schema %I revoke all on sequences from service_role', v_schema);
  execute format('alter default privileges in schema %I revoke execute on functions from service_role', v_schema);
end $$;

-- Execute rights of the service-role key: only the functions that run before or outside a session
-- (the admin-access list of the elevated function list). U1's hold functions and the cleanup function
-- lose it: they are called by a signed-in super admin or through the owner connection.
revoke execute on function lifecycle_hold_place(text, text, uuid, uuid, text) from service_role;
revoke execute on function lifecycle_hold_release(text, uuid, integer) from service_role;
revoke execute on function platform_cleanup_expired() from service_role;
-- Every other function of the schema loses the default execute right of everyone (functions are
-- executable by PUBLIC unless revoked) and of the service-role key; signed-in accounts keep only the
-- explicit grants made next to each function.
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as signature
             from pg_proc p
            where p.pronamespace = current_schema()::regnamespace and p.prokind = 'f'
              and pg_get_userbyid(p.proowner) = current_user
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, service_role', r.signature);
  end loop;
  -- Trigger functions and the system-account constant are never called by an application role.
  for r in select p.oid::regprocedure as signature
             from pg_proc p
            where p.pronamespace = current_schema()::regnamespace and p.prokind = 'f'
              and pg_get_userbyid(p.proowner) = current_user
              and (p.prorettype = 'trigger'::regtype or p.proname = 'platform_system_account')
  loop
    execute format('revoke execute on function %s from authenticated', r.signature);
  end loop;
end $$;
grant execute on function
  sign_in_lockout_check(text), sign_in_attempt_record(text), sign_in_attempt_clear(text, uuid),
  invitation_lookup(text), invitation_reserve(text, text), invitation_release(uuid, timestamptz), invitation_accept(text, uuid, uuid),
  account_recovery_check(text), sessions_remove(uuid, uuid), identity_housekeeping()
  to service_role;
