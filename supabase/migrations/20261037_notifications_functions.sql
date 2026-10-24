-- U4 Notifications: the named functions (BR40.2 to BR40.8, BR42.3, BR42.4). Each is security definer with a
-- pinned search path, checks its caller itself (the callers paragraph of rules.md) and follows the pattern of
-- the U3 files: active session, idempotency check, authorization, change in one block that a business refusal
-- rolls back, then the stored result. Only a success is stored under an idempotency key. Business outcomes
-- are result envelopes {state, reference, code} with the screens' state names. None of these writes an
-- audit event (U1 BR3.2): notices, reminders and retries are not audited.
--
-- Reminder planning is a reconciliation: `reminder_plan(task)` looks at the task as it is now (its start and
-- status, its places, the organization's reminder setting) and makes the jobs and recipients match. It does
-- not matter which use case changed the task, so every hook of 20261038 just calls it for the tasks it
-- touched, and running it twice changes nothing (BR40.4, BR40.5). Instants are UTC: the thresholds are
-- exact hours, so a daylight-saving change needs no local-time arithmetic.
--
-- Lock order (U3 NFR3.8): the task row first, tasks in ascending id order. The planner takes the task row
-- (a lock the use case usually already holds), then touches that task's job rows. The tick takes job rows
-- with skip locked and never waits.

-- ---------------------------------------------------------------------------------------------------
-- Small internal helpers (not callable by any application role).
-- ---------------------------------------------------------------------------------------------------

-- The link a notice opens: the task page, or the page of the family's requests (BR40.2).
create or replace function notification_link(p_target_type text, p_task_id uuid) returns text
language sql immutable set search_path from current
as $$ select case when p_target_type = 'task' then '/szulo/feladatok/' || p_task_id::text else '/szulo/cserek' end $$;

-- The correlation id shown on the reminders screen: a short hash of the task, threshold and start, with no
-- family or person id in it.
create or replace function reminder_correlation(p_task_id uuid, p_threshold text, p_starts_at timestamptz) returns text
language sql stable set search_path from current
as $$ select left(encode(sha256(convert_to(
     concat_ws('|', p_task_id::text, p_threshold, extract(epoch from p_starts_at)::text), 'UTF8')), 'hex'), 12) $$;

-- The organization's reminder setting (U3 BR30.10): enabled or not, and the recipient scope (duty or group).
-- An organization that never saved the setting has the defaults of the table: enabled, duty.
create or replace function reminder_setting_for(p_organization_id uuid) returns jsonb
language sql stable security definer set search_path from current
as $$ select coalesce(
  (select jsonb_build_object('enabled', s.enabled, 'scope', s.recipient_scope)
     from reminder_settings s where s.organization_id = p_organization_id and s.threshold = 'default'),
  jsonb_build_object('enabled', true, 'scope', 'duty')) $$;

-- ---------------------------------------------------------------------------------------------------
-- reminder_plan: makes the jobs and recipients of one task match the task as it is now (BR40.4, BR40.5).
--   - a live job planned for another start becomes stale (the new start gets a new job below);
--   - a task that is not open, has started, or whose reminders are switched off has its queued, retryable
--     and retrying jobs cancelled and gets none;
--   - otherwise, per threshold (7d, 24h), one live job exists when the task has at least one recipient
--     family: scheduled for the start minus 168 or 24 hours, or for now when that moment has passed (a missed
--     threshold is created immediately, once);
--   - its recipients are the families of the setting: duty means the active families that hold a place that
--     is not removed, group means the active families that are active members of the task's group; families
--     that are no longer wanted become removed;
--   - a job that has not run and has no active recipient is cancelled.
-- Called inside the use cases of 20261038 (no separate caller); takes the task row first.
-- ---------------------------------------------------------------------------------------------------
create or replace function reminder_plan(p_task_id uuid) returns void
language plpgsql security definer set search_path from current
as $$
declare
  v_task tasks%rowtype;
  v_setting jsonb;
  v_families uuid[];
  v_threshold text;
  v_hours integer;
  v_scheduled timestamptz;
  v_job reminder_jobs%rowtype;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    return;
  end if;
  v_setting := reminder_setting_for(v_task.organization_id);

  update reminder_jobs set status = 'stale'
   where task_id = v_task.id and status not in ('stale', 'cancelled') and task_starts_at <> v_task.starts_at;

  if not ((v_setting->>'enabled')::boolean and v_task.status = 'open' and v_task.starts_at > now()) then
    update reminder_jobs set status = 'cancelled'
     where task_id = v_task.id and status in ('queued', 'retryable', 'retrying');
    return;
  end if;

  if v_setting->>'scope' = 'group' then
    select coalesce(array_agg(distinct f.id order by f.id), '{}'::uuid[]) into v_families
      from families f join group_memberships m on m.family_id = f.id
     where f.organization_id = v_task.organization_id and f.status = 'active'
       and m.group_id = v_task.group_id and m.status = 'active';
  else
    select coalesce(array_agg(distinct a.family_id order by a.family_id), '{}'::uuid[]) into v_families
      from assignments a join families f on f.id = a.family_id
     where a.task_id = v_task.id and a.status <> 'removed' and f.status = 'active';
  end if;

  foreach v_threshold in array array['7d', '24h'] loop
    v_hours := case v_threshold when '7d' then 168 else 24 end;
    select * into v_job from reminder_jobs
     where task_id = v_task.id and threshold = v_threshold and status not in ('stale', 'cancelled');
    if not found then
      if cardinality(v_families) = 0 then
        continue;
      end if;
      v_scheduled := v_task.starts_at - make_interval(hours => v_hours);
      if v_scheduled <= now() then
        v_scheduled := now();
      end if;
      insert into reminder_jobs (organization_id, task_id, threshold, task_starts_at, scheduled_for, correlation_id)
      values (v_task.organization_id, v_task.id, v_threshold, v_task.starts_at, v_scheduled,
              reminder_correlation(v_task.id, v_threshold, v_task.starts_at))
      returning * into v_job;
    end if;

    insert into reminder_recipients (organization_id, reminder_job_id, family_id)
    select v_task.organization_id, v_job.id, wanted from unnest(v_families) as wanted
    on conflict (reminder_job_id, family_id) do update set status = 'active', updated_at = now()
      where reminder_recipients.status <> 'active';
    update reminder_recipients set status = 'removed', updated_at = now()
     where reminder_job_id = v_job.id and status = 'active' and not (family_id = any (v_families));

    if cardinality(v_families) = 0 and v_job.status in ('queued', 'retryable', 'retrying') then
      update reminder_jobs set status = 'cancelled' where id = v_job.id;
    end if;
  end loop;
end $$;

-- Plans several tasks in ascending id order (the fixed lock order), each once.
create or replace function reminder_plan_tasks(p_task_ids uuid[]) returns void
language plpgsql security definer set search_path from current
as $$
declare v_id uuid;
begin
  for v_id in select distinct t from unnest(coalesce(p_task_ids, '{}'::uuid[])) as t order by t loop
    perform reminder_plan(v_id);
  end loop;
end $$;

-- The upcoming tasks of an organization, and those that still have a live job: what a change of the
-- reminder setting must re-plan (BR40.5).
create or replace function reminder_plan_organization(p_organization_id uuid) returns void
language plpgsql security definer set search_path from current
as $$
declare v_ids uuid[];
begin
  select coalesce(array_agg(t.id order by t.id), '{}'::uuid[]) into v_ids
    from tasks t
   where t.organization_id = p_organization_id
     and (t.starts_at > now()
          or exists (select 1 from reminder_jobs j where j.task_id = t.id and j.status not in ('stale', 'cancelled')));
  perform reminder_plan_tasks(v_ids);
end $$;

-- The tasks a family's reminders hang on: the tasks where it is an active recipient of a live job, and its
-- places on tasks that have not started (so a place that was just removed is found too).
create or replace function reminder_family_tasks(p_family_id uuid) returns uuid[]
language sql stable security definer set search_path from current
as $$
  select coalesce(array_agg(found.task_id order by found.task_id), '{}'::uuid[])
    from (
      select j.task_id
        from reminder_recipients r join reminder_jobs j on j.id = r.reminder_job_id
       where r.family_id = p_family_id and r.status = 'active' and j.status not in ('stale', 'cancelled')
      union
      select a.task_id
        from assignments a join tasks t on t.id = a.task_id
       where a.family_id = p_family_id and t.starts_at > now()
    ) found
$$;

-- ---------------------------------------------------------------------------------------------------
-- reminder_run_jobs: runs the due jobs of one organization with a simulated delivery (BR40.6). A job that is
-- queued or retrying and due gets one attempt for all its active recipients: success marks it sent, a
-- failure marks it retryable (attempts 1 and 2) or terminal (attempt 3). At the FIRST run of a job one
-- in-app notice per linked parent of each active recipient family is created (idempotent by dedupe key),
-- even when that attempt failed; a parent linked later is not backfilled. A job whose task has meanwhile
-- started, closed or been cancelled never runs: it is cancelled; one planned for another start is stale. The
-- jobs are taken with skip locked, so two ticks at the same time record one attempt per job and the second
-- never waits. The test seam: the setting `app.reminder_simulate` = 'fail' (set by the database session, never
-- by an application role) makes the simulated delivery fail.
-- ---------------------------------------------------------------------------------------------------
create or replace function reminder_run_jobs(p_organization_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_job reminder_jobs%rowtype;
  v_task tasks%rowtype;
  v_fail boolean := coalesce(current_setting('app.reminder_simulate', true), '') = 'fail';
  v_attempt integer;
  v_outcome text;
  v_status text;
  v_kind text;
  v_run integer := 0;
  v_sent integer := 0;
  v_failed integer := 0;
  v_dropped integer := 0;
begin
  for v_job in
    select * from reminder_jobs j
     where j.organization_id = p_organization_id and j.status in ('queued', 'retrying') and j.scheduled_for <= now()
     order by j.scheduled_for, j.id
       for update skip locked
  loop
    select * into v_task from tasks where id = v_job.task_id;
    if not found or v_task.status <> 'open' or v_task.starts_at <= now() then
      update reminder_jobs set status = 'cancelled' where id = v_job.id;
      v_dropped := v_dropped + 1;
      continue;
    end if;
    if v_task.starts_at <> v_job.task_starts_at then
      update reminder_jobs set status = 'stale' where id = v_job.id;
      v_dropped := v_dropped + 1;
      continue;
    end if;

    v_attempt := v_job.attempt + 1;
    if v_fail then
      v_outcome := case when v_attempt >= 3 then 'simulated_failed' else 'simulated_retry' end;
      v_status := case when v_attempt >= 3 then 'terminal' else 'retryable' end;
      v_failed := v_failed + 1;
    else
      v_outcome := 'simulated_sent';
      v_status := 'sent';
      v_sent := v_sent + 1;
    end if;

    if v_job.attempt = 0 then
      v_kind := case v_job.threshold when '7d' then 'reminder_7d' else 'reminder_24h' end;
      insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at,
                                 reminder_job_id, dedupe_key)
      select v_job.organization_id, p.id, v_kind, 'task', v_job.task_id, v_job.task_id, v_job.task_starts_at, v_job.id,
             concat_ws(':', v_kind, v_job.id::text, p.id::text, extract(epoch from v_job.task_starts_at)::bigint::text)
        from reminder_recipients r
        join parents p on p.family_id = r.family_id and p.organization_id = v_job.organization_id
       where r.reminder_job_id = v_job.id and r.status = 'active' and p.account_id is not null and p.status = 'active'
      on conflict (dedupe_key) do nothing;
    end if;

    insert into reminder_attempts (organization_id, reminder_job_id, attempt_number, outcome)
    values (v_job.organization_id, v_job.id, v_attempt, v_outcome);
    update reminder_jobs set status = v_status, attempt = v_attempt where id = v_job.id;
    v_run := v_run + 1;
  end loop;
  return platform_result('success', null, null)
    || jsonb_build_object('run', v_run, 'sent', v_sent, 'failed', v_failed, 'dropped', v_dropped);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- reminder_run_due: the lazy tick for a signed-in member of the organization (BR40.6). The server calls it
-- when a parent opens the notification list and when an admin opens the reminders screen. It is idempotent,
-- simulated and limited to the caller's own organization, so any member may call it; another
-- organization is denied. The system caller (seed, reset, housekeeping) uses reminder_run_due_system.
-- ---------------------------------------------------------------------------------------------------
create or replace function reminder_run_due(p_organization_id uuid default null) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_org uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if v_org is null or (p_organization_id is not null and p_organization_id <> v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  return reminder_run_jobs(v_org);
end $$;

-- The same tick for the system caller: the seed, the reset and housekeeping, through the server-only admin
-- access (the service-role key). Nobody else may call it.
create or replace function reminder_run_due_system(p_organization_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_organization_id is null or not exists (select 1 from organizations o where o.id = p_organization_id) then
    return platform_result('validation', null, 'organization_not_found');
  end if;
  return reminder_run_jobs(p_organization_id);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- notification_list: the signed-in parent's own notifications, newest first (BR40.2). Each item has the
-- Hungarian title built from the kind, the task title and (for a decision) the outcome of the request, the link
-- to the task or request page, the read state and the two display fields of the existing model:
--   timing         reminders: '7-day' / '24-hour', 'stale' when the job is stale or the task start moved,
--                  'cancelled' when the job or the task is cancelled; event notices: 'cancelled' when the
--                  task is cancelled or the swap request they announce was withdrawn, else 'within-threshold';
--   provider_status reminders by job status: sent -> simulated-sent; queued, retryable, retrying ->
--                  simulated-retry; terminal, stale, cancelled -> simulated-cancelled; event notices: always
--                  simulated-sent (the in-app notice itself is stored).
-- An account with no linked parent gets the empty list; a signed-out or deactivated one is denied.
-- ---------------------------------------------------------------------------------------------------
create or replace function notification_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_parent uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_parent := notification_actor_parent();
  if v_parent is null then
    return platform_result('success', null, null) || jsonb_build_object('items', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id,
           'title', case n.kind
             when 'sign_up_confirmed' then 'Jelentkezés megerősítve: '
             when 'swap_requested' then 'Cserekérés érkezett: '
             when 'swap_decided' then case
               when r.status in ('applied', 'approved') then 'Csere jóváhagyva: '
               when r.status in ('rejected', 'withdrawn') then 'Csere elutasítva: '
               else 'Csere döntés: ' end
             when 'cancellation_decided' then case
               when r.status = 'approved' then 'Lemondás jóváhagyva: '
               when r.status = 'rejected' then 'Lemondás elutasítva: '
               else 'Lemondás döntés: ' end
             when 'place_removed' then 'A helyed törölve: '
             when 'reminder_7d' then 'Egy hét múlva: '
             else 'Holnap: ' end || coalesce(t.title, 'Feladat'),
           'link', notification_link(n.target_type, n.task_id),
           'is_read', n.read_at is not null,
           'timing', case
             when n.kind in ('reminder_7d', 'reminder_24h') then case
               when j.status = 'cancelled' or t.status = 'cancelled' then 'cancelled'
               when j.status = 'stale' or t.starts_at is distinct from n.task_starts_at then 'stale'
               when n.kind = 'reminder_7d' then '7-day'
               else '24-hour' end
             else case
               when t.status = 'cancelled' or (n.kind = 'swap_requested' and r.status = 'withdrawn') then 'cancelled'
               else 'within-threshold' end end,
           'provider_status', case
             when n.kind in ('reminder_7d', 'reminder_24h') then case
               when j.status = 'sent' then 'simulated-sent'
               when j.status in ('queued', 'retryable', 'retrying') then 'simulated-retry'
               else 'simulated-cancelled' end
             else 'simulated-sent' end,
           'created_at', n.created_at) order by n.created_at desc, n.id desc), '[]'::jsonb)
    into v_items
    from notifications n
    left join tasks t on t.id = n.task_id
    left join reminder_jobs j on j.id = n.reminder_job_id
    left join change_requests r on n.target_type = 'change_request' and r.id = n.target_ref
   where n.parent_id = v_parent;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- notification_mark_read: the signed-in parent marks their own notification as read and gets the link to
-- follow (BR40.3). read_at is set once: a repeat keeps the first time and is harmless. A notification that
-- belongs to another parent, or does not exist, gives the same denied result and changes nothing.
-- ---------------------------------------------------------------------------------------------------
create or replace function notification_mark_read(p_notification_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_parent uuid;
  v_row notifications%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_parent := notification_actor_parent();
  if v_parent is null or p_notification_id is null then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  update notifications set read_at = coalesce(read_at, now())
   where id = p_notification_id and parent_id = v_parent
  returning * into v_row;
  if not found then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  return platform_result('success', v_row.id, null)
    || jsonb_build_object('link', notification_link(v_row.target_type, v_row.task_id));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- reminder_list: one row per task and threshold for an admin, restricted to the tasks of the groups the
-- admin reaches (BR40.8), optionally filtered by status. The row is the live job, or the latest one when
-- none is live. It shows the title (task title and threshold), status, attempt, version, correlation id, the
-- label 'Szimulált kézbesítés' and a count of active recipient families: never a name or an address. Other
-- roles are denied.
-- ---------------------------------------------------------------------------------------------------
create or replace function reminder_list(p_status text default null) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_groups uuid[];
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if v_org is null or not directory_is_admin(v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_status is not null
     and p_status not in ('queued', 'sent', 'retryable', 'retrying', 'stale', 'cancelled', 'terminal') then
    return platform_result('validation', null, 'status_invalid');
  end if;
  v_groups := coordination_reach_groups();
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', listed.id,
           'version', listed.version,
           'task_id', listed.task_id,
           'threshold', listed.threshold,
           'title', listed.task_title || ' — ' || case listed.threshold when '7d' then '7 napos' else '24 órás' end
                    || ' emlékeztető',
           'status', listed.status,
           'attempt', listed.attempt,
           'correlation_id', listed.correlation_id,
           'recipient_count', counted.n,
           'recipient_summary', case when counted.n = 0 then 'Nincs aktív címzett' else counted.n || ' kijelölt család' end,
           'provider_label', 'Szimulált kézbesítés',
           'scheduled_for', listed.scheduled_for) order by listed.scheduled_for, listed.id), '[]'::jsonb)
    into v_items
    from (
      select distinct on (j.task_id, j.threshold) j.*, t.title as task_title
        from reminder_jobs j join tasks t on t.id = j.task_id
       where j.organization_id = v_org and t.group_id = any (v_groups)
       order by j.task_id, j.threshold, (j.status in ('stale', 'cancelled')), j.created_at desc, j.id desc
    ) listed
    cross join lateral (
      select count(*)::integer as n from reminder_recipients r
       where r.reminder_job_id = listed.id and r.status = 'active') counted
   where p_status is null or listed.status = p_status;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- reminder_retry: an admin who reaches the task's group retries a retryable job as one action (BR40.7). The
