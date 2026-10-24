-- U3 kernel use cases, part 2: swaps and cancellations (BR31.4, BR31.5, BR31.6, BR32.6, NFR1.33, NFR3.8).
-- Same pattern as 20261028_kernel_signup.sql: active session, idempotency check, authorization, change in
-- one block that a business refusal rolls back, then the stored result (only a success is stored).
-- A swap exchanges the tasks of two assignments and an approval or rejection writes one audit event
-- (approval.approve or approval.reject, U1 BR3.2) in the same transaction; nothing else here is audited.
--
-- Lock order (NFR3.8): the task rows first, in ascending id order, then the assignment rows, in ascending
-- id order. Every writer that touches several tasks or assignments takes them this way.
--
-- The capacity trigger of 20261026 fired for every update of an assignment's task or status and locks the
-- task row when the transaction ends. A withdrawn request returns another family's place to active, which
-- changes no count, yet it made the committing transaction lock that family's task out of order and two
-- transactions could deadlock at commit (found by the concurrent-decision test). The check only matters
-- when a count can grow: a new assignment, an assignment moved to another task, or one that comes back from
-- removed. The trigger is replaced by two that fire for exactly those cases.
drop trigger assignments_capacity on assignments;
create constraint trigger assignments_capacity_insert after insert on assignments
  deferrable initially deferred for each row execute function assignments_check_capacity();
create constraint trigger assignments_capacity_update after update of task_id, status on assignments
  deferrable initially deferred for each row
  when (old.status = 'removed' or new.task_id is distinct from old.task_id)
  execute function assignments_check_capacity();

-- Locks the assignments and their tasks in the fixed order and returns once the tasks that were locked are
-- the tasks the assignments are on now (a swap may move an assignment between the first read and the lock).
-- Internal.
create or replace function coordination_lock_assignments(p_assignment_ids uuid[]) returns void
language plpgsql set search_path from current
as $$
declare
  v_tasks uuid[];
  v_now uuid[];
  v_try integer := 0;
begin
  loop
    v_try := v_try + 1;
    select coalesce(array_agg(distinct a.task_id order by a.task_id), '{}') into v_tasks
      from assignments a where a.id = any (p_assignment_ids);
    perform 1 from tasks t where t.id = any (v_tasks) order by t.id for update;
    perform 1 from assignments a where a.id = any (p_assignment_ids) order by a.id for update;
    select coalesce(array_agg(distinct a.task_id order by a.task_id), '{}') into v_now
      from assignments a where a.id = any (p_assignment_ids);
    if v_now = v_tasks then
      return;
    end if;
    if v_try >= 5 then
      raise exception 'coordination: the assignments keep moving between tasks' using errcode = '40001';
    end if;
  end loop;
end $$;

-- Returns an assignment to active when a request on it ends without effect (a source in swap_pending or
-- cancellation_pending). Internal.
create or replace function coordination_release_source(p_assignment_id uuid) returns void
language sql set search_path from current
as $$ update assignments set status = 'active'
       where id = p_assignment_id and status in ('swap_pending', 'cancellation_pending') $$;

-- Whether two assignments can be exchanged now (BR31.4), as the code of the first rule that fails, or null.
-- The assignments and both tasks are locked by the caller. The two families are different and active, the
-- tasks differ, belong to the same group, are not cancelled and have not started (the target task is open),
-- neither family already holds a place on the other task, and both families are active members of the group.
create or replace function coordination_swap_check(p_source_id uuid, p_target_id uuid) returns text
language plpgsql stable set search_path from current
as $$
declare
  v_src assignments%rowtype;
  v_tgt assignments%rowtype;
  v_src_task tasks%rowtype;
  v_tgt_task tasks%rowtype;
begin
  select * into v_src from assignments where id = p_source_id;
  select * into v_tgt from assignments where id = p_target_id;
  select * into v_src_task from tasks where id = v_src.task_id;
  select * into v_tgt_task from tasks where id = v_tgt.task_id;
  if v_src.family_id = v_tgt.family_id or v_src.task_id = v_tgt.task_id
     or v_src_task.group_id <> v_tgt_task.group_id or v_src.organization_id <> v_tgt.organization_id
     or exists (select 1 from families f where f.id in (v_src.family_id, v_tgt.family_id) and f.status <> 'active') then
    return 'REQUEST_CONFLICT';
  end if;
  if v_src_task.status = 'cancelled' or v_tgt_task.status <> 'open'
     or v_src_task.starts_at <= now() or v_tgt_task.starts_at <= now() then
    return 'DUTY_CLOSED';
  end if;
  if exists (select 1 from assignments a
              where a.status <> 'removed'
                and ((a.family_id = v_src.family_id and a.task_id = v_tgt.task_id)
                  or (a.family_id = v_tgt.family_id and a.task_id = v_src.task_id))) then
    return 'DUTY_ALREADY_ASSIGNED';
  end if;
  if (select count(*) from group_memberships m
       where m.group_id = v_tgt_task.group_id and m.status = 'active'
         and m.family_id in (v_src.family_id, v_tgt.family_id)) < 2 then
    return 'DUTY_INELIGIBLE';
  end if;
  return null;
