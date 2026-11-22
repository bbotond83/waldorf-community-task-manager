-- U7 swaps and duty changes (DutyChanges block): swaps across any kind of duty, accepted by the other family and applied
-- at once; cancellations decided by an administrator; an administrator's reassignment of a published duty; the reversal
-- of an applied swap; the daily expiry; and the functions the later units call (C9 check, C16 removal pair).
--
-- One forward-only file, as the team's deployment rule asks. It opens and commits its own transaction, like the files
-- of U5 and U13, so a failed statement leaves nothing behind.
--
-- Lock order (BR77.1): the duty (task) rows ascending, then the place (assignment) rows ascending, then the request
-- row, in one pass that already includes the weekend slot duties and places a rota change can reach through C11.
-- No command takes a family row lock to check a family's standing.
--
-- The table `change_requests` is read only through the functions of this file: its policy and its select right for
-- signed-in accounts are removed (NFR1.3). The kernel swap functions, their `_core` bodies, the administrator's
-- approval of swaps (`swap_decide`) and the hooks of the earlier notification work are replaced or retired here.
begin;

-- ---------------------------------------------------------------------------------------------------
-- 1. The table gains the families, the versions after applying and the reason a request ended; three statuses;
--    a requester that may be cleared. Open swaps are converted: the target place of an open swap is marked pending now,
--    and its stored version is the version after that mark (BR71.5).
-- ---------------------------------------------------------------------------------------------------
alter table change_requests
  add column source_family_id uuid,
  add column target_family_id uuid,
  add column applied_source_version integer,
  add column applied_target_version integer,
  add column ended_reason text;

update change_requests r
   set source_family_id = (select a.family_id from assignments a where a.id = r.assignment_id),
       target_family_id = (select a.family_id from assignments a where a.id = r.target_assignment_id);

-- The families of a request are the holders of its places when it is made. The commands send them; a row written without
-- them (a fixture, a seed) takes them from the places, so the two can never disagree at the start.
create or replace function change_requests_fill_families() returns trigger
language plpgsql set search_path from current
as $$
begin
  if new.source_family_id is null then
    select a.family_id into new.source_family_id from assignments a where a.id = new.assignment_id;
  end if;
  if new.target_family_id is null and new.target_assignment_id is not null then
    select a.family_id into new.target_family_id from assignments a where a.id = new.target_assignment_id;
  end if;
  return new;
end $$;
create trigger change_requests_fill_families before insert on change_requests
  for each row execute function change_requests_fill_families();

alter table change_requests alter column source_family_id set not null;
alter table change_requests alter column requested_by_parent_id drop not null;

alter table change_requests drop constraint change_requests_status_check;
alter table change_requests add constraint change_requests_status_check check (status in (
  'open', 'applied', 'rejected', 'withdrawn', 'expired', 'cancelled', 'approved', 'reversed'));
alter table change_requests add constraint change_requests_ended_reason_check check (ended_reason is null or ended_reason in (
  'declined', 'withdrawn_by_requester', 'earlier_duty_started', 'duty_started', 'duty_reassigned', 'family_removed',
  'administrator_rejected'));
alter table change_requests add constraint change_requests_target_family check (kind <> 'swap' or target_family_id is not null);

-- The old check that an approved or rejected request names its decider cannot stay: a decline is the family's, and the
-- removal of a person clears the decider (BR77.3).
do $$
declare v_name text;
begin
  for v_name in
    select c.conname from pg_constraint c
     where c.conrelid = 'change_requests'::regclass and c.contype = 'c'
       and pg_get_constraintdef(c.oid) like '%decided_by_account_id IS NOT NULL%'
  loop
    execute format('alter table change_requests drop constraint %I', v_name);
  end loop;
end $$;

-- An old open swap: its target place is asked as well now (swap_pending), and the stored target version is the version
-- the place has after that mark. A target place that changed since the request keeps its old stored version, so an
-- acceptance refuses it like any changed place.
with marked as (
  update assignments a set status = 'swap_pending'
    from change_requests r
   where r.status = 'open' and r.kind = 'swap' and a.id = r.target_assignment_id
     and a.status = 'active' and a.version = r.target_assignment_version
  returning r.id as request_id, a.version as new_version)
update change_requests r set target_assignment_version = m.new_version from marked m where r.id = m.request_id;

-- The table is read only through the functions (NFR1.3): the reason is shown to the two families and administrators only.
drop policy change_requests_read on change_requests;
revoke select on change_requests from authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 2. A rota week whose duty an administrator cancelled shows as flagged with the reason `cancelled` (Q3).
-- ---------------------------------------------------------------------------------------------------
alter table rota_weeks drop constraint rota_weeks_empty_reason_check;
alter table rota_weeks add constraint rota_weeks_empty_reason_check
  check (empty_reason in ('no_family', 'rule_clash', 'cleared', 'not_drafted', 'cancelled'));

-- ---------------------------------------------------------------------------------------------------
-- 3. The audit action list gains the two interventions (NFR4) and the two denial actions of the commands here.
-- ---------------------------------------------------------------------------------------------------
alter table audit_events drop constraint audit_events_action_check;
alter table audit_events add constraint audit_events_action_check check (action in (
  'role.grant', 'role.revoke', 'role.first_super_admin',
  'approval.approve', 'approval.reject',
  'import.commit',
  'lifecycle.anonymize', 'lifecycle.delete', 'lifecycle.hold_place', 'lifecycle.hold_release',
  'account.deactivate', 'account.reactivate',
  'rota.publish', 'rota.discard',
  'profile.sharing_changed', 'account.password_changed', 'account.email_change_requested',
  'account.email_changed', 'family.added', 'parent.added', 'parent.removed', 'invitation.sent',
  'family.standing_set', 'weekend_pick.assign',
  'event.cancelled', 'event.organiser_marked', 'event.organiser_unmarked', 'event.signup_removed',
  'event.offer_removed', 'event.name_cleared', 'event.removal_applied',
  'library_book_returned_by_admin', 'library_book_changed_by_admin', 'library_book_removed_by_admin',
  'library_owner_changed_by_admin', 'library_removal_applied',
  'swap.reversed', 'duty.reassigned', 'swap.denied', 'cancellation.denied'
));

-- ---------------------------------------------------------------------------------------------------
-- 4. The five new notice kinds (C8). `swap_decided` now covers accepted and declined. Registry rows only.
-- ---------------------------------------------------------------------------------------------------
insert into notice_kinds (kind, target_type, title_prefix, label, added_by) values
  ('swap_withdrawn', 'change_request', 'Csere visszavonva:', 'Csere visszavonva', 'u7-swaps'),
  ('swap_expired', 'change_request', 'Csere lejárt:', 'Csere lejárt', 'u7-swaps'),
  ('swap_cancelled', 'change_request', 'Csere megszűnt:', 'Csere megszűnt', 'u7-swaps'),
  ('swap_reversed', 'change_request', 'Csere visszacsinálva:', 'Csere visszacsinálva', 'u7-swaps'),
  ('duty_reassigned', 'task', 'Feladat átadva:', 'Feladat átadva', 'u7-swaps');

