-- U4 Notifications: the notice and job writes inside U3's use cases (BR40.1, BR40.5, BR40.9). The use cases
-- of the hand-off list keep every check, lock and stored result they had; what changes is that, in the same
-- transaction, a successful call also writes the notices and adjusts the reminder jobs and recipients that
-- the table of BR40.9 prescribes. If a notice cannot be written the whole use case rolls back, because the
-- caller's transaction (one function call) ends in an error.
--
-- How: each function that needs a hook is renamed to `<name>_core` (the body of U3 is not touched, so every
-- check, lock and idempotency rule it proved stays byte-for-byte what it was) and a function of the old name
-- and signature takes its place. The replacement calls the core and, only when the call was a fresh success
-- (not a refusal, not the replay of a stored result), writes the notices of the table below from the state
-- the core left behind, and re-plans the reminders of the tasks involved. A replay creates nothing twice
-- (the replay is skipped, and every notice has a dedupe key besides). The cores are internal: no application
-- role executes them.
--
--   use case                       notices (to the linked parents)               reminder jobs (BR40.5)
--   duty_sign_up                   sign_up_confirmed: the signing family          plan the task
--   assignment_assign              sign_up_confirmed: the family                  plan the task
--   assignment_remove              place_removed: the family                      plan the task
--   swap_request                   swap_requested: the other family               none
--   swap_respond, applied          swap_decided: both families                    plan both tasks (the exchange)
--   swap_respond, declined         swap_decided: the requester's family           none
--   swap_withdraw                  none; the earlier swap_requested notice reads cancelled (BR40.2)
--   cancellation_request           none (admins are not notified in U4)           none
--   swap_decide, approved/rejected swap_decided: both families                    approved: plan both tasks
--   cancellation_decide            cancellation_decided: the requester's family   approved: plan the task
--   family_archive                 none (the archived family's parents are archived)  re-plan the family's tasks
--   family_restore                 none                                           none
--   task_save                      none                                           plan the task (start, status)
--   event_save                     none                                           cancelled event: plan its tasks
--   settings_save                  none                                           re-plan the upcoming tasks
--   lifecycle_run                  the family's notices are deleted               the family's recipient rows are deleted
--
-- swap_withdraw, cancellation_request and family_restore need no hook: the table has no behaviour for them,
-- and a test proves that they create nothing. The reminder planner (20261037) is a reconciliation of a task
-- with its state, so it does not matter which use case moved the task.

-- ---------------------------------------------------------------------------------------------------
-- Internal helpers.
-- ---------------------------------------------------------------------------------------------------

-- One notice for each linked parent (a parent with a sign-in account, in an active state) of a family. The
-- dedupe key is built from the kind, the target, the parent and the suffix (the assignment or request id with
-- its version), so a replay creates nothing twice and a later genuine repeat has another key (BR40.1). A family
-- with no linked parent gets nothing, and is not backfilled when a parent is linked later.
create or replace function notification_notify_family(
  p_family_id uuid, p_kind text, p_target_type text, p_target_ref uuid, p_task_id uuid, p_suffix text
) returns void
language plpgsql security definer set search_path from current
as $$
begin
  insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key)
  select p.organization_id, p.id, p_kind, p_target_type, p_target_ref, t.id, t.starts_at,
         concat_ws(':', p_kind, p_target_type, p_target_ref::text, p.id::text, p_suffix)
    from parents p join tasks t on t.id = p_task_id
   where p.family_id = p_family_id and p.account_id is not null and p.status = 'active'
  on conflict (dedupe_key) do nothing;
end $$;

-- A place was added (sign-up or admin assignment): confirm it to the family and add the family to the task's jobs.
create or replace function notification_after_place_added(p_assignment_id uuid) returns void
language plpgsql security definer set search_path from current
as $$
declare v_a assignments%rowtype;
begin
  select * into v_a from assignments where id = p_assignment_id;
  if not found then
    return;
  end if;
  perform notification_notify_family(v_a.family_id, 'sign_up_confirmed', 'task', v_a.task_id, v_a.task_id,
                                     v_a.id::text || ':' || v_a.version::text);
  perform reminder_plan(v_a.task_id);
end $$;

