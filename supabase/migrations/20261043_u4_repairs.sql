-- U4 repair pass after the architecture review of the finished unit. Every statement here is a
-- `create or replace` (or a drop of a function this file replaces), so the file can be applied again without
-- harm. It supersedes these earlier definitions, which stay in their files because those files were applied
-- before: `family_archive`, `lifecycle_run` and `import_after_lifecycle` (20261038, 20261042), `reminder_plan`
-- (20261037), `import_commit` (20261041), `import_mark_interrupted`, `import_recover` (20261040) and
-- `identity_housekeeping` (20261021).
--
-- 1. Lock order of the `family_archive` wrapper (U3 NFR3.8: family row first, then task rows in ascending id
--    order). Under the recipient scope `group` the reminder planning of a family touches every task of the
--    family's groups, among them tasks with a lower id than the places the core had locked. Planning after the
--    core therefore took a lower task after a higher one, and a swap exchange or a settings save (which both take
--    their tasks in ascending order) could wait for it while it waited for them: a deadlock that Postgres ends by
--    cancelling one request. The wrapper now takes the family row, then the union of the tasks the core and the
--    planning will touch, in one ascending pass, before the core runs. The other wrappers of 20261038 were checked
--    for the same defect: `duty_sign_up`, `assignment_assign`, `assignment_remove`, `task_save` plan only a task
--    their core has locked; `swap_respond` and `coordination_decide` plan the two tasks their core locked (the
--    exchange); `event_save` plans the tasks its core locked when the event is cancelled; `settings_save` takes
--    its tasks in ascending order and holds no task before; `swap_request` plans nothing. Only `family_archive`
--    had the defect.
--
-- 2. Staged personal data expires without anyone opening the screen (BR41.8). `identity_housekeeping`, which the
--    sign-in runs at most once an hour through the service-role key, now also expires every run whose seven days
--    have passed and deletes its staged rows. `import_commit`, `import_recover` and `import_mark_interrupted` mark
--    a run they find past its date as expired and delete its staged rows in the same call, then answer with the
--    code they always stored for that case.
--
-- 3. `lifecycle_run`: the wrapper takes the family row lock first, reads the parents, the family name and the
--    names of the family's groups after it, and the staged-row clean-up matches the rows that name the family only
--    inside those groups (and the rows matched to the family by id), not by name across groups.
--
-- 4. `import_mark_interrupted` carries the fingerprint and the confirmation of the commit that failed and makes the
--    same checks as the commit (fingerprint, no open conflict, confirmation 'yes', run not expired); a run can
--    therefore only be interrupted, and so only be recovered, after a commit that passed them.
--
-- 5. `reminder_plan` adds a family to a job only while the job can still run (queued, retryable, retrying): a
--    family that signs up after a job is sent or terminal is not counted as a recipient of a job that never runs
--    again.

-- ---------------------------------------------------------------------------------------------------
-- 1. Lock order.
-- ---------------------------------------------------------------------------------------------------

-- The tasks a family's use case and the reminder planning after it will touch: the places that are not removed
-- (the core locks the tasks of all of them) and the tasks of `reminder_family_tasks`. Internal.
create or replace function reminder_family_task_set(p_family_id uuid) returns uuid[]
language sql stable set search_path from current
as $$
  select coalesce(array_agg(found.task_id order by found.task_id), '{}'::uuid[])
    from (
      select unnest(reminder_family_tasks(p_family_id)) as task_id
      union
      select a.task_id from assignments a where a.family_id = p_family_id and a.status <> 'removed'
    ) found
$$;

-- Takes the family's task set in one ascending pass and repeats until the set that was locked is the set there
-- is (a swap may move a place between the read and the lock). Internal; the caller holds the family row.
create or replace function reminder_lock_family_tasks(p_family_id uuid) returns void
language plpgsql set search_path from current
as $$
declare
  v_ids uuid[];
  v_now uuid[];
  v_try integer := 0;
begin
  loop
    v_try := v_try + 1;
    v_ids := reminder_family_task_set(p_family_id);
    perform 1 from tasks t where t.id = any (v_ids) order by t.id for update;
    v_now := reminder_family_task_set(p_family_id);
    exit when v_now = v_ids;
    if v_try >= 5 then
      raise exception 'notifications: the tasks of a family keep changing' using errcode = '40001';
    end if;
  end loop;
end $$;