-- The facts of a request notice (BR50.4): the duty the reading family holds in the request, its date, the other duty and
-- the other family's display name, and, for the request notice alone, the proposer's reason. It reads ended requests
-- too and returns nothing for an unknown id.
create or replace function notice_facts_change_request(p_target_id uuid, p_parent_id uuid, p_kind text)
returns table (item_name text, item_date date, path text, full_title text, detail text)
language sql stable security definer set search_path from current
as $$
  select o.title, (o.starts_at at time zone 'Europe/Budapest')::date, '/szulo/cserek',
         case p_kind
           when 'swap_decided' then case
             when r.status in ('applied', 'reversed') then 'Csere elfogadva: ' || o.title
             when r.status = 'rejected' then 'Csere elutasítva: ' || o.title end
           when 'cancellation_decided' then case r.status
             when 'approved' then 'Lemondás jóváhagyva: ' || o.title
             when 'rejected' then 'Lemondás elutasítva: ' || o.title
             when 'expired' then 'Lemondás lejárt: ' || o.title
             when 'cancelled' then 'Lemondás megszűnt: ' || o.title end
         end,
         nullif(concat_ws(' ',
           case when r.kind = 'swap' then 'Csere: ' || o.title || ' ↔ ' || x.title || ' (' || x.family_name || ').' end,
           case when p_kind = 'swap_requested' and r.reason is not null
                then 'A kérelmező indoklása: ' || r.reason end), '')
    from change_requests r
    join parents p on p.id = p_parent_id and p.organization_id = r.organization_id
   cross join lateral (
     select t.title, t.starts_at from tasks t
      where t.id = case when r.kind = 'swap' and p.family_id = r.target_family_id then r.target_task_id
                        else r.source_task_id end) o
    left join lateral (
     select t.title, family_display_name(case when p.family_id = r.target_family_id then r.source_family_id
                                               else r.target_family_id end) as family_name
       from tasks t
      where r.kind = 'swap'
        and t.id = case when p.family_id = r.target_family_id then r.source_task_id else r.target_task_id end) x on true
   where r.id = p_target_id
$$;

-- ---------------------------------------------------------------------------------------------------
-- 5. The functions of the earlier kernel work that this block replaces or retires. The swap, cancellation and withdrawal
--    wrappers (20261053) and their `_core` bodies, the administrator's approval of swaps, the swap check and exchange, and
--    the notification hooks that only they called. The rewritten commands follow in sections 9 and 10.
-- ---------------------------------------------------------------------------------------------------
drop function swap_decide(text, uuid, boolean, integer);
drop function cancellation_decide(text, uuid, boolean, integer);
drop function coordination_decide(text, text, uuid, boolean, integer);
drop function coordination_decide_core(text, text, uuid, boolean, integer);
drop function swap_request_core(text, uuid, integer, uuid, integer, text);
drop function swap_respond_core(text, uuid, boolean, integer);
drop function swap_withdraw_core(text, uuid);
drop function cancellation_request_core(text, uuid, integer, text);
drop function swap_standing_check(uuid, uuid);
drop function swap_candidates(uuid);
drop function coordination_swap_check(uuid, uuid);
drop function coordination_swap_exchange(uuid, text, uuid);
drop function notification_after_swap_request(uuid);
drop function notification_after_swap_response(uuid, text);
drop function notification_after_decision(uuid, text, text);

