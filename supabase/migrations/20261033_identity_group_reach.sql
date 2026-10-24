-- U3 rewrite of U2's functions that read the placeholder family and assignment tables of the first migration
-- (NFR1.32, NFR6.14; entities.md, "Placeholder tables"). Merged migrations are never edited, so every
-- function is replaced here with `create or replace`, with the same signature, grants and security-definer
-- settings; only the reading of the placeholder tables changes. The placeholder tables themselves are dropped
-- by the next file, and only when nothing names them any more.
--
-- The group reach defined in entities.md:
--   * a family is reached through an active membership in a group where the actor holds a group admin
--     grant (a family with several memberships through any of them; with none, by super admins only);
--   * an assignment is reached through its task's group (it has no group of its own);
--   * the audit group of a family-scoped event is the first group (lowest id) among the family's active
--     memberships, whoever the actor is, and null only for a family without an active membership. This
--     deliberately differs from entities.md, which said "that the acting admin reaches, null for a super
--     admin": that wording would have dropped the group from the events of super admins, denied attempts
--     and invitation acceptances, hiding them from the group's admins and breaking U2's tests (owner
--     decision, option A). For a family with one membership the result is what U2 always produced.

-- A signed-in account may invite or grant a role and scope (BR2.9, BR2.14): a super admin for anything, a
-- group admin for a parent of a family they reach and a teacher of their own group.
create or replace function identity_can_manage_scope(p_organization_id uuid, p_role text, p_scope_type text, p_scope_id uuid)
returns boolean language sql stable security definer set search_path from current
as $$ select current_session_is_active() and (
  has_super_scope(p_organization_id)
  or (p_role = 'parent' and p_scope_type = 'family' and exists (
        select 1 from families f
         where f.id = p_scope_id and f.organization_id = p_organization_id
           and directory_reaches_family(p_organization_id, f.id)))
  or (p_role = 'kindergarten_teacher' and p_scope_type = 'group'
        and has_current_role_scope('group_admin', p_organization_id, 'group', p_scope_id))
) $$;

-- The group a scope belongs to, for the audit event: the group itself, or the family's first reached group.
create or replace function identity_scope_group(p_organization_id uuid, p_scope_type text, p_scope_id uuid)
returns uuid language sql stable security definer set search_path from current
as $$ select case p_scope_type
    when 'group' then p_scope_id
    when 'family' then (
      select m.group_id from group_memberships m
       where m.family_id = p_scope_id and m.organization_id = p_organization_id and m.status = 'active'
       order by m.group_id limit 1)
    else null end $$;

-- Whether the signed-in account may read an account row: itself, a super admin of its organization, or a
-- group admin when the account holds an active grant in their group or for a family they reach.
create or replace function identity_account_visible(p_account_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$ select current_session_is_active() and exists (
  select 1 from accounts a
   where a.id = p_account_id and (
     a.id = auth.uid()
     or has_super_scope(a.organization_id)
     or exists (
       select 1 from app_role_grants g
        where g.subject_id = a.id and g.revoked_at is null and g.organization_id = a.organization_id
          and ((g.scope_type = 'group' and has_current_role_scope('group_admin', g.organization_id, 'group', g.scope_id))
            or (g.scope_type = 'family' and directory_reaches_family(g.organization_id, g.scope_id)))))
) $$;

-- The grants a group admin reads: those of their own groups and of the families they reach.
drop policy grants_admin_read on app_role_grants;
create policy grants_admin_read on app_role_grants for select to authenticated using (
  has_super_scope(organization_id)
  or (scope_type = 'group' and has_current_role_scope('group_admin', organization_id, 'group', scope_id))
  or (scope_type = 'family' and directory_reaches_family(organization_id, scope_id))
);

-- U2's invitation creation (the version of 20261030) reading the family table of Directory.
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
    select f.organization_id into v_family_org from families f where f.id = p_scope_id;
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

-- U2's grant change (20261018) reading the family table of Directory.
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
      select f.organization_id into v_family_org from families f where f.id = p_scope_id;
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

-- The scope probe (BR2.17), now over the Directory and Coordination tables. A family is allowed to an admin
-- who reaches it and to the parents of the family; an assignment to an admin who reaches its task's group.
-- A missing record, or one of another organization, is always not_found.
create or replace function scope_probe(p_record_type text, p_record_id uuid) returns text
language plpgsql stable security definer set search_path from current
as $$
declare v_org uuid; v_group uuid; v_found boolean := false; v_caller_org uuid;
begin
  if not current_session_is_active() then
    return 'denied';
  end if;
  v_caller_org := identity_actor_organization();
  if p_record_type = 'family' then
    select true, f.organization_id into v_found, v_org from families f where f.id = p_record_id;
    if v_found and v_org = v_caller_org then
      return case when directory_reaches_family(v_org, p_record_id)
                    or has_current_role_scope('parent', v_org, 'family', p_record_id)
        then 'allowed' else 'denied' end;
    end if;
  elsif p_record_type = 'assignment' then
    select true, a.organization_id, t.group_id into v_found, v_org, v_group
      from assignments a join tasks t on t.id = a.task_id where a.id = p_record_id;
    if v_found and v_org = v_caller_org then
      return case when has_core_scope(v_org, v_group) then 'allowed' else 'denied' end;
    end if;
  elsif p_record_type = 'import_run' then
    select true, f.organization_id into v_found, v_org from app_import_runs f where f.id = p_record_id;
    if v_found and v_org = v_caller_org then
      return case when has_super_scope(v_org) then 'allowed' else 'denied' end;
    end if;
  end if;
  return 'not_found';
end $$;
