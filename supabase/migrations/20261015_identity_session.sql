-- U2 identity and access: the active-session check, the policy helpers that call it, and the
-- row-level security policies of the identity tables (BR2.5, BR2.6, BR2.15, NFR1.1).

-- The database accepts a request only for an active session of an active account (BR2.6): the token's
-- session id must exist in the sign-in service's session table, must not be past its end or its
-- 30-day inactivity limit (the limit is also configured in the sign-in service; checking it here
-- as well means an idle session reads nothing even before the service would refuse a refresh), and
-- the account must be active. A token obtained any other way carries no live session and reads nothing.
create or replace function current_session_is_active() returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce((
    select true
      from auth.sessions s
      join accounts a on a.id = s.user_id
     where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
       and s.user_id = auth.uid()
       and a.status = 'active'
       and (s.not_after is null or s.not_after > now())
       and coalesce(s.refreshed_at at time zone 'UTC', s.created_at) > now() - interval '30 days'
  ), false)
$$;

-- The existing policy helpers keep their signatures and now call the session check first (BR2.6).
create or replace function authorization_version_for(requested_subject_id uuid)
returns integer language sql stable security definer set search_path from current
as $$ select authorization_version from app_authorization_versions
       where subject_id = requested_subject_id and requested_subject_id = auth.uid() and current_session_is_active() $$;

create or replace function has_current_role_scope(requested_role text, requested_organization_id uuid, requested_scope_type text, requested_scope_id uuid)
returns boolean language sql stable security definer set search_path from current
as $$ select current_session_is_active() and exists(select 1 from app_role_grants g
  where g.subject_id = auth.uid() and g.revoked_at is null and g.role = requested_role
    and g.organization_id = requested_organization_id and g.scope_type = requested_scope_type and g.scope_id = requested_scope_id and (
  (g.role = 'parent' and g.scope_type = 'family') or
  (g.role in ('group_admin', 'kindergarten_teacher') and g.scope_type = 'group') or
  (g.role = 'super_admin' and g.scope_type = 'organization' and g.scope_id = g.organization_id)
)) $$;

create or replace function has_super_scope(requested_organization_id uuid)
returns boolean language sql stable security definer set search_path from current
as $$ select current_session_is_active() and has_current_role_scope('super_admin', requested_organization_id, 'organization', requested_organization_id) $$;

create or replace function has_core_scope(requested_organization_id uuid, requested_group_id uuid)
returns boolean language sql stable security definer set search_path from current
as $$ select current_session_is_active() and (has_super_scope(requested_organization_id)
  or has_current_role_scope('group_admin', requested_organization_id, 'group', requested_group_id)) $$;

-- The U1 actor lookup is the single choke point of every audited and idempotent operation: a signed-in
-- caller without an active session is refused there (insufficient privilege, mapped to denied).
create or replace function platform_actor_account() returns uuid
language plpgsql stable security definer set search_path from current
as $$
declare v_uid uuid;
begin
  if platform_caller_is_system() then
    return platform_system_account();
  end if;
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'platform: no signed-in session' using errcode = '28000';
  end if;
  if not current_session_is_active() then
    raise exception 'platform: the session is not active' using errcode = '42501';
  end if;
  return v_uid;
end $$;

-- Internal helpers of the elevated functions. Not callable by any application role.

-- Organization of the signed-in, active account (null without an active session).
create or replace function identity_actor_organization() returns uuid
language sql stable security definer set search_path from current
as $$ select a.organization_id from accounts a where a.id = auth.uid() and current_session_is_active() $$;

-- True when the signed-in account may invite or grant this role and scope (BR2.9, BR2.14): a super
-- admin of the organization for any role and scope, a group admin for parent (a family of their own
-- group) and kindergarten_teacher (their own group).
create or replace function identity_can_manage_scope(p_organization_id uuid, p_role text, p_scope_type text, p_scope_id uuid)
returns boolean language sql stable security definer set search_path from current
as $$ select current_session_is_active() and (
  has_super_scope(p_organization_id)
  or (p_role = 'parent' and p_scope_type = 'family' and exists (
        select 1 from app_families f
         where f.id = p_scope_id and f.organization_id = p_organization_id
           and has_current_role_scope('group_admin', p_organization_id, 'group', f.scope_id)))
  or (p_role = 'kindergarten_teacher' and p_scope_type = 'group'
        and has_current_role_scope('group_admin', p_organization_id, 'group', p_scope_id))
) $$;