-- ---------------------------------------------------------------------------------------------------
-- 6. C5: `place_add` gives a duty that has room a place for one family (BR74.1). Internal: only the DutyChanges block calls
--    it, in its own transaction, so a refusal is raised through U3R00 and ends the caller's whole change. Like
--    place_reassign it checks no eligibility and writes no audit; a duty that has started or is closed cannot change.
-- ---------------------------------------------------------------------------------------------------
create or replace function place_add(p_task uuid, p_family uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_task tasks%rowtype;
  v_id uuid;
begin
  perform 1 from tasks t where t.id = p_task for update;
  select * into v_task from tasks where id = p_task;
  if not found then
    perform platform_abort('validation', 'duty_not_found');
  end if;
  if v_task.status <> 'open' or v_task.starts_at <= now() then
    perform platform_abort('conflict', 'DUTY_CLOSED');
  end if;
  if p_family is null
     or not exists (select 1 from families f where f.id = p_family and f.organization_id = v_task.organization_id)
     or exists (select 1 from assignments x
                 where x.task_id = v_task.id and x.family_id = p_family and x.status <> 'removed') then
    perform platform_abort('conflict', 'DUTY_ALREADY_ASSIGNED');
  end if;
  if (select count(*) from assignments a where a.task_id = v_task.id and a.status <> 'removed') >= v_task.capacity then
    perform platform_abort('conflict', 'DUTY_FULL');
  end if;
  insert into assignments (organization_id, task_id, family_id, source, status)
  values (v_task.organization_id, v_task.id, p_family, 'admin_assign', 'active')
  returning id into v_id;
  return platform_result('success', v_id, null);
end $$;

-- `coordination_withdraw_requests` (called by place_release, a removal and U8's slot release) now returns both places of
-- a withdrawn swap to active, because the target place of a swap is pending too. The request stays `withdrawn`.
create or replace function coordination_withdraw_requests(p_assignment_ids uuid[]) returns void
language plpgsql set search_path from current
as $$
begin
  with withdrawn as (
    update change_requests set status = 'withdrawn'
     where status = 'open'
       and (assignment_id = any (p_assignment_ids) or target_assignment_id = any (p_assignment_ids))
    returning assignment_id, target_assignment_id)
  update assignments a set status = 'active'
    from withdrawn w
   where a.id in (w.assignment_id, w.target_assignment_id) and a.status in ('swap_pending', 'cancellation_pending');
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 7. C11: `rota_adjust_picks_after_change` accepts a change with `new_family_id` null for a rota-week place: the rota week
--    becomes empty with the reason `cancelled`; for a picking week with a pick, the pick is deleted and its slot place
--    goes back to the weekend family (never to null), unless that weekend's Saturday has begun. A null family for a
--    weekend slot place raises an error, because BR76.1 never lets one get there. Everything else is as U6 delivered it.
-- ---------------------------------------------------------------------------------------------------
create or replace function rota_adjust_picks_after_change(p_changes jsonb) returns integer
language plpgsql security definer set search_path from current
as $$
declare
  v_change record;
  v_place assignments%rowtype;
  v_task tasks%rowtype;
  v_week rota_weeks%rowtype;
  v_wend rota_weeks%rowtype;
  v_slot weekend_slots%rowtype;
  v_pick weekend_picks%rowtype;
  v_row record;
  v_t record;
  v_old uuid;
  v_reopened integer := 0;
  v_parents uuid[];
  v_duty uuid;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'rota_adjust_picks_after_change: the changes are not a list' using errcode = '22023';
  end if;
  for v_change in
    select (e->>'place_id')::uuid as place_id, (e->>'new_family_id')::uuid as new_family_id
      from jsonb_array_elements(p_changes) e order by 1
  loop
    select * into v_place from assignments a where a.id = v_change.place_id;
    if not found then
      continue;
    end if;
    select * into v_task from tasks t where t.id = v_place.task_id;

    if v_task.origin_kind = 'rota_week' then
      select * into v_week from rota_weeks w where w.id = v_task.origin_id for update;
      update rota_weeks
         set family_id = v_change.new_family_id,
             empty_reason = case when v_change.new_family_id is null then 'cancelled' end
       where id = v_week.id;
      if v_week.job in ('indoor_cleaning', 'front_garden') then
        select * into v_pick from weekend_picks pk where pk.rota_week_id = v_week.id for update;
        if found then
          select * into v_t from rota_week_times(v_week.week_start);
          select * into v_wend from rota_weeks ww
           where ww.plan_id = v_week.plan_id and ww.job = 'weekend_animal_care' and ww.week_start = v_week.week_start;
          select * into v_slot from weekend_slots s where s.id = v_pick.weekend_slot_id;
          select * into v_place from assignments a
           where a.task_id = (select t.id from tasks t where t.origin_kind = 'weekend_slot' and t.origin_id = v_slot.id)
             and a.status <> 'removed';
          if now() < v_t.saturday then
            if v_change.new_family_id is not null and v_change.new_family_id is distinct from v_wend.family_id then
              perform place_reassign(v_place.id, v_place.version, v_change.new_family_id);
            else
              perform place_reassign(v_place.id, v_place.version, v_wend.family_id);
              update assignments set source = 'rota_publish' where id = v_place.id;
              delete from weekend_picks where id = v_pick.id;
            end if;
          end if;
        end if;
      end if;

    elsif v_task.origin_kind = 'weekend_slot' then
      if v_change.new_family_id is null then
        raise exception 'rota_adjust_picks_after_change: a weekend place is never left without a family' using errcode = '22023';
      end if;
      select * into v_slot from weekend_slots s where s.id = v_task.origin_id;
      if v_slot.slot <> 'shelter_cleaning' then
        continue;
      end if;
      select * into v_wend from rota_weeks ww where ww.id = v_slot.weekend_week_id for update;
      v_old := v_wend.family_id;
      select * into v_t from rota_week_times(v_wend.week_start);
      update rota_weeks set family_id = v_change.new_family_id, empty_reason = null where id = v_wend.id;
      if now() < v_t.saturday then
        for v_row in
          select a.id, a.version
            from weekend_slots s
            join tasks t on t.origin_kind = 'weekend_slot' and t.origin_id = s.id
            join assignments a on a.task_id = t.id and a.status <> 'removed'
           where s.weekend_week_id = v_wend.id and a.family_id = v_old
           order by a.id
        loop
          perform place_reassign(v_row.id, v_row.version, v_change.new_family_id);
        end loop;
        -- A pick the new family had for this weekend goes: it no longer owes one.
        for v_row in
          select pk.id as pick_id, a.id as place_id
            from rota_weeks w
            join weekend_picks pk on pk.rota_week_id = w.id
            join weekend_slots s on s.id = pk.weekend_slot_id
            join tasks t on t.origin_kind = 'weekend_slot' and t.origin_id = s.id
            join assignments a on a.task_id = t.id and a.status <> 'removed'
           where w.plan_id = v_wend.plan_id and w.week_start = v_wend.week_start
             and w.job in ('indoor_cleaning', 'front_garden') and w.family_id = v_change.new_family_id
           order by pk.id
        loop
          update assignments set source = 'rota_publish' where id = v_row.place_id;
          delete from weekend_picks where id = v_row.pick_id;
        end loop;
      end if;
    end if;
  end loop;

  -- A picking week whose pick went away and whose new family still owes one is asked to pick (once for the week).
  for v_row in
    select w.id as week_id, w.family_id
      from rota_weeks w
      join (select (e->>'place_id')::uuid as place_id from jsonb_array_elements(p_changes) e) c on true
      join assignments a on a.id = c.place_id
      join tasks t on t.id = a.task_id and t.origin_kind = 'rota_week' and t.origin_id = w.id
     where w.job in ('indoor_cleaning', 'front_garden') and weekend_pick_owed(w.id)
       and not exists (select 1 from weekend_picks pk where pk.rota_week_id = w.id)
       and exists (select 1 from rota_week_times(w.week_start) tt where now() < tt.saturday)
       and exists (select 1 from weekend_slots s join rota_weeks ww on ww.id = s.weekend_week_id
                    where ww.plan_id = w.plan_id and ww.week_start = w.week_start)
     order by w.id
  loop
    v_duty := rota_week_duty(v_row.week_id);
    v_parents := rota_notice_parents(v_row.family_id);
    if v_duty is not null and cardinality(v_parents) > 0 then
      perform notice_send(v_parents, 'weekend_pick_reminder', 'task', v_duty, 'weekend_pick_reminder:' || v_row.week_id::text);
    end if;
    v_reopened := v_reopened + 1;
  end loop;
  return v_reopened;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 8. Internal helpers of the block. Granted to nobody (NFR3.5).
-- ---------------------------------------------------------------------------------------------------

-- The places of the weekend slots that a change to these rota-week places can reach through C11: the slot place of each
-- week's weekend pick. A command locks them together with its own places (BR77.1).
create or replace function dutychanges_pick_places(p_places uuid[]) returns uuid[]
language sql stable security definer set search_path from current
as $$
  select coalesce(array_agg(distinct sa.id), '{}'::uuid[])
    from assignments a
    join tasks t on t.id = a.task_id and t.origin_kind = 'rota_week'
    join weekend_picks pk on pk.rota_week_id = t.origin_id
    join tasks st on st.origin_kind = 'weekend_slot' and st.origin_id = pk.weekend_slot_id
    join assignments sa on sa.task_id = st.id and sa.status <> 'removed'
   where a.id = any (p_places)
$$;

-- Locks in the fixed order of BR77.1: the duty rows ascending (the given duties and the duties of the places, including
-- the places the pick can reach), then the place rows ascending. The caller locks the request row afterwards.
create or replace function dutychanges_lock(p_tasks uuid[], p_places uuid[]) returns void
language plpgsql security definer set search_path from current
as $$
declare
  v_places uuid[] := coalesce(p_places, '{}'::uuid[]) || dutychanges_pick_places(p_places);
begin
  perform 1 from tasks t
   where t.id = any (coalesce(p_tasks, '{}'::uuid[]))
      or t.id in (select a.task_id from assignments a where a.id = any (v_places))
   order by t.id for update;
  perform 1 from assignments a where a.id = any (v_places) order by a.id for update;
end $$;

-- A rota duty is one whose origin is a rota week or a weekend slot (U6).
create or replace function dutychanges_is_rota(p_task_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$ select coalesce((select t.origin_kind <> 'manual' from tasks t where t.id = p_task_id), false) $$;

-- When the earlier of a request's two duties starts (its source duty for a cancellation).
create or replace function dutychanges_earliest_start(p_request_id uuid) returns timestamptz
language sql stable security definer set search_path from current
as $$
  select least(st.starts_at, tt.starts_at)
    from change_requests r
    join tasks st on st.id = r.source_task_id
    left join tasks tt on tt.id = r.target_task_id
   where r.id = p_request_id
$$;

-- Tells every active parent of a family, once per request and kind (BR50.2). A family with nobody to tell sends nothing.
create or replace function dutychanges_notify(p_family uuid, p_kind text, p_request uuid) returns integer
language plpgsql security definer set search_path from current
as $$
declare v_parents uuid[] := rota_notice_parents(p_family);
begin
  if cardinality(v_parents) = 0 then
    return 0;
  end if;
  return notice_send(v_parents, p_kind, 'change_request', p_request, p_kind || ':' || p_request::text);
end $$;

-- Ends a request's open state: the request gets its end status and reason, and every place of it that is still pending
-- returns to active (a place that was removed stays removed). Internal; the caller holds the locks.
create or replace function dutychanges_end_request(p_request_id uuid, p_status text, p_reason text) returns void
language plpgsql security definer set search_path from current
as $$
declare v_req change_requests%rowtype;
begin
  update change_requests set status = p_status, ended_reason = p_reason
   where id = p_request_id returning * into v_req;
  update assignments set status = 'active'
   where id in (v_req.assignment_id, v_req.target_assignment_id) and status in ('swap_pending', 'cancellation_pending');
end $$;

-- A denial is audited and stored for its key (NFR4.3): the denied entry of the action (under the rate limit of 20261046),
-- and the stored result, so a repeat of the same click gets the same answer. Internal.
create or replace function dutychanges_record_denial(
  p_operation text, p_key text, p_fingerprint text, p_action text, p_target_type text, p_target_id uuid
) returns void
language plpgsql security definer set search_path from current
as $$
declare v_org uuid := identity_actor_organization();
begin
  if v_org is not null then
    perform platform_audit_write(p_action, p_target_type, coalesce(p_target_id, platform_actor_account()), v_org, null,
                                 'denied', p_operation);
  end if;
  perform platform_idempotency_store(p_operation, p_key, p_fingerprint, 'denied', null);
end $$;

-- The rules of an exchange of the holders of two places (BR71.1 to BR71.4, BR75.3), judged on the places as they are now:
-- different families and duties, no weekend slot (BR71.2), both duties open and not started, neither family already on the
-- other duty, both families active and allowed by C10 on the date of the duty they would receive (the reason goes to the
-- caller only for their own family or a super admin, as duty_ineligible_result does), and C11 asked with both changes
-- together. A refusal is raised through U3R00 with the code and, where there is one, the plain reason. Internal.
create or replace function dutychanges_swap_check(p_src uuid, p_tgt uuid) returns void
language plpgsql security definer set search_path from current
as $$
declare
  v_src assignments%rowtype;
  v_tgt assignments%rowtype;
  v_st tasks%rowtype;
  v_tt tasks%rowtype;
  v_refusal jsonb;
  v_c11 jsonb;
begin
  select * into v_src from assignments where id = p_src;
  select * into v_tgt from assignments where id = p_tgt;
  select * into v_st from tasks where id = v_src.task_id;
  select * into v_tt from tasks where id = v_tgt.task_id;
  if v_src.family_id = v_tgt.family_id or v_src.task_id = v_tgt.task_id or v_src.organization_id <> v_tgt.organization_id
     or v_src.status = 'removed' or v_tgt.status = 'removed' then
    perform platform_abort('conflict', 'REQUEST_CONFLICT');
  end if;
  if v_st.origin_kind = 'weekend_slot' or v_tt.origin_kind = 'weekend_slot' then
    perform platform_abort('conflict', 'SWAP_SLOT_FOLLOWS_WEEK');
  end if;
  if v_st.status <> 'open' or v_tt.status <> 'open' or v_st.starts_at <= now() or v_tt.starts_at <= now() then
    perform platform_abort('conflict', 'DUTY_CLOSED');
  end if;
  if exists (select 1 from assignments a
              where a.status <> 'removed'
                and ((a.family_id = v_src.family_id and a.task_id = v_tgt.task_id)
                  or (a.family_id = v_tgt.family_id and a.task_id = v_src.task_id))) then
    perform platform_abort('conflict', 'DUTY_ALREADY_ASSIGNED');
  end if;
  if exists (select 1 from families f where f.id in (v_src.family_id, v_tgt.family_id) and f.status <> 'active') then
    perform platform_abort('conflict', 'REQUEST_CONFLICT');
  end if;
  v_refusal := duty_standing_check_task(v_src.family_id, v_tgt.task_id);
  if v_refusal is null then
    v_refusal := duty_standing_check_task(v_tgt.family_id, v_src.task_id);
  end if;
  if v_refusal is not null then
    perform platform_abort('conflict', 'DUTY_INELIGIBLE',
      case when v_refusal ? 'reason' then jsonb_build_object('reason', v_refusal->>'reason') else '{}'::jsonb end);
  end if;
  v_c11 := rota_check_change(jsonb_build_array(
    jsonb_build_object('place_id', v_src.id, 'new_family_id', v_tgt.family_id),
    jsonb_build_object('place_id', v_tgt.id, 'new_family_id', v_src.family_id)));
  if not (v_c11->>'allowed')::boolean then
    perform platform_abort('conflict', v_c11->>'code');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 9. The parent's side: candidates, proposing, answering, withdrawing, the family's own list (W1 to W3).
-- ---------------------------------------------------------------------------------------------------

-- swap_candidates (BR77.2): for one of the family's own future places, the other families' active future places of any
-- kind, without weekend slot places and places in an open request, and without duties the family already holds a place
-- on, optionally within a date range. Each entry shows the duty, its time and the other family's display name (C6).
create or replace function swap_candidates(p_assignment_id uuid, p_from date default null, p_to date default null)
returns jsonb
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
  select * into v_src from assignments a where a.id = p_assignment_id and a.family_id = v_family;
  if not found then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := v_src.organization_id;
  select * into v_task from tasks t where t.id = v_src.task_id;
  if v_src.status in ('swap_pending', 'cancellation_pending') then
    return platform_result('conflict', null, 'REQUEST_DUPLICATE');
  elsif v_src.status <> 'active' then
    return platform_result('conflict', null, 'REQUEST_CONFLICT');
  end if;
  if v_task.origin_kind = 'weekend_slot' then
    return platform_result('conflict', null, 'SWAP_SLOT_FOLLOWS_WEEK');
  end if;
  if v_task.status <> 'open' or v_task.starts_at <= now() then
    return platform_result('conflict', null, 'DUTY_CLOSED');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'assignment_id', c.id, 'assignment_version', c.version, 'task_id', c.task_id, 'title', c.title,
           'category', c.category, 'starts_at', c.starts_at, 'family_display_name', c.family_name)
         order by c.starts_at, c.id), '[]'::jsonb)
    into v_items
    from (
      select ta.id, ta.version, tt.id as task_id, tt.title, tt.category, tt.starts_at,
             family_display_name(ta.family_id) as family_name
        from assignments ta
        join tasks tt on tt.id = ta.task_id
        join families f on f.id = ta.family_id
       where ta.organization_id = v_org and ta.status = 'active' and ta.family_id <> v_family and f.status = 'active'
         and tt.id <> v_task.id and tt.status = 'open' and tt.starts_at > now() and tt.origin_kind <> 'weekend_slot'
         and (p_from is null or (tt.starts_at at time zone 'Europe/Budapest')::date >= p_from)
         and (p_to is null or (tt.starts_at at time zone 'Europe/Budapest')::date <= p_to)
         and not exists (select 1 from assignments x
                          where x.family_id = v_family and x.task_id = tt.id and x.status <> 'removed')
         and not exists (select 1 from assignments y
                          where y.family_id = ta.family_id and y.task_id = v_task.id and y.status <> 'removed')
       order by tt.starts_at, ta.id
       limit 300) c;
  return platform_result('success', v_src.id, null) || jsonb_build_object('items', v_items);
