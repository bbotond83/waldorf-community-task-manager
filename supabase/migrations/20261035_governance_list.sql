-- U3 governance list (BR32.10, BR32.6). The governance screen revokes a role grant with the grant's
-- version, which is the authorization version of the grant's account (governance_revoke, 20261030). That
-- version is a row of app_authorization_versions, and its policy lets an account read only its own row, so
-- the screen could list other people's grants but not the version it must send back. This function returns
-- the grants of the organization the roles screen manages (super admin, group admin and teacher grants of
-- active accounts) together with that version, to a super admin only, and nothing else of any account. It
-- sorts just before 20261035_placeholder_drop.sql, which must stay the last U3 file.
--
-- Result: platform_result('success') plus items [{grant_id, subject_id, subject_label (the account's sign-in
-- address, which an admin may already read), role, scope_type, scope_id, scope_label (the group's name, empty
-- for a whole-organization grant), version, is_self}].
create or replace function governance_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if not has_super_scope(v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'grant_id', g.id,
           'subject_id', g.subject_id,
           'subject_label', a.email,
           'role', g.role,
           'scope_type', g.scope_type,
           'scope_id', g.scope_id,
           'scope_label', gr.name,
           'version', coalesce(v.authorization_version, 1),
           'is_self', g.subject_id = auth.uid())
         order by g.role, a.email, g.id), '[]'::jsonb)
    into v_items
    from app_role_grants g
    join accounts a on a.id = g.subject_id and a.status = 'active'
    left join app_authorization_versions v on v.subject_id = g.subject_id
    left join groups gr on g.scope_type = 'group' and gr.id = g.scope_id
   where g.organization_id = v_org and g.revoked_at is null
     and g.role in ('super_admin', 'group_admin', 'kindergarten_teacher');
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

revoke all on function governance_list() from public, anon, authenticated, service_role;
grant execute on function governance_list() to authenticated;
