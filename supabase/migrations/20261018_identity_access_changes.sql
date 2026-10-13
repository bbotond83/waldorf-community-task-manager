-- U2 identity and access: grant changes, deactivation, account lookup, the scope probe and the first
-- super admin (BR2.2, BR2.14, BR2.17, BR2.18, NFR1.12, NFR6.3).

-- Locks every active super admin grant of an organization and returns how many active accounts hold one.
-- Callers that could remove the last one take this lock first, so two concurrent changes cannot both pass
-- (BR2.14). The lock is held until the transaction ends.
create or replace function identity_lock_super_admins(p_organization_id uuid) returns integer
language plpgsql security definer set search_path from current
as $$
declare v_count integer;
begin
  perform 1 from app_role_grants g
   where g.organization_id = p_organization_id and g.role = 'super_admin' and g.revoked_at is null
   order by g.id for update;
  select count(*) into v_count
    from app_role_grants g join accounts a on a.id = g.subject_id
   where g.organization_id = p_organization_id and g.role = 'super_admin' and g.revoked_at is null
     and a.status = 'active';
  return v_count;
end $$;

create or replace function identity_bump_authorization_version(p_subject_id uuid) returns void
language sql security definer set search_path from current
as $$ insert into app_authorization_versions (subject_id, authorization_version) values (p_subject_id, 2)
      on conflict (subject_id) do update set authorization_version = app_authorization_versions.authorization_version + 1 $$;

-- Adds or revokes one grant of an account (BR2.14). A super admin of the account's organization may change
-- any grant; a group admin may add or revoke parent and kindergarten_teacher grants of their own group.
create or replace function grant_change(
  p_idempotency_key text, p_change text, p_subject_id uuid, p_role text, p_scope_type text, p_scope_id uuid
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_operation text;
  v_action text;
  v_org uuid;
  v_subject_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_group uuid;
  v_grant app_role_grants%rowtype;
  v_family_org uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
     or p_change is null or p_change not in ('add', 'revoke') then
    return platform_result('validation', null, 'request_invalid');
  end if;
  v_operation := 'grant.' || p_change;
  v_action := case p_change when 'add' then 'role.grant' else 'role.revoke' end;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_change, p_subject_id::text, p_role, p_scope_type, p_scope_id::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(v_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  select a.organization_id into v_subject_org from accounts a where a.id = p_subject_id;
  -- An account of another organization answers exactly like a missing one.
  if p_subject_id is null or v_subject_org is distinct from v_org then
    return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
      coalesce(p_subject_id, platform_system_account()), v_org, null, 'validation', null, 'account_not_found', null);
  end if;
  if p_role is null or p_scope_type is null or p_scope_id is null
     or not ((p_role = 'parent' and p_scope_type = 'family')
          or (p_role in ('group_admin', 'kindergarten_teacher') and p_scope_type = 'group')
          or (p_role = 'super_admin' and p_scope_type = 'organization' and p_scope_id = v_org)) then
    return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
      p_subject_id, v_org, null, 'validation', null, 'grant_invalid', null);
  end if;
  v_group := identity_scope_group(v_org, p_scope_type, p_scope_id);
  if not identity_can_manage_scope(v_org, p_role, p_scope_type, p_scope_id) then
    return identity_deny(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account', p_subject_id,
      v_org, v_group, 'grant_' || p_change);
  end if;

  if p_change = 'add' then
    if p_scope_type = 'family' then
      select f.organization_id into v_family_org from app_families f where f.id = p_scope_id;
      if v_family_org is distinct from v_org then
        return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
          p_subject_id, v_org, null, 'validation', null, 'scope_not_found', null);
      end if;
    end if;
    begin
      insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id, granted_by_account_id)
      values (p_subject_id, p_role, p_scope_type, p_scope_id, v_org, auth.uid());
    exception when unique_violation then
      return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
        p_subject_id, v_org, v_group, 'conflict', null, 'grant_exists', null);
    end;
  else
    if p_role = 'super_admin' then
      -- Under the row lock: the last active super admin of an organization cannot be removed.
      if identity_lock_super_admins(v_org) <= 1 and exists (
           select 1 from app_role_grants g where g.subject_id = p_subject_id and g.role = 'super_admin'
              and g.organization_id = v_org and g.revoked_at is null
              and (select a.status from accounts a where a.id = g.subject_id) = 'active') then
        return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
          p_subject_id, v_org, null, 'conflict', null, 'last_super_admin', null);
      end if;
    end if;
    update app_role_grants set revoked_at = now()
     where subject_id = p_subject_id and role = p_role and scope_type = p_scope_type
       and scope_id = p_scope_id and organization_id = v_org and revoked_at is null
    returning * into v_grant;
    if not found then
      return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
        p_subject_id, v_org, v_group, 'validation', null, 'grant_not_found', null);
    end if;
  end if;

  perform identity_bump_authorization_version(p_subject_id);
  return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
    p_subject_id, v_org, v_group, 'success', p_subject_id, null, 'grant:' || p_role);
