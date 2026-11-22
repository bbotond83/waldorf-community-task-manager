-- U7 review fixes, second round (R-05 to R-07 of the code review). A new file, because migrations 59 to 61 were applied.
--  * R-07: swap_respond, cancellation_decide and swap_reverse no longer skip the outdated-screen check when no version
--    is sent: a missing version counts as outdated (the screens always send it).
--  * R-06: the daily expiry and the family removal lock every duty row ascending, then every place row ascending, for the
--    whole batch before they change the first request, so no lock set built up over the loop can meet a command's.
--  * R-05: an approved, rejected or reversed request must name when it was decided (the decider may be cleared by a
--    removal, so only the time is required).
begin;

alter table change_requests add constraint change_requests_decided_at_check
  check (status not in ('approved', 'rejected', 'reversed') or decided_at is not null);

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
  v_out jsonb;
  v_inner jsonb;
  v_req change_requests%rowtype;
  v_src assignments%rowtype;
  v_tgt assignments%rowtype;
  v_src_version integer;
  v_tgt_version integer;
  v_status text;
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
    -- The stored result keeps the state and the reference only, so the outcome is read from the request.
    select r.status into v_status from change_requests r where r.id = (v_check->>'reference')::uuid;
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || case when v_status is null then '{}'::jsonb
              else jsonb_build_object('outcome', case when v_status in ('applied', 'reversed') then 'applied' else 'declined' end) end;
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
    -- Only the target family may answer; a request that is not theirs and one that does not exist answer alike (NFR3.2).
    select f.organization_id into v_org from families f where f.id = v_family;
    select * into v_req from change_requests r
     where r.id = p_request_id and r.organization_id = v_org and r.kind = 'swap' and r.target_family_id = v_family;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform dutychanges_lock('{}'::uuid[], array[v_req.assignment_id, v_req.target_assignment_id]);
    select * into v_req from change_requests where id = p_request_id for update;
    if v_req.status <> 'open' then
      perform platform_abort('conflict', 'SWAP_REQUEST_NOT_OPEN');
    end if;
    if p_expected_version is distinct from v_req.version then
      perform platform_abort('invalidated', 'REQUEST_VERSION_STALE');
    end if;
    if dutychanges_earliest_start(v_req.id) <= now() then
      perform platform_abort('conflict', 'SWAP_EXPIRED');
    end if;
    select * into v_src from assignments where id = v_req.assignment_id;
    select * into v_tgt from assignments where id = v_req.target_assignment_id;

    if not p_accept then
      perform dutychanges_end_request(v_req.id, 'rejected', 'declined');
      update change_requests set target_confirmed = false where id = v_req.id;
      perform dutychanges_notify(v_req.source_family_id, 'swap_decided', v_req.id);
    else
      if v_src.task_id <> v_req.source_task_id or v_tgt.task_id <> v_req.target_task_id
         or v_src.version <> v_req.source_assignment_version or v_tgt.version <> v_req.target_assignment_version
         or v_src.status <> 'swap_pending' or v_tgt.status <> 'swap_pending'
         or v_src.family_id <> v_req.source_family_id or v_tgt.family_id <> v_req.target_family_id then
        perform platform_abort('conflict', 'SWAP_CANNOT_BE_APPLIED');
      end if;
      begin
        perform dutychanges_swap_check(v_src.id, v_tgt.id);
      exception when sqlstate 'U3R00' then
        get stacked diagnostics v_detail = pg_exception_detail;
        v_inner := v_detail::jsonb;
        perform platform_abort('conflict', 'SWAP_CANNOT_BE_APPLIED',
                               jsonb_build_object('reason', v_inner->>'code') ||
                               case when v_inner ? 'reason' then jsonb_build_object('detail', v_inner->>'reason') else '{}'::jsonb end);
      end;
      perform place_exchange(v_src.id, v_src.version, v_tgt.id, v_tgt.version);
      update assignments set status = 'active' where id in (v_src.id, v_tgt.id);
      perform rota_adjust_picks_after_change(jsonb_build_array(
        jsonb_build_object('place_id', v_src.id, 'new_family_id', v_tgt.family_id),
        jsonb_build_object('place_id', v_tgt.id, 'new_family_id', v_src.family_id)));
      select a.version into v_src_version from assignments a where a.id = v_src.id;
      select a.version into v_tgt_version from assignments a where a.id = v_tgt.id;
      update change_requests
         set status = 'applied', target_confirmed = true,
             applied_source_version = v_src_version, applied_target_version = v_tgt_version
       where id = v_req.id;
      perform dutychanges_notify(v_req.source_family_id, 'swap_decided', v_req.id);
      perform dutychanges_notify(v_req.target_family_id, 'swap_decided', v_req.id);
      perform reminder_plan_tasks(array[v_req.source_task_id, v_req.target_task_id]);
    end if;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_req.id);
    return platform_result('success', v_req.id, null)
      || jsonb_build_object('outcome', case when p_accept then 'applied' else 'declined' end);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    v_out := v_detail::jsonb;
    if v_out->>'state' = 'denied' then
      perform dutychanges_record_denial(c_operation, p_idempotency_key, v_fingerprint, 'swap.denied', 'change_request',
                                        p_request_id);
    end if;
    return v_out;
  end;
