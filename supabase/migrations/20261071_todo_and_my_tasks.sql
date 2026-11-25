-- U12 of the Ovis tábla work: the shared to-do list (tasks owned by a working group or by one family, with one claimant,
-- a status, a done mark, a history and an attention flag), pulling tasks into an event's checklist, the My tasks page,
-- the coordinator's list for a group, two notices, and the functions U14 and U15 call (BR180 to BR190; contracts C1,
-- C2, C6, C8, C9, C14 to C17). The file opens and commits its own transaction, as 20261048 to 20261070 do, because the
-- migration runner adds none: the structure, the registry rows and every function succeed or fail together.
-- Technical names stay: a community is `organizations`, a working group is `groups`, a duty is a `tasks` row and a
-- place is an `assignments` row. A to-do task is a `todo_tasks` row.
--
-- Parts of this file (the plan's steps 3, 5 and 7):
--   Part A  tables, registries, the commands on one task (save, claim, give back, free, update, done, undo).
--   Part B  the pull into an event, the reads (list, get, group list, My tasks) and the checklist read for later units.
--   Part C  the deadline reminder, the removal pair, the one-off load, the grants.
--
-- Lock order of every path (BR189.1, contract C1): a command on one task locks that task row only. The pull locks the
-- event row first, then the checklist rows inside `checklist_add_task`, then the selected to-do rows ascending. No
-- command here locks a family row, and no checklist command locks a to-do row, so the two paths cannot wait on each
-- other. The removal block locks the to-do rows ascending after the family row U14 has taken.
--
-- Refusals are raised through U3R00 and rolled back (C1). Every function pins its search path, starts with
-- `revoke all` and gets an explicit grant or none: the signed-in commands and reads are granted to signed-in accounts
-- and check their caller themselves; the daily check, the removal pair, the helpers and the notice facts are internal
-- and granted to nobody who is signed in; the load is granted to the service role only.
begin;

-- ---------------------------------------------------------------------------------------------------
-- Part A, 1. The three tables. Row-level security on, no policy and no right for any application role: the screens read
--    through the read functions below (NFR3.29). Links to people and to events are typed ids with no foreign key
--    (ADR-001), checked inside the functions, so the lifecycle of a parent, a family or an event never fails on a to-do
--    row and a link to a vanished event can say so (BR185.2).
-- ---------------------------------------------------------------------------------------------------
create table todo_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  owner_group_id uuid references groups (id),
  owner_family_id uuid,
  topic text not null check (char_length(topic) between 1 and 200 and topic = btrim(topic)),
  priority integer check (priority is null or priority between 1 and 3),
  description text check (description is null or char_length(description) <= 2000),
  materials text check (materials is null or char_length(materials) <= 500),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'postponed')),
  note text check (note is null or char_length(note) <= 1000),
  not_before date,
  deadline date,
  claimant_parent_id uuid,
  claimed_at timestamptz,
  done_at timestamptz,
  done_by_parent_id uuid,
  needs_attention boolean not null default false,
  source_key text check (source_key is null or char_length(source_key) between 1 and 200),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The owner is exactly one of a working group and a family (NFR7.20).
  check ((owner_group_id is null) <> (owner_family_id is null)),
  -- A done status holds a done time and no other status holds one; the mark of a person needs the done status.
  check ((status = 'done') = (done_at is not null)),
  check (done_by_parent_id is null or status = 'done'),
  -- The claim time is set exactly when the claimant is (a removal clears both).
  check ((claimant_parent_id is null) = (claimed_at is null)),
  check (not_before is null or deadline is null or not_before <= deadline)
);
create unique index todo_tasks_source on todo_tasks (organization_id, source_key) where source_key is not null;
create index todo_tasks_status_deadline on todo_tasks (status, deadline);
create index todo_tasks_group on todo_tasks (owner_group_id) where owner_group_id is not null;
create index todo_tasks_family on todo_tasks (owner_family_id) where owner_family_id is not null;
create index todo_tasks_claimant on todo_tasks (claimant_parent_id) where claimant_parent_id is not null;
create index todo_tasks_done_by on todo_tasks (done_by_parent_id) where done_by_parent_id is not null;
create trigger todo_tasks_touch_version before update on todo_tasks
  for each row execute function platform_touch_version();

create table todo_task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references todo_tasks (id),
  change text not null check (change in ('created', 'edited', 'claimed', 'claim_given_back', 'claim_freed',
                                         'status_changed', 'marked_done', 'done_undone', 'pulled_to_event',
                                         'claimant_removed', 'migrated')),
  from_status text check (from_status is null or from_status in ('open', 'in_progress', 'done', 'postponed')),
  to_status text check (to_status is null or to_status in ('open', 'in_progress', 'done', 'postponed')),
  actor_kind text not null check (actor_kind in ('parent', 'administrator', 'system')),
  changed_by_parent_id uuid,
  event_id uuid,
  changed_at timestamptz not null default now()
);
create index todo_task_history_task on todo_task_history (task_id, changed_at, id);
create index todo_task_history_parent on todo_task_history (changed_by_parent_id) where changed_by_parent_id is not null;

-- A history row is only added. The one exception is the removal of a person: it clears the name on the row and changes
-- nothing else (BR190.1); no row is ever deleted. TRUNCATE (the reset of a local schema) does not fire row triggers.
create or replace function todo_history_guard() returns trigger
language plpgsql set search_path from current
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'todo_task_history: a history row is never deleted' using errcode = '23514';
  end if;
  if old.changed_by_parent_id is null or new.changed_by_parent_id is not null
     or (to_jsonb(new) - 'changed_by_parent_id') is distinct from (to_jsonb(old) - 'changed_by_parent_id') then
    raise exception 'todo_task_history: a history row is never changed, except to clear a removed person' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger todo_task_history_guard before update or delete on todo_task_history
  for each row execute function todo_history_guard();

create table todo_event_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references todo_tasks (id),
  event_id uuid not null,
  checklist_task_id uuid not null,
  pulled_at timestamptz not null default now(),
  unique (task_id, event_id)
);
create index todo_event_links_event on todo_event_links (event_id);

