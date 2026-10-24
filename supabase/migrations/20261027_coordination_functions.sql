-- U3 Coordination: the named change functions for events, tasks and contribution notes (BR31.1, BR31.8,
-- BR32.8). They follow the pattern and the helpers of 20261025_directory_functions.sql: active session,
-- idempotency check, authorization, change in one block that a business refusal rolls back, then the stored
-- result. Only a success is stored under the idempotency key. These edits write no audit event (U1 BR3.2).

-- Withdraws every open change request whose source or target assignment is in the list, and returns the
-- source assignment of each to active unless it is itself removed. Internal; used wherever assignments are
-- removed in bulk (task cancellation here, family archive and the swap exchange in later files). The caller
-- has already removed the assignments it removes, so a removed source is not reactivated.
create or replace function coordination_withdraw_requests(p_assignment_ids uuid[]) returns void
language plpgsql set search_path from current
as $$
begin
  with withdrawn as (
    update change_requests set status = 'withdrawn'
     where status = 'open'
       and (assignment_id = any (p_assignment_ids) or target_assignment_id = any (p_assignment_ids))
    returning assignment_id)
  update assignments a set status = 'active'
    from withdrawn w
   where a.id = w.assignment_id and a.status in ('swap_pending', 'cancellation_pending');
end $$;

