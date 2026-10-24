-- U3 repair of the lifecycle (BR35.2, NFR1.36): nothing personal may remain in the data of a family that
-- left. The first version (20261032) only marked the family's open invitations revoked, so the e-mail
-- address of every invitation, and the link to the parent it was meant for, stayed behind, and an accepted
-- invitation was not touched at all. Now every invitation of the family is deleted, whatever its status:
--   those whose scope is the family (role parent, scope_type family), and
--   those whose target is one of the family's parents.
-- A pending or accepting invitation therefore no longer exists either, so its link can no longer be used (the
-- acceptance looks the invitation up by its token hash and finds nothing). The only column that points at an
-- invitation is replaces_invitation_id (on delete set null), so the deletion blocks nothing.
--
-- Deliberately kept: the sign-in accounts of the parents (U2's accounts table and the sign-in service's user
-- keep the e-mail address). U2 deactivates an account and never deletes one (BR2.x); the deactivation below
-- ends the sign-in. This is the one documented exception to "nothing personal remains" and is recorded in
-- code-summary.md. Audit events hold no personal text (ids only).
--
-- The rest of the function is the body of 20261032, unchanged: only the statement that revoked the
-- invitations is replaced. The name sorts between 20261035_governance_list and 20261035_placeholder_drop, so
-- the placeholder drop stays the last file.

create or replace function lifecycle_run(
  p_idempotency_key text, p_family_id uuid, p_expected_version integer, p_confirmed boolean
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'lifecycle.run';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_family families%rowtype;
  v_blockers jsonb;
  v_has_assignments boolean;
  v_account uuid;
  v_result jsonb;
  v_audit uuid;
  v_outcome text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 150 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_family_id::text, p_expected_version::text, p_confirmed::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not has_super_scope(v_org) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_family_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_family from families where id = p_family_id and organization_id = v_org for update;
    if not found then
      perform platform_abort('validation', 'family_not_found');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_family.version <> p_expected_version then
      perform platform_abort('invalidated', 'LIFECYCLE_STALE');
    end if;
    v_blockers := lifecycle_blockers(p_family_id);
    if v_family.status <> 'archived' then
      v_blockers := v_blockers || '["not_archived"]'::jsonb;
    elsif v_family.anonymized_at is not null then
      v_blockers := v_blockers || '["already_anonymized"]'::jsonb;
    end if;
    if jsonb_array_length(v_blockers) > 0 then
      perform platform_abort('conflict', 'LIFECYCLE_BLOCKED',
        jsonb_build_object('deferred', true, 'blockers', v_blockers));
    end if;
    if p_confirmed is distinct from true then
      perform platform_abort('conflict', 'LIFECYCLE_CONFIRMATION_REQUIRED');
    end if;

    v_has_assignments := exists (select 1 from assignments a where a.family_id = p_family_id);

    -- The parents' sign-in accounts are deactivated through U2's function (a super admin action). An
    -- account that is already deactivated is fine; any other refusal stops the whole run.
    for v_account in
      select p.account_id from parents p where p.family_id = p_family_id and p.account_id is not null order by p.account_id
    loop
      v_result := identity_set_account_status(
        left(p_idempotency_key, 100) || ':deactivate:' || v_account::text, v_account, 'deactivated');
      if v_result->>'state' <> 'success' and v_result->>'code' <> 'account_status_unchanged' then
        perform platform_abort('conflict', 'LIFECYCLE_BLOCKED',
          jsonb_build_object('deferred', true, 'blockers', jsonb_build_array('account_' || coalesce(v_result->>'code', 'refused'))));
      end if;
    end loop;

    -- Every invitation of the family goes, whatever its status (see the head of this file).
    delete from invitations i
     where (i.scope_type = 'family' and i.scope_id = p_family_id)
        or i.target_id in (select p.id from parents p where p.family_id = p_family_id);

    delete from parent_contacts where parent_id in (select p.id from parents p where p.family_id = p_family_id);
    delete from group_memberships where family_id = p_family_id;
    if v_has_assignments then
      update contribution_notes set text = ''
       where assignment_id in (select a.id from assignments a where a.family_id = p_family_id);
      update change_requests set reason = null
       where assignment_id in (select a.id from assignments a where a.family_id = p_family_id);
      update parents set optional_profile = null, optional_profile_consent = false, account_id = null,
                         display_name = 'Anonimizált szülő'
       where family_id = p_family_id;
      update children set display_name = 'Anonimizált gyermek' where family_id = p_family_id;
      update families set display_name = 'Anonimizált család', anonymized_at = now() where id = p_family_id;
      v_outcome := 'anonymized';
      v_audit := platform_audit_write('lifecycle.anonymize', 'family', p_family_id, v_org, null, 'success', 'family');
    else
      delete from parents where family_id = p_family_id;
      delete from children where family_id = p_family_id;
      delete from families where id = p_family_id;
      v_outcome := 'deleted';
      v_audit := platform_audit_write('lifecycle.delete', 'family', p_family_id, v_org, null, 'success', 'family');
    end if;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_family_id);
    return platform_result('success', p_family_id, null)
      || jsonb_build_object('outcome', v_outcome, 'audit_event_id', v_audit);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- create or replace keeps the grants of 20261032; stated again so this file stands on its own.
revoke all on function lifecycle_run(text, uuid, integer, boolean) from public, anon, authenticated, service_role;
grant execute on function lifecycle_run(text, uuid, integer, boolean) to authenticated;