alter table todo_tasks enable row level security;
alter table todo_task_history enable row level security;
alter table todo_event_links enable row level security;
revoke all on todo_tasks, todo_task_history, todo_event_links from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- Part A, 2. The audit action list gains the five actions of BR189.3; every earlier action stays valid (NFR4.20).
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
  'swap.reversed', 'duty.reassigned', 'swap.denied', 'cancellation.denied',
  'recurring_schedule_saved', 'recurring_schedule_set_active', 'recurring_occurrence_done',
  'recurring_occurrence_undone', 'recurring_occurrence_skipped', 'recurring_removal_applied',
  'checklist.template_removed', 'checklist.template_restored', 'checklist.claim_removed',
  'checklist.done_undone', 'checklist.removal_applied',
  'animal_calendar.saved', 'animal_slots.created',
  'todo.claim_freed', 'todo.done_undone', 'todo.pulled_to_event', 'todo.removal_applied', 'todo.migration_loaded'
));

-- ---------------------------------------------------------------------------------------------------
-- Part A, 3. The notice target and the two notice kinds (C8, BR188). The facts function names the topic, its deadline and
--    the path of its page, and never the claimant, the owner family, another person or a contact detail (NFR10.4,
--    NFR10.5). It answers for a task of the reader's community only.
-- ---------------------------------------------------------------------------------------------------
create or replace function notice_facts_todo(p_target_id uuid, p_parent_id uuid, p_kind text)
returns table (item_name text, item_date date, path text, full_title text, detail text)
language sql stable security definer set search_path from current
as $$
  select t.topic, t.deadline, '/szulo/teendok/' || t.id::text, null::text, null::text
    from todo_tasks t
    join parents p on p.id = p_parent_id and p.organization_id = t.organization_id
   where t.id = p_target_id
$$;

insert into notice_targets (target_type, facts_function, added_by) values
  ('todo_task', 'notice_facts_todo', 'u12-todo');

insert into notice_kinds (kind, target_type, title_prefix, label, added_by) values
  ('todo_changed', 'todo_task', 'A teendő módosult:', 'Teendő módosult', 'u12-todo'),
  ('todo_due', 'todo_task', 'Közeleg a határidő:', 'Közeleg a határidő', 'u12-todo');

-- ---------------------------------------------------------------------------------------------------
-- Part A, 4. Helpers. Internal.
-- ---------------------------------------------------------------------------------------------------

-- Whether the caller manages a task of this owner (BR180.2): a group's tasks by a super admin or a coordinator of that
-- group (`can_manage_group`, C2), a family's tasks by a super admin only. Read live, so a right that ended applies now.
create or replace function todo_can_manage(p_org uuid, p_group uuid) returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce(case when p_group is null then has_super_scope(p_org) else can_manage_group(p_group) end, false)
$$;

-- The owner as the screens show it: the group's name, the family's display name, and "korábbi család" for a family
-- that is gone or was anonymised (NFR11.6).
create or replace function todo_owner_label(t todo_tasks) returns text
language sql stable security definer set search_path from current
as $$
  select case when t.owner_group_id is not null
              then coalesce((select g.name from groups g where g.id = t.owner_group_id), 'korábbi csoport')
              else coalesce(nullif(family_display_name(t.owner_family_id), 'korábbi tag'), 'korábbi család') end
$$;

-- One history row. The actor is a parent, an administrator with no parent record, or the system.
create or replace function todo_history_add(
  p_task uuid, p_change text, p_from text, p_to text, p_actor_kind text, p_parent uuid, p_event uuid default null
) returns void
language sql security definer set search_path from current
as $$
  insert into todo_task_history (task_id, change, from_status, to_status, actor_kind, changed_by_parent_id, event_id)
  values (p_task, p_change, p_from, p_to, p_actor_kind, p_parent, p_event)
$$;

-- Tells the claimant that an administrator changed their task (BR188.1). Nothing is sent when the caller is the
-- claimant, and the once key carries the version the change produced, so a repeat sends nothing twice.
create or replace function todo_notify_changed(p_task_id uuid, p_recipient uuid, p_caller_parent uuid) returns void
language plpgsql security definer set search_path from current
as $$
begin
  if p_recipient is null or p_recipient is not distinct from p_caller_parent then
    return;
  end if;
  perform notice_send(array[p_recipient], 'todo_changed', 'todo_task', p_task_id,
                      'todo_changed:' || p_task_id::text || ':' || (select t.version from todo_tasks t where t.id = p_task_id)::text);
end $$;

-- Clears or sets the attention flag of one task (BR190.1). Internal: the removal pair calls it for the tasks a removed
-- family owned. The task row is already locked by the caller; returns whether the flag changed.
create or replace function todo_task_set_attention(p_task_ids uuid[], p_flag boolean) returns integer
language plpgsql security definer set search_path from current
as $$
declare
  v_rows integer;
begin
  update todo_tasks set needs_attention = p_flag
   where id = any (coalesce(p_task_ids, '{}'::uuid[])) and needs_attention is distinct from p_flag;
  get diagnostics v_rows = row_count;
  return v_rows;
end $$;

-- The state of checklist tasks for the to-do pages (BR185.2): for each id, whether the task still exists, whether it is
-- done, and whether its event is closed. U11's migration is merged, so this read lives here; it only reads and U11's
-- tables learn nothing of to-do tasks. Internal.
create or replace function checklist_task_done_state(p_task_ids uuid[])
returns table (task_id uuid, task_exists boolean, is_done boolean, event_closed boolean)
language sql stable security definer set search_path from current
as $$
  select i.id, t.id is not null, coalesce(t.done_at is not null, false),
         case when e.id is null then false else not checklist_event_is_open(e) end
    from unnest(coalesce(p_task_ids, '{}'::uuid[])) as i(id)
    left join event_checklist_tasks t on t.id = i.id
    left join events e on e.id = t.event_id