-- ---------------------------------------------------------------------------------------------------
-- event_save: creates or changes an event (BR31.1). The payload is a JSON object:
--   id (null or absent creates), expected_version (needed to change), group_id, title, location,
--   coordinator_name, starts_at, ends_at, status (planned or cancelled).
-- The notes are saved by event_save_notes. Cancelling an event closes its open tasks for new sign-ups;
-- existing assignments stay and the admin decides about them. A group is changed only while the event has
-- no tasks.
-- ---------------------------------------------------------------------------------------------------
create or replace function event_save(p_idempotency_key text, p_event jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_creating boolean;
  v_id uuid;
  v_event events%rowtype;
  v_expected integer;
  v_group uuid;
  v_group_status text;
  v_title text;
  v_location text;
  v_coordinator text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_status text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(coalesce(p_event::text, ''), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_event is null or jsonb_typeof(p_event) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    v_group := platform_try_uuid(p_event->>'group_id');
    if v_group is null then
      perform platform_field_invalid('group_id');
    end if;
    -- A group of another organization answers exactly like a missing one.
    select g.status into v_group_status from groups g where g.id = v_group and g.organization_id = v_org;
    if not found then
      perform platform_field_invalid('group_id', 'not_found');
    end if;
    if not has_core_scope(v_org, v_group) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_group_status = 'archived' then
      perform platform_field_invalid('group_id', 'archived');
    end if;

    v_creating := p_event->'id' is null or jsonb_typeof(p_event->'id') = 'null';
    if not v_creating then
      v_id := platform_try_uuid(p_event->>'id');
      if v_id is null then
        perform platform_field_invalid('id');
      end if;
      select * into v_event from events where id = v_id and organization_id = v_org for update;
      if not found then
        perform platform_field_invalid('id', 'not_found');
      end if;
      if not has_core_scope(v_org, v_event.group_id) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
      v_expected := platform_try_integer(p_event->>'expected_version');
      if v_expected is null then
        perform platform_field_invalid('expected_version');
      end if;
      if v_expected <> v_event.version then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
      if v_group <> v_event.group_id and exists (select 1 from tasks t where t.event_id = v_id) then
        perform platform_field_invalid('group_id', 'locked');
      end if;
    end if;

    v_title := btrim(coalesce(p_event->>'title', ''));
    v_location := nullif(btrim(coalesce(p_event->>'location', '')), '');
    v_coordinator := nullif(btrim(coalesce(p_event->>'coordinator_name', '')), '');
    v_starts := platform_try_timestamptz(p_event->>'starts_at');
    v_ends := platform_try_timestamptz(p_event->>'ends_at');
    v_status := coalesce(p_event->>'status', case when v_creating then 'planned' else v_event.status end);
    if char_length(v_title) not between 1 and 200 then
      perform platform_field_invalid('title');
    end if;
    if v_location is not null and char_length(v_location) > 200 then
      perform platform_field_invalid('location');
    end if;
    if v_coordinator is not null and char_length(v_coordinator) > 200 then
      perform platform_field_invalid('coordinator_name');
    end if;
    if v_starts is null then
      perform platform_field_invalid('starts_at');
    end if;
    if v_ends is null then
      perform platform_field_invalid('ends_at');
    end if;
    if v_ends < v_starts then
      perform platform_field_invalid('ends_at', 'before_start');
    end if;
    if v_status not in ('planned', 'cancelled') then
      perform platform_field_invalid('status');
    end if;

    if v_creating then
      insert into events (organization_id, group_id, title, location, coordinator_name, starts_at, ends_at, status)
      values (v_org, v_group, v_title, v_location, v_coordinator, v_starts, v_ends, v_status)
      returning id into v_id;
    else
      update events
         set group_id = v_group, title = v_title, location = v_location, coordinator_name = v_coordinator,
             starts_at = v_starts, ends_at = v_ends, status = v_status
       where id = v_id;
      -- A cancelled event closes its open tasks for new sign-ups (BR31.1): the tasks are locked in
      -- ascending id order, like every writer that touches several tasks (NFR3.8).
      if v_status = 'cancelled' and v_event.status <> 'cancelled' then
        perform 1 from tasks where event_id = v_id order by id for update;
        update tasks set status = 'closed' where event_id = v_id and status = 'open';
      end if;
    end if;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null)
      || jsonb_build_object('version', (select e.version from events e where e.id = v_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- event_save_notes: the three notes of an event (allergen, supply, food, each at most 300 characters),
-- with the event's version (BR31.8). An empty text clears a note. The notes belong to the event; the
-- family's own contribution note is a separate record.
-- ---------------------------------------------------------------------------------------------------
create or replace function event_save_notes(
  p_idempotency_key text, p_event_id uuid, p_expected_version integer,
  p_allergen_note text, p_supply_note text, p_food_note text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.save_notes';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event events%rowtype;
  v_allergen text;
  v_supply text;
  v_food text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_event_id::text, p_expected_version::text, p_allergen_note, p_supply_note, p_food_note), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_event_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_event from events where id = p_event_id and organization_id = v_org for update;
    if not found then
      perform platform_field_invalid('event_id', 'not_found');
    end if;
    if not has_core_scope(v_org, v_event.group_id) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_event.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    v_allergen := nullif(btrim(coalesce(p_allergen_note, '')), '');
    v_supply := nullif(btrim(coalesce(p_supply_note, '')), '');
    v_food := nullif(btrim(coalesce(p_food_note, '')), '');
    if char_length(v_allergen) > 300 then
      perform platform_field_invalid('allergen_note');
    end if;
    if char_length(v_supply) > 300 then
      perform platform_field_invalid('supply_note');
    end if;
    if char_length(v_food) > 300 then
      perform platform_field_invalid('food_note');
    end if;
    update events set allergen_note = v_allergen, supply_note = v_supply, food_note = v_food
     where id = p_event_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_event_id);
    return platform_result('success', p_event_id, null) || jsonb_build_object('version', v_event.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- task_save: creates or changes a task (BR31.1). The payload is a JSON object:
--   id (null or absent creates), expected_version (needed to change), group_id, event_id (optional),
--   title, category, capacity, starts_at, ends_at, location, status (open, closed or cancelled).
-- The task's group equals its event's group; the capacity is 1 to 50 and not below the places already
-- taken; the place defaults to the event's, else a dash. A task of a cancelled event is created closed and
-- cannot be reopened. Setting the status to cancelled is final: the task's assignments become removed and
-- the open requests that involve them are withdrawn. The task row is locked first, like every writer that
-- changes a task (NFR3.8).
-- ---------------------------------------------------------------------------------------------------
create or replace function task_save(p_idempotency_key text, p_task jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'task.save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_creating boolean;
  v_id uuid;
  v_task tasks%rowtype;
  v_expected integer;
  v_group uuid;
  v_group_status text;
  v_event_id uuid;
  v_event events%rowtype;
  v_title text;
  v_category text;
  v_capacity integer;
  v_taken integer;
  v_starts timestamptz;
  v_ends timestamptz;
  v_location text;
  v_status text;
  v_ids uuid[];
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(coalesce(p_task::text, ''), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_task is null or jsonb_typeof(p_task) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    v_group := platform_try_uuid(p_task->>'group_id');
    if v_group is null then
      perform platform_field_invalid('group_id');
    end if;
    select g.status into v_group_status from groups g where g.id = v_group and g.organization_id = v_org;
    if not found then
      perform platform_field_invalid('group_id', 'not_found');
    end if;
    if not has_core_scope(v_org, v_group) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_group_status = 'archived' then
      perform platform_field_invalid('group_id', 'archived');
    end if;

    v_creating := p_task->'id' is null or jsonb_typeof(p_task->'id') = 'null';
    if not v_creating then
      v_id := platform_try_uuid(p_task->>'id');
      if v_id is null then
        perform platform_field_invalid('id');
      end if;
      select * into v_task from tasks where id = v_id and organization_id = v_org for update;
      if not found then
        perform platform_field_invalid('id', 'not_found');
      end if;
      if not has_core_scope(v_org, v_task.group_id) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
      v_expected := platform_try_integer(p_task->>'expected_version');
      if v_expected is null then
        perform platform_field_invalid('expected_version');
      end if;
      if v_expected <> v_task.version then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
      if v_task.status = 'cancelled' then
        perform platform_field_invalid('id', 'cancelled');
      end if;
      select count(*) into v_taken from assignments a where a.task_id = v_id and a.status <> 'removed';
      if v_group <> v_task.group_id and v_taken > 0 then
        perform platform_field_invalid('group_id', 'locked');
      end if;
    else
      v_taken := 0;
    end if;

    -- The event, when there is one: of this organization and of the task's group.
    if p_task->'event_id' is not null and jsonb_typeof(p_task->'event_id') <> 'null' then
      v_event_id := platform_try_uuid(p_task->>'event_id');
      if v_event_id is null then
        perform platform_field_invalid('event_id');
      end if;
      select * into v_event from events where id = v_event_id and organization_id = v_org;
      if not found then
        perform platform_field_invalid('event_id', 'not_found');
      end if;
      if v_event.group_id <> v_group then
        perform platform_field_invalid('event_id', 'group_mismatch');
      end if;
    elsif not v_creating and p_task->'event_id' is null then
      v_event_id := v_task.event_id;
      select * into v_event from events where id = v_event_id;
    end if;
    -- A task that keeps its event cannot move to another group (the event's group is the task's).
    if v_event_id is not null and v_event.group_id <> v_group then
      perform platform_field_invalid('event_id', 'group_mismatch');
    end if;

    v_title := btrim(coalesce(p_task->>'title', ''));
    if p_task->'category' is not null then
      v_category := btrim(coalesce(p_task->>'category', ''));
    else
      v_category := coalesce(v_task.category, 'general');
    end if;
    v_capacity := platform_try_integer(p_task->>'capacity');
    v_starts := platform_try_timestamptz(p_task->>'starts_at');
    v_ends := platform_try_timestamptz(p_task->>'ends_at');
    if p_task->'location' is not null then
      v_location := nullif(btrim(coalesce(p_task->>'location', '')), '');
    else
      v_location := v_task.location;
    end if;
    v_location := coalesce(v_location, nullif(v_event.location, ''), '-');
    v_status := coalesce(p_task->>'status', case when v_creating then 'open' else v_task.status end);

    if char_length(v_title) not between 1 and 200 then
      perform platform_field_invalid('title');
    end if;
    if char_length(v_category) not between 1 and 100 then
      perform platform_field_invalid('category');
    end if;
    if v_capacity is null or v_capacity not between 1 and 50 then
      perform platform_field_invalid('capacity');
    end if;
    if v_capacity < v_taken then
      perform platform_abort('validation', 'field_invalid',
        jsonb_build_object('field', 'capacity', 'reason', 'below_taken', 'taken', v_taken));
    end if;
    if v_starts is null then
      perform platform_field_invalid('starts_at');
    end if;
    if v_ends is null then
      perform platform_field_invalid('ends_at');
    end if;
    if v_ends < v_starts then
      perform platform_field_invalid('ends_at', 'before_start');
    end if;
    if char_length(v_location) > 200 then
      perform platform_field_invalid('location');
    end if;
    if v_status not in ('open', 'closed', 'cancelled') or (v_creating and v_status = 'cancelled') then
      perform platform_field_invalid('status');
    end if;
    -- A task of a cancelled event is closed for sign-up and stays closed (BR31.1).
    if v_event.status = 'cancelled' and v_status = 'open' then
      if v_creating then
        v_status := 'closed';
      else
        perform platform_field_invalid('status', 'event_cancelled');
      end if;
    end if;

    if v_creating then
      insert into tasks (organization_id, group_id, event_id, title, category, capacity, starts_at, ends_at, location, status)
      values (v_org, v_group, v_event_id, v_title, v_category, v_capacity, v_starts, v_ends, v_location, v_status)
      returning id into v_id;
    else
      update tasks
         set group_id = v_group, event_id = v_event_id, title = v_title, category = v_category,
             capacity = v_capacity, starts_at = v_starts, ends_at = v_ends, location = v_location,
             status = v_status
       where id = v_id;
      -- Cancellation is final: the places are removed and the requests that involve them are withdrawn.
      if v_status = 'cancelled' then
        select coalesce(array_agg(a.id order by a.id), '{}') into v_ids
          from assignments a where a.task_id = v_id and a.status <> 'removed';
        update assignments set status = 'removed' where id = any (v_ids);
        perform coordination_withdraw_requests(v_ids);
      end if;
    end if;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null)
      || jsonb_build_object('version', (select t.version from tasks t where t.id = v_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- contribution_save: a parent saves the note their family keeps for its place on a task (BR31.8). The
-- parent port sends only the duty (task) id and the text, so the function finds the family's own place
-- on that task from the signed-in parent. The last save wins (no version). A parent whose family has no
-- place on the task, an account without a linked parent and an archived family are denied.
-- ---------------------------------------------------------------------------------------------------
create or replace function contribution_save(p_idempotency_key text, p_task_id uuid, p_text text) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'contribution.save';
  v_family uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_assignment uuid;
  v_organization uuid;
  v_text text;
  v_id uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_task_id::text, p_text), 'UTF8')), 'hex');
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
    select a.id, a.organization_id into v_assignment, v_organization
      from assignments a
     where a.task_id = p_task_id and a.family_id = v_family and a.status <> 'removed';
    if v_assignment is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_text is null or char_length(p_text) > 500 then
      perform platform_field_invalid('text');
    end if;
    v_text := btrim(p_text);
    insert into contribution_notes (organization_id, assignment_id, text)
    values (v_organization, v_assignment, v_text)
    on conflict (assignment_id) do update set text = excluded.text
    returning id into v_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

revoke all on function
  coordination_withdraw_requests(uuid[]),
  event_save(text, jsonb),
  event_save_notes(text, uuid, integer, text, text, text),
  task_save(text, jsonb),
  contribution_save(text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function
  event_save(text, jsonb),
  event_save_notes(text, uuid, integer, text, text, text),
  task_save(text, jsonb),
  contribution_save(text, uuid, text)
  to authenticated;