-- A place was removed by an admin: tell the family and take it out of the task's jobs.
create or replace function notification_after_place_removed(p_assignment_id uuid) returns void
language plpgsql security definer set search_path from current
as $$
declare v_a assignments%rowtype;
begin
  select * into v_a from assignments where id = p_assignment_id;
  if not found then
    return;
  end if;
  perform notification_notify_family(v_a.family_id, 'place_removed', 'task', v_a.task_id, v_a.task_id,
                                     v_a.id::text || ':' || v_a.version::text);
  perform reminder_plan(v_a.task_id);
end $$;

-- A swap was requested: tell the other family (the family of the target place).
create or replace function notification_after_swap_request(p_request_id uuid) returns void
language plpgsql security definer set search_path from current
as $$
declare
  v_r change_requests%rowtype;
  v_family uuid;
begin
  select * into v_r from change_requests where id = p_request_id;
  if not found then
    return;
  end if;
  select a.family_id into v_family from assignments a where a.id = v_r.target_assignment_id;
  perform notification_notify_family(v_family, 'swap_requested', 'change_request', v_r.id, v_r.source_task_id,
                                     v_r.id::text || ':' || v_r.version::text);
end $$;

-- The other family answered a swap request: applied tells both families and re-plans both tasks (each family
-- moves from one task's recipients to the other's); declined tells the requester only.
create or replace function notification_after_swap_response(p_request_id uuid, p_outcome text) returns void
language plpgsql security definer set search_path from current
as $$
declare
  v_r change_requests%rowtype;
  v_source uuid;
  v_target uuid;
begin
  select * into v_r from change_requests where id = p_request_id;
  if not found then
    return;
  end if;
  select a.family_id into v_source from assignments a where a.id = v_r.assignment_id;
  perform notification_notify_family(v_source, 'swap_decided', 'change_request', v_r.id, v_r.source_task_id,
                                     v_r.id::text || ':' || v_r.version::text);
  if p_outcome = 'applied' then
    select a.family_id into v_target from assignments a where a.id = v_r.target_assignment_id;
    perform notification_notify_family(v_target, 'swap_decided', 'change_request', v_r.id, v_r.source_task_id,
                                       v_r.id::text || ':' || v_r.version::text);
    perform reminder_plan_tasks(array[v_r.source_task_id, v_r.target_task_id]);
  end if;
end $$;