-- The group a scope belongs to, for the audit event: the group itself, or the family's group.
create or replace function identity_scope_group(p_organization_id uuid, p_scope_type text, p_scope_id uuid)
returns uuid language sql stable security definer set search_path from current
as $$ select case p_scope_type
    when 'group' then p_scope_id
    when 'family' then (select f.scope_id from app_families f where f.id = p_scope_id and f.organization_id = p_organization_id)
    else null end $$;

-- Whether the signed-in account may read an account row: itself, a super admin of its organization, or
-- a group admin when the account holds an active grant in their group (the access table of entities.md).
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
            or (g.scope_type = 'family' and exists (
                  select 1 from app_families f
                   where f.id = g.scope_id and f.organization_id = g.organization_id
                     and has_current_role_scope('group_admin', f.organization_id, 'group', f.scope_id))))))
) $$;

-- Records the denial of an operation: writes the denied audit event and stores the result (U1 pattern).
-- The action is role.grant for an attempt to hand out access through an invitation or a grant.
create or replace function identity_deny(
  p_operation text, p_key text, p_fingerprint text, p_action text, p_target_type text, p_target_id uuid,
  p_organization_id uuid, p_group_id uuid, p_details text
) returns jsonb
language sql security definer set search_path from current
as $$ select platform_finish_operation(p_operation, p_key, p_fingerprint, p_action, p_target_type, p_target_id,
         p_organization_id, p_group_id, 'denied', null, 'authorization_denied', p_details) $$;

-- Row-level security of the identity tables. Every policy requires an active session (BR2.6).
drop policy if exists current_grants_self on app_role_grants;
create policy current_grants_self on app_role_grants for select to authenticated
  using (current_session_is_active() and subject_id = auth.uid() and revoked_at is null);
create policy grants_admin_read on app_role_grants for select to authenticated using (
  has_super_scope(organization_id)
  or (scope_type = 'group' and has_current_role_scope('group_admin', organization_id, 'group', scope_id))
  or (scope_type = 'family' and exists (
        select 1 from app_families f where f.id = app_role_grants.scope_id and has_core_scope(f.organization_id, f.scope_id)))
);
drop policy if exists current_version_self on app_authorization_versions;
create policy current_version_self on app_authorization_versions for select to authenticated
  using (current_session_is_active() and subject_id = auth.uid());

create policy accounts_read on accounts for select to authenticated using (identity_account_visible(id));

create policy invitations_read on invitations for select to authenticated using (
  current_session_is_active()
  and (created_by_account_id = auth.uid()
       or identity_can_manage_scope(organization_id, role, scope_type, scope_id))
);

-- U1's open item is settled here (BR2.15): a super admin reads the audit events of their organization,
-- a group admin the events whose group is their own. There is no write policy.
create policy audit_events_admin_read on audit_events for select to authenticated using (
  has_super_scope(organization_id)
  or (group_id is not null and has_current_role_scope('group_admin', organization_id, 'group', group_id))
);

-- Column rights: the token hash of an invitation is never selectable by an application role.
grant select on accounts to authenticated;
grant select (id, email, role, scope_type, scope_id, organization_id, target_id, status, reserved_at,
              created_by_account_id, created_at, expires_at, accepted_at, accepted_account_id,
              replaces_invitation_id, version, updated_at)
  on invitations to authenticated;
grant select on audit_events to authenticated;

revoke all on function current_session_is_active() from public, anon, authenticated, service_role;
grant execute on function current_session_is_active() to authenticated;
revoke all on function
  identity_actor_organization(),
  identity_can_manage_scope(uuid, text, text, uuid),
  identity_scope_group(uuid, text, uuid),
  identity_account_visible(uuid),
  identity_deny(text, text, text, text, text, uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function identity_account_visible(uuid), identity_can_manage_scope(uuid, text, text, uuid) to authenticated;
