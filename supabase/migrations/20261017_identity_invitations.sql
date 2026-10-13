-- U2 identity and access: invitations (BR2.9, BR2.10, BR2.11, NFR6.2).
-- Create, resend and revoke run as the signed-in admin; lookup, reserve, release and accept run for the
-- server's admin access before a session exists. Tokens never reach the database: the server sends the
-- SHA-256 hash (lower-case hex) of the 32-byte token.

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

  -- An expired pending invitation for the same email, role and scope no longer counts as open.
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

-- Resend: a new invitation replaces a pending (or expired) one, with a new token and a new 7-day expiry.
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

-- Pre-session lookup of a token: returns only the role, the kind of scope and the validity (BR2.10).
-- 'valid' (pending, or reserved by a submit), 'expired' (pending past its expiry) or 'not_valid'
-- (unknown, accepted, revoked or replaced).
create or replace function invitation_lookup(p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare v_inv invitations%rowtype;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return platform_result('validation', null, 'token_hash_invalid');
  end if;
  select * into v_inv from invitations where token_hash = p_token_hash;
  if not found or v_inv.status in ('accepted', 'revoked', 'replaced') then
    return platform_result('success', null, 'not_valid');
  end if;
  if v_inv.expires_at <= now() then
    return platform_result('success', null, 'expired')
      || jsonb_build_object('role', v_inv.role, 'scope_type', v_inv.scope_type);
  end if;
  return platform_result('success', null, 'valid')
    || jsonb_build_object('role', v_inv.role, 'scope_type', v_inv.scope_type);
end $$;

-- Reserve: moves a valid invitation from pending to accepting so only one submit proceeds (BR2.11). A
-- reservation older than 2 minutes is released first. An invitation whose email already has an Account
-- is refused with a distinct code. A repeat with the same idempotency key returns the stored success.
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
  if v_inv.status = 'accepting' and v_inv.reserved_at > now() - interval '2 minutes' then
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

-- Releases a reservation back to pending after a failed acceptance (BR2.11), but only the reservation the caller
-- holds: the reservation time returned by invitation_reserve identifies it, so a slow first submit can never
-- release the newer reservation of a second one.
create or replace function invitation_release(p_invitation_id uuid, p_reserved_at timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_count integer;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  update invitations set status = 'pending', reserved_at = null
   where id = p_invitation_id and status = 'accepting' and reserved_at = p_reserved_at;
  get diagnostics v_count = row_count;
  return platform_result('success', p_invitation_id, case when v_count = 1 then 'released' else 'not_reserved' end);
end $$;

-- Accept: in one transaction creates the Account (with the id of the sign-in user the server created),
-- the grant and its version row, marks the invitation accepted and writes the audit event with the system
-- actor and the invitation as target (BR2.11). Any failure rolls everything back.
create or replace function invitation_accept(p_idempotency_key text, p_invitation_id uuid, p_account_id uuid)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'invitation.accept';
  v_inv invitations%rowtype;
  v_fingerprint text;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
     or p_invitation_id is null or p_account_id is null then
    return platform_result('validation', null, 'request_invalid');
  end if;
  select * into v_inv from invitations where id = p_invitation_id for update;
  if not found then
    return platform_result('validation', null, 'invitation_not_valid');
  end if;
  v_fingerprint := encode(sha256(convert_to(v_inv.token_hash, 'UTF8')), 'hex');
  if v_inv.status <> 'accepting' or v_inv.reserved_at is null or v_inv.reserved_at <= now() - interval '2 minutes' then
    return platform_result('validation', null, 'invitation_not_reserved');
  end if;
  if not exists (select 1 from auth.users u where u.id = p_account_id and lower(u.email) = v_inv.email) then
    return platform_result('validation', null, 'sign_in_user_missing');
  end if;
  if exists (select 1 from accounts a where a.id = p_account_id or a.email = v_inv.email) then
    return platform_result('conflict', null, 'account_exists');
  end if;

  insert into accounts (id, email, organization_id) values (p_account_id, v_inv.email, v_inv.organization_id);
  insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id, granted_by_account_id)
  values (p_account_id, v_inv.role, v_inv.scope_type, v_inv.scope_id, v_inv.organization_id, v_inv.created_by_account_id);
  insert into app_authorization_versions (subject_id, authorization_version) values (p_account_id, 1)
  on conflict (subject_id) do update set authorization_version = app_authorization_versions.authorization_version + 1;
  update invitations
     set status = 'accepted', accepted_at = now(), accepted_account_id = p_account_id, reserved_at = null
   where id = v_inv.id;
  -- U3-HOOK: link the Parent record (target_id of the invitation) to this account here.
  return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant', 'invitation',
    v_inv.id, v_inv.organization_id, identity_scope_group(v_inv.organization_id, v_inv.scope_type, v_inv.scope_id),
    'success', p_account_id, null, 'invitation:' || v_inv.id::text);
end $$;

revoke all on function
  invitation_create(text, text, text, text, uuid, text, uuid),
  invitation_resend(text, uuid, text),
  invitation_revoke(text, uuid),
  invitation_lookup(text),
  invitation_reserve(text, text),
  invitation_release(uuid, timestamptz),
  invitation_accept(text, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  invitation_create(text, text, text, text, uuid, text, uuid),
  invitation_resend(text, uuid, text),
  invitation_revoke(text, uuid)
  to authenticated;