end $$;

-- Runs the exchange of an open swap request (confirmation or admin approval): the two assignments swap
-- their tasks, the source returns to active, the request gets its final status, every other open request
-- that involves either assignment is withdrawn (so one assignment cannot be exchanged twice) and both task
-- versions rise. Everything is locked by the caller. Internal.
create or replace function coordination_swap_exchange(p_request_id uuid, p_status text, p_decided_by uuid) returns void
language plpgsql set search_path from current
as $$
declare
  v_req change_requests%rowtype;
  v_src assignments%rowtype;
  v_tgt assignments%rowtype;
begin
  select * into v_req from change_requests where id = p_request_id;
  select * into v_src from assignments where id = v_req.assignment_id;
  select * into v_tgt from assignments where id = v_req.target_assignment_id;
  update assignments set task_id = v_tgt.task_id, status = 'active' where id = v_src.id;
  update assignments set task_id = v_src.task_id where id = v_tgt.id;
  update change_requests
     set status = p_status, target_confirmed = true, decided_by_account_id = p_decided_by,
         decided_at = case when p_decided_by is null then null else now() end
   where id = v_req.id;
  perform coordination_withdraw_requests(array[v_src.id, v_tgt.id]);
  update tasks set updated_at = now() where id in (v_src.task_id, v_tgt.task_id);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- swap_candidates: the partners a parent may choose for one of their own assignments (W7): the other
