-- U3 lifecycle of a family that left (BR35.1, BR35.2, NFR1.36, NFR3.10). Super admins only: group admins see
-- and run nothing. A family is a candidate when it is archived (its archived_at is the day it left) and has
-- not been through the lifecycle before. The removed places and closed requests of a family are kept as
-- history and leave only here, with the family (answer Q3): no other function deletes an assignment.

-- Why a family cannot be run yet, as a list of codes: it left less than 30 days ago (grace_period), or an
-- open lifecycle hold of U1 exists on it (hold). Empty when nothing stops it. Internal.
create or replace function lifecycle_blockers(p_family_id uuid) returns jsonb
language sql stable security definer set search_path from current
as $$
  select coalesce(jsonb_agg(blocker order by blocker), '[]'::jsonb) from (
    select 'grace_period' as blocker
      from families f where f.id = p_family_id and f.archived_at > now() - interval '30 days'
    union all
    select 'hold'
     where exists (select 1 from lifecycle_holds h
                    where h.target_type = 'family' and h.target_id = p_family_id and h.released_at is null)
  ) blockers
$$;

-- ---------------------------------------------------------------------------------------------------
-- lifecycle_list: the lifecycle candidates of the organization (W15). Each entry: family id, version, display
-- name, the day it left and its state: eligible-delete (no assignment row of any status), eligible-anonymize
-- (at least one) or blocked (with the blocker codes). The optional filter is one of the three states; an
-- empty list is the empty state. A family restored after leaving is not archived and so not listed.
-- ---------------------------------------------------------------------------------------------------
create or replace function lifecycle_list(p_state text default null) returns jsonb
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
  if p_state is not null and p_state not in ('eligible-delete', 'eligible-anonymize', 'blocked') then
    return platform_result('validation', null, 'filter_invalid');
  end if;
  select coalesce(jsonb_agg(candidate.item order by candidate.left_at, candidate.id), '[]'::jsonb) into v_items
    from (
      select f.id, f.archived_at as left_at,
             jsonb_build_object('family_id', f.id, 'version', f.version, 'display_name', f.display_name,
                                'archived_at', f.archived_at, 'state', c.state, 'blockers', c.blockers) as item,
             c.state
        from families f
        cross join lateral (
          select lifecycle_blockers(f.id) as blockers,
                 case
                   when jsonb_array_length(lifecycle_blockers(f.id)) > 0 then 'blocked'
                   when exists (select 1 from assignments a where a.family_id = f.id) then 'eligible-anonymize'
                   else 'eligible-delete' end as state) c
       where f.organization_id = v_org and f.status = 'archived' and f.anonymized_at is null
    ) candidate
   where p_state is null or candidate.state = p_state;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- lifecycle_run: deletes or anonymizes one candidate (BR35.2). The checks run in this order: a stale
-- version (invalidated LIFECYCLE_STALE), a blocked or not archived family (conflict LIFECYCLE_BLOCKED, with
-- the blocker codes in the result as the deferred note: U1 has no audit action for a deferral), a missing
-- confirmation (conflict LIFECYCLE_CONFIRMATION_REQUIRED). Then, in one transaction:
--   eligible-delete     removes the family, its parents, contacts, children and memberships;
--   eligible-anonymize  deletes the contacts, optional profiles and memberships, empties the contribution
--                       note texts and the request reasons of the family's places, clears the parents'
--                       account links, replaces the family, parent and child names with an anonymous label
--                       and keeps the assignments as history.
-- Both deactivate the parents' sign-in accounts through U2's function, revoke the family's open invitations
-- and write one audit event, lifecycle.delete or lifecycle.anonymize, with the family as target.
-- ---------------------------------------------------------------------------------------------------
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
    update invitations set status = 'revoked'
     where scope_type = 'family' and scope_id = p_family_id and status in ('pending', 'accepting');

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

revoke all on function
  lifecycle_blockers(uuid),
  lifecycle_list(text),
  lifecycle_run(text, uuid, integer, boolean)
  from public, anon, authenticated, service_role;
grant execute on function
  lifecycle_list(text),
  lifecycle_run(text, uuid, integer, boolean)
  to authenticated;