end $$;

create or replace function cancellation_decide(
  p_idempotency_key text, p_request_id uuid, p_approve boolean, p_expected_version integer default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'cancellation.decide';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_out jsonb;
  v_req change_requests%rowtype;
  v_task tasks%rowtype;
  v_src assignments%rowtype;
  v_reached boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_request_id::text, p_approve::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || coalesce((select jsonb_build_object('outcome', case when r.status = 'approved' then 'approved' else 'rejected' end)
                     from change_requests r where r.id = (v_check->>'reference')::uuid
                      and r.status in ('approved', 'rejected')), '{}'::jsonb);
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_org := identity_actor_organization();
    if p_request_id is null or p_approve is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_req from change_requests r
     where r.id = p_request_id and r.organization_id = v_org and r.kind = 'cancellation';
    if found then
      select * into v_task from tasks t where t.id = v_req.source_task_id;
      v_reached := case when v_task.origin_kind <> 'manual' then coalesce(has_super_scope(v_org), false)
                        else coalesce(has_core_scope(v_org, v_task.group_id), false) end;
    end if;
    if not found or not v_reached then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform dutychanges_lock('{}'::uuid[], array[v_req.assignment_id]);
    select * into v_req from change_requests where id = p_request_id for update;
    if v_req.status <> 'open' then
      perform platform_abort('conflict', 'APPROVAL_ALREADY_DECIDED');
    end if;
    if p_expected_version is distinct from v_req.version then
      perform platform_abort('invalidated', 'APPROVAL_INVALIDATED');
    end if;
    select * into v_task from tasks where id = v_req.source_task_id;
    if v_task.starts_at <= now() then
      perform platform_abort('conflict', 'CANCELLATION_EXPIRED');
    end if;
    select * into v_src from assignments where id = v_req.assignment_id;
    if v_src.task_id <> v_req.source_task_id or v_src.version <> v_req.source_assignment_version
       or v_src.status <> 'cancellation_pending' then
      perform platform_abort('invalidated', 'APPROVAL_INVALIDATED');
    end if;

    if p_approve then
      update change_requests
         set status = 'approved', decided_by_account_id = auth.uid(), decided_at = now()
       where id = v_req.id;
      perform place_release(v_src.id, v_src.version);
      if v_task.origin_kind = 'rota_week' then
        perform rota_adjust_picks_after_change(jsonb_build_array(
          jsonb_build_object('place_id', v_src.id, 'new_family_id', null)));
      end if;
      update tasks set updated_at = now() where id = v_task.id;
      perform reminder_plan_tasks(array[v_task.id]);
      perform platform_audit_write('approval.approve', 'change_request', v_req.id, v_org, v_task.group_id, 'success',
                                   'cancellation');
    else
      update change_requests
         set status = 'rejected', ended_reason = 'administrator_rejected', decided_by_account_id = auth.uid(),
             decided_at = now()
       where id = v_req.id;
      update assignments set status = 'active' where id = v_src.id and status = 'cancellation_pending';
      perform platform_audit_write('approval.reject', 'change_request', v_req.id, v_org, v_task.group_id, 'success',
                                   'cancellation');
    end if;
    perform dutychanges_notify(v_req.source_family_id, 'cancellation_decided', v_req.id);

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_req.id);
    return platform_result('success', v_req.id, null)
      || jsonb_build_object('outcome', case when p_approve then 'approved' else 'rejected' end);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    v_out := v_detail::jsonb;
    if v_out->>'state' = 'denied' then
      perform dutychanges_record_denial(c_operation, p_idempotency_key, v_fingerprint, 'cancellation.denied',
                                        'change_request', p_request_id);
    end if;
    return v_out;
  end;