$$;

-- ---------------------------------------------------------------------------------------------------
-- Part A, 5. todo_task_save (W1; BR180.2, BR181.1 to BR181.3). One call adds a task or changes one as a whole. A manager
--    of the owner saves; a coordinator only for their own group and never moves a task; a family-owned task is a super
--    admin's. A change carries the version the editor saw. Saving clears the attention flag and bumps the version.
--      p_task: {id?, expected_version?, owner_group_id? | owner_family_id?, topic, priority?, description?, materials?,
--               status?, note?, not_before?, deadline?}
--    Saving never sets done (BR183.2). The claimant is told when a manager changes anything but the note (BR188.1).
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
    v_actor := coalesce(current_parent_id(), identity_linked_parent());
    v_group_text := nullif(p_task->>'owner_group_id', '');
    v_family_text := nullif(p_task->>'owner_family_id', '');
    v_owner_given := v_group_text is not null or v_family_text is not null;
    if v_group_text is not null and v_family_text is not null then
      perform platform_field_invalid('owner', 'one_only');
    end if;
    v_creating := p_task->'id' is null or jsonb_typeof(p_task->'id') = 'null';

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
        perform platform_deny_unless_super(v_org);
        v_family := platform_try_uuid(v_family_text);
        if v_family is null then
          perform platform_field_invalid('owner');
        end if;
        if not exists (select 1 from families f where f.id = v_family and f.organization_id = v_org and f.status = 'active') then
          perform platform_field_invalid('owner', 'not_found');
        end if;
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
      v_content_changed := v_owner_group is distinct from v_old.owner_group_id
        or v_owner_family is distinct from v_old.owner_family_id
        or v_topic is distinct from v_old.topic or v_priority is distinct from v_old.priority
        or v_description is distinct from v_old.description or v_materials is distinct from v_old.materials
        or v_status is distinct from v_old.status or v_not_before is distinct from v_old.not_before
        or v_deadline is distinct from v_old.deadline;
      update todo_tasks
         set owner_group_id = v_owner_group, owner_family_id = v_owner_family, topic = v_topic, priority = v_priority,
             description = v_description, materials = v_materials, status = v_status, note = v_note,
             not_before = v_not_before, deadline = v_deadline, needs_attention = false
       where id = v_id;
      perform todo_history_add(v_id, 'edited', v_old.status, v_status, case when v_actor is null then 'administrator' else 'parent' end, v_actor);
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

-- ---------------------------------------------------------------------------------------------------
-- Part A, 6. todo_task_claim (W2; BR182.1, BR182.2). A parent with a family claims a group's task, or a task their own
--    family owns. The role and family checks come before any row is looked up, a family-owned task of another family
--    answers like one that does not exist, and the task row is locked before the claimant is read. After the lock the
--    caller is checked again (NFR3.25): a removal that committed in between leaves no claim for a removed parent. No
--    family row is locked. The status check order lets the loser of two claims at once read TODO_CLAIMED, not a version
--    conflict.
-- ---------------------------------------------------------------------------------------------------
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
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
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

-- ---------------------------------------------------------------------------------------------------
-- Part A, 7. todo_task_give_back (BR182.2, BR182.3). Only the claimant gives a claim back, while the task is not done. The
--    task goes back to open when it was in progress; a postponed one stays postponed. The caller is checked again after
--    the lock, as for a claim.
-- ---------------------------------------------------------------------------------------------------
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
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
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

-- ---------------------------------------------------------------------------------------------------
-- Part A, 8. todo_task_free_claim (BR182.3, BR188.1, BR189.3). A manager of the task frees any claim on a task that is not
--    done; the claimant is told and, when it was another person's claim, one audit row without names is written.
-- ---------------------------------------------------------------------------------------------------
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
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
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

-- ---------------------------------------------------------------------------------------------------
-- Part A, 9. todo_task_update (BR183.1). The claimant and a manager of the task change its status and its note, and
--    nothing else. The claimant sets in progress or postponed; a manager may also set open while nobody holds the task;
--    postponed needs a note; a parent never sets done or open by hand. A null status keeps it. The note is always the one
--    sent, so a null note clears it.
-- ---------------------------------------------------------------------------------------------------
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
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
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

-- ---------------------------------------------------------------------------------------------------
-- Part A, 10. todo_task_mark_done and todo_task_undo_done (BR183.2, BR183.3). The claimant or a manager marks a task done
--    and the app records who and when; who marked it is stored as a parent, so the caller needs an active parent record
--    (a super admin without one is refused with no_parent_record). Whoever marked it, or a manager, undoes the mark; the
--    task is in progress again when a claimant is still set, otherwise open. Undoing another person's mark is audited,
--    and a manager's undo tells the claimant. The caller is checked again after the lock.
-- ---------------------------------------------------------------------------------------------------
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
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
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
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
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