-- A family is archived (its places are removed: the family leaves the jobs, and a job left empty is cancelled).
-- The family row and its tasks are locked first, in the fixed order, only for a caller who reaches the family;
-- every other caller goes straight to the core, which refuses it as before.
create or replace function family_archive(p_idempotency_key text, p_family_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_result jsonb;
  v_org uuid;
begin
  v_org := identity_actor_organization();
  if p_family_id is not null and v_org is not null and directory_reaches_family(v_org, p_family_id) then
    perform 1 from families f where f.id = p_family_id and f.organization_id = v_org for update;
    if found then
      perform reminder_lock_family_tasks(p_family_id);
    end if;
  end if;
  v_result := family_archive_core(p_idempotency_key, p_family_id, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform reminder_plan_tasks(reminder_family_tasks((v_result->>'reference')::uuid));
  end if;
  return v_result;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 5. The planner: recipients only for jobs that can still run. The body is that of 20261037 apart from the
--    guard around the recipients of a job.
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

    -- A job that was sent or ended (terminal) never runs again: nobody is added to it (or brought back into it).
    if v_job.status in ('queued', 'retryable', 'retrying') then
      insert into reminder_recipients (organization_id, reminder_job_id, family_id)
      select v_task.organization_id, v_job.id, wanted from unnest(v_families) as wanted
      on conflict (reminder_job_id, family_id) do update set status = 'active', updated_at = now()
        where reminder_recipients.status <> 'active';
    end if;
    update reminder_recipients set status = 'removed', updated_at = now()
     where reminder_job_id = v_job.id and status = 'active' and not (family_id = any (v_families));

    if cardinality(v_families) = 0 and v_job.status in ('queued', 'retryable', 'retrying') then
      update reminder_jobs set status = 'cancelled' where id = v_job.id;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 2. Expiry of staged data.
-- ---------------------------------------------------------------------------------------------------

-- Expires one open run and deletes its staged rows. The caller has locked the run row. Internal.
create or replace function import_expire_run(p_run_id uuid) returns void
language plpgsql set search_path from current
as $$
begin
  update import_runs set status = 'expired', version = version + 1, updated_at = now()
   where id = p_run_id and status in ('previewed', 'confirmed', 'interrupted');
  delete from import_staged_rows where import_run_id = p_run_id;
end $$;

-- Expires every organization's open runs whose seven days have passed, and deletes their staged rows. Returns the
-- number of runs. Internal: the housekeeping calls it.
create or replace function import_expire_all() returns integer
language plpgsql set search_path from current
as $$
declare v_ids uuid[];
begin
  with expired as (
    update import_runs set status = 'expired', version = version + 1, updated_at = now()
     where status in ('previewed', 'confirmed', 'interrupted') and expires_at <= now()
    returning id)
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from expired;
  delete from import_staged_rows where import_run_id = any (v_ids);
  return cardinality(v_ids);
end $$;

-- Housekeeping: stale reservations return to pending, sign-in attempt rows are kept for the lock function's whole
-- 30-minute look-back so a run can never shorten an active lock (20261021), and import runs past their seven days
-- expire with their staged rows (BR41.8).
create or replace function identity_housekeeping() returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_attempts integer; v_pruned integer; v_users integer; v_invitations integer; v_expired integer;
  v_released integer; v_imports integer;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  v_released := invitation_release_stale();
  delete from sign_in_attempts where attempted_at <= now() - interval '30 minutes';
  get diagnostics v_attempts = row_count;
  delete from sign_in_attempts
   where id in (select id from (
           select id, row_number() over (partition by email_hash order by attempted_at desc, id) as position
             from sign_in_attempts) ranked where ranked.position > 20);
  get diagnostics v_pruned = row_count;
  delete from auth.users u
   where u.raw_app_meta_data ? 'invitation_id'
     and u.created_at < now() - interval '1 hour'
     and not exists (select 1 from accounts a where a.id = u.id);
  get diagnostics v_users = row_count;
  delete from invitations
   where status in ('accepted', 'revoked', 'replaced') and updated_at < now() - interval '90 days';
  get diagnostics v_invitations = row_count;
  select count(*) into v_expired from invitations where status = 'pending' and expires_at <= now();
  v_imports := import_expire_all();
  return platform_result('success', null, 'done') || jsonb_build_object(
    'attempts_removed', v_attempts + v_pruned, 'users_removed', v_users,
    'invitations_removed', v_invitations, 'invitations_expired', v_expired,
    'reservations_released', v_released, 'import_runs_expired', v_imports);
end $$;

-- import_commit (20261041) with one change: a run found past its seven days is expired and its staged rows are
-- deleted in this call, which then answers IMPORT_PREVIEW_STALE as it always did.
create or replace function import_commit(
  p_idempotency_key text, p_run_id uuid, p_fingerprint text, p_confirmation text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'import.commit';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_run import_runs%rowtype;
  v_open integer;
  v_result jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_run_id::text, p_fingerprint, p_confirmation), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || coalesce(import_run_model((v_check->>'reference')::uuid), '{}'::jsonb);
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if v_org is null or not has_super_scope(v_org) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_run_id is null then
      perform platform_abort('invalidated', 'IMPORT_PREVIEW_STALE');
    end if;
    select * into v_run from import_runs r
     where r.id = p_run_id and r.organization_id = v_org and r.started_by_account_id = auth.uid() for update;
    -- The refusal for a run past its date is returned, not raised: raising would roll the deletion back.
    if found and v_run.status in ('previewed', 'confirmed', 'interrupted') and v_run.expires_at <= now() then
      perform import_expire_run(v_run.id);
      return platform_result('invalidated', null, 'IMPORT_PREVIEW_STALE');
    end if;
    if not found or v_run.status not in ('previewed', 'confirmed') then
      perform platform_abort('invalidated', 'IMPORT_PREVIEW_STALE');
    end if;
    if p_fingerprint is distinct from v_run.workbook_fingerprint then
      perform platform_abort('conflict', 'IMPORT_FINGERPRINT_CHANGED');
    end if;
    select count(*)::integer into v_open from import_conflicts c where c.import_run_id = v_run.id and c.resolution is null;
    if v_open > 0 then
      perform platform_abort('conflict', 'IMPORT_CONFLICT_UNRESOLVED');
    end if;
    if p_confirmation is distinct from 'yes' then
      perform platform_abort('conflict', 'IMPORT_CONFIRMATION_REQUIRED');
    end if;

    v_result := import_apply(v_run.id, 'committed');
    if v_result->>'state' = 'success' then
      perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_run.id);
    end if;
    return v_result;
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- import_mark_interrupted (20261040) with the commit's own checks (point 4) and the expiry deletion (point 2). The
-- one-argument function is dropped: a run can be marked only by a caller that presents the fingerprint and the
-- confirmation of the commit that failed.
drop function if exists import_mark_interrupted(uuid);
create or replace function import_mark_interrupted(p_run_id uuid, p_fingerprint text, p_confirmation text)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_run import_runs%rowtype;
  v_open integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := import_super_organization();
  if v_org is null then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_run from import_runs r
   where r.id = p_run_id and r.organization_id = v_org and r.started_by_account_id = auth.uid() for update;
  if not found or v_run.status not in ('previewed', 'confirmed', 'interrupted') then
    return platform_result('invalidated', null, 'IMPORT_PREVIEW_STALE');
  end if;
  if v_run.expires_at <= now() then
    perform import_expire_run(v_run.id);
    return platform_result('invalidated', null, 'IMPORT_PREVIEW_STALE');
  end if;
  if v_run.status <> 'interrupted' then
    if p_fingerprint is distinct from v_run.workbook_fingerprint then
      return platform_result('conflict', null, 'IMPORT_FINGERPRINT_CHANGED');
    end if;
    select count(*)::integer into v_open from import_conflicts c where c.import_run_id = v_run.id and c.resolution is null;
    if v_open > 0 then
      return platform_result('conflict', null, 'IMPORT_CONFLICT_UNRESOLVED');
    end if;
    if p_confirmation is distinct from 'yes' then
      return platform_result('conflict', null, 'IMPORT_CONFIRMATION_REQUIRED');
    end if;
    update import_runs set status = 'interrupted', step = 6, version = version + 1, updated_at = now()
     where id = v_run.id;
  end if;
  return platform_result('success', v_run.id, null) || import_run_model(v_run.id);
end $$;

-- import_recover (20261040) with one change: a run past its seven days is expired and its staged rows deleted in
-- this call, which then answers IMPORT_RECOVERY_NOT_AVAILABLE as it always did. A run is interrupted only after a
-- commit that presented the right fingerprint and the confirmation (import_mark_interrupted above), and
-- import_apply compares the fingerprint of the staged rows with the run's again.
create or replace function import_recover(p_idempotency_key text, p_run_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'import.recover';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_run import_runs%rowtype;
  v_result jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_run_id::text, p_action), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || coalesce(import_run_model((v_check->>'reference')::uuid), '{}'::jsonb);
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if v_org is null or not has_super_scope(v_org) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_action is distinct from 'resume' then
      perform platform_abort('conflict', 'IMPORT_RECOVERY_ACTION_INVALID');
    end if;
    select * into v_run from import_runs r
     where r.id = p_run_id and r.organization_id = v_org and r.started_by_account_id = auth.uid() for update;
    if found and v_run.status in ('previewed', 'confirmed', 'interrupted') and v_run.expires_at <= now() then
      perform import_expire_run(v_run.id);
      return platform_result('conflict', null, 'IMPORT_RECOVERY_NOT_AVAILABLE');
    end if;
    if not found or v_run.status <> 'interrupted' then
      perform platform_abort('conflict', 'IMPORT_RECOVERY_NOT_AVAILABLE');
    end if;

    v_result := import_apply(v_run.id, 'recovered');
    if v_result->>'state' = 'success' then
      perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_run.id);
    end if;
    return v_result;
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 3. The lifecycle: the family lock first, the staged-row clean-up inside the family's groups.
-- ---------------------------------------------------------------------------------------------------

