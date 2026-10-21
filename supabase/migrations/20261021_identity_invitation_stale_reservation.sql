-- U2 identity and access, review repair (code review of 2026-10-20, Major 1 and Minor 4).
--
-- 1. A reservation older than 2 minutes counts as pending everywhere (entities file, BR2.11). Before this
--    migration only invitation_reserve cleared it, and it checked expiry first, so a reservation whose
--    release was never proven stayed `accepting` forever: revoke, resend and create all refused it and the
--    open-invitation index blocked a new invitation for the same email, role and scope.
-- 2. Housekeeping released nothing and deleted sign-in attempt rows older than 15 minutes, while the lock
--    function looks back 30 minutes. A run inside an active lock could lift it early. It now deletes rows
--    older than 30 minutes, the lock function's own horizon.
-- Only function bodies change. Signatures, grants and the security-definer settings stay as they were.

-- Returns every stale reservation to pending. Internal: only the functions below call it.
create or replace function invitation_release_stale() returns integer
language plpgsql security definer set search_path from current
as $$
declare v_count integer;
begin
  update invitations set status = 'pending', reserved_at = null
   where status = 'accepting' and reserved_at <= now() - interval '2 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function invitation_release_stale() from public, anon, authenticated, service_role;

create or replace function invitation_create(
  p_idempotency_key text, p_email text, p_role text, p_scope_type text, p_scope_id uuid,
  p_token_hash text, p_target_id uuid default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'invitation.create';
  v_org uuid;
  v_email text;
  v_fingerprint text;
  v_check jsonb;
  v_id uuid;
  v_family_org uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_email := lower(btrim(coalesce(p_email, '')));
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', v_email, p_role, p_scope_type, p_scope_id::text, p_target_id::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  if v_org is null or p_role is null or p_scope_type is null or p_scope_id is null then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
      'invitation', coalesce(p_scope_id, platform_system_account()), coalesce(v_org, platform_system_account()), null,
      'validation', null, 'invitation_invalid', null);
  end if;
  if not identity_can_manage_scope(v_org, p_role, p_scope_type, p_scope_id) then
    return identity_deny(c_operation, p_idempotency_key, v_fingerprint, 'role.grant', 'invitation',
      p_scope_id, v_org, null, 'invitation_create');
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
     or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
     or not ((p_role = 'parent' and p_scope_type = 'family')
          or (p_role in ('group_admin', 'kindergarten_teacher') and p_scope_type = 'group')
          or (p_role = 'super_admin' and p_scope_type = 'organization' and p_scope_id = v_org)) then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
      'invitation', p_scope_id, v_org, null, 'validation', null, 'invitation_invalid', null);
  end if;
  if p_scope_type = 'family' then
    select f.organization_id into v_family_org from app_families f where f.id = p_scope_id;
    if v_family_org is distinct from v_org then
      return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
        'invitation', p_scope_id, v_org, null, 'validation', null, 'scope_not_found', null);
    end if;
  end if;

  -- A stale reservation is pending again, and an expired pending invitation for the same email, role and
  -- scope no longer counts as open.
  perform invitation_release_stale();
  update invitations set status = 'replaced'
   where email = v_email and role = p_role and scope_type = p_scope_type and scope_id = p_scope_id
     and status = 'pending' and expires_at <= now();
  begin
    insert into invitations (email, role, scope_type, scope_id, organization_id, target_id, token_hash, created_by_account_id)
    values (v_email, p_role, p_scope_type, p_scope_id, v_org, p_target_id, p_token_hash, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
      'invitation', p_scope_id, v_org, null, 'conflict', null, 'invitation_exists', null);
  end;
  perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
  return platform_result('success', v_id, null);
end $$;