-- ---------------------------------------------------------------------------------------------------
-- Part B, 1. todo_pull_to_event (W3; BR185.1, BR185.2; contract C15). A manager of the event pulls open to-do tasks into
--    its checklist, in the parents' section "Teendők"; the original task is not changed. The event is locked first (it
--    must be open), then `checklist_add_task` locks the checklist rows, then the selected to-do rows are locked
--    ascending and their versions compared, so an outdated screen fails the whole pull. Everything is one transaction:
--    a failure on any task leaves no checklist task, link or history row. A task already pulled into this event (its
--    checklist task still there) adds nothing; a link whose checklist task is gone is ignored and made again. A claimant
--    who is still an active parent of an active family comes along as the first helper (BR170.5 of U11); the checklist
--    keeps a material text of at most 300 characters, so a longer one is cut there and stays whole on the to-do task.
--      p_todo_ids and p_expected_versions: parallel lists, one version per task.
-- ---------------------------------------------------------------------------------------------------
create or replace function todo_pull_to_event(
  p_idempotency_key text, p_event_id uuid, p_todo_ids uuid[], p_expected_versions integer[]
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'todo.pull';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event events%rowtype;
  v_actor uuid;
  v_ids uuid[];
  v_versions integer[];
  v_count integer;
  v_i integer;
  v_task todo_tasks%rowtype;
  v_link todo_event_links%rowtype;
  v_locked todo_tasks%rowtype;
  v_ctask uuid;
  v_new_tasks uuid[] := '{}'::uuid[];
  v_new_ctasks uuid[] := '{}'::uuid[];
  v_added integer := 0;
  v_already integer := 0;
  v_carried integer := 0;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_event_id::text,
                      coalesce(array_to_string(p_todo_ids, ','), ''), coalesce(array_to_string(p_expected_versions, ','), '')),
                      'UTF8')), 'hex');
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
    -- The event is locked first and must be one the caller manages (BR185.1): a coordinator of another group, a parent
    -- and a teacher are refused here, before anything of a to-do task is read.
    v_event := event_lock_managed(p_event_id, v_org);
    if not checklist_event_is_open(v_event) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    if p_todo_ids is null or p_expected_versions is null or cardinality(p_todo_ids) = 0
       or cardinality(p_todo_ids) <> cardinality(p_expected_versions) or array_position(p_todo_ids, null) is not null
       or array_position(p_expected_versions, null) is not null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    if cardinality(p_todo_ids) > 50 then
      perform platform_abort('validation', 'too_many_tasks');
    end if;
    select array_agg(x.id order by x.id), array_agg(x.version order by x.id), count(distinct x.id)
      into v_ids, v_versions, v_count
      from (select i.id, p_expected_versions[i.ord::integer] as version
              from unnest(p_todo_ids) with ordinality as i(id, ord)) x;
    if v_count <> cardinality(v_ids) then
      perform platform_abort('validation', 'request_invalid');
    end if;
    v_actor := coalesce(current_parent_id(), identity_linked_parent());

    -- Each task, ascending: the checklist task is made through U11's function, which locks the checklist rows.
    for v_i in 1 .. cardinality(v_ids) loop
      select * into v_task from todo_tasks t where t.id = v_ids[v_i] and t.organization_id = v_org;
      if not found then
        perform platform_field_invalid('todo_ids', 'not_found');
      end if;
      if v_task.status = 'done' then
        perform platform_abort('conflict', 'TODO_DONE');
      end if;
      select * into v_link from todo_event_links l where l.task_id = v_task.id and l.event_id = p_event_id;
      if found then
        if exists (select 1 from event_checklist_tasks c where c.id = v_link.checklist_task_id and c.event_id = p_event_id) then
          v_already := v_already + 1;
          continue;
        end if;
        -- The checklist task is gone: the old link does not block a new pull (BR185.1).
        delete from todo_event_links where id = v_link.id;
      end if;
      v_ctask := checklist_add_task(
        p_event_id,
        jsonb_build_object('section_title', 'Teendők', 'title', v_task.topic, 'priority', v_task.priority,
                           'materials', left(v_task.materials, 300)),
        v_task.id::text,
        case when v_task.claimant_parent_id is not null
             then jsonb_build_object('parent_id', v_task.claimant_parent_id) end);
      v_new_tasks := v_new_tasks || v_task.id;
      v_new_ctasks := v_new_ctasks || v_ctask;
      if v_task.claimant_parent_id is not null
         and exists (select 1 from checklist_claims c where c.task_id = v_ctask and c.parent_id = v_task.claimant_parent_id) then
        v_carried := v_carried + 1;
      end if;
    end loop;

    -- Then the to-do rows, ascending: a task changed since the screen was loaded fails the whole pull.
    -- A task already on this event's list skips the version check (BR185.1).
    for v_i in 1 .. cardinality(v_ids) loop
      select * into v_locked from todo_tasks t where t.id = v_ids[v_i] for update;
      if v_locked.status = 'done' then
        perform platform_abort('conflict', 'TODO_DONE');
      end if;
      if not (v_ids[v_i] = any (v_new_tasks)) then
        continue;
      end if;
      if v_locked.version <> v_versions[v_i] then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
    end loop;

    for v_i in 1 .. cardinality(v_new_tasks) loop
      insert into todo_event_links (task_id, event_id, checklist_task_id) values (v_new_tasks[v_i], p_event_id, v_new_ctasks[v_i]);
      perform todo_history_add(v_new_tasks[v_i], 'pulled_to_event', null, null,
                               case when v_actor is null then 'administrator' else 'parent' end, v_actor, p_event_id);
      v_added := v_added + 1;
    end loop;
    if v_added > 0 then
      perform platform_audit_write('todo.pulled_to_event', 'event', p_event_id, v_org, v_event.group_id, 'success',
                                   'added:' || v_added::text);
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_event_id);
    return platform_result('success', p_event_id, null)
      || jsonb_build_object('added', v_added, 'already_on_list', v_already, 'claimants_carried', v_carried);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Part B, 2. The card of a task for the list (BR180.1, BR184.1): the fields a card shows and whether the caller may claim
--    it. Names come through C6, a family's name falls back to "korábbi család" and a person's to "korábbi tag" (NFR11.6).
--    Internal.
-- ---------------------------------------------------------------------------------------------------
create or replace function todo_card_json(t todo_tasks, p_parent uuid, p_family uuid, p_today date) returns jsonb
language sql stable security definer set search_path from current
as $$
  select jsonb_build_object(
    'id', t.id, 'topic', t.topic, 'priority', t.priority, 'status', t.status,
    'owner_kind', case when t.owner_group_id is not null then 'working_group' else 'family' end,
    'owner_id', coalesce(t.owner_group_id, t.owner_family_id),
    'owner_label', todo_owner_label(t),
    'claimant_display_name', case when t.claimant_parent_id is null then null
                                  else coalesce(parent_display_name(t.claimant_parent_id), 'korábbi tag') end,
    'claimed_by_me', coalesce(t.claimant_parent_id = p_parent, false),
    'not_before', t.not_before, 'deadline', t.deadline,
    'is_done', t.status = 'done',
    'is_not_yet', t.status <> 'done' and t.not_before is not null and t.not_before > p_today,
    'is_overdue', t.status <> 'done' and t.deadline is not null and t.deadline < p_today,
    'needs_attention', t.needs_attention,
    'version', t.version,
    'can_claim', p_parent is not null and p_family is not null and t.status <> 'done' and t.claimant_parent_id is null
                 and (t.not_before is null or t.not_before <= p_today)
                 and (t.owner_family_id is null or t.owner_family_id = p_family))