end $$;

-- Deactivates or reactivates an account (BR2.2, BR2.14): super admins only. The change, the new
-- authorization version and the audit event are one transaction; the database refuses a deactivated
-- account at once through the session check, before the server has banned the sign-in user.
create or replace function identity_set_account_status(p_idempotency_key text, p_account_id uuid, p_status text)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_operation text;
  v_action text;
  v_org uuid;
  v_account accounts%rowtype;
  v_fingerprint text;
  v_check jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_operation := case p_status when 'deactivated' then 'account.deactivate' else 'account.reactivate' end;
  v_action := v_operation;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(coalesce(p_account_id::text, ''), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(v_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  select * into v_account from accounts where id = p_account_id for update;
  if not found or v_account.organization_id is distinct from v_org then
    return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
      coalesce(p_account_id, platform_system_account()), coalesce(v_org, platform_system_account()), null,
      'validation', null, 'account_not_found', null);
  end if;
  if not has_super_scope(v_account.organization_id) then
    return identity_deny(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account', v_account.id,
      v_account.organization_id, null, v_operation);
  end if;
  if v_account.status = p_status then
    return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
      v_account.id, v_account.organization_id, null, 'conflict', null, 'account_status_unchanged', null);
  end if;
  if p_status = 'deactivated' and identity_lock_super_admins(v_account.organization_id) <= 1 and exists (
       select 1 from app_role_grants g where g.subject_id = v_account.id and g.role = 'super_admin'
          and g.organization_id = v_account.organization_id and g.revoked_at is null) then
    return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
      v_account.id, v_account.organization_id, null, 'conflict', null, 'last_super_admin', null);
  end if;

  update accounts set status = p_status where id = v_account.id;
  perform identity_bump_authorization_version(v_account.id);
  return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
    v_account.id, v_account.organization_id, null, 'success', v_account.id, null, p_status);
end $$;

create or replace function account_deactivate(p_idempotency_key text, p_account_id uuid) returns jsonb
language sql security definer set search_path from current
as $$ select identity_set_account_status(p_idempotency_key, p_account_id, 'deactivated') $$;

create or replace function account_reactivate(p_idempotency_key text, p_account_id uuid) returns jsonb
language sql security definer set search_path from current
as $$ select identity_set_account_status(p_idempotency_key, p_account_id, 'active') $$;

-- Looks an account up by email within the caller's reach (BR2.16): a super admin finds any account of
-- their organization, a group admin only an account that holds a grant in their group. Returns the id
-- and the status only; anything else (another organization, outside the group) is "not found".
create or replace function account_find_by_email(p_email text) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare v_account accounts%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  select * into v_account from accounts where email = lower(btrim(coalesce(p_email, '')));
  if not found or v_account.organization_id is distinct from identity_actor_organization()
     or not identity_account_visible(v_account.id) then
    return platform_result('validation', null, 'account_not_found');
  end if;
  return platform_result('success', v_account.id, v_account.status);
end $$;