-- job becomes retrying (its version rises) and the next run records the attempt for all its recipients at
-- once. A job that is not retryable gives the conflict REMINDER_NOT_RETRYABLE, a stale version the
-- invalidated result REMINDER_STALE; a job of another organization answers like a missing one. No audit event.
-- ---------------------------------------------------------------------------------------------------
create or replace function reminder_retry(p_idempotency_key text, p_job_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'reminder.retry';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_job reminder_jobs%rowtype;
  v_group uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_job_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_job_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_job from reminder_jobs j where j.id = p_job_id and j.organization_id = v_org for update;
    if not found then
      perform platform_abort('validation', 'reminder_not_found');
    end if;
    select t.group_id into v_group from tasks t where t.id = v_job.task_id;
    if v_group is null or not has_core_scope(v_org, v_group) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_job.status <> 'retryable' then
      perform platform_abort('conflict', 'REMINDER_NOT_RETRYABLE');
    end if;
    if v_job.version <> p_expected_version then
      perform platform_abort('invalidated', 'REMINDER_STALE');
    end if;

    update reminder_jobs set status = 'retrying' where id = v_job.id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_job.id);
    return platform_result('success', v_job.id, null)
      || jsonb_build_object('version', v_job.version + 1, 'status', 'retrying');
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Function rights. Helpers and the planner are internal (nobody executes them directly); the parent's
-- functions, the admin's functions and the member tick are executable by signed-in accounts and check their
-- caller themselves; the system tick is executable by the service-role key only.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  notification_link(text, uuid),
  reminder_correlation(uuid, text, timestamptz),
  reminder_setting_for(uuid),
  reminder_plan(uuid),
  reminder_plan_tasks(uuid[]),
  reminder_plan_organization(uuid),
  reminder_family_tasks(uuid),
  reminder_run_jobs(uuid),
  reminder_run_due(uuid),
  reminder_run_due_system(uuid),
  notification_list(),
  notification_mark_read(uuid),
  reminder_list(text),
  reminder_retry(text, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function
  reminder_run_due(uuid),
  notification_list(),
  notification_mark_read(uuid),
  reminder_list(text),
  reminder_retry(text, uuid, integer)
  to authenticated;
grant execute on function reminder_run_due_system(uuid) to service_role;
