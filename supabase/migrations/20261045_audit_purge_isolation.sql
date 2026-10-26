-- Audit purge isolation (follow-up B1; findings R-18 of the U2 review and R-08 of the U5 review). Forward-only: the
-- merged file 20261044 is not edited. Schema-neutral like the files before it (every function pins its own schema
-- with `set search_path from current`).
--
-- Two changes to what 20261044 defined:
--   1. audit_purge() deletes at most 5000 rows per call, the oldest aged rows first, so a large backlog (the first run
--      after a long gap) is worked off over several housekeeping runs and one run never holds its row locks for long.
--   2. identity_housekeeping() runs the purge in a sub-transaction of its own. A purge that fails undoes only the purge;
--      the other clean-up steps still commit, and the result says so with `audit_purge_failed`. Before, a failing or
--      timed-out purge rolled the whole housekeeping back, and the next run met the same backlog again.
-- The 365-day purge covers every audit event, including the ones written by the import and notification functions.

-- 1. The purge, capped. Same signature, same system-caller-only rule, same transaction-local setting that the
-- append-only trigger of 20261044 checks. The ids are chosen by age (the audit_events_time index) and deleted by id.
create or replace function audit_purge() returns integer
language plpgsql security definer set search_path from current
as $$
declare v_count integer;
begin
  if not platform_caller_is_system() then
    raise exception 'audit_purge is for the system caller only' using errcode = '42501';
  end if;
  perform set_config('app.audit_purge', 'on', true);
  delete from audit_events
   where id in (select id from audit_events
                 where occurred_at < now() - interval '365 days'
                 order by occurred_at, id
                 limit 5000);
  get diagnostics v_count = row_count;
  perform set_config('app.audit_purge', 'off', true);
  return v_count;
end $$;

-- 2. identity_housekeeping (last defined in 20261044) with the purge isolated. The exception block rolls back the
-- purge's own changes, including its transaction-local setting, and nothing else. The failure flag carries no error
-- text and no row content.
create or replace function identity_housekeeping() returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_attempts integer; v_pruned integer; v_users integer; v_invitations integer; v_expired integer;
  v_released integer; v_imports integer; v_audit integer := 0; v_audit_failed boolean := false;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  v_released := invitation_release_stale();
  delete from sign_in_attempts where attempted_at <= now() - interval '30 minutes';
  get diagnostics v_attempts = row_count;
  delete from sign_in_attempts
   where id in (select id from (
           select id, row_number() over (partition by email_hash order by attempted_at desc, id) as position
             from sign_in_attempts) ranked where ranked.position > 20);
  get diagnostics v_pruned = row_count;
  delete from auth.users u
   where u.raw_app_meta_data ? 'invitation_id'
     and u.created_at < now() - interval '1 hour'
     and not exists (select 1 from accounts a where a.id = u.id);
  get diagnostics v_users = row_count;
  delete from invitations
   where status in ('accepted', 'revoked', 'replaced') and updated_at < now() - interval '90 days';
  get diagnostics v_invitations = row_count;
  select count(*) into v_expired from invitations where status = 'pending' and expires_at <= now();
  v_imports := import_expire_all();
  begin
    v_audit := audit_purge();
  exception when others then
    v_audit := 0;
    v_audit_failed := true;
  end;
  return platform_result('success', null, 'done') || jsonb_build_object(
    'attempts_removed', v_attempts + v_pruned, 'users_removed', v_users,
    'invitations_removed', v_invitations, 'invitations_expired', v_expired,
    'reservations_released', v_released, 'import_runs_expired', v_imports,
    'audit_events_purged', v_audit, 'audit_purge_failed', v_audit_failed);
end $$;

-- Function rights, restated unchanged: both are executable by the system caller (the service-role key) only.
revoke all on function audit_purge() from public, anon, authenticated, service_role;
grant execute on function audit_purge() to service_role;
revoke all on function identity_housekeeping() from public, anon, authenticated, service_role;
grant execute on function identity_housekeeping() to service_role;