$$;

-- ---------------------------------------------------------------------------------------------------
-- Part B, 3. todo_list (W2; BR180.1, BR184.1). The community's list for every signed-in reader, a teacher included, in one
--    document. The default view leaves out done tasks and tasks whose "not before" date is in the future; the toggle
--    brings them back, marked. Filters narrow by owner (a group or a family), status and priority, and the attention
--    flag for the removal screen of U14. The order is priority 1 first and empty last, then the soonest deadline and
--    empty last, then id; the list stops at 500 and says so. Each task says whether it was pulled into an event, and
--    whether it is done there, read from the checklist through checklist_task_done_state (BR185.2). A caller with no
--    access gets the denied refusal, never an empty list.
-- ---------------------------------------------------------------------------------------------------
create or replace function todo_list(
  p_show_hidden boolean default false, p_owner uuid default null, p_status text default null,
  p_priority integer default null, p_attention_only boolean default false
) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parent uuid;
  v_family uuid;
  v_today date := school_today();
  v_items jsonb;
  v_truncated boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_status is not null and p_status not in ('open', 'in_progress', 'done', 'postponed') then
    return platform_result('validation', null, 'field_invalid') || jsonb_build_object('field', 'status', 'reason', 'invalid');
  end if;
  if p_priority is not null and p_priority not between 1 and 3 then
    return platform_result('validation', null, 'field_invalid') || jsonb_build_object('field', 'priority', 'reason', 'invalid');
  end if;
  v_org := identity_actor_organization();
  v_parent := current_parent_id();
  v_family := current_family_id();

  with page as (
    select t as task,
           row_number() over (order by t.priority nulls last, t.deadline nulls last, t.id) as rn
      from todo_tasks t
     where t.organization_id = v_org
       and (coalesce(p_show_hidden, false) or (t.status <> 'done' and (t.not_before is null or t.not_before <= v_today)))
       and (p_owner is null or t.owner_group_id = p_owner or t.owner_family_id = p_owner)
       and (p_status is null or t.status = p_status)
       and (p_priority is null or t.priority = p_priority)
       and (not coalesce(p_attention_only, false) or t.needs_attention)
     order by t.priority nulls last, t.deadline nulls last, t.id
     limit 501
  ), states as (
    select s.*
      from checklist_task_done_state(coalesce((select array_agg(l.checklist_task_id)
                                                 from todo_event_links l
                                                 join page p on (p.task).id = l.task_id and p.rn <= 500), '{}'::uuid[])) s
  ), links as (
    select l.task_id, bool_or(s.task_exists) as on_event, bool_or(s.is_done) as done_on_event
      from todo_event_links l join states s on s.task_id = l.checklist_task_id
     group by l.task_id
  )
  select coalesce(jsonb_agg(todo_card_json(p.task, v_parent, v_family, v_today)
                            || jsonb_build_object('on_event', coalesce(k.on_event, false),
                                                  'done_on_event', coalesce(k.done_on_event, false))
                            order by p.rn) filter (where p.rn <= 500), '[]'::jsonb),
         count(*) > 500
    into v_items, v_truncated
    from page p left join links k on k.task_id = (p.task).id;

  return platform_result('success', null, null) || jsonb_build_object(
    'items', v_items, 'truncated', v_truncated,
    'filters', jsonb_build_object('show_hidden', coalesce(p_show_hidden, false), 'owner', p_owner, 'status', p_status,
                                  'priority', p_priority, 'attention_only', coalesce(p_attention_only, false)),
    'caller', jsonb_build_object('can_claim_tasks', v_parent is not null and v_family is not null,
                                 'can_manage_community', coalesce(has_super_scope(v_org), false)));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Part B, 4. todo_get (W2; BR180.1, BR184.2, BR185.2). One task for any signed-in reader of the community: its fields, owner,
