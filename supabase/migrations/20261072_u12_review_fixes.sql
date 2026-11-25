begin;

-- ---------------------------------------------------------------------------------------------------
-- U12 review follow-up. Forward-only: the functions below are replaced; nothing already applied is edited.
--   * todo_task_save: a hand-over to a family releases a claim held by a parent of another family (the task goes back to
--     open when it was in progress, one claim_freed history row is written, the claimant is told, and a claim freed from
--     another person is audited, as in todo_task_free_claim). When a family is named, the family row is share-locked
--     first (the removal pair locks the family row first), before the task row, so a removal committing in between
--     cannot leave a task of a removed family unflagged. Only a family being named takes this lock; the other commands
--     take none.
--   * Every command that returns a version (save, claim, give back, free claim, update, mark done, undo done) now also
--     returns the current version when it answers a repeated key.
--   * migration_load_todo: a task "in progress" has no claimant in the load and no other path creates that state, so the
--     load stores it as open.
--   Rights are restated at the end.
-- ---------------------------------------------------------------------------------------------------
create or replace function todo_task_save(p_idempotency_key text, p_task jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'todo.save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_creating boolean;
  v_id uuid;
  v_old todo_tasks%rowtype;
  v_actor uuid;
  v_group_text text;
  v_family_text text;
  v_group uuid;
  v_family uuid;
  v_owner_group uuid;
  v_owner_family uuid;
  v_owner_given boolean;
  v_group_row groups%rowtype;
  v_topic text;
  v_priority integer;
  v_description text;
  v_materials text;
  v_status text;
  v_note text;
  v_not_before date;
  v_deadline date;
  v_expected integer;
  v_content_changed boolean;
  v_release boolean := false;
  v_new_status text;
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
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || jsonb_build_object('version', (select t.version from todo_tasks t where t.id = (v_check->>'reference')::uuid));
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_task is null or jsonb_typeof(p_task) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    v_actor := coalesce(current_parent_id(), identity_linked_parent());
    v_group_text := nullif(p_task->>'owner_group_id', '');
    v_family_text := nullif(p_task->>'owner_family_id', '');
    v_owner_given := v_group_text is not null or v_family_text is not null;
    if v_group_text is not null and v_family_text is not null then
      perform platform_field_invalid('owner', 'one_only');
    end if;
    v_creating := p_task->'id' is null or jsonb_typeof(p_task->'id') = 'null';

    -- A family named as the owner is a super admin's. Its row is share-locked first, before any task row: the removal
    -- pair takes the family row, then the task rows, so both go in the same order.
    if v_family_text is not null then
      perform platform_deny_unless_super(v_org);
      v_family := platform_try_uuid(v_family_text);
      if v_family is null then
        perform platform_field_invalid('owner');
      end if;
      perform 1 from families f where f.id = v_family and f.organization_id = v_org and f.status = 'active' for share;
      if not found then
        perform platform_field_invalid('owner', 'not_found');
      end if;
    end if;

    if v_creating then
      if not v_owner_given then
        perform platform_field_invalid('owner', 'one_required');
      end if;
    else
      v_id := platform_try_uuid(p_task->>'id');
      if v_id is null then
        perform platform_field_invalid('id');
      end if;
      select * into v_old from todo_tasks t where t.id = v_id and t.organization_id = v_org for update;
      if not found then
        perform platform_deny_unless_super(v_org);
        perform platform_field_invalid('id', 'not_found');
      end if;
      if not todo_can_manage(v_org, v_old.owner_group_id) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
      v_expected := platform_try_integer(p_task->>'expected_version');
      if v_expected is null then
        perform platform_field_invalid('expected_version');
      end if;
      if v_expected <> v_old.version then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
    end if;

    -- The owner (BR180.2). A new task names one; a change keeps the owner unless a super admin names another.
    if v_owner_given then
      if v_family_text is not null then
        v_owner_group := null;
        v_owner_family := v_family;
      else
        v_group := platform_try_uuid(v_group_text);
        if v_group is null then
          perform platform_field_invalid('owner');
        end if;
        select * into v_group_row from groups g where g.id = v_group and g.organization_id = v_org;
        if not found then
          perform platform_deny_unless_super(v_org);
          perform platform_field_invalid('owner', 'not_found');
        end if;
        if not todo_can_manage(v_org, v_group) then
          perform platform_abort('denied', 'authorization_denied');
        end if;
        if v_group_row.status = 'archived' and (v_creating or v_old.owner_group_id is distinct from v_group) then
          perform platform_field_invalid('owner', 'archived');
        end if;
        v_owner_group := v_group;
        v_owner_family := null;
      end if;
      -- A change of owner is a super admin's (BR180.2).
      if not v_creating and (v_owner_group is distinct from v_old.owner_group_id
                             or v_owner_family is distinct from v_old.owner_family_id) then
        perform platform_deny_unless_super(v_org);
      end if;
    else
      v_owner_group := v_old.owner_group_id;
      v_owner_family := v_old.owner_family_id;
    end if;

    v_topic := checklist_text(p_task->'topic', 'topic', 200, true);
    v_priority := checklist_int(p_task->'priority', 'priority', 1, 3, null);
    v_description := checklist_text(p_task->'description', 'description', 2000);
    v_materials := checklist_text(p_task->'materials', 'materials', 500);
    v_note := checklist_text(p_task->'note', 'note', 1000);
    if nullif(p_task->>'not_before', '') is not null then
      v_not_before := platform_try_date(p_task->>'not_before');
      if v_not_before is null then
        perform platform_field_invalid('not_before');
      end if;
    end if;
    if nullif(p_task->>'deadline', '') is not null then
      v_deadline := platform_try_date(p_task->>'deadline');
      if v_deadline is null then
        perform platform_field_invalid('deadline');
      end if;
    end if;
    if v_not_before is not null and v_deadline is not null and v_not_before > v_deadline then
      perform platform_field_invalid('not_before', 'not_before_after_deadline');
    end if;

    -- The status (BR181.1, BR183.1): a new task is open or postponed; done has its own command; a task that is done keeps
    -- that status; the claim decides whether a task can be open or in progress.
    v_status := coalesce(nullif(p_task->>'status', ''), case when v_creating then 'open' else v_old.status end);
    if v_status not in ('open', 'in_progress', 'done', 'postponed') then
      perform platform_field_invalid('status');
    end if;
    if v_creating then
      if v_status not in ('open', 'postponed') then
        perform platform_abort('validation', 'status_not_allowed');
      end if;
    elsif v_old.status = 'done' then
      if v_status <> 'done' then
        perform platform_abort('validation', 'status_not_allowed');
      end if;
    elsif v_status <> v_old.status then
      if v_status = 'done'
         or (v_status = 'open' and v_old.claimant_parent_id is not null)
         or (v_status = 'in_progress' and v_old.claimant_parent_id is null) then
        perform platform_abort('validation', 'status_not_allowed');
      end if;
    end if;
    if v_status = 'postponed' and v_note is null then
      perform platform_field_invalid('note', 'required');
    end if;

    if v_creating then
      insert into todo_tasks (organization_id, owner_group_id, owner_family_id, topic, priority, description, materials,
                              status, note, not_before, deadline)
      values (v_org, v_owner_group, v_owner_family, v_topic, v_priority, v_description, v_materials, v_status, v_note,
              v_not_before, v_deadline)
      returning id into v_id;
      perform todo_history_add(v_id, 'created', null, v_status, case when v_actor is null then 'administrator' else 'parent' end, v_actor);
    else
      -- A family-owned task is claimed only by that family: a claim held by a parent of another family ends with the
      -- hand-over. A done task keeps its mark.
      v_release := v_old.claimant_parent_id is not null and v_old.status <> 'done' and v_owner_family is not null
        and (select p.family_id from parents p where p.id = v_old.claimant_parent_id) is distinct from v_owner_family;
      v_new_status := case when v_release and v_status = 'in_progress' then 'open' else v_status end;
      v_content_changed := v_owner_group is distinct from v_old.owner_group_id
        or v_owner_family is distinct from v_old.owner_family_id
        or v_topic is distinct from v_old.topic or v_priority is distinct from v_old.priority
        or v_description is distinct from v_old.description or v_materials is distinct from v_old.materials
        or v_status is distinct from v_old.status or v_not_before is distinct from v_old.not_before
        or v_deadline is distinct from v_old.deadline;
      update todo_tasks
         set owner_group_id = v_owner_group, owner_family_id = v_owner_family, topic = v_topic, priority = v_priority,
             description = v_description, materials = v_materials, status = v_new_status, note = v_note,
             not_before = v_not_before, deadline = v_deadline, needs_attention = false,
             claimant_parent_id = case when v_release then null else claimant_parent_id end,
             claimed_at = case when v_release then null else claimed_at end
       where id = v_id;
      perform todo_history_add(v_id, 'edited', v_old.status, v_new_status, case when v_actor is null then 'administrator' else 'parent' end, v_actor);
      if v_release then
        perform todo_history_add(v_id, 'claim_freed', v_new_status, v_new_status,
                                 case when v_actor is null then 'administrator' else 'parent' end, v_actor);
        if v_old.claimant_parent_id is distinct from v_actor then
          perform platform_audit_write('todo.claim_freed', 'todo_task', v_id, v_org, v_old.owner_group_id, 'success', null);
        end if;
      end if;
      if v_content_changed then
        perform todo_notify_changed(v_id, v_old.claimant_parent_id, v_actor);
      end if;
    end if;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null)
      || jsonb_build_object('version', (select t.version from todo_tasks t where t.id = v_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function todo_task_claim(p_idempotency_key text, p_task_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'todo.claim';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_family uuid;
  v_task todo_tasks%rowtype;
  v_new_status text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_task_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || jsonb_build_object('version', (select t.version from todo_tasks t where t.id = (v_check->>'reference')::uuid));
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := current_parent_id();
    v_family := current_family_id();
    if v_parent is null or v_family is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    -- Reach, read without a lock: a missing task and another family's task answer the same.
    select * into v_task from todo_tasks t where t.id = p_task_id and t.organization_id = v_org;
    if not found or (v_task.owner_family_id is not null and v_task.owner_family_id <> v_family) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_task from todo_tasks t where t.id = p_task_id for update;
    -- After the lock: the caller is still an active parent with an active family, and the task is still in reach.
    if current_parent_id() is distinct from v_parent or current_family_id() is distinct from v_family
       or (v_task.owner_family_id is not null and v_task.owner_family_id <> v_family) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_task.status = 'done' then
      perform platform_abort('conflict', 'TODO_DONE');
    end if;
    if v_task.claimant_parent_id is not null then
      perform platform_abort('conflict', 'TODO_CLAIMED');
    end if;
    if v_task.not_before is not null and v_task.not_before > school_today() then
      perform platform_abort('conflict', 'TODO_NOT_YET');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_task.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    v_new_status := 'in_progress';
    update todo_tasks set claimant_parent_id = v_parent, claimed_at = now(), status = v_new_status where id = v_task.id;
    perform todo_history_add(v_task.id, 'claimed', v_task.status, v_new_status, 'parent', v_parent);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_task.id);
    return platform_result('success', v_task.id, null) || jsonb_build_object('version', v_task.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function todo_task_give_back(p_idempotency_key text, p_task_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'todo.give_back';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_family uuid;
  v_task todo_tasks%rowtype;
  v_new_status text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_task_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || jsonb_build_object('version', (select t.version from todo_tasks t where t.id = (v_check->>'reference')::uuid));
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := current_parent_id();
    v_family := current_family_id();
    if v_parent is null or v_family is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform 1 from todo_tasks t where t.id = p_task_id and t.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_task from todo_tasks t where t.id = p_task_id for update;
    if current_parent_id() is distinct from v_parent or current_family_id() is distinct from v_family then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_task.claimant_parent_id is null then
      perform platform_abort('conflict', 'TODO_NOT_CLAIMED');
    end if;
    if v_task.claimant_parent_id <> v_parent then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_task.status = 'done' then
      perform platform_abort('conflict', 'TODO_DONE');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_task.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    v_new_status := case when v_task.status = 'in_progress' then 'open' else v_task.status end;
    update todo_tasks set claimant_parent_id = null, claimed_at = null, status = v_new_status where id = v_task.id;
    perform todo_history_add(v_task.id, 'claim_given_back', v_task.status, v_new_status, 'parent', v_parent);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_task.id);
    return platform_result('success', v_task.id, null) || jsonb_build_object('version', v_task.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function todo_task_free_claim(p_idempotency_key text, p_task_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'todo.free_claim';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_actor uuid;
  v_task todo_tasks%rowtype;
  v_old_claimant uuid;
  v_new_status text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_task_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || jsonb_build_object('version', (select t.version from todo_tasks t where t.id = (v_check->>'reference')::uuid));
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_actor := coalesce(current_parent_id(), identity_linked_parent());
    select * into v_task from todo_tasks t where t.id = p_task_id and t.organization_id = v_org;
    if not found or not todo_can_manage(v_org, v_task.owner_group_id) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_task from todo_tasks t where t.id = p_task_id for update;
    -- The grant is read again after the lock (NFR3.25).
    if not todo_can_manage(v_org, v_task.owner_group_id) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_task.status = 'done' then
      perform platform_abort('conflict', 'TODO_DONE');
    end if;
    if v_task.claimant_parent_id is null then
      perform platform_abort('conflict', 'TODO_NOT_CLAIMED');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_task.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    v_old_claimant := v_task.claimant_parent_id;
    v_new_status := case when v_task.status = 'in_progress' then 'open' else v_task.status end;
    update todo_tasks set claimant_parent_id = null, claimed_at = null, status = v_new_status where id = v_task.id;
    perform todo_history_add(v_task.id, 'claim_freed', v_task.status, v_new_status,
                             case when v_actor is null then 'administrator' else 'parent' end, v_actor);
    if v_old_claimant is distinct from v_actor then
      perform platform_audit_write('todo.claim_freed', 'todo_task', v_task.id, v_org, v_task.owner_group_id, 'success', null);
    end if;
    perform todo_notify_changed(v_task.id, v_old_claimant, v_actor);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_task.id);
    return platform_result('success', v_task.id, null) || jsonb_build_object('version', v_task.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function todo_task_update(
  p_idempotency_key text, p_task_id uuid, p_status text, p_note text, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'todo.update';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_actor uuid;
  v_task todo_tasks%rowtype;
  v_manage boolean;
  v_claimant boolean;
  v_status text;
  v_note text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_task_id::text, coalesce(p_status, ''), coalesce(p_note, ''),
                                                      p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || jsonb_build_object('version', (select t.version from todo_tasks t where t.id = (v_check->>'reference')::uuid));
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_actor := coalesce(current_parent_id(), identity_linked_parent());
    perform 1 from todo_tasks t where t.id = p_task_id and t.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_task from todo_tasks t where t.id = p_task_id for update;
    v_manage := todo_can_manage(v_org, v_task.owner_group_id);
    v_claimant := v_actor is not null and v_task.claimant_parent_id is not distinct from v_actor and current_parent_id() = v_actor;
    if not v_manage and not v_claimant then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_task.status = 'done' then
      perform platform_abort('conflict', 'TODO_DONE');
    end if;
    v_status := coalesce(nullif(btrim(p_status), ''), v_task.status);
    if v_status not in ('open', 'in_progress', 'postponed') then
      perform platform_abort('validation', 'status_not_allowed');
    end if;
    -- A parent who is not a manager sets in progress or postponed only; no one sets open while a claimant holds the task,
    -- and in progress needs a claimant (BR183.1).
    if v_status <> v_task.status then
      if (v_status = 'open' and (v_task.claimant_parent_id is not null or not v_manage))
         or (v_status = 'in_progress' and v_task.claimant_parent_id is null) then
        perform platform_abort('validation', 'status_not_allowed');
      end if;
    end if;
    v_note := nullif(btrim(coalesce(p_note, '')), '');
    if v_note is not null and char_length(v_note) > 1000 then
      perform platform_field_invalid('note');
    end if;
    if v_status = 'postponed' and v_note is null then
      perform platform_field_invalid('note', 'required');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_task.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_status is distinct from v_task.status or v_note is distinct from v_task.note then
      update todo_tasks set status = v_status, note = v_note where id = v_task.id;
      if v_status is distinct from v_task.status then
        perform todo_history_add(v_task.id, 'status_changed', v_task.status, v_status,
                                 case when v_actor is null then 'administrator' else 'parent' end, v_actor);
      end if;
      -- A manager's change of the status tells another person who holds the task (BR188.1); a note-only change does not.
      if v_manage and v_status is distinct from v_task.status then
        perform todo_notify_changed(v_task.id, v_task.claimant_parent_id, v_actor);
      end if;
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_task.id);
    return platform_result('success', v_task.id, null)
      || jsonb_build_object('version', (select t.version from todo_tasks t where t.id = v_task.id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function todo_task_mark_done(p_idempotency_key text, p_task_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'todo.mark_done';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_task todo_tasks%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_task_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || jsonb_build_object('version', (select t.version from todo_tasks t where t.id = (v_check->>'reference')::uuid));
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := current_parent_id();
    if v_parent is null then
      -- A super admin with no parent record is told why; a teacher and everyone else is simply refused.
      if coalesce(has_super_scope(v_org), false) then
        perform platform_abort('denied', 'no_parent_record');
      end if;
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform 1 from todo_tasks t where t.id = p_task_id and t.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_task from todo_tasks t where t.id = p_task_id for update;
    if current_parent_id() is distinct from v_parent then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_task.claimant_parent_id is distinct from v_parent and not todo_can_manage(v_org, v_task.owner_group_id) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_task.status = 'done' then
      perform platform_abort('conflict', 'TODO_DONE');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_task.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    update todo_tasks set status = 'done', done_at = now(), done_by_parent_id = v_parent where id = v_task.id;
    perform todo_history_add(v_task.id, 'marked_done', v_task.status, 'done', 'parent', v_parent);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_task.id);
    return platform_result('success', v_task.id, null) || jsonb_build_object('version', v_task.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function todo_task_undo_done(p_idempotency_key text, p_task_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'todo.undo_done';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_actor uuid;
  v_parent uuid;
  v_task todo_tasks%rowtype;
  v_manage boolean;
  v_own boolean;
  v_new_status text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_task_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || jsonb_build_object('version', (select t.version from todo_tasks t where t.id = (v_check->>'reference')::uuid));
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := current_parent_id();
    v_actor := coalesce(v_parent, identity_linked_parent());
    perform 1 from todo_tasks t where t.id = p_task_id and t.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_task from todo_tasks t where t.id = p_task_id for update;
    v_manage := todo_can_manage(v_org, v_task.owner_group_id);
    v_own := v_parent is not null and v_task.done_by_parent_id is not distinct from v_parent;
    if not v_manage and not v_own then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_task.status <> 'done' then
      perform platform_abort('conflict', 'TODO_NOT_DONE');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_task.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    v_new_status := case when v_task.claimant_parent_id is not null then 'in_progress' else 'open' end;
    update todo_tasks set status = v_new_status, done_at = null, done_by_parent_id = null where id = v_task.id;
    perform todo_history_add(v_task.id, 'done_undone', 'done', v_new_status,
                             case when v_actor is null then 'administrator' else 'parent' end, v_actor);
    if not v_own then
      perform platform_audit_write('todo.done_undone', 'todo_task', v_task.id, v_org, v_task.owner_group_id, 'success', null);
    end if;
    if v_manage then
      perform todo_notify_changed(v_task.id, v_task.claimant_parent_id, v_actor);
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_task.id);
    return platform_result('success', v_task.id, null) || jsonb_build_object('version', v_task.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function migration_load_todo(p_source_key text, p_organization_id uuid, p_todo jsonb)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_detail text;
  v_existing uuid;
  v_topic text;
  v_priority integer;
  v_description text;
  v_materials text;
  v_note text;
  v_status text;
  v_not_before date;
  v_deadline date;
  v_done_date date;
  v_group_name text;
  v_group uuid;
  v_family uuid;
  v_count integer;
  v_id uuid;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_source_key is null or char_length(p_source_key) not between 1 and 200
     or p_organization_id is null or p_todo is null or jsonb_typeof(p_todo) <> 'object'
     or not exists (select 1 from organizations o where o.id = p_organization_id) then
    return platform_result('validation', null, 'request_invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_schema() || '|load-todo|' || p_source_key, 0));
  select t.id into v_existing from todo_tasks t where t.organization_id = p_organization_id and t.source_key = p_source_key;
  if found then
    return platform_result('success', v_existing, 'replayed');
  end if;

  begin
    v_topic := checklist_text(p_todo->'topic', 'topic', 200, true);
    v_description := checklist_text(p_todo->'description', 'description', 2000);
    v_materials := checklist_text(p_todo->'materials', 'materials', 500);
    v_note := checklist_text(p_todo->'note', 'note', 1000);
    v_priority := checklist_int(p_todo->'priority', 'priority', 1, 3, null);
    v_status := coalesce(nullif(btrim(coalesce(p_todo->>'status', '')), ''), 'open');
    if v_status not in ('open', 'in_progress', 'done', 'postponed') then
      perform platform_field_invalid('status');
    end if;
    -- The load sets no claimant, and in progress needs one: a sheet row in progress is stored as open.
    if v_status = 'in_progress' then
      v_status := 'open';
    end if;
    if v_status = 'postponed' and v_note is null then
      perform platform_field_invalid('note', 'required');
    end if;
    begin
      v_not_before := nullif(p_todo->>'not_before', '')::date;
    exception when others then
      perform platform_field_invalid('not_before');
    end;
    begin
      v_deadline := nullif(p_todo->>'deadline', '')::date;
    exception when others then
      perform platform_field_invalid('deadline');
    end;
    begin
      v_done_date := nullif(p_todo->>'done_date', '')::date;
    exception when others then
      perform platform_field_invalid('done_date');
    end;
    if v_not_before is not null and v_deadline is not null and v_not_before > v_deadline then
      perform platform_field_invalid('not_before', 'not_before_after_deadline');
    end if;

    v_group_name := nullif(btrim(coalesce(p_todo->>'owner_group_name', '')), '');
    if v_group_name is not null then
      if nullif(p_todo->>'owner_family_id', '') is not null then
        perform platform_field_invalid('owner', 'one_only');
      end if;
      select count(*), min(g.id::text)::uuid into v_count, v_group
        from groups g where g.organization_id = p_organization_id and lower(g.name) = lower(v_group_name) and g.status <> 'archived';
      if v_count <> 1 then
        perform platform_field_invalid('owner', 'not_found');
      end if;
    elsif nullif(p_todo->>'owner_family_id', '') is not null then
      v_family := platform_try_uuid(p_todo->>'owner_family_id');
      if v_family is null or not exists (select 1 from families f where f.id = v_family and f.organization_id = p_organization_id) then
        perform platform_field_invalid('owner', 'not_found');
      end if;
    else
      perform platform_field_invalid('owner', 'one_required');
    end if;

    insert into todo_tasks (organization_id, owner_group_id, owner_family_id, topic, priority, description, materials, status,
                            note, not_before, deadline, done_at, source_key)
    values (p_organization_id, v_group, v_family, v_topic, v_priority, v_description, v_materials, v_status, v_note,
            v_not_before, v_deadline,
            case when v_status = 'done' then coalesce(v_done_date::timestamp at time zone 'Europe/Budapest', now()) end,
            p_source_key)
    returning id into v_id;
    perform todo_history_add(v_id, 'migrated', null, v_status, 'system', null);
    perform platform_audit_write('todo.migration_loaded', 'todo_task', v_id, p_organization_id, v_group, 'success', 'loaded');
    return platform_result('success', v_id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

revoke all on function
  todo_task_save(text, jsonb),
  todo_task_claim(text, uuid, integer),
  todo_task_give_back(text, uuid, integer),
  todo_task_free_claim(text, uuid, integer),
  todo_task_update(text, uuid, text, text, integer),
  todo_task_mark_done(text, uuid, integer),
  todo_task_undo_done(text, uuid, integer),
  migration_load_todo(text, uuid, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function
  todo_task_save(text, jsonb),
  todo_task_claim(text, uuid, integer),
  todo_task_give_back(text, uuid, integer),
  todo_task_free_claim(text, uuid, integer),
  todo_task_update(text, uuid, text, text, integer),
  todo_task_mark_done(text, uuid, integer),
  todo_task_undo_done(text, uuid, integer)
  to authenticated;

grant execute on function migration_load_todo(text, uuid, jsonb) to service_role;

commit;