-- families' active assignments on other open, not-started tasks of the same group, that could be exchanged.
-- Each entry shows the task title, its start and the family's display name; the ids are only what the
-- request needs to name the choice. Nothing else of the other family.
-- ---------------------------------------------------------------------------------------------------
create or replace function swap_candidates(p_assignment_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_family uuid;
  v_org uuid;
  v_src assignments%rowtype;
  v_task tasks%rowtype;
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
  select * into v_src from assignments a where a.id = p_assignment_id and a.organization_id = v_org;
  if not found then
    return platform_result('validation', null, 'assignment_not_found');
  end if;
  if v_src.family_id <> v_family then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_task from tasks t where t.id = v_src.task_id;
  if v_src.status <> 'active' then
    return platform_result('conflict', null, 'REQUEST_DUPLICATE');
  end if;
  if v_task.status = 'cancelled' or v_task.starts_at <= now() then
    return platform_result('conflict', null, 'DUTY_CLOSED');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'assignment_id', ta.id, 'assignment_version', ta.version, 'task_id', tt.id,
           'title', tt.title, 'starts_at', tt.starts_at, 'family_display_name', f.display_name)
         order by tt.starts_at, ta.id), '[]'::jsonb)
    into v_items
    from assignments ta
    join tasks tt on tt.id = ta.task_id
    join families f on f.id = ta.family_id
   where ta.organization_id = v_org and ta.status = 'active' and ta.family_id <> v_family and f.status = 'active'
     and tt.group_id = v_task.group_id and tt.id <> v_task.id and tt.status = 'open' and tt.starts_at > now()
     and not exists (select 1 from assignments x
                      where x.family_id = v_family and x.task_id = tt.id and x.status <> 'removed')
     and not exists (select 1 from assignments y
                      where y.family_id = ta.family_id and y.task_id = v_task.id and y.status <> 'removed')
     and (select count(*) from group_memberships m
           where m.group_id = tt.group_id and m.status = 'active'
             and m.family_id in (v_family, ta.family_id)) = 2;
  return platform_result('success', v_src.id, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- swap_request: a parent asks to swap their own assignment with another family's (W7). Both tasks are
-- locked (ascending id), then: not the family's own source assignment (denied), the same family or an
-- assignment that is not active (REQUEST_CONFLICT), an open request on the source (REQUEST_DUPLICATE), a
-- stale version of either assignment (invalidated REQUEST_VERSION_STALE), then the checks of
-- coordination_swap_check (DUTY_CLOSED, DUTY_ALREADY_ASSIGNED, DUTY_INELIGIBLE, REQUEST_CONFLICT). On
-- success the request is stored with the requester confirmed and the source becomes swap_pending; the new
-- source version and both task ids and the target version are stored on the request.
-- ---------------------------------------------------------------------------------------------------
create or replace function swap_request(
  p_idempotency_key text, p_assignment_id uuid, p_expected_version integer,
  p_target_assignment_id uuid, p_target_version integer, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'swap.request';
  v_family uuid;
  v_org uuid;
  v_parent uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_src assignments%rowtype;
  v_tgt assignments%rowtype;
  v_code text;
  v_reason text;
  v_id uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_assignment_id::text, p_expected_version::text,
    p_target_assignment_id::text, p_target_version::text, p_reason), 'UTF8')), 'hex');
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
    if p_assignment_id is null or p_target_assignment_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_target_version is null then
      perform platform_field_invalid('target_version');
    end if;
    v_reason := nullif(btrim(coalesce(p_reason, '')), '');
    if char_length(v_reason) > 500 then
      perform platform_field_invalid('reason');
    end if;
    select f.organization_id into v_org from families f where f.id = v_family;
    select p.id into v_parent from parents p
     where p.account_id = auth.uid() and p.family_id = v_family and p.status = 'active';
    -- Missing and other organizations' assignments answer alike.
    if (select count(*) from assignments a
         where a.id in (p_assignment_id, p_target_assignment_id) and a.organization_id = v_org) <> 2
       or p_assignment_id = p_target_assignment_id then
      perform platform_abort('validation', 'assignment_not_found');
    end if;
    perform coordination_lock_assignments(array[p_assignment_id, p_target_assignment_id]);
    select * into v_src from assignments where id = p_assignment_id;
    select * into v_tgt from assignments where id = p_target_assignment_id;

    if v_src.family_id <> v_family then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_tgt.family_id = v_family then
      perform platform_abort('conflict', 'REQUEST_CONFLICT');
    end if;
    if exists (select 1 from change_requests r where r.assignment_id = v_src.id and r.status = 'open') then
      perform platform_abort('conflict', 'REQUEST_DUPLICATE');
    end if;
    if v_src.version <> p_expected_version or v_tgt.version <> p_target_version then
      perform platform_abort('invalidated', 'REQUEST_VERSION_STALE');
    end if;
    if v_src.status <> 'active' or v_tgt.status <> 'active' then
      perform platform_abort('conflict', 'REQUEST_CONFLICT');
    end if;
    v_code := coordination_swap_check(v_src.id, v_tgt.id);
    if v_code is not null then
      perform platform_abort('conflict', v_code);
    end if;

    insert into change_requests (organization_id, assignment_id, target_assignment_id, kind, requested_by_parent_id,
                                 source_task_id, source_assignment_version, target_task_id, target_assignment_version,
                                 reason, source_confirmed, target_confirmed)
    values (v_org, v_src.id, v_tgt.id, 'swap', v_parent, v_src.task_id, v_src.version + 1, v_tgt.task_id,
            v_tgt.version, v_reason, true, false)
    returning id into v_id;
    update assignments set status = 'swap_pending' where id = v_src.id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object('assignment_version', v_src.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- swap_respond: the family that received a swap request confirms or declines it (W7). Only a parent of the
-- target assignment's family may answer. A request that is no longer open gives SWAP_REQUEST_NOT_OPEN
-- (conflict). Declining withdraws the request and returns the source to active. Confirming repeats every
-- check under the locks, comparing the stored task ids and assignment versions with the current ones; a
-- mismatch or a failed check gives SWAP_CANNOT_BE_APPLIED (conflict) and the request stays open for the
-- admin or the requester. Otherwise the exchange runs with no admin (answer Q1).
-- ---------------------------------------------------------------------------------------------------
create or replace function swap_respond(
  p_idempotency_key text, p_request_id uuid, p_accept boolean, p_expected_version integer default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'swap.respond';
  v_family uuid;
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_req change_requests%rowtype;
  v_src assignments%rowtype;
  v_tgt assignments%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_request_id::text, p_accept::text, p_expected_version::text), 'UTF8')), 'hex');
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
    if p_request_id is null or p_accept is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select f.organization_id into v_org from families f where f.id = v_family;
    select * into v_req from change_requests r
     where r.id = p_request_id and r.organization_id = v_org and r.kind = 'swap';
    if not found then
      perform platform_abort('validation', 'request_not_found');
    end if;
    -- Only the family of the target assignment may answer: not the requester, not anyone else.
    if not exists (select 1 from assignments a where a.id = v_req.target_assignment_id and a.family_id = v_family) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform coordination_lock_assignments(array[v_req.assignment_id, v_req.target_assignment_id]);
    select * into v_req from change_requests where id = p_request_id for update;
    if v_req.status <> 'open' then
      perform platform_abort('conflict', 'SWAP_REQUEST_NOT_OPEN');
    end if;
    if p_expected_version is not null and p_expected_version <> v_req.version then
      perform platform_abort('invalidated', 'REQUEST_VERSION_STALE');
    end if;

    if not p_accept then
      update change_requests set status = 'withdrawn', target_confirmed = false where id = v_req.id;
      perform coordination_release_source(v_req.assignment_id);
    else
      select * into v_src from assignments where id = v_req.assignment_id;
      select * into v_tgt from assignments where id = v_req.target_assignment_id;
      if v_src.task_id <> v_req.source_task_id or v_tgt.task_id <> v_req.target_task_id
         or v_src.version <> v_req.source_assignment_version or v_tgt.version <> v_req.target_assignment_version
         or v_src.status <> 'swap_pending' or v_tgt.status <> 'active'
         or coordination_swap_check(v_src.id, v_tgt.id) is not null then
        perform platform_abort('conflict', 'SWAP_CANNOT_BE_APPLIED');
      end if;
      perform coordination_swap_exchange(v_req.id, 'applied', null);
    end if;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_req.id);
    return platform_result('success', v_req.id, null)
      || jsonb_build_object('outcome', case when p_accept then 'applied' else 'declined' end);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- swap_incoming: the open requests of the signed-in parent's family, both the swap requests addressed to it