--    claimant and done mark, its history from oldest to newest with who and when (no note or other free text), its event
--    links with what the checklist says, and what the caller may do on it (nothing for a teacher). A task of another
--    community and an unknown id answer the same denied refusal.
-- ---------------------------------------------------------------------------------------------------
create or replace function todo_get(p_task_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parent uuid;
  v_family uuid;
  v_today date := school_today();
  v_task todo_tasks%rowtype;
  v_manage boolean;
  v_mine boolean;
  v_done boolean;
  v_history jsonb;
  v_links jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select * into v_task from todo_tasks t where t.id = p_task_id and t.organization_id = v_org;
  if not found then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_parent := current_parent_id();
  v_family := current_family_id();
  v_manage := todo_can_manage(v_org, v_task.owner_group_id);
  v_mine := coalesce(v_task.claimant_parent_id = v_parent, false);
  v_done := v_task.status = 'done';

  select coalesce(jsonb_agg(jsonb_build_object(
           'change', h.change, 'from_status', h.from_status, 'to_status', h.to_status,
           'actor', case h.actor_kind when 'system' then 'rendszer' when 'administrator' then 'adminisztrátor'
                      else coalesce(parent_display_name(h.changed_by_parent_id), 'korábbi tag') end,
           'at', h.changed_at, 'event_id', h.event_id,
           'event_title', (select e.title from events e where e.id = h.event_id)) order by h.changed_at, h.id), '[]'::jsonb)
    into v_history from todo_task_history h where h.task_id = v_task.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'event_id', l.event_id, 'event_title', e.title, 'pulled_at', l.pulled_at,
           'state', case when e.id is null or not s.task_exists then 'gone' when s.is_done then 'done_on_event' else 'on_list' end,
           'event_closed', s.event_closed) order by l.pulled_at, l.id), '[]'::jsonb)
    into v_links
    from todo_event_links l
    left join events e on e.id = l.event_id
    cross join lateral checklist_task_done_state(array[l.checklist_task_id]) s
   where l.task_id = v_task.id;

  return platform_result('success', v_task.id, null) || jsonb_build_object('item',
    todo_card_json(v_task, v_parent, v_family, v_today) || jsonb_build_object(
      'description', v_task.description, 'materials', v_task.materials, 'note', v_task.note,
      'created_at', v_task.created_at,
      'done', case when not v_done then null else jsonb_build_object(
                'at', v_task.done_at,
                'by_display_name', case
                  when v_task.done_by_parent_id is not null then coalesce(parent_display_name(v_task.done_by_parent_id), 'korábbi tag')
                  when exists (select 1 from todo_task_history h where h.task_id = v_task.id and h.change = 'migrated') then null
                  else 'korábbi tag' end,
                'is_own', coalesce(v_task.done_by_parent_id = v_parent, false)) end,
      'history', v_history,
      'event_links', v_links,
      'can', jsonb_build_object(
        'claim', (todo_card_json(v_task, v_parent, v_family, v_today)->>'can_claim')::boolean,
        'give_back', v_mine and not v_done,
        'update', not v_done and (v_mine or v_manage),
        'mark_done', not v_done and v_parent is not null and (v_mine or v_manage),
        'undo_done', v_done and (v_manage or coalesce(v_task.done_by_parent_id = v_parent, false)),
        'free_claim', v_manage and not v_done and v_task.claimant_parent_id is not null,
        'edit', v_manage)));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Part B, 5. todo_list_for_group (C14; BR187.1). The coordinator page's list of a group's to-do tasks: the open ones and the
--    ones finished in the last 60 days, answered only to a caller who may manage the group. Rows are id, title and status
--    (the contract) with what the tab needs to edit a task or free a claim. A caller who may not gets the denied
--    refusal, never an empty list.
-- ---------------------------------------------------------------------------------------------------
create or replace function todo_list_for_group(p_group_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_today date := school_today();
  v_items jsonb;
  v_truncated boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_group_id is null or not can_manage_group(p_group_id) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  with page as (
    select t,
           row_number() over (order by (t.status = 'done'), t.priority nulls last, t.deadline nulls last, t.id) as rn
      from todo_tasks t
     where t.organization_id = v_org and t.owner_group_id = p_group_id
       and (t.status <> 'done' or t.done_at > now() - interval '60 days')
     order by (t.status = 'done'), t.priority nulls last, t.deadline nulls last, t.id
     limit 501
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', (p.t).id, 'title', (p.t).topic, 'status', (p.t).status, 'priority', (p.t).priority,
           'deadline', (p.t).deadline,
           'claimant_display_name', case when (p.t).claimant_parent_id is null then null
                                         else coalesce(parent_display_name((p.t).claimant_parent_id), 'korábbi tag') end,
           'is_overdue', (p.t).status <> 'done' and (p.t).deadline is not null and (p.t).deadline < v_today,
           'needs_attention', (p.t).needs_attention, 'version', (p.t).version) order by p.rn) filter (where p.rn <= 500),
           '[]'::jsonb),
         count(*) > 500
    into v_items, v_truncated from page p;
  return platform_result('success', p_group_id, null) || jsonb_build_object('items', v_items, 'truncated', v_truncated);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Part B, 6. my_tasks_get (W4; BR186.1, BR186.2). The caller's own work in one document: the duties their family holds
--    (places not done, on open duties, from 60 days back), the open occurrences of recurring duties of their family and
--    groups (U9's read), and the to-do tasks they claimed that are not done. Nothing to browse, no event checklist task
--    and nothing of another family. A teacher and a caller without a family get the denied refusal, never an empty
--    page. Rows are grouped by the Budapest week (Monday to Sunday): on or before this Sunday is "this week" (overdue
--    ones marked), later is "later", no date is "no date"; inside a group by date, kind and id. An empty page says so.
--    A row's `can_mark_done` is the right the row's own screen gives, so no new right is created here.
-- ---------------------------------------------------------------------------------------------------
create or replace function my_tasks_week_end(p_today date) returns date
language sql immutable set search_path from current
as $$ select p_today + (7 - extract(isodow from p_today)::integer) $$;

-- The group a row falls in on My tasks: no date, on or before this Sunday (overdue ones included), or later. Plain date
-- arithmetic on the Budapest date, so the two clock-change Sundays are weeks like any other.
create or replace function my_tasks_group(p_due date, p_today date) returns text
language sql immutable set search_path from current
as $$ select case when p_due is null then 'no_date' when p_due <= my_tasks_week_end(p_today) then 'this_week' else 'later' end $$;

create or replace function my_tasks_get() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parent uuid;
  v_family uuid;
  v_today date := school_today();
  v_week_end date;
  v_recurring jsonb;
  v_this jsonb;
  v_later jsonb;
  v_none jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_parent := current_parent_id();
  v_family := current_family_id();
  if not can_read_community() or v_parent is null or v_family is null then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  v_week_end := my_tasks_week_end(v_today);
  v_recurring := recurring_my_occurrences();
  if v_recurring->>'state' is distinct from 'success' then
    return platform_result('denied', null, coalesce(v_recurring->>'code', 'authorization_denied'));
  end if;

  with source_rows as (
    select 'duty'::text as kind, a.id as id, t.id as ref_id, t.title as title,
           (t.starts_at at time zone 'Europe/Budapest')::date as due_date, a.status as status, a.version as version,
           true as can_mark_done
      from assignments a join tasks t on t.id = a.task_id
     where a.organization_id = v_org and a.family_id = v_family and a.status <> 'removed' and a.done_at is null
       and t.status = 'open' and (t.starts_at at time zone 'Europe/Budapest')::date >= v_today - 60
    union all
    select 'recurring', (r.item->>'id')::uuid, (r.item->>'id')::uuid, r.item->>'title', (r.item->>'due_date')::date,
           r.item->>'status', (r.item->>'version')::integer, coalesce((r.item->>'can_mark_done')::boolean, false)
      from jsonb_array_elements(coalesce(v_recurring->'items', '[]'::jsonb)) as r(item)
     where r.item->>'status' = 'open'
    union all
    select 'todo', t.id, t.id, t.topic, t.deadline, t.status, t.version, true
      from todo_tasks t
     where t.organization_id = v_org and t.claimant_parent_id = v_parent and t.status <> 'done'
  ), grouped as (
    select s.*, my_tasks_group(s.due_date, v_today) as grp
      from source_rows s
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', g.kind, 'id', g.id, 'ref_id', g.ref_id, 'title', g.title,
                                               'date', g.due_date, 'status', g.status, 'version', g.version,
                                               'is_overdue', g.due_date is not null and g.due_date < v_today,
                                               'can_mark_done', g.can_mark_done)
                            order by g.due_date, g.kind, g.id) filter (where g.grp = 'this_week'), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object('kind', g.kind, 'id', g.id, 'ref_id', g.ref_id, 'title', g.title,
                                               'date', g.due_date, 'status', g.status, 'version', g.version,
                                               'is_overdue', false, 'can_mark_done', g.can_mark_done)
                            order by g.due_date, g.kind, g.id) filter (where g.grp = 'later'), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object('kind', g.kind, 'id', g.id, 'ref_id', g.ref_id, 'title', g.title,
                                               'date', null, 'status', g.status, 'version', g.version,
                                               'is_overdue', false, 'can_mark_done', g.can_mark_done)
                            order by g.kind, g.id) filter (where g.grp = 'no_date'), '[]'::jsonb)
    into v_this, v_later, v_none
    from grouped g;

  return platform_result('success', null, null) || jsonb_build_object(
    'this_week', v_this, 'later', v_later, 'no_date', v_none,
    'is_empty', jsonb_array_length(v_this) + jsonb_array_length(v_later) + jsonb_array_length(v_none) = 0,
    'week_end', v_week_end);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Part C, 1. The deadline reminder (C9; BR188.2). Daily, lock step 4, reached only through U5's run. For each task with a