-- Deletes the staged rows that name or are matched to a family that the lifecycle removed. A row is matched by the
-- family's id; a row that only names the family counts when it is in one of the groups the family belonged to,
-- so another group's family with the same name keeps its rows. Internal.
drop function if exists import_after_lifecycle(uuid, uuid, text);
create or replace function import_after_lifecycle(
  p_organization_id uuid, p_family_id uuid, p_family_name text, p_group_names text[]
) returns integer
language plpgsql set search_path from current
as $$
declare v_count integer;
begin
  delete from import_staged_rows s
   where s.organization_id = p_organization_id
     and ((s.matched_record_type = 'family' and s.matched_record_id = p_family_id)
          or (p_family_name is not null and s.payload ->> 'Család' = p_family_name
              and lower(btrim(coalesce(s.payload ->> 'Csoport', ''))) = any (coalesce(p_group_names, '{}'::text[]))));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function lifecycle_run(
  p_idempotency_key text, p_family_id uuid, p_expected_version integer, p_confirmed boolean
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_result jsonb;
  v_org uuid;
  v_parents uuid[] := '{}'::uuid[];
  v_name text;
  v_groups text[] := '{}'::text[];
begin
  v_org := identity_actor_organization();
  -- The family row first (U3 NFR3.8), only for a super admin of its own organization; the core takes it again and
  -- refuses every other caller as before. What the clean-up needs is read only after the lock, so a parent linked
  -- a moment ago is in the list.
  if p_family_id is not null and v_org is not null and current_session_is_active() and has_super_scope(v_org) then
    perform 1 from families f where f.id = p_family_id and f.organization_id = v_org for update;
    if found then
      select coalesce(array_agg(p.id), '{}'::uuid[]) into v_parents from parents p where p.family_id = p_family_id;
      select f.display_name into v_name from families f where f.id = p_family_id;
      select coalesce(array_agg(distinct lower(btrim(g.name))), '{}'::text[]) into v_groups
        from group_memberships m join groups g on g.id = m.group_id where m.family_id = p_family_id;
    end if;
  end if;
  v_result := lifecycle_run_core(p_idempotency_key, p_family_id, p_expected_version, p_confirmed);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_lifecycle(p_family_id, v_parents);
    perform import_after_lifecycle(v_org, p_family_id, v_name, v_groups);
  end if;
  return v_result;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Function rights, as before: the helpers are internal, the use cases are executable by signed-in accounts.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  reminder_family_task_set(uuid),
  reminder_lock_family_tasks(uuid),
  reminder_plan(uuid),
  import_expire_run(uuid),
  import_expire_all(),
  import_after_lifecycle(uuid, uuid, text, text[])
  from public, anon, authenticated, service_role;

revoke all on function
  family_archive(text, uuid, integer),
  lifecycle_run(text, uuid, integer, boolean),
  import_commit(text, uuid, text, text),
  import_mark_interrupted(uuid, text, text),
  import_recover(text, uuid, text),
  identity_housekeeping()
  from public, anon, authenticated, service_role;
grant execute on function
  family_archive(text, uuid, integer),
  lifecycle_run(text, uuid, integer, boolean),
  import_commit(text, uuid, text, text),
  import_mark_interrupted(uuid, text, text),
  import_recover(text, uuid, text)
  to authenticated;
grant execute on function identity_housekeeping() to service_role;