-- The scope probe (BR2.17): asks whether the signed-in account may open one record. Returns only the text
-- allowed, denied or not_found. A record that is missing, or belongs to another organization, is always
-- not_found, so the probe is no oracle across organizations. A session that is not active gets denied.
-- Each later unit adds the branch for its own record types here.
create or replace function scope_probe(p_record_type text, p_record_id uuid) returns text
language plpgsql stable security definer set search_path from current
as $$
declare v_org uuid; v_scope uuid; v_found boolean := false; v_caller_org uuid;
begin
  if not current_session_is_active() then
    return 'denied';
  end if;
  v_caller_org := identity_actor_organization();
  if p_record_type = 'family' then
    select true, f.organization_id, f.scope_id into v_found, v_org, v_scope from app_families f where f.id = p_record_id;
    if v_found and v_org = v_caller_org then
      return case when has_core_scope(v_org, v_scope) or has_current_role_scope('parent', v_org, 'family', p_record_id)
        then 'allowed' else 'denied' end;
    end if;
  elsif p_record_type = 'assignment' then
    select true, f.organization_id, f.scope_id into v_found, v_org, v_scope from app_assignments f where f.id = p_record_id;
    if v_found and v_org = v_caller_org then
      return case when has_core_scope(v_org, v_scope) then 'allowed' else 'denied' end;
    end if;
  elsif p_record_type = 'import_run' then
    select true, f.organization_id into v_found, v_org from app_import_runs f where f.id = p_record_id;
    if v_found and v_org = v_caller_org then
      return case when has_super_scope(v_org) then 'allowed' else 'denied' end;
    end if;
  end if;
  return 'not_found';
end $$;

-- The first super admin of an organization (BR2.18): called only by the operator command, which runs as
-- the schema owner (the system actor). Under an advisory lock for the organization it refuses when an
-- active super admin exists; otherwise it creates the Account, the organization grant and the version
-- row, and writes role.first_super_admin. The sign-in user is created by the command beforehand.
create or replace function operator_first_super_admin(p_organization_id uuid, p_user_id uuid, p_email text)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_email text;
begin
  if not platform_caller_is_system() or coalesce(current_setting('role', true), 'none') = 'service_role' then
    return platform_result('denied', null, 'operator_required');
  end if;
  v_email := lower(btrim(coalesce(p_email, '')));
  if p_organization_id is null or p_user_id is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    return platform_result('validation', null, 'request_invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_schema() || '|first_super_admin|' || p_organization_id::text, 0));
  if exists (select 1 from app_role_grants g join accounts a on a.id = g.subject_id
              where g.organization_id = p_organization_id and g.role = 'super_admin'
                and g.revoked_at is null and a.status = 'active') then
    return platform_result('conflict', null, 'super_admin_exists');
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id and lower(u.email) = v_email) then
    return platform_result('validation', null, 'sign_in_user_missing');
  end if;
  if exists (select 1 from accounts a where a.id = p_user_id or a.email = v_email) then
    return platform_result('conflict', null, 'account_exists');
  end if;
  insert into accounts (id, email, organization_id) values (p_user_id, v_email, p_organization_id);
  insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id)
  values (p_user_id, 'super_admin', 'organization', p_organization_id, p_organization_id);
  insert into app_authorization_versions (subject_id, authorization_version) values (p_user_id, 1)
  on conflict (subject_id) do update set authorization_version = app_authorization_versions.authorization_version + 1;
  perform platform_audit_write('role.first_super_admin', 'account', p_user_id, p_organization_id, null, 'success', 'first_super_admin');
  return platform_result('success', p_user_id, null);
end $$;

revoke all on function
  identity_lock_super_admins(uuid),
  identity_bump_authorization_version(uuid),
  grant_change(text, text, uuid, text, text, uuid),
  identity_set_account_status(text, uuid, text),
  account_deactivate(text, uuid), account_reactivate(text, uuid),
  account_find_by_email(text), scope_probe(text, uuid),
  operator_first_super_admin(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function
  grant_change(text, text, uuid, text, text, uuid),
  account_deactivate(text, uuid), account_reactivate(text, uuid),
  account_find_by_email(text), scope_probe(text, uuid)
  to authenticated;