end $$;

create or replace function swap_reverse(p_idempotency_key text, p_request_id uuid, p_expected_version integer default null)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'swap.reverse';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_out jsonb;
  v_req change_requests%rowtype;
  v_st tasks%rowtype;
  v_tt tasks%rowtype;
  v_src assignments%rowtype;
  v_tgt assignments%rowtype;
  v_reached boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_request_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_org := identity_actor_organization();
    select * into v_req from change_requests r
     where r.id = p_request_id and r.organization_id = v_org and r.kind = 'swap';
    if found then
      select * into v_st from tasks t where t.id = v_req.source_task_id;
      select * into v_tt from tasks t where t.id = v_req.target_task_id;
      v_reached := case when v_st.origin_kind <> 'manual' or v_tt.origin_kind <> 'manual'
                        then coalesce(has_super_scope(v_org), false)
                        else coalesce(has_core_scope(v_org, v_st.group_id), false)
                         and coalesce(has_core_scope(v_org, v_tt.group_id), false) end;
    end if;
    if not found or not v_reached then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform dutychanges_lock('{}'::uuid[], array[v_req.assignment_id, v_req.target_assignment_id]);
    select * into v_req from change_requests where id = p_request_id for update;
    if v_req.status <> 'applied' then
      perform platform_abort('conflict', 'SWAP_NOT_APPLIED');
    end if;
    if p_expected_version is distinct from v_req.version then
      perform platform_abort('invalidated', 'REQUEST_VERSION_STALE');
    end if;
    select * into v_src from assignments where id = v_req.assignment_id;
    select * into v_tgt from assignments where id = v_req.target_assignment_id;
    select * into v_st from tasks where id = v_src.task_id;
    select * into v_tt from tasks where id = v_tgt.task_id;
    if v_st.status <> 'open' or v_tt.status <> 'open' or v_st.starts_at <= now() or v_tt.starts_at <= now() then
      perform platform_abort('conflict', 'DUTY_CLOSED');
    end if;
    if v_req.applied_source_version is null or v_req.applied_target_version is null
       or v_src.version <> v_req.applied_source_version or v_tgt.version <> v_req.applied_target_version
       or v_src.status <> 'active' or v_tgt.status <> 'active' then
      perform platform_abort('conflict', 'SWAP_CHANGED_SINCE');
    end if;
    perform dutychanges_swap_check(v_src.id, v_tgt.id);

    perform place_exchange(v_src.id, v_src.version, v_tgt.id, v_tgt.version);
    perform rota_adjust_picks_after_change(jsonb_build_array(
      jsonb_build_object('place_id', v_src.id, 'new_family_id', v_tgt.family_id),
      jsonb_build_object('place_id', v_tgt.id, 'new_family_id', v_src.family_id)));
    update change_requests set status = 'reversed', decided_by_account_id = auth.uid(), decided_at = now()
     where id = v_req.id;
    perform dutychanges_notify(v_req.source_family_id, 'swap_reversed', v_req.id);
    perform dutychanges_notify(v_req.target_family_id, 'swap_reversed', v_req.id);
    perform reminder_plan_tasks(array[v_req.source_task_id, v_req.target_task_id]);
    perform platform_audit_write('swap.reversed', 'change_request', v_req.id, v_org, null, 'success', 'swap');

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_req.id);
    return platform_result('success', v_req.id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    v_out := v_detail::jsonb;
    if v_out->>'state' = 'denied' then
      perform dutychanges_record_denial(c_operation, p_idempotency_key, v_fingerprint, 'swap.reversed',
                                        'change_request', p_request_id);
    end if;
    return v_out;
  end;
end $$;

create or replace function dutychanges_swap_expiry_check(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_row record;
  v_req change_requests%rowtype;
  v_n integer;
  v_created integer := 0;
  v_skipped integer := 0;
  v_tasks uuid[];
  v_places uuid[];
begin
  select coalesce(array_agg(distinct s.t) filter (where s.t is not null), '{}'::uuid[]),
         coalesce(array_agg(distinct s.p) filter (where s.p is not null), '{}'::uuid[])
    into v_tasks, v_places
    from (select unnest(array[r.source_task_id, r.target_task_id]) as t,
                 unnest(array[r.assignment_id, r.target_assignment_id]) as p
            from change_requests r
            join tasks st on st.id = r.source_task_id
            left join tasks tt on tt.id = r.target_task_id
           where r.status = 'open' and least(st.starts_at, coalesce(tt.starts_at, st.starts_at)) <= v_now) s;
  perform dutychanges_lock(v_tasks, v_places);
  for v_row in
    select r.id, r.assignment_id, r.target_assignment_id, r.source_task_id, r.target_task_id
      from change_requests r
      join tasks st on st.id = r.source_task_id
      left join tasks tt on tt.id = r.target_task_id
     where r.status = 'open' and least(st.starts_at, coalesce(tt.starts_at, st.starts_at)) <= v_now
     order by r.id
  loop
    perform dutychanges_lock(array_remove(array[v_row.source_task_id, v_row.target_task_id], null),
                             array_remove(array[v_row.assignment_id, v_row.target_assignment_id], null));
    select * into v_req from change_requests where id = v_row.id for update;
    if v_req.status <> 'open' then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if v_req.kind = 'swap' then
      perform dutychanges_end_request(v_req.id, 'expired', 'earlier_duty_started');
      v_n := dutychanges_notify(v_req.source_family_id, 'swap_expired', v_req.id)
           + dutychanges_notify(v_req.target_family_id, 'swap_expired', v_req.id);
    else
      perform dutychanges_end_request(v_req.id, 'expired', 'duty_started');
      v_n := dutychanges_notify(v_req.source_family_id, 'cancellation_decided', v_req.id);
    end if;
    if v_n > 0 then
      v_created := v_created + v_n;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end $$;

create or replace function dutychanges_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_preview jsonb := dutychanges_removal_preview(p_subject_kind, p_subject_id);
  v_parents uuid[];
  v_accounts uuid[];
  v_family uuid;
  v_row record;
  v_req change_requests%rowtype;
  v_tasks uuid[];
  v_places uuid[];
begin
  if p_subject_kind = 'family' then
    v_family := p_subject_id;
    select coalesce(array_agg(p.id), '{}'::uuid[]), coalesce(array_agg(p.account_id) filter (where p.account_id is not null), '{}'::uuid[])
      into v_parents, v_accounts from parents p where p.family_id = p_subject_id;
  elsif p_subject_kind = 'parent' then
    select coalesce(array_agg(p.id), '{}'::uuid[]), coalesce(array_agg(p.account_id) filter (where p.account_id is not null), '{}'::uuid[])
      into v_parents, v_accounts from parents p where p.id = p_subject_id;
  else
    return v_preview;
  end if;

  if v_family is not null then
    select coalesce(array_agg(distinct s.t) filter (where s.t is not null), '{}'::uuid[]),
           coalesce(array_agg(distinct s.p) filter (where s.p is not null), '{}'::uuid[])
      into v_tasks, v_places
      from (select unnest(array[r.source_task_id, r.target_task_id]) as t,
                   unnest(array[r.assignment_id, r.target_assignment_id]) as p
              from change_requests r
             where r.status = 'open' and (r.source_family_id = v_family or r.target_family_id = v_family)) s;
    perform dutychanges_lock(v_tasks, v_places);
    for v_row in
      select r.id, r.assignment_id, r.target_assignment_id, r.source_task_id, r.target_task_id
        from change_requests r
       where r.status = 'open' and (r.source_family_id = v_family or r.target_family_id = v_family)
       order by r.id
    loop
      perform dutychanges_lock(array_remove(array[v_row.source_task_id, v_row.target_task_id], null),
                               array_remove(array[v_row.assignment_id, v_row.target_assignment_id], null));
      select * into v_req from change_requests where id = v_row.id for update;
      if v_req.status <> 'open' then
        continue;
      end if;
      perform dutychanges_end_request(v_req.id, 'cancelled', 'family_removed');
      if v_req.kind = 'swap' then
        perform dutychanges_notify(case when v_req.source_family_id = v_family then v_req.target_family_id
                                        else v_req.source_family_id end, 'swap_cancelled', v_req.id);
      end if;
    end loop;
    update change_requests set reason = null
     where (source_family_id = v_family or target_family_id = v_family) and reason is not null;
  end if;
  update change_requests set requested_by_parent_id = null
   where status <> 'open' and requested_by_parent_id = any (v_parents);
  update change_requests set decided_by_account_id = null where decided_by_account_id = any (v_accounts);
  return v_preview;
end $$;

commit;