--    claimant who is still a parent, not done, with a deadline: from three days before the deadline up to the deadline
--    the claimant gets one `todo_due` notice. The once key carries the task, the claimant and the deadline date, so a new
--    claimant or a moved deadline allows one new reminder and a second run sends nothing. No task lock is taken. A
--    failing task is named in the detail and the others still run.
-- ---------------------------------------------------------------------------------------------------
create or replace function todo_deadline_reminder(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Budapest')::date;
  v_task record;
  v_created integer := 0;
  v_skipped integer := 0;
  v_failed uuid[] := '{}'::uuid[];
begin
  for v_task in
    select t.id, t.claimant_parent_id, t.deadline
      from todo_tasks t
     where t.claimant_parent_id is not null and t.status <> 'done' and t.deadline is not null
       and v_today between t.deadline - 3 and t.deadline
     order by t.id
  loop
    begin
      if not exists (select 1 from parents p where p.id = v_task.claimant_parent_id) then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      v_created := v_created + notice_send(array[v_task.claimant_parent_id], 'todo_due', 'todo_task', v_task.id,
                     'todo_due:' || v_task.id::text || ':' || v_task.claimant_parent_id::text || ':' || v_task.deadline::text);
    exception when others then
      v_failed := v_failed || v_task.id;
    end;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped,
    'detail', case when cardinality(v_failed) = 0 then null else 'failed: ' || array_to_string(v_failed, ', ') end);
end $$;

insert into timed_check_registry (check_name, function_name, run_kind, is_active, lock_step, added_by) values
  ('todo_deadline_reminder', 'todo_deadline_reminder', 'daily', true, 4, 'u12-todo');

-- ---------------------------------------------------------------------------------------------------
-- Part C, 2. C16 (BR190.1): removing a parent or a family. For a parent: the done mark and the history names they made are
--    cleared; a claim they hold is cleared and, when the task is not done, the task is flagged, an in-progress status goes
--    back to open and a `claimant_removed` history row (actor system) is written. For a family: every not-done task it owns
--    is flagged, and the same names of its parents are cleared. Rows stay and read as korábbi tag. Preview and apply
--    return the same two counts. Apply locks the family row (a no-op when U14 already holds it), then the to-do rows
--    ascending.
-- ---------------------------------------------------------------------------------------------------
create or replace function todo_removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_parents uuid[];
  v_family uuid;
  v_clear integer;
  v_flag integer;
begin
  if p_subject_kind = 'parent' then
    select coalesce(array_agg(p.id), '{}'::uuid[]) into v_parents from parents p where p.id = p_subject_id;
  elsif p_subject_kind = 'family' then
    v_family := p_subject_id;
    select coalesce(array_agg(p.id), '{}'::uuid[]) into v_parents from parents p where p.family_id = p_subject_id;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;
  select (select count(*) from todo_tasks t where t.claimant_parent_id = any (v_parents) or t.done_by_parent_id = any (v_parents))
       + (select count(*) from todo_task_history h where h.changed_by_parent_id = any (v_parents))
    into v_clear;
  select count(*) into v_flag
    from todo_tasks t
   where (t.claimant_parent_id = any (v_parents) and t.status <> 'done')
      or (v_family is not null and t.owner_family_id = v_family and t.status <> 'done' and not t.needs_attention);
  return jsonb_build_object('to_clear', v_clear, 'to_flag', v_flag);
end $$;

create or replace function todo_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parents uuid[];
  v_family uuid;
  v_tasks uuid[];
  v_released uuid[];
  v_family_open uuid[];
  v_clear integer := 0;
  v_flag integer := 0;
  v_rows integer;