create or replace function invitation_resend(p_idempotency_key text, p_invitation_id uuid, p_new_token_hash text)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'invitation.resend';
  v_org uuid;
  v_old invitations%rowtype;
  v_fingerprint text;
  v_check jsonb;
  v_id uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(p_invitation_id::text, 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  perform invitation_release_stale();
  select * into v_old from invitations where id = p_invitation_id for update;
  -- An invitation of another organization answers exactly like a missing one.
  if not found or v_old.organization_id is distinct from v_org then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
      'invitation', coalesce(p_invitation_id, platform_system_account()), coalesce(v_org, platform_system_account()), null,
      'validation', null, 'invitation_not_found', null);
  end if;
  if not identity_can_manage_scope(v_org, v_old.role, v_old.scope_type, v_old.scope_id) then
    return identity_deny(c_operation, p_idempotency_key, v_fingerprint, 'role.grant', 'invitation',
      v_old.id, v_org, identity_scope_group(v_org, v_old.scope_type, v_old.scope_id), 'invitation_resend');
  end if;
  if v_old.status <> 'pending' then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
      'invitation', v_old.id, v_org, null, 'conflict', null, 'invitation_not_pending', null);
  end if;
  if p_new_token_hash is null or p_new_token_hash !~ '^[a-f0-9]{64}$' then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
      'invitation', v_old.id, v_org, null, 'validation', null, 'invitation_invalid', null);
  end if;

  update invitations set status = 'replaced' where id = v_old.id;
  begin
    insert into invitations (email, role, scope_type, scope_id, organization_id, target_id, token_hash,
                             created_by_account_id, replaces_invitation_id)
    values (v_old.email, v_old.role, v_old.scope_type, v_old.scope_id, v_old.organization_id, v_old.target_id,
            p_new_token_hash, auth.uid(), v_old.id)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'invitation_resend: token hash already used' using errcode = '23505';
  end;
  perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
  return platform_result('success', v_id, null);
end $$;

create or replace function invitation_revoke(p_idempotency_key text, p_invitation_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'invitation.revoke';
  v_org uuid;
  v_inv invitations%rowtype;
  v_fingerprint text;
  v_check jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(p_invitation_id::text, 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  perform invitation_release_stale();
  select * into v_inv from invitations where id = p_invitation_id for update;
  if not found or v_inv.organization_id is distinct from v_org then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
      'invitation', coalesce(p_invitation_id, platform_system_account()), coalesce(v_org, platform_system_account()), null,
      'validation', null, 'invitation_not_found', null);
  end if;
  if not identity_can_manage_scope(v_org, v_inv.role, v_inv.scope_type, v_inv.scope_id) then
    return identity_deny(c_operation, p_idempotency_key, v_fingerprint, 'role.grant', 'invitation',
      v_inv.id, v_org, identity_scope_group(v_org, v_inv.scope_type, v_inv.scope_id), 'invitation_revoke');
  end if;
  if v_inv.status <> 'pending' then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
      'invitation', v_inv.id, v_org, null, 'conflict', null, 'invitation_not_pending', null);
  end if;
  update invitations set status = 'revoked' where id = v_inv.id;
  perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_inv.id);
  return platform_result('success', v_inv.id, null);
end $$;

-- Reserve: a stale reservation is released first, so the expiry check below sees a pending invitation and an
-- expired one can be replaced by create. Everything else is as in 20261017.
create or replace function invitation_reserve(p_idempotency_key text, p_token_hash text) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'invitation.accept';
  v_inv invitations%rowtype;
  v_fingerprint text;
  v_check jsonb;
  v_orphan uuid;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
     or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return platform_result('validation', null, 'request_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(p_token_hash, 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  perform invitation_release_stale();
  select * into v_inv from invitations where token_hash = p_token_hash for update;
  if not found or v_inv.status in ('accepted', 'revoked', 'replaced') then
    return platform_result('validation', null, 'invitation_not_valid');
  end if;
  if v_inv.expires_at <= now() then
    return platform_result('validation', null, 'invitation_expired');
  end if;
  if exists (select 1 from accounts a where a.email = v_inv.email) then
    return platform_result('validation', null, 'account_exists');
  end if;
  if v_inv.status = 'accepting' then
    return platform_result('conflict', null, 'invitation_reserved');
  end if;
  update invitations set status = 'accepting', reserved_at = now() where id = v_inv.id;
  -- A sign-in user left by an earlier failed attempt (tagged with an invitation id, no Account) is reused.
  select u.id into v_orphan from auth.users u
   where lower(u.email) = v_inv.email and u.raw_app_meta_data ? 'invitation_id'
     and not exists (select 1 from accounts a where a.id = u.id)
   order by u.created_at desc limit 1;
  return platform_result('success', v_inv.id, 'reserved')
    || jsonb_build_object('email', v_inv.email, 'orphan_user_id', v_orphan,
         'reserved_at', (select i.reserved_at from invitations i where i.id = v_inv.id));
end $$;

-- Housekeeping: stale reservations return to pending, and sign-in attempt rows are kept for the lock
-- function's whole 30-minute look-back so a run can never shorten an active lock.
create or replace function identity_housekeeping() returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_attempts integer; v_pruned integer; v_users integer; v_invitations integer; v_expired integer; v_released integer;
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
  return platform_result('success', null, 'done') || jsonb_build_object(
    'attempts_removed', v_attempts + v_pruned, 'users_removed', v_users,
    'invitations_removed', v_invitations, 'invitations_expired', v_expired,
    'reservations_released', v_released);
end $$;