-- (direction incoming) and the family's own open swap and cancellation requests (direction outgoing), each
-- with its kind, the family's own task and, for a swap, the other family's display name and task.
-- ---------------------------------------------------------------------------------------------------
create or replace function swap_incoming() returns jsonb
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
  select coalesce(jsonb_agg(row_item order by sort_time, sort_id), '[]'::jsonb) into v_items
    from (
      select r.created_at as sort_time, r.id as sort_id,
             jsonb_build_object(
               'request_id', r.id, 'kind', r.kind, 'version', r.version,
               'direction', case when sa.family_id = v_family then 'outgoing' else 'incoming' end,
               'own_task_title', case when sa.family_id = v_family then st.title else tt.title end,
               'own_task_starts_at', case when sa.family_id = v_family then st.starts_at else tt.starts_at end,
               'partner_task_title', case when sa.family_id = v_family then tt.title else st.title end,
               'partner_task_starts_at', case when sa.family_id = v_family then tt.starts_at else st.starts_at end,
               'partner_family_name', case when sa.family_id = v_family then tf.display_name else sf.display_name end
             ) as row_item
        from change_requests r
        join assignments sa on sa.id = r.assignment_id
        join tasks st on st.id = sa.task_id
        join families sf on sf.id = sa.family_id
        left join assignments ta on ta.id = r.target_assignment_id
        left join tasks tt on tt.id = ta.task_id
        left join families tf on tf.id = ta.family_id
       where r.organization_id = v_org and r.status = 'open'
         and (sa.family_id = v_family or (r.kind = 'swap' and ta.family_id = v_family))
    ) listed;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- swap_withdraw: the requester's family withdraws its own open request, swap or cancellation (BR31.4). The