end $$;

-- swap_request (BR70.1, BR71.1 to BR71.5): a parent of the family that holds the place proposes a swap with another
-- family's place. The caller sends both versions as the screen showed them. Under the locks of BR77.1: a stale version is
-- refused before anything changes, then the status of both places, then the rules of dutychanges_swap_check. On success
-- both places become swap_pending, the request stores the versions the places have after that mark, the families, the
-- duties and the reason (trimmed, at most 500 characters), and the other family gets swap_requested.
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
  v_out jsonb;
  v_src assignments%rowtype;
  v_tgt assignments%rowtype;
  v_reason text;
  v_id uuid;
  v_src_version integer;
  v_tgt_version integer;
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
    -- A place that is not the family's and a place that does not exist answer alike (NFR3.2).
    if not exists (select 1 from assignments a where a.id = p_assignment_id and a.family_id = v_family) then
      perform platform_abort('denied', 'authorization_denied');
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
    if p_assignment_id = p_target_assignment_id
       or not exists (select 1 from assignments a where a.id = p_target_assignment_id and a.organization_id = v_org) then
      perform platform_abort('validation', 'assignment_not_found');
    end if;

    perform dutychanges_lock('{}'::uuid[], array[p_assignment_id, p_target_assignment_id]);
    select * into v_src from assignments where id = p_assignment_id;
    select * into v_tgt from assignments where id = p_target_assignment_id;
    if v_src.family_id <> v_family then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_tgt.family_id = v_family then
      perform platform_abort('conflict', 'DUTY_ALREADY_ASSIGNED');
    end if;
    if v_src.version <> p_expected_version or v_tgt.version <> p_target_version then
      perform platform_abort('invalidated', 'REQUEST_VERSION_STALE');
    end if;
    if v_src.status in ('swap_pending', 'cancellation_pending') or v_tgt.status in ('swap_pending', 'cancellation_pending') then
      perform platform_abort('conflict', 'REQUEST_DUPLICATE');
    end if;
    if v_src.status <> 'active' or v_tgt.status <> 'active' then
      perform platform_abort('conflict', 'REQUEST_CONFLICT');
    end if;
    perform dutychanges_swap_check(v_src.id, v_tgt.id);

    update assignments set status = 'swap_pending' where id in (v_src.id, v_tgt.id);
    select a.version into v_src_version from assignments a where a.id = v_src.id;
    select a.version into v_tgt_version from assignments a where a.id = v_tgt.id;
    insert into change_requests (organization_id, assignment_id, target_assignment_id, kind, requested_by_parent_id,
                                 source_task_id, source_assignment_version, target_task_id, target_assignment_version,
                                 reason, source_confirmed, target_confirmed, source_family_id, target_family_id)
    values (v_org, v_src.id, v_tgt.id, 'swap', v_parent, v_src.task_id, v_src_version, v_tgt.task_id, v_tgt_version,
            v_reason, true, false, v_src.family_id, v_tgt.family_id)
    returning id into v_id;
    perform dutychanges_notify(v_tgt.family_id, 'swap_requested', v_id);

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object('assignment_version', v_src_version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    v_out := v_detail::jsonb;
    if v_out->>'state' = 'denied' then
      perform dutychanges_record_denial(c_operation, p_idempotency_key, v_fingerprint, 'swap.denied', 'assignment',
                                        p_assignment_id);
    end if;
    return v_out;
  end;
end $$;

-- swap_respond (BR70.1, BR72.1 to BR72.4, BR73.1): the target family accepts or declines. A request that is not open
-- gives SWAP_REQUEST_NOT_OPEN, a stale request version REQUEST_VERSION_STALE, and a request whose earlier duty has started
-- SWAP_EXPIRED. Declining rejects it (ended reason declined), returns both places to active and tells the proposer.
-- Accepting applies the swap only if both places still have exactly the versions stored on the request and the rules
-- still hold (SWAP_CANNOT_BE_APPLIED with the reason otherwise): rules check, place exchange, both places active, picks
-- follow (C11), the request applied with the versions read at the end, both families told, reminders planned again.
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
    if p_expected_version is not null and p_expected_version <> v_req.version then
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

-- swap_withdraw (BR70.1, BR72.5): the family that asked withdraws its own open request, swap or cancellation. A request
-- that is not open gives SWAP_REQUEST_NOT_OPEN; one whose duty has started SWAP_EXPIRED or CANCELLATION_EXPIRED. Both
-- places return to active; the other family of a swap is told, a cancellation tells nobody.
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
  v_out jsonb;
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
    select * into v_req from change_requests r
     where r.id = p_request_id and r.organization_id = v_org and r.source_family_id = v_family;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform dutychanges_lock('{}'::uuid[], array_remove(array[v_req.assignment_id, v_req.target_assignment_id], null));
    select * into v_req from change_requests where id = p_request_id for update;
    if v_req.status <> 'open' then
      perform platform_abort('conflict', 'SWAP_REQUEST_NOT_OPEN');
    end if;
    if dutychanges_earliest_start(v_req.id) <= now() then
      perform platform_abort('conflict', case when v_req.kind = 'swap' then 'SWAP_EXPIRED' else 'CANCELLATION_EXPIRED' end);
    end if;
    perform dutychanges_end_request(v_req.id, 'withdrawn', 'withdrawn_by_requester');
    if v_req.kind = 'swap' then
      perform dutychanges_notify(v_req.target_family_id, 'swap_withdrawn', v_req.id);
    end if;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_req.id);
    return platform_result('success', v_req.id, null);
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