begin
  if p_subject_kind = 'parent' then
    select p.organization_id into v_org from parents p where p.id = p_subject_id;
    if not found then
      return jsonb_build_object('to_clear', 0, 'to_flag', 0);
    end if;
    v_parents := array[p_subject_id];
  elsif p_subject_kind = 'family' then
    select f.organization_id into v_org from families f where f.id = p_subject_id;
    if not found then
      return jsonb_build_object('to_clear', 0, 'to_flag', 0);
    end if;
    v_family := p_subject_id;
    select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_parents from parents p where p.family_id = p_subject_id;
    perform 1 from families f where f.id = v_family for update;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;

  select coalesce(array_agg(x.id order by x.id), '{}'::uuid[]) into v_tasks
    from (select t.id from todo_tasks t where t.claimant_parent_id = any (v_parents) or t.done_by_parent_id = any (v_parents)
          union
          select t.id from todo_tasks t
           where v_family is not null and t.owner_family_id = v_family and t.status <> 'done') x;
  perform 1 from todo_tasks t where t.id = any (v_tasks) order by t.id for update;

  -- A claim on a task that is not done is released and the task flagged.
  select coalesce(array_agg(t.id order by t.id), '{}'::uuid[]) into v_released
    from todo_tasks t where t.claimant_parent_id = any (v_parents) and t.status <> 'done';
  insert into todo_task_history (task_id, change, from_status, to_status, actor_kind, changed_by_parent_id)
  select t.id, 'claimant_removed', t.status, case when t.status = 'in_progress' then 'open' else t.status end, 'system', null
    from todo_tasks t where t.id = any (v_released) order by t.id;
  update todo_tasks
     set claimant_parent_id = null, claimed_at = null, needs_attention = true,
         status = case when status = 'in_progress' then 'open' else status end
   where id = any (v_released);
  v_flag := cardinality(v_released);
  v_clear := v_clear + cardinality(v_released);

  -- A claim on a done task and the done mark lose the person; the rows stay.
  update todo_tasks
     set claimant_parent_id = case when claimant_parent_id = any (v_parents) then null else claimant_parent_id end,
         claimed_at = case when claimant_parent_id = any (v_parents) then null else claimed_at end,
         done_by_parent_id = case when done_by_parent_id = any (v_parents) then null else done_by_parent_id end
   where status = 'done' and (claimant_parent_id = any (v_parents) or done_by_parent_id = any (v_parents));
  get diagnostics v_rows = row_count;
  v_clear := v_clear + v_rows;

  -- A removed family's open tasks need an administrator.
  if v_family is not null then
    select coalesce(array_agg(t.id order by t.id), '{}'::uuid[]) into v_family_open
      from todo_tasks t where t.owner_family_id = v_family and t.status <> 'done';
    v_flag := v_flag + todo_task_set_attention(v_family_open, true);
  end if;

  update todo_task_history set changed_by_parent_id = null where changed_by_parent_id = any (v_parents);
  get diagnostics v_rows = row_count;
  v_clear := v_clear + v_rows;

  perform platform_audit_write('todo.removal_applied', p_subject_kind, p_subject_id, v_org, null, 'success',
                               'cleared:' || v_clear::text || ':flagged:' || v_flag::text);
  return jsonb_build_object('to_clear', v_clear, 'to_flag', v_flag);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Part C, 3. The one-off load (C17; BR190.2). Service role only; one task per call; a second call with the same source key
--    creates nothing and returns the stored task. Payload: {topic, priority?, description?, materials?, status?, note?,
--    not_before?, deadline?, done_date?, owner_group_name | owner_family_id}. The same limits as a save apply; a done row
--    is stored done with the sheet's date (today when it has none), no claimant and no person on the mark. A bad row is
--    refused with the field name only and the next rows are unaffected. One `migrated` history row (actor system) is
--    written and the load is audited without a name or text.
-- ---------------------------------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------------------------------
-- Part C, 4. Function rights (C1, NFR3.7). Every function here starts with no rights. The signed-in commands and reads go
--    to signed-in accounts and check their caller themselves; the load goes to the service role; the helpers, the facts,
--    the reminder, the removal pair and the checklist read stay with nobody who is signed in.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  todo_history_guard(),
  notice_facts_todo(uuid, uuid, text),
  todo_can_manage(uuid, uuid),
  todo_owner_label(todo_tasks),
  todo_history_add(uuid, text, text, text, text, uuid, uuid),
  todo_notify_changed(uuid, uuid, uuid),
  todo_task_set_attention(uuid[], boolean),
  checklist_task_done_state(uuid[]),
  todo_card_json(todo_tasks, uuid, uuid, date),
  my_tasks_week_end(date),
  my_tasks_group(date, date),
  todo_deadline_reminder(timestamptz),
  todo_removal_preview(text, uuid),
  todo_removal_apply(text, uuid),
  migration_load_todo(text, uuid, jsonb),
  todo_task_save(text, jsonb),
  todo_task_claim(text, uuid, integer),
  todo_task_give_back(text, uuid, integer),
  todo_task_free_claim(text, uuid, integer),
  todo_task_update(text, uuid, text, text, integer),
  todo_task_mark_done(text, uuid, integer),
  todo_task_undo_done(text, uuid, integer),
  todo_pull_to_event(text, uuid, uuid[], integer[]),
  todo_list(boolean, uuid, text, integer, boolean),
  todo_get(uuid),
  todo_list_for_group(uuid),
  my_tasks_get()
  from public, anon, authenticated, service_role;

grant execute on function
  todo_task_save(text, jsonb),
  todo_task_claim(text, uuid, integer),
  todo_task_give_back(text, uuid, integer),
  todo_task_free_claim(text, uuid, integer),
  todo_task_update(text, uuid, text, text, integer),
  todo_task_mark_done(text, uuid, integer),
  todo_task_undo_done(text, uuid, integer),
  todo_pull_to_event(text, uuid, uuid[], integer[]),
  todo_list(boolean, uuid, text, integer, boolean),
  todo_get(uuid),
  todo_list_for_group(uuid),
  my_tasks_get()
  to authenticated;

grant execute on function migration_load_todo(text, uuid, jsonb) to service_role;

commit;