-- request becomes withdrawn and the source returns to active. A request that is not open any more gives
-- SWAP_REQUEST_NOT_OPEN.
-- ---------------------------------------------------------------------------------------------------
create or replace function swap_withdraw(p_idempotency_key text, p_request_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'swap.withdraw';
  v_family uuid;
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_req change_requests%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(coalesce(p_request_id::text, ''), 'UTF8')), 'hex');
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
    if p_request_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select f.organization_id into v_org from families f where f.id = v_family;
    select * into v_req from change_requests r where r.id = p_request_id and r.organization_id = v_org;
    if not found then
      perform platform_abort('validation', 'request_not_found');
    end if;
    if not exists (select 1 from assignments a where a.id = v_req.assignment_id and a.family_id = v_family) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform coordination_lock_assignments(
      array_remove(array[v_req.assignment_id, v_req.target_assignment_id], null));
    select * into v_req from change_requests where id = p_request_id for update;
    if v_req.status <> 'open' then
      perform platform_abort('conflict', 'SWAP_REQUEST_NOT_OPEN');
    end if;
    update change_requests set status = 'withdrawn' where id = v_req.id;
    perform coordination_release_source(v_req.assignment_id);

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_req.id);
    return platform_result('success', v_req.id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- cancellation_request: a parent asks to cancel their own assignment until the task starts (W8, answer Q3).
-- An assignment of another family is denied. An open request on the assignment gives REQUEST_DUPLICATE (a
-- repeat), a stale version REQUEST_VERSION_STALE, an assignment that is not active REQUEST_CONFLICT and a
-- task that has started DUTY_CLOSED. On success the request is stored and the assignment becomes
-- cancellation_pending; the place stays taken until an admin decides.
-- ---------------------------------------------------------------------------------------------------
create or replace function cancellation_request(
  p_idempotency_key text, p_assignment_id uuid, p_expected_version integer, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'cancellation.request';
  v_family uuid;
  v_org uuid;
  v_parent uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_asg assignments%rowtype;
  v_task tasks%rowtype;
  v_reason text;
  v_id uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_assignment_id::text, p_expected_version::text, p_reason), 'UTF8')), 'hex');
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
    if p_assignment_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    v_reason := nullif(btrim(coalesce(p_reason, '')), '');
    if char_length(v_reason) > 500 then
      perform platform_field_invalid('reason');
    end if;
    select f.organization_id into v_org from families f where f.id = v_family;
    select p.id into v_parent from parents p
     where p.account_id = auth.uid() and p.family_id = v_family and p.status = 'active';
    perform 1 from assignments a where a.id = p_assignment_id and a.organization_id = v_org;
    if not found then
      perform platform_abort('validation', 'assignment_not_found');
    end if;
    perform coordination_lock_assignments(array[p_assignment_id]);
    select * into v_asg from assignments where id = p_assignment_id;
    if v_asg.family_id <> v_family then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if exists (select 1 from change_requests r where r.assignment_id = v_asg.id and r.status = 'open') then
      perform platform_abort('conflict', 'REQUEST_DUPLICATE');
    end if;
    if v_asg.version <> p_expected_version then
      perform platform_abort('invalidated', 'REQUEST_VERSION_STALE');
    end if;
    if v_asg.status <> 'active' then
      perform platform_abort('conflict', 'REQUEST_CONFLICT');
    end if;
    select * into v_task from tasks where id = v_asg.task_id;
    if v_task.status = 'cancelled' or v_task.starts_at <= now() then
      perform platform_abort('conflict', 'DUTY_CLOSED');
    end if;

    insert into change_requests (organization_id, assignment_id, kind, requested_by_parent_id, source_task_id,
                                 source_assignment_version, reason)
    values (v_org, v_asg.id, 'cancellation', v_parent, v_asg.task_id, v_asg.version + 1, v_reason)
    returning id into v_id;
    update assignments set status = 'cancellation_pending' where id = v_asg.id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object('assignment_version', v_asg.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- The admin's decision on a request (BR31.5): the shared body of swap_decide and cancellation_decide.
-- The actor must reach the group of the source assignment's task. A request that is not open gives
-- APPROVAL_ALREADY_DECIDED (conflict); a request whose stored task ids or assignment versions (or its own
-- version, when sent) no longer match gives APPROVAL_INVALIDATED. Approving a swap repeats the checks of
-- BR31.4 (SWAP_CANNOT_BE_APPLIED) and runs the exchange; approving a cancellation removes the place. Both
-- decisions record the deciding account and time and write one approval.approve or approval.reject audit
-- event, with the request as target, in the same transaction. Internal.
-- ---------------------------------------------------------------------------------------------------
create or replace function coordination_decide(
  p_kind text, p_idempotency_key text, p_request_id uuid, p_approve boolean, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_operation text := p_kind || '.decide';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_req change_requests%rowtype;
  v_src assignments%rowtype;
  v_tgt assignments%rowtype;
  v_group uuid;
  v_consistent boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_request_id::text, p_approve::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(v_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_request_id is null or p_approve is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_req from change_requests r
     where r.id = p_request_id and r.organization_id = v_org and r.kind = p_kind;
    if not found then
      perform platform_abort('validation', 'request_not_found');
    end if;
    select t.group_id into v_group
      from assignments a join tasks t on t.id = a.task_id where a.id = v_req.assignment_id;
    if not has_core_scope(v_org, v_group) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform coordination_lock_assignments(
      array_remove(array[v_req.assignment_id, v_req.target_assignment_id], null));
    select * into v_req from change_requests where id = p_request_id for update;
    if v_req.status <> 'open' then
      perform platform_abort('conflict', 'APPROVAL_ALREADY_DECIDED');
    end if;
    if p_expected_version is not null and p_expected_version <> v_req.version then
      perform platform_abort('invalidated', 'APPROVAL_INVALIDATED');
    end if;
    select * into v_src from assignments where id = v_req.assignment_id;
    if p_kind = 'swap' then
      select * into v_tgt from assignments where id = v_req.target_assignment_id;
      v_consistent := v_src.task_id = v_req.source_task_id and v_src.version = v_req.source_assignment_version
        and v_src.status = 'swap_pending' and v_tgt.task_id = v_req.target_task_id
        and v_tgt.version = v_req.target_assignment_version and v_tgt.status = 'active';
    else
      v_consistent := v_src.task_id = v_req.source_task_id and v_src.version = v_req.source_assignment_version
        and v_src.status = 'cancellation_pending';
    end if;
    if not v_consistent then
      perform platform_abort('invalidated', 'APPROVAL_INVALIDATED');
    end if;

    if p_approve then
      if p_kind = 'swap' then
        if coordination_swap_check(v_src.id, v_tgt.id) is not null then
          perform platform_abort('conflict', 'SWAP_CANNOT_BE_APPLIED');
        end if;
        perform coordination_swap_exchange(v_req.id, 'approved', auth.uid());
      else
        update assignments set status = 'removed' where id = v_src.id;
        update change_requests set status = 'approved', decided_by_account_id = auth.uid(), decided_at = now()
         where id = v_req.id;
        perform coordination_withdraw_requests(array[v_src.id]);
        update tasks set updated_at = now() where id = v_src.task_id;
      end if;
      perform platform_audit_write('approval.approve', 'change_request', v_req.id, v_org, v_group, 'success', p_kind);
    else
      update change_requests set status = 'rejected', decided_by_account_id = auth.uid(), decided_at = now()
       where id = v_req.id;
      perform coordination_release_source(v_src.id);
      perform platform_audit_write('approval.reject', 'change_request', v_req.id, v_org, v_group, 'success', p_kind);
    end if;

    perform platform_idempotency_store(v_operation, p_idempotency_key, v_fingerprint, 'success', v_req.id);
    return platform_result('success', v_req.id, null)
      || jsonb_build_object('outcome', case when p_approve then 'approved' else 'rejected' end);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function swap_decide(
  p_idempotency_key text, p_request_id uuid, p_approve boolean, p_expected_version integer default null
) returns jsonb
language sql security definer set search_path from current
as $$ select coordination_decide('swap', p_idempotency_key, p_request_id, p_approve, p_expected_version) $$;

create or replace function cancellation_decide(
  p_idempotency_key text, p_request_id uuid, p_approve boolean, p_expected_version integer default null
) returns jsonb
language sql security definer set search_path from current
as $$ select coordination_decide('cancellation', p_idempotency_key, p_request_id, p_approve, p_expected_version) $$;

revoke all on function
  coordination_lock_assignments(uuid[]),
  coordination_release_source(uuid),
  coordination_swap_check(uuid, uuid),
  coordination_swap_exchange(uuid, text, uuid),
  coordination_decide(text, text, uuid, boolean, integer),
  swap_candidates(uuid),
  swap_request(text, uuid, integer, uuid, integer, text),
  swap_respond(text, uuid, boolean, integer),
  swap_incoming(),
  swap_withdraw(text, uuid),
  cancellation_request(text, uuid, integer, text),
  swap_decide(text, uuid, boolean, integer),
  cancellation_decide(text, uuid, boolean, integer)
  from public, anon, authenticated, service_role;
grant execute on function
  swap_candidates(uuid),
  swap_request(text, uuid, integer, uuid, integer, text),
  swap_respond(text, uuid, boolean, integer),
  swap_incoming(),
  swap_withdraw(text, uuid),
  cancellation_request(text, uuid, integer, text),
  swap_decide(text, uuid, boolean, integer),
  cancellation_decide(text, uuid, boolean, integer)
  to authenticated;