-- swap_incoming (BR70.3): the signed-in parent's family's requests: the swaps addressed to it (incoming) and its own swap
-- and cancellation requests (outgoing), all open ones and the ones that ended in the last 60 days, newest first, at most
-- 100. An open request whose duty has started shows as expired. The reason goes to the two families of a swap and to the
-- family of a cancellation, and to nobody else; the display names come through C6.
create or replace function swap_incoming() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_family uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_family := directory_actor_family();
  if v_family is null then
    return platform_result('denied', null, 'no_family');
  end if;
  select coalesce(jsonb_agg(l.item order by l.sort_time desc, l.sort_id desc), '[]'::jsonb) into v_items
    from (
      select r.created_at as sort_time, r.id as sort_id,
             jsonb_build_object(
               'request_id', r.id, 'kind', r.kind, 'version', r.version,
               'direction', case when r.source_family_id = v_family then 'outgoing' else 'incoming' end,
               'status', case when r.status = 'open' and least(st.starts_at, coalesce(tt.starts_at, st.starts_at)) <= now()
                              then 'expired' else r.status end,
               'ended_reason', case when r.status = 'open' and least(st.starts_at, coalesce(tt.starts_at, st.starts_at)) <= now()
                                    then case when r.kind = 'swap' then 'earlier_duty_started' else 'duty_started' end
                                    else r.ended_reason end,
               'own_task_title', case when r.source_family_id = v_family then st.title else tt.title end,
               'own_task_starts_at', case when r.source_family_id = v_family then st.starts_at else tt.starts_at end,
               'partner_task_title', case when r.source_family_id = v_family then tt.title else st.title end,
               'partner_task_starts_at', case when r.source_family_id = v_family then tt.starts_at else st.starts_at end,
               'partner_family_name', case when r.kind <> 'swap' then null
                                           when r.source_family_id = v_family then family_display_name(r.target_family_id)
                                           else family_display_name(r.source_family_id) end,
               'reason', r.reason,
               'created_at', r.created_at, 'decided_at', r.decided_at, 'updated_at', r.updated_at
             ) as item
        from change_requests r
        join tasks st on st.id = r.source_task_id
        left join tasks tt on tt.id = r.target_task_id
       where (r.source_family_id = v_family or (r.kind = 'swap' and r.target_family_id = v_family))
         and (r.status = 'open' or r.updated_at >= now() - interval '60 days')
       order by r.created_at desc, r.id desc
       limit 100) l;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- cancellation_request (BR76.1): a parent of the family that holds the place asks to cancel it until its duty starts,
