-- U3 kernel use cases, part 1: listing and signing up for tasks, and the admin's assign and remove
-- (BR31.2, BR31.3, BR31.7, BR31.9, BR31.11, BR32.6). They follow the pattern of the files before: active
-- session, idempotency check, authorization, change in one block that a business refusal rolls back, then
-- the stored result. Only a success is stored under the idempotency key. None of these writes an audit
-- event (U1 BR3.2). A parent's family is always found from the session's account (BR32.2).
--
-- Lock order (NFR3.8): every function that changes places takes the task row (or the task rows, in
-- ascending id order) before any assignment row, so no two of them can wait for each other.

-- The view of one task for one family (BR31.11): title, due time, location, the task version, the family's
-- own place with its version, and the state. It deliberately holds no counts: how many places are taken is
-- other families' information. Internal: the use cases below call it.
create or replace function coordination_duty_view(p_task_id uuid, p_family_id uuid) returns jsonb
language sql stable security definer set search_path from current
as $$
  select jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'due_at', t.starts_at,
      'location', t.location,
      'version', t.version,
      'signup_open', (t.status = 'open' and t.starts_at > now()),
      'state', case
        when own.id is not null then
          case own.status when 'swap_pending' then 'swap-pending'
                          when 'cancellation_pending' then 'cancellation-pending'
                          else 'assigned' end
        when not exists (select 1 from group_memberships m
                          where m.family_id = p_family_id and m.group_id = t.group_id and m.status = 'active')
          then 'ineligible'
        when (select count(*) from assignments a where a.task_id = t.id and a.status <> 'removed') >= t.capacity
          then 'full'
        else 'available' end,
      'assignment_id', own.id,
      'assignment_version', own.version)
    from tasks t
    left join lateral (
      select a.id, a.status, a.version from assignments a
       where a.task_id = t.id and a.family_id = p_family_id and a.status <> 'removed') own on true
   where t.id = p_task_id
$$;

-- ---------------------------------------------------------------------------------------------------
-- duty_list: the signed-in parent's task list (W5). The tasks of the groups the family is an active member
-- of, plus the tasks the family holds a place on; cancelled tasks are left out. An empty list is the empty
-- state. An account without a linked parent, or with an archived family, is denied with no_family.
-- ---------------------------------------------------------------------------------------------------
create or replace function duty_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_family uuid;
  v_org uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_family := directory_actor_family();
  if v_family is null then
    return platform_result('denied', null, 'no_family');
  end if;
  select f.organization_id into v_org from families f where f.id = v_family;
  select coalesce(jsonb_agg(coordination_duty_view(visible.id, v_family) order by visible.starts_at, visible.id), '[]'::jsonb)
    into v_items
    from (select t.id, t.starts_at
            from tasks t
           where t.organization_id = v_org and t.status <> 'cancelled'
             and (exists (select 1 from assignments a
                           where a.task_id = t.id and a.family_id = v_family and a.status <> 'removed')
                  or exists (select 1 from group_memberships m join groups g on g.id = m.group_id
                              where m.family_id = v_family and m.group_id = t.group_id
                                and m.status = 'active' and g.status = 'active'))) visible;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- duty_get: one task for the signed-in parent. A task that does not exist, belongs to another