-- An admin decided a swap or a cancellation request: tell the families involved (both for a swap, the
-- requester's for a cancellation); an approval re-plans the tasks involved.
create or replace function notification_after_decision(p_request_id uuid, p_kind text, p_outcome text) returns void
language plpgsql security definer set search_path from current
as $$
declare
  v_r change_requests%rowtype;
  v_source uuid;
  v_target uuid;
begin
  select * into v_r from change_requests where id = p_request_id;
  if not found then
    return;
  end if;
  select a.family_id into v_source from assignments a where a.id = v_r.assignment_id;
  if p_kind = 'swap' then
    select a.family_id into v_target from assignments a where a.id = v_r.target_assignment_id;
    perform notification_notify_family(v_source, 'swap_decided', 'change_request', v_r.id, v_r.source_task_id,
                                       v_r.id::text || ':' || v_r.version::text);
    perform notification_notify_family(v_target, 'swap_decided', 'change_request', v_r.id, v_r.source_task_id,
                                       v_r.id::text || ':' || v_r.version::text);
    if p_outcome = 'approved' then
      perform reminder_plan_tasks(array[v_r.source_task_id, v_r.target_task_id]);
    end if;
  else
    perform notification_notify_family(v_source, 'cancellation_decided', 'change_request', v_r.id, v_r.source_task_id,
                                       v_r.id::text || ':' || v_r.version::text);
    if p_outcome = 'approved' then
      perform reminder_plan(v_r.source_task_id);
    end if;
  end if;
end $$;

-- The lifecycle removed a family (BR35.2): its parents' notices are deleted, not kept as history, and its
-- recipient rows go too, so no personal link remains. A job that has not run and has lost its last active
-- recipient is cancelled. The caller collected the parent ids before the lifecycle deleted or anonymized them.
create or replace function notification_after_lifecycle(p_family_id uuid, p_parent_ids uuid[]) returns void
language plpgsql security definer set search_path from current
as $$
declare v_jobs uuid[];
begin
  delete from notifications where parent_id = any (coalesce(p_parent_ids, '{}'::uuid[]));
  select coalesce(array_agg(r.reminder_job_id), '{}'::uuid[]) into v_jobs
    from reminder_recipients r where r.family_id = p_family_id;
  delete from reminder_recipients where family_id = p_family_id;
  update reminder_jobs j set status = 'cancelled'
   where j.id = any (v_jobs) and j.status in ('queued', 'retryable', 'retrying')
     and not exists (select 1 from reminder_recipients r where r.reminder_job_id = j.id and r.status = 'active');
end $$;

-- ---------------------------------------------------------------------------------------------------
-- The use cases. Renamed to their cores first (internal), then replaced by the wrappers below.
-- ---------------------------------------------------------------------------------------------------
alter function duty_sign_up(text, uuid, integer) rename to duty_sign_up_core;
alter function assignment_assign(text, uuid, uuid, integer) rename to assignment_assign_core;
alter function assignment_remove(text, uuid, integer) rename to assignment_remove_core;
alter function swap_request(text, uuid, integer, uuid, integer, text) rename to swap_request_core;
alter function swap_respond(text, uuid, boolean, integer) rename to swap_respond_core;
alter function coordination_decide(text, text, uuid, boolean, integer) rename to coordination_decide_core;
alter function family_archive(text, uuid, integer) rename to family_archive_core;
alter function task_save(text, jsonb) rename to task_save_core;
alter function event_save(text, jsonb) rename to event_save_core;
alter function settings_save(text, integer, boolean, text) rename to settings_save_core;
alter function lifecycle_run(text, uuid, integer, boolean) rename to lifecycle_run_core;

-- A place is taken by a parent (BR40.9: sign_up_confirmed to the signing family; the family joins the jobs).
create or replace function duty_sign_up(p_idempotency_key text, p_task_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  v_result := duty_sign_up_core(p_idempotency_key, p_task_id, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_place_added((v_result->>'reference')::uuid);
  end if;
  return v_result;
end $$;

-- A place is given by an admin (the same notice and job change).
create or replace function assignment_assign(
  p_idempotency_key text, p_task_id uuid, p_family_id uuid, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  v_result := assignment_assign_core(p_idempotency_key, p_task_id, p_family_id, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_place_added((v_result->>'reference')::uuid);
  end if;
  return v_result;
end $$;

-- A place is removed by an admin (place_removed to the family; the family leaves the jobs).
create or replace function assignment_remove(p_idempotency_key text, p_assignment_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  v_result := assignment_remove_core(p_idempotency_key, p_assignment_id, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_place_removed((v_result->>'reference')::uuid);
  end if;
  return v_result;
end $$;

-- A swap is requested (swap_requested to the other family).
create or replace function swap_request(
  p_idempotency_key text, p_assignment_id uuid, p_expected_version integer,
  p_target_assignment_id uuid, p_target_version integer, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  v_result := swap_request_core(p_idempotency_key, p_assignment_id, p_expected_version,
                                p_target_assignment_id, p_target_version, p_reason);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_swap_request((v_result->>'reference')::uuid);
  end if;
  return v_result;
end $$;

-- The other family confirms or declines (swap_decided; a confirmation exchanges the places and re-plans both tasks).
create or replace function swap_respond(
  p_idempotency_key text, p_request_id uuid, p_accept boolean, p_expected_version integer default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  v_result := swap_respond_core(p_idempotency_key, p_request_id, p_accept, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_swap_response((v_result->>'reference')::uuid, v_result->>'outcome');
  end if;
  return v_result;
end $$;

-- An admin decides a swap or a cancellation request: the shared body of swap_decide and cancellation_decide, which
-- keep calling it by this name.
create or replace function coordination_decide(
  p_kind text, p_idempotency_key text, p_request_id uuid, p_approve boolean, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  v_result := coordination_decide_core(p_kind, p_idempotency_key, p_request_id, p_approve, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_decision((v_result->>'reference')::uuid, p_kind, v_result->>'outcome');
  end if;
  return v_result;
end $$;

-- A family is archived (its places are removed: the family leaves the jobs, and a job left empty is cancelled).
create or replace function family_archive(p_idempotency_key text, p_family_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  v_result := family_archive_core(p_idempotency_key, p_family_id, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform reminder_plan_tasks(reminder_family_tasks((v_result->>'reference')::uuid));
  end if;
  return v_result;
end $$;

-- A task is saved: a new start makes the old jobs stale and plans new ones, a cancelled or closed task cancels
-- its jobs, a new task gets jobs under the group scope. No notices.
create or replace function task_save(p_idempotency_key text, p_task jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  v_result := task_save_core(p_idempotency_key, p_task);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform reminder_plan((v_result->>'reference')::uuid);
  end if;
  return v_result;
end $$;

-- An event is saved: when it is cancelled, the jobs of its (now closed) tasks are cancelled. No notices.
create or replace function event_save(p_idempotency_key text, p_event jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_result jsonb;
  v_ids uuid[];
begin
  v_result := event_save_core(p_idempotency_key, p_event);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed'
     and exists (select 1 from events e where e.id = (v_result->>'reference')::uuid and e.status = 'cancelled') then
    select coalesce(array_agg(t.id order by t.id), '{}'::uuid[]) into v_ids
      from tasks t where t.event_id = (v_result->>'reference')::uuid;
    perform reminder_plan_tasks(v_ids);
  end if;
  return v_result;
end $$;

-- The reminder setting is saved: switched off cancels every live job, switched on or another recipient scope
-- re-plans the upcoming tasks.
create or replace function settings_save(
  p_idempotency_key text, p_expected_version integer, p_enabled boolean, p_recipient_scope text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  v_result := settings_save_core(p_idempotency_key, p_expected_version, p_enabled, p_recipient_scope);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform reminder_plan_organization(identity_actor_organization());
  end if;
  return v_result;
end $$;

-- The lifecycle runs for a family: the notices of its parents and its recipient rows are deleted (BR35.2,
-- NFR1.56). The parent ids are read before the core deletes or anonymizes the parents.
create or replace function lifecycle_run(
  p_idempotency_key text, p_family_id uuid, p_expected_version integer, p_confirmed boolean
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_result jsonb;
  v_parents uuid[];
begin
  select coalesce(array_agg(p.id), '{}'::uuid[]) into v_parents from parents p where p.family_id = p_family_id;
  v_result := lifecycle_run_core(p_idempotency_key, p_family_id, p_expected_version, p_confirmed);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_lifecycle(p_family_id, v_parents);
  end if;
  return v_result;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Function rights. The cores and the helpers are internal; the replacements are executable by signed-in
-- accounts as the functions they replace were (they keep checking their caller in the core).
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  notification_notify_family(uuid, text, text, uuid, uuid, text),
  notification_after_place_added(uuid),
  notification_after_place_removed(uuid),
  notification_after_swap_request(uuid),
  notification_after_swap_response(uuid, text),
  notification_after_decision(uuid, text, text),
  notification_after_lifecycle(uuid, uuid[]),
  duty_sign_up_core(text, uuid, integer),
  assignment_assign_core(text, uuid, uuid, integer),
  assignment_remove_core(text, uuid, integer),
  swap_request_core(text, uuid, integer, uuid, integer, text),
  swap_respond_core(text, uuid, boolean, integer),
  coordination_decide_core(text, text, uuid, boolean, integer),
  family_archive_core(text, uuid, integer),
  task_save_core(text, jsonb),
  event_save_core(text, jsonb),
  settings_save_core(text, integer, boolean, text),
  lifecycle_run_core(text, uuid, integer, boolean),
  coordination_decide(text, text, uuid, boolean, integer)
  from public, anon, authenticated, service_role;

revoke all on function
  duty_sign_up(text, uuid, integer),
  assignment_assign(text, uuid, uuid, integer),
  assignment_remove(text, uuid, integer),
  swap_request(text, uuid, integer, uuid, integer, text),
  swap_respond(text, uuid, boolean, integer),
  family_archive(text, uuid, integer),
  task_save(text, jsonb),
  event_save(text, jsonb),
  settings_save(text, integer, boolean, text),
  lifecycle_run(text, uuid, integer, boolean)
  from public, anon, authenticated, service_role;
grant execute on function
  duty_sign_up(text, uuid, integer),
  assignment_assign(text, uuid, uuid, integer),
  assignment_remove(text, uuid, integer),
  swap_request(text, uuid, integer, uuid, integer, text),
  swap_respond(text, uuid, boolean, integer),
  family_archive(text, uuid, integer),
  task_save(text, jsonb),
  event_save(text, jsonb),
  settings_save(text, integer, boolean, text),
  lifecycle_run(text, uuid, integer, boolean)
  to authenticated;
