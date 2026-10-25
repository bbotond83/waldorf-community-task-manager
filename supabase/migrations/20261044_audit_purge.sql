-- U5 audit purge (NFR1.68, NFR2.35, NFR6.27): audit events older than 365 days can be deleted, and only by the
-- housekeeping function of the system caller. Forward-only: the merged files (20261012, 20261043) are not edited.
-- Schema-neutral: the migration runner sets the session search path to the target schema, and every function pins
-- its own schema with `set search_path from current` (BR1.5).

-- 1. The append-only trigger of 20261012 refused every update and delete. It now refuses every update, and a delete
-- unless the transaction-local setting `app.audit_purge` is `on` and the row is older than 365 days. Every other
-- change is refused with the same error as before. The setting is set only by audit_purge() below for its own
-- transaction; no application role holds a delete right on the table, so setting it elsewhere changes nothing.
create or replace function audit_events_refuse_change() returns trigger
language plpgsql set search_path from current
as $$ begin
  if tg_op = 'DELETE'
     and coalesce(current_setting('app.audit_purge', true), '') = 'on'
     and old.occurred_at < now() - interval '365 days' then
    return old;
  end if;
  raise exception 'audit_events is append-only' using errcode = '42501';
end $$;

-- 2. The purge. Executable only by the system caller (the service-role key); housekeeping calls it. It sets the
-- setting for its own transaction only, deletes the aged rows, switches the setting off again, and returns how many
-- rows it deleted. It writes no audit event and returns no personal data.
create or replace function audit_purge() returns integer
language plpgsql security definer set search_path from current
as $$
declare v_count integer;
begin
  if not platform_caller_is_system() then
    raise exception 'audit_purge is for the system caller only' using errcode = '42501';
  end if;
  perform set_config('app.audit_purge', 'on', true);
  delete from audit_events where occurred_at < now() - interval '365 days';
  get diagnostics v_count = row_count;
  perform set_config('app.audit_purge', 'off', true);
  return v_count;
end $$;

-- 3. identity_housekeeping (last defined in 20261043) with one added call to the purge and its count in the result.
create or replace function identity_housekeeping() returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_attempts integer; v_pruned integer; v_users integer; v_invitations integer; v_expired integer;
  v_released integer; v_imports integer; v_audit integer;
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
  v_audit := audit_purge();
  return platform_result('success', null, 'done') || jsonb_build_object(
    'attempts_removed', v_attempts + v_pruned, 'users_removed', v_users,
    'invitations_removed', v_invitations, 'invitations_expired', v_expired,
    'reservations_released', v_released, 'import_runs_expired', v_imports,
    'audit_events_purged', v_audit);
end $$;

-- Function rights. The purge is executable by the system caller only; the housekeeping rights are restated unchanged.
revoke all on function audit_purge() from public, anon, authenticated, service_role;
grant execute on function audit_purge() to service_role;
revoke all on function identity_housekeeping() from public, anon, authenticated, service_role;
grant execute on function identity_housekeeping() to service_role;