-- organization or is cancelled is "not found". A task of a group the family is not in is returned with the
-- state ineligible. The allergen note of the task's event is returned only to a family that holds a place
-- on the task and to an admin who reaches the task's group (BR31.9); the family's own contribution note
-- only to the family (BR31.8).
-- ---------------------------------------------------------------------------------------------------
create or replace function duty_get(p_task_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_family uuid;
  v_org uuid;
  v_task tasks%rowtype;
  v_view jsonb;
  v_allergen text;
  v_note text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_family := directory_actor_family();
  if v_family is null then
    return platform_result('denied', null, 'no_family');
  end if;
  select f.organization_id into v_org from families f where f.id = v_family;
  select * into v_task from tasks t where t.id = p_task_id and t.organization_id = v_org and t.status <> 'cancelled';
  if not found then
    return platform_result('validation', null, 'duty_not_found');
  end if;
  v_view := coordination_duty_view(v_task.id, v_family);
  if v_task.event_id is not null
     and (v_view->>'assignment_id' is not null or has_core_scope(v_org, v_task.group_id)) then
    select e.allergen_note into v_allergen from events e where e.id = v_task.event_id;
  end if;
  if v_view->>'assignment_id' is not null then
    select n.text into v_note from contribution_notes n where n.assignment_id = (v_view->>'assignment_id')::uuid;
  end if;
  return platform_result('success', v_task.id, null)
    || jsonb_build_object('item', v_view || jsonb_build_object(
         'allergen_note', v_allergen, 'own_contribution_note', v_note));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- duty_sign_up: a parent signs their family up for a task (W6). The task row is locked first, then the
-- checks run in the fixed order of BR31.2 and the first failure is the result:
--   version differs                      invalidated  DUTY_VERSION_STALE
--   task not open, or already started    conflict     DUTY_CLOSED
--   family already holds a place         conflict     DUTY_ALREADY_ASSIGNED
--   no active membership in the group    conflict     DUTY_INELIGIBLE
--   places taken at capacity             conflict     DUTY_FULL
-- On success the assignment is created (source parent_sign_up) and the task version rises by one. The
-- unique index on family and task is the last word against a double click.
-- ---------------------------------------------------------------------------------------------------
create or replace function duty_sign_up(p_idempotency_key text, p_task_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'duty.sign_up';
  v_family uuid;
  v_org uuid;
  v_parent uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_task tasks%rowtype;
  v_assignment assignments%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_task_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_family := directory_actor_family();
    if v_family is null then
      perform platform_abort('denied', 'no_family');
    end if;
    if p_task_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    -- The family row is held for share while the place is taken, so an archive of the family (which takes
    -- the row for update, family before tasks) either completes first, and the sign-up finds no active
    -- family, or waits for this one. The family comes before the task in the lock order.
    select f.organization_id into v_org from families f
     where f.id = v_family and f.status = 'active' for share;
    if not found then
      perform platform_abort('denied', 'no_family');
    end if;
    select p.id into v_parent from parents p
     where p.account_id = auth.uid() and p.family_id = v_family and p.status = 'active';

    -- The task row first: two parents racing for the last place are serialised here (BR31.3). A task of
    -- another organization answers exactly like a missing one.
    select * into v_task from tasks where id = p_task_id and organization_id = v_org for update;
    if not found then
      perform platform_abort('validation', 'duty_not_found');
    end if;
    if v_task.version <> p_expected_version then
      perform platform_abort('invalidated', 'DUTY_VERSION_STALE');
    end if;
    if v_task.status <> 'open' or v_task.starts_at <= now() then
      perform platform_abort('conflict', 'DUTY_CLOSED');
    end if;
    if exists (select 1 from assignments a where a.task_id = v_task.id and a.family_id = v_family and a.status <> 'removed') then
      perform platform_abort('conflict', 'DUTY_ALREADY_ASSIGNED');
    end if;
    if not exists (select 1 from group_memberships m
                    where m.family_id = v_family and m.group_id = v_task.group_id and m.status = 'active') then
      perform platform_abort('conflict', 'DUTY_INELIGIBLE');
    end if;
    if (select count(*) from assignments a where a.task_id = v_task.id and a.status <> 'removed') >= v_task.capacity then
      perform platform_abort('conflict', 'DUTY_FULL');
    end if;

    insert into assignments (organization_id, task_id, family_id, parent_id, source)
    values (v_org, v_task.id, v_family, v_parent, 'parent_sign_up')
    returning * into v_assignment;
    update tasks set updated_at = now() where id = v_task.id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_assignment.id);
    return platform_result('success', v_assignment.id, null)
      || jsonb_build_object('version', v_assignment.version, 'task_version', v_task.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- assignment_assign: an admin who reaches the task's group gives a place to a chosen family (BR31.7). The
-- same checks as the sign-up, in the same order, without the start time: version (conflict
-- VERSION_CONFLICT), a cancelled task, an existing place (DUTY_ALREADY_ASSIGNED), eligibility
-- (ASSIGNMENT_INELIGIBLE), capacity (ASSIGNMENT_CAPACITY_FULL). There is no override. The assignment gets
-- the source admin_assign and no parent.
-- ---------------------------------------------------------------------------------------------------
create or replace function assignment_assign(
  p_idempotency_key text, p_task_id uuid, p_family_id uuid, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'assignment.assign';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_task tasks%rowtype;
  v_family_status text;
  v_assignment assignments%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_task_id::text, p_family_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_task_id is null or p_family_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    -- The family before the task, held for share (see duty_sign_up). A family of another organization
    -- answers exactly like a missing one; the reach check follows once the task is known.
    select f.status into v_family_status from families f
     where f.id = p_family_id and f.organization_id = v_org for share;
    if not found then
      perform platform_field_invalid('family_id', 'not_found');
    end if;
    select * into v_task from tasks where id = p_task_id and organization_id = v_org for update;
    if not found then
      perform platform_field_invalid('task_id', 'not_found');
    end if;
    if not has_core_scope(v_org, v_task.group_id) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_family_status = 'archived' then
      perform platform_field_invalid('family_id', 'archived');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_task.version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_task.status = 'cancelled' then
      perform platform_field_invalid('task_id', 'cancelled');
    end if;
    if exists (select 1 from assignments a where a.task_id = v_task.id and a.family_id = p_family_id and a.status <> 'removed') then
      perform platform_abort('conflict', 'DUTY_ALREADY_ASSIGNED');
    end if;
    if not exists (select 1 from group_memberships m
                    where m.family_id = p_family_id and m.group_id = v_task.group_id and m.status = 'active') then
      perform platform_abort('conflict', 'ASSIGNMENT_INELIGIBLE');
    end if;
    if (select count(*) from assignments a where a.task_id = v_task.id and a.status <> 'removed') >= v_task.capacity then
      perform platform_abort('conflict', 'ASSIGNMENT_CAPACITY_FULL');
    end if;

    insert into assignments (organization_id, task_id, family_id, source)
    values (v_org, v_task.id, p_family_id, 'admin_assign')
    returning * into v_assignment;
    update tasks set updated_at = now() where id = v_task.id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_assignment.id);
    return platform_result('success', v_assignment.id, null)
      || jsonb_build_object('version', v_assignment.version, 'task_version', v_task.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- assignment_remove: an admin who reaches the task's group removes a place (BR31.7). The place becomes
-- removed and is free again, the open requests that involve it are withdrawn (the other family's source
-- place returns to active) and the task version rises. A stale or already removed place gives
-- VERSION_CONFLICT. The task is locked before the assignment.
-- ---------------------------------------------------------------------------------------------------
create or replace function assignment_remove(p_idempotency_key text, p_assignment_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'assignment.remove';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_task_id uuid;
  v_task tasks%rowtype;
  v_assignment assignments%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_assignment_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_assignment_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select a.task_id into v_task_id from assignments a where a.id = p_assignment_id and a.organization_id = v_org;
    if not found then
      perform platform_field_invalid('assignment_id', 'not_found');
    end if;
    select * into v_task from tasks where id = v_task_id for update;
    if not has_core_scope(v_org, v_task.group_id) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_assignment from assignments where id = p_assignment_id for update;
    if v_assignment.task_id <> v_task_id then
      -- The place moved to another task between the first read and the lock (a swap): ask again.
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_assignment.version <> p_expected_version or v_assignment.status = 'removed' then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;

    update assignments set status = 'removed' where id = v_assignment.id;
    perform coordination_withdraw_requests(array[v_assignment.id]);
    update tasks set updated_at = now() where id = v_task.id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_assignment.id);
    return platform_result('success', v_assignment.id, null)
      || jsonb_build_object('version', v_assignment.version + 1, 'task_version', v_task.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

revoke all on function
  coordination_duty_view(uuid, uuid),
  duty_list(),
  duty_get(uuid),
  duty_sign_up(text, uuid, integer),
  assignment_assign(text, uuid, uuid, integer),
  assignment_remove(text, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function
  duty_list(),
  duty_get(uuid),
  duty_sign_up(text, uuid, integer),
  assignment_assign(text, uuid, uuid, integer),
  assignment_remove(text, uuid, integer)
  to authenticated;
