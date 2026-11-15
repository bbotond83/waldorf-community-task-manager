begin;

-- ---------------------------------------------------------------------------------------------------
-- governance_revoke and the coordinator right (U4, BR41.7). Since 20261051 the general role-change function
-- refuses the group-admin role, so the Settings screen's "revoke" on a group-admin grant would have failed. This
-- redefines governance_revoke (body of 20261030) so that, for a group-admin grant, the revoke runs through
-- coordinator_revoke: the same membership lock, the same audit event (grant:group_admin:revoked), the same notice
-- to the person. Every other role still goes through grant_change exactly as before. The checks that come first
-- (existing grant, reach, stale authorization version, own grant) are unchanged, so a group-admin grant answers
-- them exactly like any other. If the grant has no active membership behind it (the invariant BR41.8 says this
-- cannot happen) the old refusal GRANT_USE_COORDINATOR_ACTION stands and nothing changes.
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
  v_membership group_memberships%rowtype;
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

  if v_grant.role = 'group_admin' then
    select m.* into v_membership
      from group_memberships m join parents p on p.id = m.parent_id
     where p.account_id = v_grant.subject_id and p.organization_id = v_org
       and m.group_id = v_grant.scope_id and m.status = 'active';
    if found then
      -- The coordinator action repeats its own checks; a version or grant that moved since this read is a stale grant.
      v_result := coordinator_revoke(p_idempotency_key, v_membership.id, v_membership.version);
      if v_result->>'state' in ('conflict', 'invalidated')
         and v_result->>'code' in ('VERSION_CONFLICT', 'NOT_COORDINATOR', 'NOT_A_MEMBER') then
        return platform_result('invalidated', null, 'GRANT_STALE');
      end if;
    else
      v_result := grant_change(p_idempotency_key, 'revoke', v_grant.subject_id, v_grant.role, v_grant.scope_type, v_grant.scope_id);
    end if;
  else
    v_result := grant_change(p_idempotency_key, 'revoke', v_grant.subject_id, v_grant.role, v_grant.scope_type, v_grant.scope_id);
  end if;
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

revoke all on function governance_revoke(text, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function governance_revoke(text, uuid, integer) to authenticated;

commit;