-- with an optional reason. A place that is not the family's and one that does not exist answer alike; a stale version
-- gives REQUEST_VERSION_STALE; a place already in a request REQUEST_DUPLICATE; a weekend slot place
-- SWAP_SLOT_FOLLOWS_WEEK; a closed or started duty DUTY_CLOSED. The place becomes cancellation_pending and stays with the
-- family until an administrator decides. The refusal of rota duties is retired.
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
  v_out jsonb;
  v_asg assignments%rowtype;
  v_task tasks%rowtype;
  v_reason text;
  v_id uuid;
  v_version integer;
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
    if not exists (select 1 from assignments a where a.id = p_assignment_id and a.family_id = v_family) then
      perform platform_abort('denied', 'authorization_denied');
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
    perform dutychanges_lock('{}'::uuid[], array[p_assignment_id]);
    select * into v_asg from assignments where id = p_assignment_id;
    if v_asg.family_id <> v_family then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_asg.version <> p_expected_version then
      perform platform_abort('invalidated', 'REQUEST_VERSION_STALE');
    end if;
    if v_asg.status in ('swap_pending', 'cancellation_pending') then
      perform platform_abort('conflict', 'REQUEST_DUPLICATE');
    end if;
    if v_asg.status <> 'active' then
      perform platform_abort('conflict', 'REQUEST_CONFLICT');
    end if;
    select * into v_task from tasks where id = v_asg.task_id;
    if v_task.origin_kind = 'weekend_slot' then
      perform platform_abort('conflict', 'SWAP_SLOT_FOLLOWS_WEEK');
    end if;
    if v_task.status <> 'open' or v_task.starts_at <= now() then
      perform platform_abort('conflict', 'DUTY_CLOSED');
    end if;

    update assignments set status = 'cancellation_pending' where id = v_asg.id;
    select a.version into v_version from assignments a where a.id = v_asg.id;
    insert into change_requests (organization_id, assignment_id, kind, requested_by_parent_id, source_task_id,
                                 source_assignment_version, reason, source_family_id)
    values (v_org, v_asg.id, 'cancellation', v_parent, v_asg.task_id, v_version, v_reason, v_asg.family_id)
    returning id into v_id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object('assignment_version', v_version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    v_out := v_detail::jsonb;
    if v_out->>'state' = 'denied' then
      perform dutychanges_record_denial(c_operation, p_idempotency_key, v_fingerprint, 'cancellation.denied',
                                        'assignment', p_assignment_id);
    end if;
    return v_out;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 10. The administrator's side: deciding a cancellation, reassigning a duty, reversing a swap, and the two lists
--     (W5 to W7). A rota duty is decided by a super admin only; any other duty by an admin who reaches its group
--     (BR70.2). The request is looked up and the caller tested in one condition, so a request that is not the caller's
--     to see and one that does not exist answer alike (NFR3.2).
-- ---------------------------------------------------------------------------------------------------

-- cancellation_decide (BR76.2, BR76.3, BR73.2): approve or reject a cancellation. A request that is not open gives
-- APPROVAL_ALREADY_DECIDED, a stale request version or a place that changed since APPROVAL_INVALIDATED, and a duty that
-- has started CANCELLATION_EXPIRED. Approving marks the request approved first, then frees the place with place_release
-- (which therefore finds no open request to withdraw), then asks C11 to empty the rota week with the reason `cancelled`
-- and send its pick back to the weekend family. Rejecting leaves the duty with the family. The family is told; the
-- decision is audited as approval.approve or approval.reject in the same transaction.
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
    if p_expected_version is not null and p_expected_version <> v_req.version then
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

-- duty_reassign (BR74.1 to BR74.4): the administrator gives a future duty to another family. The caller sends the version
-- the screen showed: the place's when the duty has a place, otherwise the duty's. A weekend slot duty is refused
-- (SWAP_SLOT_FOLLOWS_WEEK: U6's weekend_pick_assign keeps the pick rules), and so is a duty with several places
-- (DUTY_HAS_SEVERAL_PLACES). The new family is judged with C10 and the change with C11 before anything changes. An open
-- swap or cancellation on the place ends as cancelled (duty_reassigned) and its families are told; then place_reassign
-- runs, or place_add when the duty has no place, then C11 follows the change (the pick moves or the family is asked to
-- pick). The old and the new family are told, reminders planned again, and the action audited as duty.reassigned.
create or replace function duty_reassign(
  p_idempotency_key text, p_duty_id uuid, p_expected_version integer, p_family_id uuid
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'duty.reassign';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_out jsonb;
  v_task tasks%rowtype;
  v_reached boolean;
  v_place_ids uuid[];
  v_place assignments%rowtype;
  v_has_place boolean := false;
  v_old uuid;
  v_req change_requests%rowtype;
  v_refusal jsonb;
  v_c11 jsonb;
  v_place_id uuid;
  v_version integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_duty_id::text, p_expected_version::text, p_family_id::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_org := identity_actor_organization();
    select * into v_task from tasks t where t.id = p_duty_id and t.organization_id = v_org;
    if found then
      v_reached := case when v_task.origin_kind <> 'manual' then coalesce(has_super_scope(v_org), false)
                        else coalesce(has_core_scope(v_org, v_task.group_id), false) end;
    end if;
    if not found or not v_reached then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_family_id is null then
      perform platform_field_invalid('family_id');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_task.origin_kind = 'weekend_slot' then
      perform platform_abort('conflict', 'SWAP_SLOT_FOLLOWS_WEEK');
    end if;
    if not exists (select 1 from families f where f.id = p_family_id and f.organization_id = v_org) then
      perform platform_field_invalid('family_id');
    end if;

    select coalesce(array_agg(a.id order by a.id), '{}'::uuid[]) into v_place_ids
      from assignments a where a.task_id = v_task.id and a.status <> 'removed';
    perform dutychanges_lock(array[v_task.id], v_place_ids);
    select coalesce(array_agg(a.id order by a.id), '{}'::uuid[]) into v_place_ids
      from assignments a where a.task_id = v_task.id and a.status <> 'removed';
    if cardinality(v_place_ids) > 1 then
      perform platform_abort('conflict', 'DUTY_HAS_SEVERAL_PLACES');
    end if;
    select * into v_task from tasks where id = v_task.id;
    if cardinality(v_place_ids) = 1 then
      select * into v_place from assignments where id = v_place_ids[1];
      v_has_place := true;
    end if;
    if (v_has_place and v_place.version <> p_expected_version)
       or (not v_has_place and v_task.version <> p_expected_version) then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_task.status <> 'open' or v_task.starts_at <= now() then
      perform platform_abort('conflict', 'DUTY_CLOSED');
    end if;
    if exists (select 1 from assignments x
                where x.task_id = v_task.id and x.family_id = p_family_id and x.status <> 'removed') then
      perform platform_abort('conflict', 'DUTY_ALREADY_ASSIGNED');
    end if;
    if exists (select 1 from families f where f.id = p_family_id and f.status <> 'active') then
      perform platform_abort('conflict', 'DUTY_INELIGIBLE', jsonb_build_object('reason', 'family_inactive'));
    end if;
    v_refusal := duty_standing_check_task(p_family_id, v_task.id);
    if v_refusal is not null then
      perform platform_abort('conflict', 'DUTY_INELIGIBLE', jsonb_build_object('reason', v_refusal->>'reason'));
    end if;
    if v_has_place then
      v_c11 := rota_check_change(jsonb_build_array(
        jsonb_build_object('place_id', v_place.id, 'new_family_id', p_family_id)));
      if not (v_c11->>'allowed')::boolean then
        perform platform_abort('conflict', v_c11->>'code');
      end if;

      -- An open swap or cancellation on the place ends here, and everyone concerned is told (BR74.4).
      select * into v_req from change_requests r
       where r.status = 'open' and (r.assignment_id = v_place.id or r.target_assignment_id = v_place.id)
       for update;
      if found then
        perform dutychanges_end_request(v_req.id, 'cancelled', 'duty_reassigned');
        if v_req.kind = 'swap' then
          perform dutychanges_notify(v_req.source_family_id, 'swap_cancelled', v_req.id);
          perform dutychanges_notify(v_req.target_family_id, 'swap_cancelled', v_req.id);
        else
          perform dutychanges_notify(v_req.source_family_id, 'cancellation_decided', v_req.id);
        end if;
      end if;
      select a.version into v_version from assignments a where a.id = v_place.id;
      v_old := v_place.family_id;
      perform place_reassign(v_place.id, v_version, p_family_id);
      v_place_id := v_place.id;
    else
      select (place_add(v_task.id, p_family_id)->>'reference')::uuid into v_place_id;
      v_c11 := rota_check_change(jsonb_build_array(
        jsonb_build_object('place_id', v_place_id, 'new_family_id', p_family_id)));
      if not (v_c11->>'allowed')::boolean then
        perform platform_abort('conflict', v_c11->>'code');
      end if;
    end if;
    perform rota_adjust_picks_after_change(jsonb_build_array(
      jsonb_build_object('place_id', v_place_id, 'new_family_id', p_family_id)));
    perform reminder_plan_tasks(array[v_task.id]);
    select a.version into v_version from assignments a where a.id = v_place_id;
    if v_old is not null and cardinality(rota_notice_parents(v_old)) > 0 then
      perform notice_send(rota_notice_parents(v_old), 'duty_reassigned', 'task', v_task.id,
                          'duty_reassigned:' || v_place_id::text || ':' || v_version::text);
    end if;
    if cardinality(rota_notice_parents(p_family_id)) > 0 then
      perform notice_send(rota_notice_parents(p_family_id), 'duty_reassigned', 'task', v_task.id,
                          'duty_reassigned:' || v_place_id::text || ':' || v_version::text);
    end if;
    perform platform_audit_write('duty.reassigned', 'assignment', v_place_id, v_org, v_task.group_id, 'success',
                                 'reassigned');

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_place_id);
    return platform_result('success', v_place_id, null) || jsonb_build_object('assignment_version', v_version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    v_out := v_detail::jsonb;
    if v_out->>'state' = 'denied' then
      perform dutychanges_record_denial(c_operation, p_idempotency_key, v_fingerprint, 'duty.reassigned', 'task',
                                        p_duty_id);
    end if;
    return v_out;
  end;
end $$;

-- swap_reverse (BR75.2, BR75.3): the administrator reverses an applied swap only while both places still have the
-- versions the swap left (SWAP_CHANGED_SINCE otherwise) and neither duty has started (DUTY_CLOSED). A rota swap, that is
-- one with at least one rota duty, is a super admin's; otherwise the caller must reach both groups. The same rules run
-- with the families the other way round; the request becomes reversed with the decider and the time, both families are
-- told, reminders planned again, and the action audited as swap.reversed.
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
    if p_expected_version is not null and p_expected_version <> v_req.version then
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

-- swap_list (BR75.1): the swaps an administrator may see, pending and ended, newest first, with both families (C6), both
-- duties, the status, the times, the reason and whether each can be reversed now. A super admin sees the community's
-- swaps; a group admin sees the swaps whose two duties are not rota duties and whose two groups they reach. Pending swaps
-- are the current school year's together with every open one. Anyone else is denied.
create or replace function swap_list(p_school_year_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_super boolean;
  v_year school_years%rowtype;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if v_org is null or not coalesce(directory_is_admin(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_super := coalesce(has_super_scope(v_org), false);
  if p_school_year_id is not null then
    select * into v_year from school_years s where s.id = p_school_year_id and s.organization_id = v_org;
    if not found then
      return platform_result('validation', null, 'request_invalid');
    end if;
  else
    select * into v_year from school_years s where s.id = rota_pick_school_year(v_org);
  end if;
  select coalesce(jsonb_agg(l.item order by l.created_at desc, l.id desc), '[]'::jsonb) into v_items
    from (
      select r.id, r.created_at,
             jsonb_build_object(
               'request_id', r.id, 'version', r.version,
               'status', case when r.status = 'open' and least(st.starts_at, tt.starts_at) <= now() then 'expired' else r.status end,
               'ended_reason', case when r.status = 'open' and least(st.starts_at, tt.starts_at) <= now()
                                    then 'earlier_duty_started' else r.ended_reason end,
               'source_family_name', family_display_name(r.source_family_id),
               'target_family_name', family_display_name(r.target_family_id),
               'source_task_title', st.title, 'source_task_starts_at', st.starts_at,
               'target_task_title', tt.title, 'target_task_starts_at', tt.starts_at,
               'is_rota', (st.origin_kind <> 'manual' or tt.origin_kind <> 'manual'),
               'reason', r.reason, 'created_at', r.created_at, 'decided_at', r.decided_at,
               'can_reverse', (r.status = 'applied' and r.applied_source_version is not null
                               and sa.version = r.applied_source_version and ta.version = r.applied_target_version
                               and sa.status = 'active' and ta.status = 'active'
                               and st.status = 'open' and tt.status = 'open'
                               and st.starts_at > now() and tt.starts_at > now())
             ) as item
        from change_requests r
        join tasks st on st.id = r.source_task_id
        join tasks tt on tt.id = r.target_task_id
        join assignments sa on sa.id = r.assignment_id
        join assignments ta on ta.id = r.target_assignment_id
       where r.organization_id = v_org and r.kind = 'swap'
         and (v_super or (st.origin_kind = 'manual' and tt.origin_kind = 'manual'
                          and coalesce(has_core_scope(v_org, st.group_id), false)
                          and coalesce(has_core_scope(v_org, tt.group_id), false)))
         and (r.status = 'open' or v_year.id is null
              or (r.created_at at time zone 'Europe/Budapest')::date between v_year.starts_on and v_year.ends_on)
       order by r.created_at desc, r.id desc
       limit 200) l;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- cancellation_list (BR70.3, BR76.1): the cancellation requests an administrator may decide, with the reason: a super
-- admin sees the community's, a group admin those of non-rota duties of the groups they reach. Open requests and the
-- ones that ended in the last 60 days, newest first, at most 200. An open request whose duty has started shows as
-- expired. Anyone else is denied. This replaces the direct read of the table by the approvals screen.
create or replace function cancellation_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_super boolean;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if v_org is null or not coalesce(directory_is_admin(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_super := coalesce(has_super_scope(v_org), false);
  select coalesce(jsonb_agg(l.item order by l.created_at desc, l.id desc), '[]'::jsonb) into v_items
    from (
      select r.id, r.created_at,
             jsonb_build_object(
               'request_id', r.id, 'version', r.version,
               'status', case when r.status = 'open' and st.starts_at <= now() then 'expired' else r.status end,
               'ended_reason', case when r.status = 'open' and st.starts_at <= now() then 'duty_started' else r.ended_reason end,
               'family_name', family_display_name(r.source_family_id),
               'task_title', st.title, 'task_starts_at', st.starts_at, 'group_id', st.group_id,
               'is_rota', st.origin_kind <> 'manual',
               'reason', r.reason, 'created_at', r.created_at, 'decided_at', r.decided_at
             ) as item
        from change_requests r
        join tasks st on st.id = r.source_task_id
       where r.organization_id = v_org and r.kind = 'cancellation'
         and (v_super or (st.origin_kind = 'manual' and coalesce(has_core_scope(v_org, st.group_id), false)))
         and (r.status = 'open' or r.updated_at >= now() - interval '60 days')
       order by r.created_at desc, r.id desc
       limit 200) l;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- dashboard_get: the open-approvals count now holds the cancellation requests the caller may decide and that can still be
-- decided (the duty has not started). A swap waits for the other family, not for an administrator, so it is not counted.
-- A super admin counts every one; a group admin the non-rota duties of their groups (the reach of cancellation_decide).
create or replace function dashboard_get() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_super boolean;
  v_groups uuid[];
  v_approvals integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if not directory_is_admin(v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_super := has_super_scope(v_org);
  v_groups := coordination_reach_groups();
  select count(*)::integer into v_approvals
    from change_requests r
    join tasks t on t.id = r.source_task_id
   where r.organization_id = v_org and r.kind = 'cancellation' and r.status = 'open' and t.starts_at > now()
     and (v_super or (t.origin_kind = 'manual' and t.group_id = any (v_groups)));
  return platform_result('success', null, null) || jsonb_build_object('open_approvals', v_approvals);
end $$;

-- notification_list: the notice of a swap request reads cancelled once the request has ended without a swap (the other
-- family declined, the requester withdrew, it expired or an administrator or a removal cancelled it). Otherwise unchanged.
create or replace function notification_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_parent uuid;
  v_items jsonb := '[]'::jsonb;
  v_row record;
  v_d record;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_parent := notification_actor_parent();
  if v_parent is null then
    return platform_result('success', null, null) || jsonb_build_object('items', '[]'::jsonb);
  end if;
  for v_row in
    select n.id, n.kind, n.target_type, n.target_ref, n.read_at, n.created_at, n.task_starts_at,
           t.status as task_status, t.starts_at as task_start, j.status as job_status, r.status as request_status
      from notifications n
      left join tasks t on t.id = n.task_id
      left join reminder_jobs j on j.id = n.reminder_job_id
      left join change_requests r on n.target_type = 'change_request' and r.id = n.target_ref
     where n.parent_id = v_parent
     order by n.created_at desc, n.id desc
     limit 50
  loop
    select * into v_d from notice_describe(v_row.kind, v_row.target_type, v_row.target_ref, v_parent);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_row.id,
      'title', v_d.title,
      'text', v_d.detail,
      'link', v_d.path,
      'is_read', v_row.read_at is not null,
      'timing', case
        when v_row.kind in ('reminder_7d', 'reminder_24h') then case
          when v_row.job_status = 'cancelled' or v_row.task_status = 'cancelled' then 'cancelled'
          when v_row.job_status = 'stale' or v_row.task_start is distinct from v_row.task_starts_at then 'stale'
          when v_row.kind = 'reminder_7d' then '7-day'
          else '24-hour' end
        else case
          when v_row.task_status = 'cancelled' or (v_row.kind = 'swap_requested' and v_row.request_status in ('withdrawn', 'rejected', 'expired', 'cancelled'))
            then 'cancelled'
          else 'within-threshold' end end,
      'created_at', v_row.created_at));
  end loop;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 11. The daily check `swap_expiry` (C9; BR73.1, BR73.2). Every open swap whose earlier duty has started becomes expired
--     (ended reason earlier_duty_started), both places return to active and both families get swap_expired; every open
--     cancellation whose duty has started becomes expired (duty_started), the place returns to active so the family
--     keeps the duty, and the family gets cancellation_decided. Once per request: a second run finds nothing open. It
--     runs as the system and is granted to nobody. Locks: the duties ascending, then the places, then the request, for
--     one request at a time.
-- ---------------------------------------------------------------------------------------------------
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
begin
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

insert into timed_check_registry (check_name, function_name, run_kind, is_active, lock_step, added_by) values
  ('swap_expiry', 'dutychanges_swap_expiry_check', 'daily', true, 4, 'u7-swaps');

-- ---------------------------------------------------------------------------------------------------
-- 12. The removal block (C16; BR77.3). Internal: U14 calls it in the C16 order. For a family, every open request where it
--     is the source or the target family becomes cancelled (family_removed), the places of that request return to
--     active and the other family of a swap is told (swap_cancelled); then the reason of every request the family made or
--     received is cleared, the requester is cleared on ended requests of its parents, and the decider where it is one of
--     its parents' accounts. For a parent: the requester on ended requests and the decider that is its account.
--     Preview and apply return counts only: `to_clear` (rows that lose a person field or a reason) and `to_flag` (open
--     requests the removal cancels), with no name and no reason. Past requests show the person as korábbi tag through C6.
-- ---------------------------------------------------------------------------------------------------
create or replace function dutychanges_removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_parents uuid[];
  v_accounts uuid[];
  v_family uuid;
  v_clear integer;
  v_flag integer := 0;
begin
  if p_subject_kind = 'family' then
    v_family := p_subject_id;
    select coalesce(array_agg(p.id), '{}'::uuid[]), coalesce(array_agg(p.account_id) filter (where p.account_id is not null), '{}'::uuid[])
      into v_parents, v_accounts from parents p where p.family_id = p_subject_id;
    select count(*) into v_flag from change_requests r
     where r.status = 'open' and (r.source_family_id = p_subject_id or r.target_family_id = p_subject_id);
  elsif p_subject_kind = 'parent' then
    select coalesce(array_agg(p.id), '{}'::uuid[]), coalesce(array_agg(p.account_id) filter (where p.account_id is not null), '{}'::uuid[])
      into v_parents, v_accounts from parents p where p.id = p_subject_id;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;
  select count(*) into v_clear from change_requests r
   where (v_family is not null and (r.source_family_id = v_family or r.target_family_id = v_family) and r.reason is not null)
      or (r.status <> 'open' and r.requested_by_parent_id = any (v_parents))
      or r.decided_by_account_id = any (v_accounts);
  return jsonb_build_object('to_clear', v_clear, 'to_flag', v_flag);
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

-- ---------------------------------------------------------------------------------------------------
-- 13. Function rights. Every function here starts with `revoke all` and an explicit `grant execute` (NFR3.6). The commands
--     and reads check their caller themselves; the helpers, the C5 and C11 functions, the check and the removal pair
--     are internal and granted to nobody (NFR3.5).
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  change_requests_fill_families(),
  place_add(uuid, uuid),
  dutychanges_pick_places(uuid[]),
  dutychanges_lock(uuid[], uuid[]),
  dutychanges_is_rota(uuid),
  dutychanges_earliest_start(uuid),
  dutychanges_notify(uuid, text, uuid),
  dutychanges_end_request(uuid, text, text),
  dutychanges_record_denial(text, text, text, text, text, uuid),
  dutychanges_swap_check(uuid, uuid),
  dutychanges_swap_expiry_check(timestamptz),
  dutychanges_removal_preview(text, uuid),
  dutychanges_removal_apply(text, uuid),
  swap_candidates(uuid, date, date),
  swap_request(text, uuid, integer, uuid, integer, text),
  swap_respond(text, uuid, boolean, integer),
  swap_withdraw(text, uuid),
  swap_incoming(),
  cancellation_request(text, uuid, integer, text),
  cancellation_decide(text, uuid, boolean, integer),
  duty_reassign(text, uuid, integer, uuid),
  swap_reverse(text, uuid, integer),
  swap_list(uuid),
  cancellation_list()
  from public, anon, authenticated, service_role;

grant execute on function
  swap_candidates(uuid, date, date),
  swap_request(text, uuid, integer, uuid, integer, text),
  swap_respond(text, uuid, boolean, integer),
  swap_withdraw(text, uuid),
  swap_incoming(),
  cancellation_request(text, uuid, integer, text),
  cancellation_decide(text, uuid, boolean, integer),
  duty_reassign(text, uuid, integer, uuid),
  swap_reverse(text, uuid, integer),
  swap_list(uuid),
  cancellation_list()
  to authenticated;

commit;
