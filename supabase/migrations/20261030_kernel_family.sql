-- U3 kernel use cases, part 3: archiving and restoring a family, the invitation link for a parent, the
-- dashboard counts and the governance revoke (BR30.3, BR30.7, BR32.3, BR32.5, BR32.10, BR32.6). Same
-- pattern as the files before. Lock order of the whole unit: family row, then task rows in ascending id
-- order, then assignment rows in ascending id order (NFR3.8).

-- A family that went through the lifecycle (BR35.2) keeps its row but holds no personal data any more; the
-- mark keeps it out of the lifecycle list and out of restore.
alter table families add column anonymized_at timestamptz;

-- ---------------------------------------------------------------------------------------------------
-- family_archive: an admin in reach archives a family (W4, BR30.7). In one transaction the family, its
-- parents and children become archived, every place of the family on a task that starts in the future
-- becomes removed (the places are free again), every open request that involves one of the family's
-- places is withdrawn (another family's source place returns to active), and the versions of the affected
-- tasks rise. Places on tasks that have started stay as history. The sign-in accounts are not touched.
-- The family row is locked first, then the tasks and places of the family in the fixed order.
-- ---------------------------------------------------------------------------------------------------
create or replace function family_archive(p_idempotency_key text, p_family_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'family.archive';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_family families%rowtype;
  v_ids uuid[];
  v_locked uuid[];
  v_future uuid[];
  v_tries integer := 0;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_family_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_family_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    -- A family of another organization answers exactly like a missing one.
    select * into v_family from families where id = p_family_id and organization_id = v_org for update;
    if not found then
      perform platform_abort('validation', 'family_not_found');
    end if;
    if not directory_reaches_family(v_org, p_family_id) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_family.version <> p_expected_version or v_family.status = 'archived' then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;

    -- Tasks and places of the family, in the fixed order, until the set that was locked is the set there is.
    loop
      v_tries := v_tries + 1;
      select coalesce(array_agg(a.id order by a.id), '{}') into v_ids
        from assignments a where a.family_id = p_family_id and a.status <> 'removed';
      perform coordination_lock_assignments(v_ids);
      select coalesce(array_agg(a.id order by a.id), '{}') into v_locked
        from assignments a where a.family_id = p_family_id and a.status <> 'removed';
      exit when v_ids = v_locked;
      if v_tries >= 5 then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
    end loop;

    select coalesce(array_agg(a.id order by a.id), '{}') into v_future
      from assignments a join tasks t on t.id = a.task_id
     where a.id = any (v_ids) and t.starts_at > now();
    update tasks set updated_at = now()
     where id in (select a.task_id from assignments a where a.id = any (v_future));
    update assignments set status = 'removed' where id = any (v_future);
    perform coordination_withdraw_requests(v_ids);

    update parents set status = 'archived' where family_id = p_family_id and status <> 'archived';
    update children set status = 'archived' where family_id = p_family_id and status <> 'archived';
    update families set status = 'archived', archived_at = now() where id = p_family_id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_family_id);
    return platform_result('success', p_family_id, null)
      || jsonb_build_object('version', v_family.version + 1, 'removed_places', coalesce(array_length(v_future, 1), 0));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- family_restore: brings the family, its parents and its children back (BR30.7). The removed places are not
-- brought back. A stale version gives VERSION_CONFLICT; a family that is not archived (already active, or
-- anonymized by the lifecycle) gives RESTORE_CONFLICT.
-- ---------------------------------------------------------------------------------------------------
create or replace function family_restore(p_idempotency_key text, p_family_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'family.restore';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_family families%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_family_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_family_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_family from families where id = p_family_id and organization_id = v_org for update;
    if not found then
      perform platform_abort('validation', 'family_not_found');
    end if;
    if not directory_reaches_family(v_org, p_family_id) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_family.version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_family.status <> 'archived' or v_family.anonymized_at is not null then
      perform platform_abort('conflict', 'RESTORE_CONFLICT');
    end if;

    update parents set status = 'active' where family_id = p_family_id and status <> 'active';
    update children set status = 'active' where family_id = p_family_id and status <> 'active';
    update families set status = 'active', archived_at = null where id = p_family_id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_family_id);
    return platform_result('success', p_family_id, null) || jsonb_build_object('version', v_family.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- invitation_accept_parent: the link of an accepted invitation to its target parent (BR30.3, BR32.3). Called
-- by invitation_accept before it writes anything. An invitation without a target parent has nothing to
-- link. A target that is missing, archived, in another family than the invitation's scope or in an archived
-- family (TARGET_INVALID), that already has an account (PARENT_ALREADY_LINKED), or an account that already
-- belongs to another parent (ACCOUNT_ALREADY_LINKED) is a conflict. The target row is locked, so two
-- acceptances for the same parent end with exactly one link; the unique account link is the last word.
-- Internal.
-- ---------------------------------------------------------------------------------------------------
create or replace function invitation_accept_parent(p_invitation_id uuid, p_account_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_inv invitations%rowtype;
  v_parent parents%rowtype;
  v_family_status text;
begin
  select * into v_inv from invitations where id = p_invitation_id;
  if not found or v_inv.role <> 'parent' or v_inv.target_id is null then
    return platform_result('success', null, 'no_target');
  end if;
  select * into v_parent from parents
   where id = v_inv.target_id and organization_id = v_inv.organization_id for update;
  if not found or v_parent.family_id <> v_inv.scope_id or v_parent.status <> 'active' then
    return platform_result('conflict', null, 'TARGET_INVALID');
  end if;
  select f.status into v_family_status from families f where f.id = v_parent.family_id;
  if v_family_status is distinct from 'active' then
    return platform_result('conflict', null, 'TARGET_INVALID');
  end if;
  if v_parent.account_id is not null then
    return platform_result('conflict', null, 'PARENT_ALREADY_LINKED');
  end if;
  if exists (select 1 from parents p where p.account_id = p_account_id) then
    return platform_result('conflict', null, 'ACCOUNT_ALREADY_LINKED');
  end if;
  update parents set account_id = p_account_id where id = v_parent.id;
  return platform_result('success', v_parent.id, 'linked');
exception when unique_violation then
  return platform_result('conflict', null, 'ACCOUNT_ALREADY_LINKED');
end $$;

-- U2's acceptance, now with the link for a parent (the U3-HOOK of 20261017 is replaced by this call). Only
-- the new call differs from the version of 20261017: when the link is refused the reservation goes back to
-- pending in this same call and the invitation stays for an admin to look at; nothing is created.
create or replace function invitation_accept(p_idempotency_key text, p_invitation_id uuid, p_account_id uuid)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'invitation.accept';
  v_inv invitations%rowtype;
  v_fingerprint text;
  v_link jsonb;
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

  -- The link comes first so a refusal happens before anything is written.
  v_link := invitation_accept_parent(v_inv.id, p_account_id);
  if v_link->>'state' <> 'success' then
    update invitations set status = 'pending', reserved_at = null where id = v_inv.id and status = 'accepting';
    return v_link;
  end if;

  insert into accounts (id, email, organization_id) values (p_account_id, v_inv.email, v_inv.organization_id);
  insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id, granted_by_account_id)
  values (p_account_id, v_inv.role, v_inv.scope_type, v_inv.scope_id, v_inv.organization_id, v_inv.created_by_account_id);
  insert into app_authorization_versions (subject_id, authorization_version) values (p_account_id, 1)
  on conflict (subject_id) do update set authorization_version = app_authorization_versions.authorization_version + 1;
  update invitations
     set status = 'accepted', accepted_at = now(), accepted_account_id = p_account_id, reserved_at = null
   where id = v_inv.id;
  return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant', 'invitation',
    v_inv.id, v_inv.organization_id, identity_scope_group(v_inv.organization_id, v_inv.scope_type, v_inv.scope_id),
    'success', p_account_id, null, 'invitation:' || v_inv.id::text);
end $$;

-- U2's invitation creation (the version of 20261021) with one added check (BR32.3): a target parent must be
-- an active parent of the family the invitation is for, so a wrong target is refused early.
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
  if p_target_id is not null and not (p_role = 'parent' and exists (
       select 1 from parents p
        where p.id = p_target_id and p.organization_id = v_org and p.family_id = p_scope_id and p.status = 'active')) then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
      'invitation', p_scope_id, v_org, null, 'validation', null, 'target_not_found', null);
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

-- ---------------------------------------------------------------------------------------------------
-- The dashboard (W-dashboard, BR32.5): for an admin's reach, the number of open approvals (open swap and
-- cancellation requests whose source place is on a task of a reached group) and of open import conflicts.
-- Imports are U4's: until it creates import records the conflict count is a function that returns zero, and
-- a test marks that link as unfinished.
-- ---------------------------------------------------------------------------------------------------
create or replace function dashboard_import_conflicts(p_organization_id uuid) returns integer
language sql stable security definer set search_path from current
as $$ select 0 $$;

create or replace function dashboard_get() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_super boolean;
  v_groups uuid[];
  v_approvals integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if not directory_is_admin(v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_super := has_super_scope(v_org);
  select coalesce(array_agg(g.scope_id), '{}') into v_groups
    from app_role_grants g
   where g.subject_id = auth.uid() and g.organization_id = v_org and g.role = 'group_admin'
     and g.scope_type = 'group' and g.revoked_at is null;
  select count(*)::integer into v_approvals
    from change_requests r
    join assignments a on a.id = r.assignment_id
    join tasks t on t.id = a.task_id
   where r.organization_id = v_org and r.status = 'open' and (v_super or t.group_id = any (v_groups));
  return platform_result('success', null, null) || jsonb_build_object(
    'open_approvals', v_approvals,
    'open_import_conflicts', dashboard_import_conflicts(v_org));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- governance_revoke: an admin revokes one role grant through the governance screen (W16, BR32.10). The
-- grant's version is the authorization version of its account; a stale one gives the invalidated result
-- GRANT_STALE. An admin cannot revoke their own grant (conflict GRANT_SELF_LOCKOUT). Everything else is
-- U2's grant_change: its reach rules, its audit event and its refusal to remove the last active super admin
-- (mapped to GRANT_LAST_SUPER_ADMIN). A grant that does not exist in the actor's organization is denied;
-- an actor who may not manage the grant gets U2's own audited denial.
-- ---------------------------------------------------------------------------------------------------
create or replace function governance_revoke(p_idempotency_key text, p_grant_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'governance.revoke';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_grant app_role_grants%rowtype;
  v_version integer;
  v_result jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_grant_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  select * into v_grant from app_role_grants g
   where g.id = p_grant_id and g.organization_id = v_org and g.revoked_at is null;
  if not found then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if not identity_can_manage_scope(v_org, v_grant.role, v_grant.scope_type, v_grant.scope_id) then
    return grant_change(p_idempotency_key, 'revoke', v_grant.subject_id, v_grant.role, v_grant.scope_type, v_grant.scope_id);
  end if;
  select v.authorization_version into v_version from app_authorization_versions v where v.subject_id = v_grant.subject_id;
  if p_expected_version is null or v_version is distinct from p_expected_version then
    return platform_result('invalidated', null, 'GRANT_STALE');
  end if;
  if v_grant.subject_id = auth.uid() then
    return platform_result('conflict', null, 'GRANT_SELF_LOCKOUT');
  end if;

  v_result := grant_change(p_idempotency_key, 'revoke', v_grant.subject_id, v_grant.role, v_grant.scope_type, v_grant.scope_id);
  if v_result->>'state' = 'conflict' and v_result->>'code' = 'last_super_admin' then
    return platform_result('conflict', null, 'GRANT_LAST_SUPER_ADMIN');
  end if;
  if v_result->>'state' <> 'success' then
    return v_result;
  end if;
  perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_grant.id);
  return platform_result('success', v_grant.id, null)
    || jsonb_build_object('authorization_version', (select v.authorization_version from app_authorization_versions v where v.subject_id = v_grant.subject_id));
end $$;

revoke all on function
  family_archive(text, uuid, integer),
  family_restore(text, uuid, integer),
  invitation_accept_parent(uuid, uuid),
  dashboard_import_conflicts(uuid),
  dashboard_get(),
  governance_revoke(text, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function
  family_archive(text, uuid, integer),
  family_restore(text, uuid, integer),
  dashboard_get(),
  governance_revoke(text, uuid, integer)
  to authenticated;
