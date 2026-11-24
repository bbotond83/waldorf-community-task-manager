-- U11 of the Ovis tábla work: checklist templates, the checklist each event copies from them, the people who take a task
-- (several helpers per task, a typed name for someone without an account), the done mark, two timed notices, the end of
-- today's event tasks, and the functions U12 and U14 call (BR160 to BR170; contracts C1, C2, C6 to C9, C13 to C16). The
-- file opens and commits its own transaction, as 20261048 to 20261066 do, because the migration runner adds none: the
-- structure, the registry rows and every redefined function succeed or fail together.
-- Technical names stay: a community is `organizations`, a working group is `groups`, a duty is a `tasks` row.
--
-- Lock order of every path (BR170.1): the event row first, then the event's checklist head row, then its sections by
-- ascending id, then its checklist tasks by ascending id, then their claims by ascending id. A template command locks
-- the template, then its sections and tasks, and never an event. The copy locks the event and reads the template
-- without a lock. No command locks a family row.
--
-- Refusals are raised through U3R00 and rolled back (C1). Every function pins its search path, starts with
-- `revoke all` and gets an explicit grant or none: the signed-in commands and reads are granted to signed-in accounts
-- and check their caller themselves; the install, the facts, the removal pair, the helpers and the two checks are
-- internal and granted to nobody who is signed in.
begin;

-- ---------------------------------------------------------------------------------------------------
-- 1. The seven tables. Row-level security on, no policy and no right for any application role: the screens read through
--    the read functions below (NFR3.7). Links to people are typed ids with no foreign key (ADR-001), checked inside the
--    functions, so the lifecycle of a parent or family never fails on a checklist row. The positions are checked at the
--    end of the statement (deferred), so a reorder can swap two rows in one go.
-- ---------------------------------------------------------------------------------------------------
create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  working_group_id uuid references groups (id),
  name text not null check (char_length(name) between 1 and 200 and name = btrim(name)),
  description text check (description is null or char_length(description) <= 1000),
  default_lead_days integer check (default_lead_days is null or default_lead_days between 1 and 60),
  is_removed boolean not null default false,
  removed_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_removed = (removed_at is not null))
);
create unique index checklist_templates_name on checklist_templates
  (organization_id, coalesce(working_group_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index checklist_templates_group on checklist_templates (organization_id, working_group_id);
create trigger checklist_templates_touch_version before update on checklist_templates
  for each row execute function platform_touch_version();

create table checklist_template_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_templates (id) on delete cascade,
  position integer not null check (position between 1 and 30),
  title text not null check (char_length(title) between 1 and 100),
  kind text not null default 'parents' check (kind in ('parents', 'organisers', 'teachers')),
  unique (template_id, position) deferrable initially deferred
);

create table checklist_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_templates (id) on delete cascade,
  section_id uuid not null references checklist_template_sections (id) on delete cascade,
  position integer not null check (position between 1 and 300),
  title text not null check (char_length(title) between 1 and 200),
  place text check (place is null or char_length(place) <= 200),
  props text check (props is null or char_length(props) <= 300),
  priority integer check (priority is null or priority between 1 and 3),
  materials text check (materials is null or char_length(materials) <= 300),
  tip text check (tip is null or char_length(tip) <= 1000),
  summer_only boolean not null default false,
  helpers_needed integer not null default 1 check (helpers_needed between 1 and 20),
  time_matters boolean not null default false,
  unique (section_id, position) deferrable initially deferred
);
create index checklist_template_tasks_template on checklist_template_tasks (template_id);

create table event_checklists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid not null unique references events (id) on delete cascade,
  copied_from_template_id uuid,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger event_checklists_touch_version before update on event_checklists
  for each row execute function platform_touch_version();

create table event_checklist_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  checklist_id uuid not null references event_checklists (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  position integer not null check (position between 1 and 30),
  title text not null check (char_length(title) between 1 and 100),
  kind text not null default 'parents' check (kind in ('parents', 'organisers', 'teachers')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, position) deferrable initially deferred
);
create index event_checklist_sections_checklist on event_checklist_sections (checklist_id, position);
create trigger event_checklist_sections_touch_version before update on event_checklist_sections
  for each row execute function platform_touch_version();

create table event_checklist_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid not null references events (id) on delete cascade,
  section_id uuid not null references event_checklist_sections (id) on delete cascade,
  position integer not null check (position between 1 and 300),
  title text not null check (char_length(title) between 1 and 200),
  place text check (place is null or char_length(place) <= 200),
  props text check (props is null or char_length(props) <= 300),
  priority integer check (priority is null or priority between 1 and 3),
  materials text check (materials is null or char_length(materials) <= 300),
  tip text check (tip is null or char_length(tip) <= 1000),
  deadline date,
  summer_only boolean not null default false,
  helpers_needed integer not null default 1 check (helpers_needed between 1 and 20),
  time_matters boolean not null default false,
  source_ref text check (source_ref is null or char_length(source_ref) between 1 and 100),
  done_at timestamptz,
  done_by_parent_id uuid,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, position) deferrable initially deferred,
  check (done_by_parent_id is null or done_at is not null)
);
create unique index event_checklist_tasks_source on event_checklist_tasks (event_id, source_ref)
  where source_ref is not null;
create index event_checklist_tasks_event on event_checklist_tasks (event_id, section_id, position);
create trigger event_checklist_tasks_touch_version before update on event_checklist_tasks
  for each row execute function platform_touch_version();

create table checklist_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid not null references events (id) on delete cascade,
  task_id uuid not null references event_checklist_tasks (id) on delete cascade,
  parent_id uuid,
  family_id uuid,
  typed_name text check (typed_name is null or char_length(typed_name) between 1 and 200),
  note text check (note is null or char_length(note) <= 500),
  chosen_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((parent_id is null) = (family_id is null)),
  check (not (parent_id is not null and typed_name is not null))
);
create unique index checklist_claims_parent on checklist_claims (task_id, parent_id) where parent_id is not null;
create index checklist_claims_task on checklist_claims (task_id, created_at, id);
create index checklist_claims_parent_lookup on checklist_claims (parent_id) where parent_id is not null;
create index checklist_claims_family_lookup on checklist_claims (family_id) where family_id is not null;
create index checklist_claims_event on checklist_claims (event_id);
create trigger checklist_claims_touch_version before update on checklist_claims
  for each row execute function platform_touch_version();

alter table checklist_templates enable row level security;
alter table checklist_template_sections enable row level security;
alter table checklist_template_tasks enable row level security;
alter table event_checklists enable row level security;
alter table event_checklist_sections enable row level security;
alter table event_checklist_tasks enable row level security;
alter table checklist_claims enable row level security;
revoke all on checklist_templates, checklist_template_sections, checklist_template_tasks, event_checklists,
  event_checklist_sections, event_checklist_tasks, checklist_claims from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 2. The audit action list gains the five actions of BR170.3; every earlier action stays valid (NFR4).
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
  'checklist.done_undone', 'checklist.removal_applied'
));

-- ---------------------------------------------------------------------------------------------------
-- 3. The two notice kinds (target type event, U10's facts function; C8). The two daily checks are registered in
--    section 15, after their functions exist. Nothing in U5 is edited for them.
-- ---------------------------------------------------------------------------------------------------
insert into notice_kinds (kind, target_type, title_prefix, label, added_by) values
  ('event_lead_time', 'event', 'Közeleg:', 'Közelgő esemény', 'u11-checklists'),
  ('checklist_unclaimed', 'event', 'Gazdátlan feladatok:', 'Gazdátlan feladatok', 'u11-checklists');

-- ---------------------------------------------------------------------------------------------------
-- 4. Helpers. Internal.
-- ---------------------------------------------------------------------------------------------------

-- Whether the caller may manage a template of this owner (BR160.1): a super admin any, a coordinator their own group's.
create or replace function checklist_template_can_manage(p_org uuid, p_group uuid) returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce(case when p_group is null then has_super_scope(p_org) else can_manage_group(p_group) end, false)
$$;

-- The organising team of an event for the caller (BR100.1, BR106.1): a manager, or a parent marked as organiser.
create or replace function checklist_in_team(p_event events, p_parent uuid) returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce(has_core_scope(p_event.organization_id, p_event.group_id), false)
      or (p_parent is not null and p_parent = any (event_organisers(p_event.id)))
$$;

-- A text field of a payload: absent or empty gives null; longer than the limit is refused on the field.
create or replace function checklist_text(p_value jsonb, p_field text, p_max integer, p_required boolean default false)
returns text
language plpgsql stable set search_path from current
as $$
declare v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    v_text := null;
  elsif jsonb_typeof(p_value) <> 'string' then
    perform platform_field_invalid(p_field);
  else
    v_text := nullif(btrim(p_value #>> '{}'), '');
  end if;
  if v_text is null then
    if p_required then
      perform platform_field_invalid(p_field);
    end if;
    return null;
  end if;
  if char_length(v_text) > p_max then
    perform platform_field_invalid(p_field);
  end if;
  return v_text;
end $$;

-- An integer field of a payload within bounds; absent or null gives the default (which may be null).
create or replace function checklist_int(p_value jsonb, p_field text, p_min integer, p_max integer, p_default integer)
returns integer
language plpgsql stable set search_path from current
as $$
declare v_int integer;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' or p_value = '""'::jsonb then
    return p_default;
  end if;
  v_int := platform_try_integer(p_value #>> '{}');
  if v_int is null or v_int not between p_min and p_max then
    perform platform_field_invalid(p_field);
  end if;
  return v_int;
end $$;

-- A boolean field of a payload; absent or null gives the default.
create or replace function checklist_bool(p_value jsonb, p_field text, p_default boolean) returns boolean
language plpgsql stable set search_path from current
as $$
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return p_default;
  end if;
  if jsonb_typeof(p_value) <> 'boolean' then
    perform platform_field_invalid(p_field);
  end if;
  return (p_value #>> '{}')::boolean;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 5. template_save (W1; BR160.2, BR160.3). The editor sends the whole template: name, description, lead days, and the
--    sections with their tasks in order. A group coordinator may save only their own group's templates; a super admin
--    any. The saved sections and tasks replace the old ones in one transaction. A removed template may be edited.
--      p_template: {id?, expected_version?, working_group_id?, name, description?, default_lead_days?,
--                   sections: [{title, kind?, tasks: [{title, place?, props?, priority?, materials?, tip?,
--                                                      summer_only?, helpers_needed?, time_matters?}]}]}
-- ---------------------------------------------------------------------------------------------------
create or replace function template_save(p_idempotency_key text, p_template jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.template_save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_creating boolean;
  v_id uuid;
  v_template checklist_templates%rowtype;
  v_group uuid;
  v_name text;
  v_description text;
  v_lead integer;
  v_section jsonb;
  v_task jsonb;
  v_section_no integer := 0;
  v_task_no integer;
  v_task_total integer := 0;
  v_section_id uuid;
  v_kind text;
  v_teachers boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(coalesce(p_template::text, ''), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_template is null or jsonb_typeof(p_template) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    v_creating := p_template->'id' is null or jsonb_typeof(p_template->'id') = 'null';
    if v_creating then
      if nullif(p_template->>'working_group_id', '') is not null then
        v_group := platform_try_uuid(p_template->>'working_group_id');
        if v_group is null then
          perform platform_field_invalid('working_group_id');
        end if;
        if not exists (select 1 from groups g where g.id = v_group and g.organization_id = v_org) then
          perform platform_deny_unless_super(v_org);
          perform platform_field_invalid('working_group_id', 'not_found');
        end if;
      end if;
      if not checklist_template_can_manage(v_org, v_group) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
    else
      v_id := platform_try_uuid(p_template->>'id');
      if v_id is null then
        perform platform_field_invalid('id');
      end if;
      select * into v_template from checklist_templates t where t.id = v_id and t.organization_id = v_org for update;
      if not found then
        perform platform_deny_unless_super(v_org);
        perform platform_field_invalid('id', 'not_found');
      end if;
      if not checklist_template_can_manage(v_org, v_template.working_group_id) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
      v_group := v_template.working_group_id;
      if p_template ? 'working_group_id'
         and nullif(p_template->>'working_group_id', '') is distinct from v_group::text then
        perform platform_field_invalid('working_group_id', 'locked');
      end if;
      if platform_try_integer(p_template->>'expected_version') is null then
        perform platform_field_invalid('expected_version');
      end if;
      if platform_try_integer(p_template->>'expected_version') <> v_template.version then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
    end if;

    v_name := checklist_text(p_template->'name', 'name', 200, true);
    v_description := checklist_text(p_template->'description', 'description', 1000);
    v_lead := checklist_int(p_template->'default_lead_days', 'default_lead_days', 1, 60, null);
    if p_template->'sections' is null or jsonb_typeof(p_template->'sections') <> 'array' then
      perform platform_field_invalid('sections');
    end if;
    if jsonb_array_length(p_template->'sections') > 30 then
      perform platform_field_invalid('sections', 'too_many_sections');
    end if;
    -- Every section and task is checked before anything is written.
    for v_section in select value from jsonb_array_elements(p_template->'sections') loop
      if jsonb_typeof(v_section) <> 'object' then
        perform platform_field_invalid('sections');
      end if;
      perform checklist_text(v_section->'title', 'section_title', 100, true);
      if coalesce(v_section->>'kind', 'parents') not in ('parents', 'organisers', 'teachers') then
        perform platform_field_invalid('section_kind');
      end if;
      if v_section->'tasks' is null or jsonb_typeof(v_section->'tasks') <> 'array' then
        perform platform_field_invalid('tasks');
      end if;
      v_task_total := v_task_total + jsonb_array_length(v_section->'tasks');
      if v_task_total > 300 then
        perform platform_field_invalid('tasks', 'too_many_tasks');
      end if;
      for v_task in select value from jsonb_array_elements(v_section->'tasks') loop
        if jsonb_typeof(v_task) <> 'object' then
          perform platform_field_invalid('tasks');
        end if;
        perform checklist_text(v_task->'title', 'title', 200, true);
        perform checklist_text(v_task->'place', 'place', 200);
        perform checklist_text(v_task->'props', 'props', 300);
        perform checklist_text(v_task->'materials', 'materials', 300);
        perform checklist_text(v_task->'tip', 'tip', 1000);
        perform checklist_int(v_task->'priority', 'priority', 1, 3, null);
        perform checklist_int(v_task->'helpers_needed', 'helpers_needed', 1, 20, 1);
        perform checklist_bool(v_task->'summer_only', 'summer_only', false);
        perform checklist_bool(v_task->'time_matters', 'time_matters', false);
      end loop;
    end loop;

    if exists (select 1 from checklist_templates t
                where t.organization_id = v_org and t.working_group_id is not distinct from v_group
                  and lower(t.name) = lower(v_name) and t.id is distinct from v_id) then
      perform platform_field_invalid('name', 'name_taken');
    end if;

    if v_creating then
      insert into checklist_templates (organization_id, working_group_id, name, description, default_lead_days)
      values (v_org, v_group, v_name, v_description, v_lead)
      returning id into v_id;
    else
      perform 1 from checklist_template_sections s where s.template_id = v_id order by s.id for update;
      perform 1 from checklist_template_tasks t where t.template_id = v_id order by t.id for update;
      update checklist_templates set name = v_name, description = v_description, default_lead_days = v_lead
       where id = v_id;
      delete from checklist_template_tasks where template_id = v_id;
      delete from checklist_template_sections where template_id = v_id;
    end if;

    for v_section in select value from jsonb_array_elements(p_template->'sections') loop
      v_section_no := v_section_no + 1;
      v_kind := coalesce(v_section->>'kind', 'parents');
      v_teachers := v_kind = 'teachers';
      insert into checklist_template_sections (template_id, position, title, kind)
      values (v_id, v_section_no, checklist_text(v_section->'title', 'section_title', 100, true), v_kind)
      returning id into v_section_id;
      v_task_no := 0;
      for v_task in select value from jsonb_array_elements(v_section->'tasks') loop
        v_task_no := v_task_no + 1;
        insert into checklist_template_tasks (template_id, section_id, position, title, place, props, priority,
                                              materials, tip, summer_only, helpers_needed, time_matters)
        values (v_id, v_section_id, v_task_no,
                checklist_text(v_task->'title', 'title', 200, true),
                checklist_text(v_task->'place', 'place', 200),
                checklist_text(v_task->'props', 'props', 300),
                checklist_int(v_task->'priority', 'priority', 1, 3, null),
                checklist_text(v_task->'materials', 'materials', 300),
                checklist_text(v_task->'tip', 'tip', 1000),
                checklist_bool(v_task->'summer_only', 'summer_only', false),
                case when v_teachers then 1 else checklist_int(v_task->'helpers_needed', 'helpers_needed', 1, 20, 1) end,
                case when v_teachers then false else checklist_bool(v_task->'time_matters', 'time_matters', false) end);
      end loop;
    end loop;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null)
      || jsonb_build_object('version', (select t.version from checklist_templates t where t.id = v_id));
  exception
    when sqlstate 'U3R00' then
      get stacked diagnostics v_detail = pg_exception_detail;
      return v_detail::jsonb;
    when unique_violation then
      -- Two saves of the same name at once: the second is told the name is taken.
      return platform_result('validation', null, 'field_invalid')
        || jsonb_build_object('field', 'name', 'reason', 'name_taken');
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 6. template_set_removed (W2; BR161.1). Hides or restores a template. Nothing is deleted and no event changes.
-- ---------------------------------------------------------------------------------------------------
create or replace function template_set_removed(
  p_idempotency_key text, p_template_id uuid, p_removed boolean, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.template_set_removed';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_template checklist_templates%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_template_id::text, coalesce(p_removed::text, ''), p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_template_id is null or p_removed is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_template from checklist_templates t
     where t.id = p_template_id and t.organization_id = v_org for update;
    if not found then
      perform platform_deny_unless_super(v_org);
      perform platform_field_invalid('template_id', 'not_found');
    end if;
    if not checklist_template_can_manage(v_org, v_template.working_group_id) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_template.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_template.is_removed is distinct from p_removed then
      update checklist_templates
         set is_removed = p_removed, removed_at = case when p_removed then now() end
       where id = p_template_id;
      perform platform_audit_write(
        case when p_removed then 'checklist.template_removed' else 'checklist.template_restored' end,
        'checklist_template', p_template_id, v_org, v_template.working_group_id, 'success', null);
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_template_id);
    return platform_result('success', p_template_id, null)
      || jsonb_build_object('version', (select t.version from checklist_templates t where t.id = p_template_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 7. Template reads (W3; BR160.1, BR161.2). A caller who manages nothing gets the denied refusal, never an empty list.
-- ---------------------------------------------------------------------------------------------------
create or replace function template_get(p_template_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_template checklist_templates%rowtype;
  v_sections jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  select * into v_template from checklist_templates t where t.id = p_template_id and t.organization_id = v_org;
  if not found or not checklist_template_can_manage(v_org, v_template.working_group_id) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'position', s.position, 'title', s.title, 'kind', s.kind,
           'tasks', coalesce((select jsonb_agg(jsonb_build_object(
                      'id', t.id, 'position', t.position, 'title', t.title, 'place', t.place, 'props', t.props,
                      'priority', t.priority, 'materials', t.materials, 'tip', t.tip, 'summer_only', t.summer_only,
                      'helpers_needed', t.helpers_needed, 'time_matters', t.time_matters) order by t.position)
                      from checklist_template_tasks t where t.section_id = s.id), '[]'::jsonb))
         order by s.position), '[]'::jsonb)
    into v_sections
    from checklist_template_sections s where s.template_id = v_template.id;
  return platform_result('success', v_template.id, null) || jsonb_build_object(
    'item', jsonb_build_object(
      'id', v_template.id, 'working_group_id', v_template.working_group_id,
      'working_group_name', (select g.name from groups g where g.id = v_template.working_group_id),
      'name', v_template.name, 'description', v_template.description,
      'default_lead_days', v_template.default_lead_days, 'is_removed', v_template.is_removed,
      'version', v_template.version, 'sections', v_sections));
end $$;

create or replace function template_list_admin() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_super boolean;
  v_groups uuid[];
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  v_super := coalesce(has_super_scope(v_org), false);
  v_groups := coalesce(coordination_reach_groups(), '{}'::uuid[]);
  if not v_super and cardinality(v_groups) = 0 then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'name', t.name, 'working_group_id', t.working_group_id, 'group_name', g.name,
           'task_count', (select count(*) from checklist_template_tasks k where k.template_id = t.id),
           'status', case when t.is_removed then 'removed' else 'active' end, 'version', t.version)
         order by t.is_removed, g.name nulls first, lower(t.name), t.id), '[]'::jsonb)
    into v_items
    from checklist_templates t left join groups g on g.id = t.working_group_id
   where t.organization_id = v_org and (v_super or t.working_group_id = any (v_groups));
  return platform_result('success', null, null) || jsonb_build_object(
    'items', v_items,
    'caller', jsonb_build_object('can_manage_community', v_super, 'managed_group_ids', to_jsonb(v_groups)));
end $$;

-- Contract C14: one working group's templates for the group's page (BR161.2).
create or replace function template_list(p_group_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_group_id is null or not can_manage_group(p_group_id) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'title', t.name, 'status', case when t.is_removed then 'removed' else 'active' end)
         order by t.is_removed, lower(t.name), t.id), '[]'::jsonb)
    into v_items
    from checklist_templates t where t.organization_id = v_org and t.working_group_id = p_group_id;
  return platform_result('success', p_group_id, null) || jsonb_build_object('items', v_items);
end $$;

-- The active templates the caller may start an event from (BR161.2, BR163.2): a super admin any, a coordinator the
-- community templates and their own groups' templates.
create or replace function template_options(p_group_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_super boolean;
  v_groups uuid[];
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  v_super := coalesce(has_super_scope(v_org), false);
  v_groups := coalesce(coordination_reach_groups(), '{}'::uuid[]);
  if not v_super and cardinality(v_groups) = 0 then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_group_id is not null and not can_manage_group(p_group_id) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'name', t.name, 'default_lead_days', t.default_lead_days,
           'working_group_id', t.working_group_id,
           'has_summer_tasks', exists (select 1 from checklist_template_tasks k
                                        where k.template_id = t.id and k.summer_only))
         order by t.working_group_id is not null, lower(t.name), t.id), '[]'::jsonb)
    into v_items
    from checklist_templates t
   where t.organization_id = v_org and not t.is_removed
     and (v_super or t.working_group_id is null or t.working_group_id = any (v_groups))
     and (p_group_id is null or t.working_group_id is null or t.working_group_id = p_group_id);
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 8. The starting templates (BR162.1, AC12.3.3). An internal install function, granted to the service role only, so a
--    hosted database gets the same templates as the local one; the content is not test data. It holds no person's name
--    or contact detail. A template whose name the community already has is skipped, so running it twice adds nothing.
--    Returns the number of templates it added.
-- ---------------------------------------------------------------------------------------------------
create or replace function checklist_starting_templates_install(p_organization_id uuid) returns integer
language plpgsql security definer set search_path from current
as $$
declare
  v_data constant jsonb := $json$[
 {
  "name": "Nagytakarítás",
  "description": "Figyelem! Az ecetes bútorlemosó vagy a viasz után a rongyot, ami felhasználásra került, nem szabad azonnal a kukába dobni. Mindkét termék öngyulladásra hajlamos, ezért a rongyot előbb ki kell teregetni, hogy megszáradjon, és úgy lehet csak kidobni. Vászon függönyök mosása 60 fokon mehet.",
  "default_lead_days": 14,
  "sections": [
   {
    "title": "Padlásfeljáró",
    "kind": "parents",
    "tasks": [
     {
      "time_matters": true,
      "title": "Szelektív hulladék elvitele"
     },
     {
      "time_matters": true,
      "title": "Asztal letakarítása, rendbe tétele"
     },
     {
      "time_matters": true,
      "title": "Felsöprés"
     },
     {
      "time_matters": true,
      "title": "Ablak tisztítása"
     },
     {
      "time_matters": true,
      "title": "Víztároló rész rendbe tétele"
     }
    ]
   },
   {
    "title": "Előtér",
    "kind": "parents",
    "tasks": [
     {
      "time_matters": true,
      "title": "Pókhálótlanítás és általános portörlés"
     },
     {
      "time_matters": true,
      "title": "Ajtó/ablakok lemosása"
     },
     {
      "time_matters": true,
      "title": "Ablakon lévő függöny vasalása"
     },
     {
      "time_matters": true,
      "title": "Ablakkeret belső részének áttörlése ecetes lemosóval"
     },
     {
      "time_matters": true,
      "title": "Ajtón/ablakokon lévő függöny kimosása/vasalása"
     },
     {
      "time_matters": true,
      "title": "Cipősszekrény letisztítása (vizes és száraz és ecetes lemosó)"
     },
     {
      "time_matters": true,
      "title": "Pad letisztítása (ecetes lemosóval)"
     },
     {
      "time_matters": true,
      "title": "Kapcsolók portalanítása"
     },
     {
      "time_matters": true,
      "title": "Padló tisztítása"
     },
     {
      "time_matters": true,
      "title": "Fuga körömkefével történő átsikálása"
     }
    ]
   },
   {
    "title": "Öltöző",
    "kind": "parents",
    "tasks": [
     {
      "time_matters": true,
      "title": "Pókhálótlanítás és általános portörlés"
     },
     {
      "time_matters": true,
      "title": "Öltöző ablak lemosása"
     },
     {
      "time_matters": true,
      "title": "Ablakkeret belső részének áttörlése ecetes lemosóval"
     },
     {
      "time_matters": true,
      "title": "Ruhás polcok tisztítása (ecetes lemosóval)"
     },
     {
      "time_matters": true,
      "title": "Padok letisztítása (ecetes lemosóval)"
     },
     {
      "time_matters": true,
      "title": "Kapcsolók portalanítása"
     },
     {
      "time_matters": true,
      "title": "Padló tisztítása"
     }
    ]
   },
   {
    "title": "Mesélős",
    "kind": "parents",
    "tasks": [
     {
      "time_matters": true,
      "title": "Pókhálótlanítás és általános portörlés"
     },
     {
      "time_matters": true,
      "title": "Ablakok lemosása"
     },
     {
      "time_matters": true,
      "title": "Függöny kimosása"
     },
     {
      "time_matters": true,
      "title": "Függöny vasalása"
     },
     {
      "time_matters": true,
      "title": "Ablakkeret belső részének áttörlése ecetes lemosóval"
     },
     {
      "time_matters": true,
      "title": "Bútorok letisztítása (ecetes lemosóval) - asztal, székek"
     },
     {
      "time_matters": true,
      "title": "Kisszekrény letisztítása"
     },
     {
      "time_matters": true,
      "title": "Kapcsolók portalanítása"
     },
     {
      "time_matters": true,
      "title": "Padló tisztítása"
     },
     {
      "time_matters": true,
      "title": "Nagyszőnyeg tisztítása",
      "summer_only": true,
      "tip": "Csak a nyári nagytakarításkor van szőnyegtisztítás. Korábban szőnyegtisztító cég tisztította a nagy szőnyeget, házhoz jön; a maradó családoknak érdemes újratárgyalni."
     }
    ]
   },
   {
    "title": "Fényes",
    "kind": "parents",
    "tasks": [
     {
      "time_matters": true,
      "title": "Pókhálótlanítás és általános portörlés"
     },
     {
      "time_matters": true,
      "title": "Ablakok lemosása"
     },
     {
      "time_matters": true,
      "title": "Függöny kimosása"
     },
     {
      "time_matters": true,
      "title": "Függöny vasalása"
     },
     {
      "time_matters": true,
      "title": "Ablakkeret belső részének áttörlése ecetes lemosóval"
     },
     {
      "time_matters": true,
      "title": "Játéktartók letisztítása (ecetes lemosóval) - 2 db"
     },
     {
      "time_matters": true,
      "title": "Kisszekrény letisztítása"
     },
     {
      "time_matters": true,
      "title": "Bútorok letisztítása (ecetes lemosóval) - asztal, székek"
     },
     {
      "time_matters": true,
      "title": "Játékok letisztítása (ecetes lemosóval)"
     },
     {
      "time_matters": true,
      "title": "Kapcsolók portalanítása"
     },
     {
      "time_matters": true,
      "title": "Padló tisztítása"
     },
     {
      "time_matters": true,
      "title": "Nagyszőnyeg tisztítása",
      "summer_only": true,
      "tip": "Sokféle anyagból összeállított rongyszőnyegről van szó, és az egyes anyagfajták máshogy nyúlnak meg, ha vizesek! Ha család vállalja a tisztítást, erre figyeljen. Csak a nyári nagytakarításkor van szőnyegtisztítás."
     }
    ]
   },
   {
    "title": "Konyha-étkező, nagy játszós terület",
    "kind": "parents",
    "tasks": [
     {
      "time_matters": true,
      "title": "Konyhabútor letisztítása/tetejének portalanítása"
     },
     {
      "time_matters": true,
      "title": "Konyhaszekrény + hűtőgép külső-belső tisztítás és rendezés"
     },
     {
      "time_matters": true,
      "title": "Pókhálótlanítás és általános portörlés"
     },
     {
      "time_matters": true,
      "title": "Lámpabúrák portalanítása"
     },
     {
      "time_matters": true,
      "title": "Játéktartó letisztítása (ecetes lemosóval) - 1 db"
     },
     {
      "time_matters": true,
      "title": "Játékok között lévő anyagok kimosása, vasalása",
      "tip": "Az étkezős részen lévő polcos kisbútoron vannak ezek az anyagok; haza szoktuk vinni és kimossuk. Ezt mindegyik nagytakarításnál meg kell csinálni."
     },
     {
      "time_matters": true,
      "title": "Bútorok letisztítása (ecetes lemosóval) - asztal, székek (a lábakról az összeállt port leszedni)"
     },
     {
      "time_matters": true,
      "title": "Kiskonyha letisztítása (ecetes lemosóval)"
     },
     {
      "time_matters": true,
      "title": "Baldachin mosása"
     },
     {
      "time_matters": true,
      "title": "Baldachin vasalása",
      "tip": "Érdemes nedvesen bevinni az oviba, ott vasalni és egyből feltenni. Figyelem: a nagy létra legtetejére állva lehet feltenni, egyedül senki ne tegye ezt, mindig legyen ott valaki még!"
     },
     {
      "time_matters": true,
      "title": "Kandalló külső portalanítása"
     },
     {
      "time_matters": true,
      "title": "Szőnyegtárolóban lévő szőnyegek/báránybőrök portalanítása"
     },
     {
      "time_matters": true,
      "title": "Rongyszőnyegek kimosása",
      "summer_only": true,
      "tip": "Érdemes külön követni, hogy melyik család hány darab szőnyeget vitt haza kimosni: ezt írd a jelentkezés megjegyzésébe."
     },
     {
      "time_matters": true,
      "title": "Kapcsolók portalanítása"
     },
     {
      "time_matters": true,
      "title": "Padló tisztítása"
     },
     {
      "time_matters": true,
      "title": "Fuga körömkefével történő átsikálása"
     }
    ]
   },
   {
    "title": "Mosdók",
    "kind": "parents",
    "tasks": [
     {
      "time_matters": true,
      "title": "Pókhálótlanítás és általános portörlés"
     },
     {
      "time_matters": true,
      "title": "Csempe letisztítása"
     },
     {
      "time_matters": true,
      "title": "Kézmosók letisztítása"
     },
     {
      "time_matters": true,
      "title": "WC-k kitisztítása"
     },
     {
      "time_matters": true,
      "title": "Kapcsolók portalanítása"
     },
     {
      "time_matters": true,
      "title": "Padló tisztítása"
     },
     {
      "time_matters": true,
      "title": "Fuga körömkefével történő átsikálása"
     }
    ]
   },
   {
    "title": "Óvónői",
    "kind": "parents",
    "tasks": [
     {
      "time_matters": true,
      "title": "Pókhálótlanítás és általános portörlés"
     },
     {
      "time_matters": true,
      "title": "Ablak lemosása"
     },
     {
      "time_matters": true,
      "title": "Függöny kimosása"
     },
     {
      "time_matters": true,
      "title": "Függöny vasalása"
     },
     {
      "time_matters": true,
      "title": "Ablakkeret belső részének áttörlése ecetes lemosóval"
     },
     {
      "time_matters": true,
      "title": "Kapcsolók portalanítása"
     },
     {
      "time_matters": true,
      "title": "Padló tisztítása"
     },
     {
      "time_matters": true,
      "title": "Bútorok tisztítása"
     }
    ]
   },
   {
    "title": "Alvós",
    "kind": "parents",
    "tasks": [
     {
      "time_matters": true,
      "title": "Pókhálótlanítás és általános portörlés",
      "tip": "A téli és a nyári ünnep miatt minden bútor és berendezés az alvósba kerül behordásra: aki az alvós takarítását vállalja, annak kell onnan kipakolni. Erre érdemes mindenkit figyelmeztetni, aki érintett lehet a saját területén."
     },
     {
      "time_matters": true,
      "title": "Lámpabúrák portalanítása"
     },
     {
      "time_matters": true,
      "title": "Galéria takarítása"
     },
     {
      "time_matters": true,
      "title": "Ablak és ajtó lemosása"
     },
     {
      "time_matters": true,
      "title": "Függöny kimosása"
     },
     {
      "time_matters": true,
      "title": "Függöny vasalása"
     },
     {
      "time_matters": true,
      "title": "Ablakkeret belső részének áttörlése ecetes lemosóval"
     },
     {
      "time_matters": true,
      "title": "Kapcsolók portalanítása"
     },
     {
      "time_matters": true,
      "title": "Padló tisztítása"
     },
     {
      "time_matters": true,
      "title": "Gyapjú szőnyeg tisztítása",
      "summer_only": true,
      "tip": "A gyapjúszőnyegek és a báránybőrök más kezelést igényelnek, mint egy sima szőnyeg: kádban lanolinnal áztatva, lábbal jól áttaposva, majd újabb áztató kör után meleg, napos időben szárítva tisztíthatók."
     }
    ]
   },
   {
    "title": "Szervezők feladatai",
    "kind": "organisers",
    "tasks": [
     {
      "title": "Takarítás előtt legalább két héttel megírni a szülőknek az értesítő e-mailt, hogy legyen idejük beírni magukat"
     },
     {
      "title": "A nagytakarítós lista üressé tétele, esetleges szükséges megjegyzések felvitele"
     },
     {
      "title": "Jelentkezési határidő megadása az e-mailben, és figyelni, hogy feltöltésre került-e minden rész"
     },
     {
      "title": "Szükség esetén újra írni a szülőknek, ha nincs beírva elég jelentkező"
     },
     {
      "title": "Téli nagytakarítás előtt a spirál összeszedése"
     },
     {
      "title": "Nyáron az új szülőkkel bemenni takarítani",
      "summer_only": true
     },
     {
      "title": "A takarítás utolsó napjának mindig a szombat megadása",
      "tip": "Két oka van: vasárnap várhatóan az óvónők is be szeretnének menni felkészülni a következő ovis napra, és ha a szervező nem tud szombaton záró kört menni, akkor neki megmarad a vasárnap."
     },
     {
      "title": "Záró kör: ha mindenki KÉSZ-nek jelölte a feladatát, bemenni és átnézni az óvodát",
      "tip": "Szükség esetén a szervező megcsinálja, ami elmaradt, vagy bevonja az érintett családot. Ezért érdemes már közben is ránézni a dolgokra."
     },
     {
      "title": "Záró kör 2: minden oda került-e vissza, ahova való"
     }
    ]
   }
  ]
 },
 {
  "name": "Hajó javítás",
  "description": "A fa játszókerti hajó javításának feladatai, fontossági sorrenddel és szükséges eszközökkel.",
  "sections": [
   {
    "title": "Csúszda esésbiztonság",
    "kind": "parents",
    "tasks": [
     {
      "title": "Esési területről (csúszda végétől 1,7 m sugarú kör) eltávolítani a fa keretet, oszlopot",
      "priority": 1,
      "materials": "csavarhúzó, ásó"
     },
     {
      "title": "Esési területről (csúszda végétől 1,7 m sugarú kör) levágni a belógó ágakat a fákról (megvárjuk, míg ledobja a virágait a császárfa) és kiszedni a mogyoróbokrot",
      "priority": 1,
      "materials": "ásó a garázsban"
     },
     {
      "title": "Kigazolni a csúszda környéki területet (beülőtől és csúszda végétől 1,5 m-es területen)",
      "materials": "kapa, gereblye"
     },
     {
      "title": "Esési területről kiásni a földet 30 cm mélyen és átvinni a szánkódombra, a homokot pedig szétszórni a hajó körül (csak ha már megvan a csere homok)",
      "materials": "ásó, lapát (több!), talicska (több!!) - garázsba berakva az ajtó mellé jobbra"
     },
     {
      "title": "Homokot hordani az esési területre 30 cm magasan, alá geotextíliát teríteni az egész területre",
      "materials": "geotextília, 3 köbméter homok, több lapát, több talicska"
     }
    ]
   },
   {
    "title": "Csúszda teteje (beülője)",
    "kind": "parents",
    "tasks": [
     {
      "title": "Biztonsági védőpalánk körbe és esésgátló korlát felrakása kép szerint",
      "priority": 1
     },
     {
      "title": "Fémsodronyok leszedése és elvágása, rögzítése a szélkeréknél",
      "priority": 1
     }
    ]
   },
   {
    "title": "Feljáró palánk",
    "kind": "parents",
    "tasks": [
     {
      "title": "40 fokos szögű palánk kialakítása felmászást segítő keresztlécekkel és mászókövekkel - ha nem megoldható sürgősen, akkor átmeneti leszerelése",
      "priority": 1,
      "materials": "faanyag, csavarok, mászókövek"
     }
    ]
   },
   {
    "title": "Belső létra",
    "kind": "parents",
    "tasks": [
     {
      "title": "Alsó létrafok levágása (min. 40 cm magasan kezdődjön a legalsó fok), lépcsők ritkítása, hogy a fokok között min. 24 cm legyen",
      "priority": 1,
      "materials": "fűrész"
     }
    ]
   },
   {
    "title": "Oldalkötézet",
    "kind": "parents",
    "tasks": [
     {
      "title": "Lelógó, rögzítetlen végű kötelek levágása",
      "priority": 1,
      "materials": "vágószerszám"
     },
     {
      "title": "Csak a fenti oldalkötél meghagyása - csak amikor már az új feljáró palánk elkészült",
      "priority": 2
     }
    ]
   },
   {
    "title": "Hajótest szerkezet",
    "kind": "parents",
    "tasks": [
     {
      "title": "Hiányzó oldaldeszkák és kiesett csavarok pótlása"
     },
     {
      "title": "Rések tömése, vagy azok megfelelő méretre tágítása, hogy az ujjak ne szoruljanak be (8-25 mm között nem megfelelő!), padozatnál pedig a 30 mm-nél nagyobb réseket kell javítani",
      "materials": "faanyag, csavarok"
     }
    ]
   }
  ]
 },
 {
  "name": "Szent Mihály",
  "sections": []
 },
 {
  "name": "Szent Márton",
  "sections": []
 },
 {
  "name": "Szent Miklós",
  "sections": [
   {
    "title": "Szülők",
    "kind": "parents",
    "tasks": [
     {
      "title": "Beszerzés: celofán zacskók (esetleg zsákocskák varrása), arany zsinór csomagoláshoz, egész dió, hámozott dió"
     },
     {
      "title": "Mézeskalács sütés"
     },
     {
      "title": "Csomagolás gyerekeknek és óvónőknek is: alma, mézeskalács celofán zacskóban, búza zsákocskában vagy celofánban, hámozott dió zsákocskában vagy celofánban"
     },
     {
      "title": "Aranydió festés"
     },
     {
      "title": "Miklós-zsákok előkészítése"
     }
    ]
   },
   {
    "title": "Óvónők",
    "kind": "teachers",
    "tasks": [
     {
      "title": "Létszám megadása"
     }
    ]
   }
  ]
 },
 {
  "name": "Spirál járás",
  "sections": [
   {
    "title": "Szülők",
    "kind": "parents",
    "tasks": [
     {
      "title": "Terem kiürítése péntek délután - szombat dél"
     },
     {
      "title": "Fenyőágak beszerzése"
     },
     {
      "title": "Fenyőágak összevágása (3 púposra rakott banános doboz), bekészítése a terembe"
     },
     {
      "title": "Ünnep után az ágakat felszedni, gyűjtőhelyre vinni"
     }
    ]
   },
   {
    "title": "Óvónők",
    "kind": "teachers",
    "tasks": [
     {
      "title": "A spirált és a fenyőkaput az óvónők készítik"
     },
     {
      "title": "Rózsa, liliom beszerzése"
     }
    ]
   }
  ]
 },
 {
  "name": "Húsvét",
  "sections": [
   {
    "title": "Szülők",
    "kind": "parents",
    "tasks": [
     {
      "title": "Virágföld beszerzése, esetleg ültető cserepek beszerzése"
     }
    ]
   }
  ]
 },
 {
  "name": "Pünkösd",
  "sections": []
 },
 {
  "name": "Gyermekek búcsúnapja",
  "sections": [
   {
    "title": "Szülők",
    "kind": "parents",
    "tasks": [
     {
      "title": "Szálas virág beszerzése"
     }
    ]
   },
   {
    "title": "Óvónők",
    "kind": "teachers",
    "tasks": [
     {
      "title": "Darabszám megadása"
     }
    ]
   }
  ]
 },
 {
  "name": "Búcsúzás/nyárünnep",
  "sections": [
   {
    "title": "Szülők",
    "kind": "parents",
    "tasks": [
     {
      "title": "Virágkapu készítése"
     },
     {
      "title": "Az ünnep megszervezése a korábbi tapasztalatok alapján"
     }
    ]
   }
  ]
 }
]$json$::jsonb;
  v_tpl jsonb;
  v_section jsonb;
  v_task jsonb;
  v_id uuid;
  v_section_id uuid;
  v_section_no integer;
  v_task_no integer;
  v_added integer := 0;
begin
  if p_organization_id is null or not exists (select 1 from organizations o where o.id = p_organization_id) then
    return 0;
  end if;
  for v_tpl in select value from jsonb_array_elements(v_data) loop
    if exists (select 1 from checklist_templates t
                where t.organization_id = p_organization_id and t.working_group_id is null
                  and lower(t.name) = lower(v_tpl->>'name')) then
      continue;
    end if;
    insert into checklist_templates (organization_id, working_group_id, name, description, default_lead_days)
    values (p_organization_id, null, v_tpl->>'name', v_tpl->>'description',
            nullif(v_tpl->>'default_lead_days', '')::integer)
    returning id into v_id;
    v_section_no := 0;
    for v_section in select value from jsonb_array_elements(v_tpl->'sections') loop
      v_section_no := v_section_no + 1;
      insert into checklist_template_sections (template_id, position, title, kind)
      values (v_id, v_section_no, v_section->>'title', v_section->>'kind')
      returning id into v_section_id;
      v_task_no := 0;
      for v_task in select value from jsonb_array_elements(v_section->'tasks') loop
        v_task_no := v_task_no + 1;
        insert into checklist_template_tasks (template_id, section_id, position, title, place, props, priority,
                                              materials, tip, summer_only, helpers_needed, time_matters)
        values (v_id, v_section_id, v_task_no, v_task->>'title', v_task->>'place', v_task->>'props',
                nullif(v_task->>'priority', '')::integer, v_task->>'materials', v_task->>'tip',
                coalesce((v_task->>'summer_only')::boolean, false), 1,
                coalesce((v_task->>'time_matters')::boolean, false));
      end loop;
    end loop;
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 9. Helpers for the event's checklist. Internal.
-- ---------------------------------------------------------------------------------------------------

-- Open means planned and not ended (BR101.1); every command that changes a checklist needs it.
create or replace function checklist_event_is_open(p_event events) returns boolean
language sql stable set search_path from current
as $$ select p_event.status = 'planned' and p_event.ends_at > now() $$;

-- The checklist head of an event, locked, with its version; version 0 and no row when there is none. Renumbers nothing.
create or replace function checklist_head_version(p_event_id uuid) returns integer
language sql stable security definer set search_path from current
as $$ select coalesce((select h.version from event_checklists h where h.event_id = p_event_id), 0) $$;

-- ---------------------------------------------------------------------------------------------------
-- 10. checklist_copy_template (W4; BR163.1, BR163.2, BR163.3). The event takes its own copy of an active template, with
--     every task unclaimed; summer-only tasks only in a summer event. The event is locked first; the template is read
--     without a lock. Allowed into an open event whose checklist has no section yet.
-- ---------------------------------------------------------------------------------------------------
create or replace function checklist_copy_template(p_idempotency_key text, p_event_id uuid, p_template_id uuid)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.copy_template';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event events%rowtype;
  v_template checklist_templates%rowtype;
  v_head event_checklists%rowtype;
  v_section record;
  v_section_id uuid;
  v_section_no integer := 0;
  v_task_no integer;
  v_has_tasks boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_event_id::text, p_template_id::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_event := event_lock_managed(p_event_id, v_org);
    select * into v_head from event_checklists h where h.event_id = p_event_id for update;
    if not checklist_event_is_open(v_event) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    if p_template_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_template from checklist_templates t where t.id = p_template_id and t.organization_id = v_org;
    if not found or v_template.is_removed
       or (v_template.working_group_id is not null and not can_manage_group(v_template.working_group_id)) then
      perform platform_abort('denied', 'TEMPLATE_UNAVAILABLE');
    end if;
    if exists (select 1 from event_checklist_sections s where s.event_id = p_event_id) then
      perform platform_abort('conflict', 'CHECKLIST_NOT_EMPTY');
    end if;
    if v_head.id is null then
      insert into event_checklists (organization_id, event_id, copied_from_template_id)
      values (v_org, p_event_id, p_template_id)
      returning * into v_head;
    else
      update event_checklists set copied_from_template_id = p_template_id where id = v_head.id;
    end if;
    for v_section in
      select s.id, s.title, s.kind from checklist_template_sections s where s.template_id = p_template_id order by s.position
    loop
      select exists (select 1 from checklist_template_tasks k
                      where k.section_id = v_section.id and (v_event.is_summer or not k.summer_only))
        into v_has_tasks;
      if not v_has_tasks then
        continue;
      end if;
      v_section_no := v_section_no + 1;
      insert into event_checklist_sections (organization_id, checklist_id, event_id, position, title, kind)
      values (v_org, v_head.id, p_event_id, v_section_no, v_section.title, v_section.kind)
      returning id into v_section_id;
      insert into event_checklist_tasks (organization_id, event_id, section_id, position, title, place, props,
                                         priority, materials, tip, summer_only, helpers_needed, time_matters)
      select v_org, p_event_id, v_section_id, (row_number() over (order by k.position))::integer, k.title, k.place,
             k.props, k.priority, k.materials, k.tip, k.summer_only, k.helpers_needed, k.time_matters
        from checklist_template_tasks k
       where k.section_id = v_section.id and (v_event.is_summer or not k.summer_only);
    end loop;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_event_id);
    return platform_result('success', p_event_id, null)
      || jsonb_build_object('version', checklist_head_version(p_event_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 11. The managers' edits of an event's own checklist (W5; BR164.1 to BR164.3). Sections and tasks are added, changed,
--     deleted and reordered while the event is open. Adding, deleting and moving send the checklist's own version
--     (0 when the event has none yet), which goes up; changing a section or a task sends its own version. A task with a
--     claim or a done mark cannot be deleted. No command here reads or changes the event's version.
-- ---------------------------------------------------------------------------------------------------
create or replace function checklist_section_save(
  p_idempotency_key text, p_event_id uuid, p_expected_checklist_version integer, p_section jsonb
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.section_save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event events%rowtype;
  v_head event_checklists%rowtype;
  v_section event_checklist_sections%rowtype;
  v_id uuid;
  v_title text;
  v_kind text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_event_id::text, coalesce(p_expected_checklist_version::text, ''), coalesce(p_section::text, '')),
    'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_event := event_lock_managed(p_event_id, v_org);
    select * into v_head from event_checklists h where h.event_id = p_event_id for update;
    if not checklist_event_is_open(v_event) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    if p_section is null or jsonb_typeof(p_section) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    v_title := checklist_text(p_section->'title', 'title', 100, true);
    v_kind := coalesce(p_section->>'kind', 'parents');
    if v_kind not in ('parents', 'organisers', 'teachers') then
      perform platform_field_invalid('kind');
    end if;
    if p_section->'id' is null or jsonb_typeof(p_section->'id') = 'null' then
      -- Adding sends the checklist's version.
      if p_expected_checklist_version is null then
        perform platform_field_invalid('expected_checklist_version');
      end if;
      if p_expected_checklist_version <> coalesce(v_head.version, 0) then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
      if (select count(*) from event_checklist_sections s where s.event_id = p_event_id) >= 30 then
        perform platform_field_invalid('sections', 'too_many_sections');
      end if;
      if v_head.id is null then
        insert into event_checklists (organization_id, event_id) values (v_org, p_event_id) returning * into v_head;
      else
        update event_checklists set updated_at = now() where id = v_head.id;
      end if;
      insert into event_checklist_sections (organization_id, checklist_id, event_id, position, title, kind)
      values (v_org, v_head.id, p_event_id,
              (select coalesce(max(s.position), 0) + 1 from event_checklist_sections s where s.event_id = p_event_id),
              v_title, v_kind)
      returning id into v_id;
    else
      v_id := platform_try_uuid(p_section->>'id');
      if v_id is null then
        perform platform_field_invalid('id');
      end if;
      select * into v_section from event_checklist_sections s where s.id = v_id and s.event_id = p_event_id for update;
      if not found then
        perform platform_field_invalid('id', 'not_found');
      end if;
      if platform_try_integer(p_section->>'expected_version') is null then
        perform platform_field_invalid('expected_version');
      end if;
      if platform_try_integer(p_section->>'expected_version') <> v_section.version then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
      if v_kind <> v_section.kind then
        perform 1 from event_checklist_tasks t where t.section_id = v_id order by t.id for update;
        if exists (select 1 from event_checklist_tasks t where t.section_id = v_id
                      and (t.done_at is not null or exists (select 1 from checklist_claims c where c.task_id = t.id))) then
          perform platform_abort('conflict', 'SECTION_HAS_CLAIMS');
        end if;
        -- A teachers' section holds one helper and no times (Q4).
        if v_kind = 'teachers' then
          update event_checklist_tasks set helpers_needed = 1, time_matters = false where section_id = v_id;
        end if;
      end if;
      update event_checklist_sections set title = v_title, kind = v_kind where id = v_id;
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object(
      'version', (select s.version from event_checklist_sections s where s.id = v_id),
      'checklist_version', checklist_head_version(p_event_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function checklist_section_remove(
  p_idempotency_key text, p_section_id uuid, p_expected_checklist_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.section_remove';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event_id uuid;
  v_event events%rowtype;
  v_head event_checklists%rowtype;
  v_section event_checklist_sections%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_section_id::text, coalesce(p_expected_checklist_version::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    select s.event_id into v_event_id from event_checklist_sections s
     where s.id = p_section_id and s.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    v_event := event_lock_managed(v_event_id, v_org);
    select * into v_head from event_checklists h where h.event_id = v_event_id for update;
    select * into v_section from event_checklist_sections s where s.id = p_section_id and s.event_id = v_event_id for update;
    if not found then
      perform platform_field_invalid('section_id', 'not_found');
    end if;
    if not checklist_event_is_open(v_event) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    if p_expected_checklist_version is null then
      perform platform_field_invalid('expected_checklist_version');
    end if;
    if p_expected_checklist_version <> v_head.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    perform 1 from event_checklist_tasks t where t.section_id = p_section_id order by t.id for update;
    perform 1 from checklist_claims c join event_checklist_tasks t on t.id = c.task_id
     where t.section_id = p_section_id order by c.id for update of c;
    if exists (select 1 from event_checklist_tasks t where t.section_id = p_section_id
                  and (t.done_at is not null or exists (select 1 from checklist_claims c where c.task_id = t.id))) then
      perform platform_abort('conflict', 'TASK_HAS_CLAIMS');
    end if;
    delete from event_checklist_sections where id = p_section_id;
    update event_checklist_sections set position = position - 1
     where event_id = v_event_id and position > v_section.position;
    update event_checklists set updated_at = now() where id = v_head.id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_section_id);
    return platform_result('success', p_section_id, null)
      || jsonb_build_object('checklist_version', checklist_head_version(v_event_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- A task of the checklist, added or changed. Adding sends the checklist's version; changing sends the task's version,
-- and moving it to another section of the same kind (while it has no claim or done mark) also sends the checklist's.
--   p_task: {id?, expected_version?, section_id, title, place?, props?, priority?, materials?, tip?, deadline?,
--            summer_only?, helpers_needed?, time_matters?}
create or replace function checklist_task_save(
  p_idempotency_key text, p_event_id uuid, p_expected_checklist_version integer, p_task jsonb
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.task_save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event events%rowtype;
  v_head event_checklists%rowtype;
  v_task event_checklist_tasks%rowtype;
  v_target event_checklist_sections%rowtype;
  v_source event_checklist_sections%rowtype;
  v_id uuid;
  v_section_id uuid;
  v_title text;
  v_place text;
  v_props text;
  v_materials text;
  v_tip text;
  v_priority integer;
  v_deadline date;
  v_summer boolean;
  v_helpers integer;
  v_time boolean;
  v_claims integer;
  v_creating boolean;
  v_moved boolean := false;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_event_id::text, coalesce(p_expected_checklist_version::text, ''), coalesce(p_task::text, '')),
    'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_event := event_lock_managed(p_event_id, v_org);
    select * into v_head from event_checklists h where h.event_id = p_event_id for update;
    if not checklist_event_is_open(v_event) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    if p_task is null or jsonb_typeof(p_task) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    v_creating := p_task->'id' is null or jsonb_typeof(p_task->'id') = 'null';
    v_section_id := platform_try_uuid(p_task->>'section_id');
    if v_creating and v_section_id is null then
      perform platform_field_invalid('section_id');
    end if;
    if not v_creating then
      v_id := platform_try_uuid(p_task->>'id');
      if v_id is null then
        perform platform_field_invalid('id');
      end if;
      select * into v_task from event_checklist_tasks t where t.id = v_id and t.event_id = p_event_id;
      if not found then
        perform platform_field_invalid('id', 'not_found');
      end if;
      v_section_id := coalesce(v_section_id, v_task.section_id);
    end if;
    -- Sections by ascending id (BR170.1): the target and, for a move, the source.
    perform 1 from event_checklist_sections s
     where s.event_id = p_event_id and s.id in (v_section_id, case when v_creating then v_section_id else v_task.section_id end)
     order by s.id for update;
    select * into v_target from event_checklist_sections s where s.id = v_section_id and s.event_id = p_event_id;
    if not found then
      perform platform_field_invalid('section_id', 'not_found');
    end if;
    if not v_creating then
      select * into v_task from event_checklist_tasks t where t.id = v_id and t.event_id = p_event_id for update;
      if not found then
        perform platform_field_invalid('id', 'not_found');
      end if;
      select * into v_source from event_checklist_sections s where s.id = v_task.section_id;
      v_moved := v_task.section_id <> v_section_id;
    end if;

    v_title := checklist_text(p_task->'title', 'title', 200, true);
    v_place := checklist_text(p_task->'place', 'place', 200);
    v_props := checklist_text(p_task->'props', 'props', 300);
    v_materials := checklist_text(p_task->'materials', 'materials', 300);
    v_tip := checklist_text(p_task->'tip', 'tip', 1000);
    v_priority := checklist_int(p_task->'priority', 'priority', 1, 3, null);
    v_summer := checklist_bool(p_task->'summer_only', 'summer_only', false);
    v_helpers := checklist_int(p_task->'helpers_needed', 'helpers_needed', 1, 20, 1);
    v_time := checklist_bool(p_task->'time_matters', 'time_matters', false);
    if nullif(p_task->>'deadline', '') is not null then
      v_deadline := case when p_task->>'deadline' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                         then platform_try_date(p_task->>'deadline') end;
      if v_deadline is null then
        perform platform_field_invalid('deadline');
      end if;
      if v_deadline > (v_event.ends_at at time zone 'Europe/Budapest')::date then
        perform platform_field_invalid('deadline', 'after_end');
      end if;
    end if;
    if v_target.kind = 'teachers' then
      v_helpers := 1;
      v_time := false;
    end if;

    if v_creating then
      if p_expected_checklist_version is null then
        perform platform_field_invalid('expected_checklist_version');
      end if;
      if p_expected_checklist_version <> coalesce(v_head.version, 0) then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
      if (select count(*) from event_checklist_tasks t where t.event_id = p_event_id) >= 300 then
        perform platform_field_invalid('tasks', 'too_many_tasks');
      end if;
      update event_checklists set updated_at = now() where id = v_head.id;
      insert into event_checklist_tasks (organization_id, event_id, section_id, position, title, place, props, priority,
                                         materials, tip, deadline, summer_only, helpers_needed, time_matters)
      values (v_org, p_event_id, v_section_id,
              (select coalesce(max(t.position), 0) + 1 from event_checklist_tasks t where t.section_id = v_section_id),
              v_title, v_place, v_props, v_priority, v_materials, v_tip, v_deadline, v_summer, v_helpers, v_time)
      returning id into v_id;
    else
      if platform_try_integer(p_task->>'expected_version') is null then
        perform platform_field_invalid('expected_version');
      end if;
      if platform_try_integer(p_task->>'expected_version') <> v_task.version then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
      select count(*) into v_claims from checklist_claims c where c.task_id = v_id;
      if v_moved then
        if p_expected_checklist_version is null then
          perform platform_field_invalid('expected_checklist_version');
        end if;
        if p_expected_checklist_version <> v_head.version then
          perform platform_abort('conflict', 'VERSION_CONFLICT');
        end if;
        if (v_claims > 0 or v_task.done_at is not null) and v_target.kind <> v_source.kind then
          perform platform_abort('conflict', 'SECTION_HAS_CLAIMS');
        end if;
      end if;
      if v_helpers < v_claims then
        perform platform_abort('validation', 'field_invalid',
          jsonb_build_object('field', 'helpers_needed', 'reason', 'below_claims', 'claims', v_claims));
      end if;
      if v_target.kind = 'teachers' and (v_claims > 0 or v_task.done_at is not null) then
        perform platform_abort('conflict', 'SECTION_HAS_CLAIMS');
      end if;
      if v_moved then
        update event_checklist_tasks set position = position - 1
         where section_id = v_task.section_id and position > v_task.position;
        update event_checklists set updated_at = now() where id = v_head.id;
      end if;
      update event_checklist_tasks
         set section_id = v_section_id,
             position = case when v_moved
                             then (select coalesce(max(t.position), 0) + 1 from event_checklist_tasks t
                                    where t.section_id = v_section_id)
                             else position end,
             title = v_title, place = v_place, props = v_props, priority = v_priority, materials = v_materials,
             tip = v_tip, deadline = v_deadline, summer_only = v_summer, helpers_needed = v_helpers,
             time_matters = v_time
       where id = v_id;
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object(
      'version', (select t.version from event_checklist_tasks t where t.id = v_id),
      'checklist_version', checklist_head_version(p_event_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function checklist_task_remove(
  p_idempotency_key text, p_task_id uuid, p_expected_checklist_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.task_remove';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event_id uuid;
  v_event events%rowtype;
  v_head event_checklists%rowtype;
  v_task event_checklist_tasks%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_task_id::text, coalesce(p_expected_checklist_version::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    select t.event_id into v_event_id from event_checklist_tasks t where t.id = p_task_id and t.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    v_event := event_lock_managed(v_event_id, v_org);
    select * into v_head from event_checklists h where h.event_id = v_event_id for update;
    select * into v_task from event_checklist_tasks t where t.id = p_task_id and t.event_id = v_event_id for update;
    if not found then
      perform platform_field_invalid('task_id', 'not_found');
    end if;
    if not checklist_event_is_open(v_event) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    if p_expected_checklist_version is null then
      perform platform_field_invalid('expected_checklist_version');
    end if;
    if p_expected_checklist_version <> v_head.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    perform 1 from checklist_claims c where c.task_id = p_task_id order by c.id for update;
    if v_task.done_at is not null or exists (select 1 from checklist_claims c where c.task_id = p_task_id) then
      perform platform_abort('conflict', 'TASK_HAS_CLAIMS');
    end if;
    delete from event_checklist_tasks where id = p_task_id;
    update event_checklist_tasks set position = position - 1
     where section_id = v_task.section_id and position > v_task.position;
    update event_checklists set updated_at = now() where id = v_head.id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_task_id);
    return platform_result('success', p_task_id, null)
      || jsonb_build_object('checklist_version', checklist_head_version(v_event_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- The full order: [{section_id, task_ids: [...]}] in the new order. The sections must be exactly the event's sections, and
-- each task list exactly that section's tasks; moving a task to another section is checklist_task_save.
create or replace function checklist_reorder(
  p_idempotency_key text, p_event_id uuid, p_expected_checklist_version integer, p_order jsonb
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.reorder';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event events%rowtype;
  v_head event_checklists%rowtype;
  v_item jsonb;
  v_section_ids uuid[] := '{}';
  v_task_ids uuid[];
  v_section_id uuid;
  v_one uuid;
  v_i integer := 0;
  v_j integer;
  v_known uuid[];
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_event_id::text, coalesce(p_expected_checklist_version::text, ''), coalesce(p_order::text, '')),
    'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_event := event_lock_managed(p_event_id, v_org);
    select * into v_head from event_checklists h where h.event_id = p_event_id for update;
    if not checklist_event_is_open(v_event) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    if p_expected_checklist_version is null then
      perform platform_field_invalid('expected_checklist_version');
    end if;
    if p_expected_checklist_version <> coalesce(v_head.version, 0) then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_head.id is null or p_order is null or jsonb_typeof(p_order) <> 'array' then
      perform platform_field_invalid('order');
    end if;
    perform 1 from event_checklist_sections s where s.event_id = p_event_id order by s.id for update;
    perform 1 from event_checklist_tasks t where t.event_id = p_event_id order by t.id for update;
    -- The sections listed are exactly the event's sections, each once.
    for v_item in select value from jsonb_array_elements(p_order) loop
      if jsonb_typeof(v_item) <> 'object' then
        perform platform_field_invalid('order');
      end if;
      v_section_id := platform_try_uuid(v_item->>'section_id');
      if v_section_id is null or v_section_id = any (v_section_ids) then
        perform platform_field_invalid('order');
      end if;
      v_section_ids := v_section_ids || v_section_id;
    end loop;
    select coalesce(array_agg(s.id order by s.id), '{}'::uuid[]) into v_known
      from event_checklist_sections s where s.event_id = p_event_id;
    if (select coalesce(array_agg(x order by x), '{}'::uuid[]) from unnest(v_section_ids) x) is distinct from v_known then
      perform platform_field_invalid('order', 'sections_differ');
    end if;
    for v_item in select value from jsonb_array_elements(p_order) loop
      v_i := v_i + 1;
      v_section_id := (v_item->>'section_id')::uuid;
      if v_item->'task_ids' is null or jsonb_typeof(v_item->'task_ids') <> 'array' then
        perform platform_field_invalid('order');
      end if;
      v_task_ids := '{}';
      for v_one in
        select platform_try_uuid(x.value #>> '{}') from jsonb_array_elements(v_item->'task_ids') as x(value)
      loop
        if v_one is null or v_one = any (v_task_ids) then
          perform platform_field_invalid('order');
        end if;
        v_task_ids := v_task_ids || v_one;
      end loop;
      if (select coalesce(array_agg(x order by x), '{}'::uuid[]) from unnest(v_task_ids) x)
         is distinct from (select coalesce(array_agg(t.id order by t.id), '{}'::uuid[])
                             from event_checklist_tasks t where t.section_id = v_section_id) then
        perform platform_field_invalid('order', 'tasks_differ');
      end if;
      update event_checklist_sections set position = v_i where id = v_section_id;
      v_j := 0;
      foreach v_one in array v_task_ids loop
        v_j := v_j + 1;
        update event_checklist_tasks set position = v_j where id = v_one;
      end loop;
    end loop;
    update event_checklists set updated_at = now() where id = v_head.id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_event_id);
    return platform_result('success', p_event_id, null)
      || jsonb_build_object('checklist_version', checklist_head_version(p_event_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 12. Taking a task and marking it done (W6; BR165.1 to BR166.2). The event row is locked first, then the task row, then
--     its claims, so two people taking the last place at once are served one after the other. Nothing here locks a
--     family row, and no rota, fair-share, standing or reminder function reads a claim (BR165.6).
-- ---------------------------------------------------------------------------------------------------

-- The checks of a note and a chosen time on a claim (BR165.3).
create or replace function checklist_claim_details(
  p_event events, p_time_matters boolean, p_note text, p_chosen_at timestamptz
) returns text
language plpgsql stable set search_path from current
as $$
declare o_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if char_length(o_note) > 500 then
    perform platform_field_invalid('note');
  end if;
  if p_chosen_at is not null then
    if not p_time_matters then
      perform platform_field_invalid('chosen_at', 'not_offered');
    end if;
    if p_chosen_at < p_event.starts_at or p_chosen_at > p_event.ends_at then
      perform platform_field_invalid('chosen_at', 'outside_event');
    end if;
  end if;
  return o_note;
end $$;

create or replace function checklist_claim(
  p_idempotency_key text, p_task_id uuid, p_note text, p_chosen_at timestamptz
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.claim';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_family uuid;
  v_event_id uuid;
  v_event events%rowtype;
  v_task event_checklist_tasks%rowtype;
  v_kind text;
  v_note text;
  v_id uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_task_id::text, coalesce(p_note, ''), coalesce(p_chosen_at::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := current_parent_id();
    v_family := current_family_id();
    -- A teacher, or a caller with no family, is refused as for every family-based command (BR165.1).
    if v_parent is null or v_family is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select t.event_id into v_event_id from event_checklist_tasks t where t.id = p_task_id and t.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'CHECKLIST_TASK_UNAVAILABLE');
    end if;
    v_event := event_lock_for_parent(v_event_id, v_org);
    select * into v_task from event_checklist_tasks t where t.id = p_task_id and t.event_id = v_event_id for update;
    if not found then
      perform platform_abort('denied', 'CHECKLIST_TASK_UNAVAILABLE');
    end if;
    select s.kind into v_kind from event_checklist_sections s where s.id = v_task.section_id;
    -- An organisers' task answers like a task that does not exist to anyone outside the organising team.
    if v_kind = 'organisers' and not checklist_in_team(v_event, v_parent) then
      perform platform_abort('denied', 'CHECKLIST_TASK_UNAVAILABLE');
    end if;
    if v_kind = 'teachers' then
      perform platform_abort('conflict', 'TASK_NOT_CLAIMABLE');
    end if;
    if not checklist_event_is_open(v_event) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    v_note := checklist_claim_details(v_event, v_task.time_matters, p_note, p_chosen_at);
    perform 1 from checklist_claims c where c.task_id = p_task_id order by c.id for update;
    if v_task.done_at is not null then
      perform platform_abort('conflict', 'TASK_DONE');
    end if;
    if exists (select 1 from checklist_claims c where c.task_id = p_task_id and c.parent_id = v_parent) then
      perform platform_abort('conflict', 'ALREADY_CLAIMED');
    end if;
    if (select count(*) from checklist_claims c where c.task_id = p_task_id) >= v_task.helpers_needed then
      perform platform_abort('conflict', 'TASK_TAKEN');
    end if;
    insert into checklist_claims (organization_id, event_id, task_id, parent_id, family_id, note, chosen_at)
    values (v_org, v_event_id, p_task_id, v_parent, v_family, v_note, p_chosen_at)
    returning id into v_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object('version', 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function checklist_claim_typed(
  p_idempotency_key text, p_task_id uuid, p_name text, p_note text, p_chosen_at timestamptz
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.claim_typed';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_event_id uuid;
  v_event events%rowtype;
  v_task event_checklist_tasks%rowtype;
  v_kind text;
  v_name text;
  v_note text;
  v_id uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_task_id::text, coalesce(p_name, ''), coalesce(p_note, ''), coalesce(p_chosen_at::text, '')),
    'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := current_parent_id();
    select t.event_id into v_event_id from event_checklist_tasks t where t.id = p_task_id and t.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    v_event := event_lock_for_parent(v_event_id, v_org);
    if not checklist_in_team(v_event, v_parent) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_task from event_checklist_tasks t where t.id = p_task_id and t.event_id = v_event_id for update;
    if not found then
      perform platform_abort('denied', 'CHECKLIST_TASK_UNAVAILABLE');
    end if;
    select s.kind into v_kind from event_checklist_sections s where s.id = v_task.section_id;
    if v_kind = 'teachers' then
      perform platform_abort('conflict', 'TASK_NOT_CLAIMABLE');
    end if;
    if not checklist_event_is_open(v_event) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    v_name := checklist_text(to_jsonb(p_name), 'name', 200, true);
    v_note := checklist_claim_details(v_event, v_task.time_matters, p_note, p_chosen_at);
    perform 1 from checklist_claims c where c.task_id = p_task_id order by c.id for update;
    if v_task.done_at is not null then
      perform platform_abort('conflict', 'TASK_DONE');
    end if;
    if (select count(*) from checklist_claims c where c.task_id = p_task_id) >= v_task.helpers_needed then
      perform platform_abort('conflict', 'TASK_TAKEN');
    end if;
    insert into checklist_claims (organization_id, event_id, task_id, typed_name, note, chosen_at)
    values (v_org, v_event_id, p_task_id, v_name, v_note, p_chosen_at)
    returning id into v_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object('version', 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function checklist_claim_change(
  p_idempotency_key text, p_claim_id uuid, p_expected_version integer, p_note text, p_chosen_at timestamptz
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.claim_change';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_event_id uuid;
  v_task_id uuid;
  v_event events%rowtype;
  v_task event_checklist_tasks%rowtype;
  v_claim checklist_claims%rowtype;
  v_note text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_claim_id::text, p_expected_version::text, coalesce(p_note, ''), coalesce(p_chosen_at::text, '')),
    'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := current_parent_id();
    if v_parent is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    -- Only the parent who made the claim finds it: another family's claim and a made-up id fail the same way (NFR3.3).
    select c.event_id, c.task_id into v_event_id, v_task_id from checklist_claims c
     where c.id = p_claim_id and c.organization_id = v_org and c.parent_id = v_parent;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    v_event := event_lock_for_parent(v_event_id, v_org);
    select * into v_task from event_checklist_tasks t where t.id = v_task_id and t.event_id = v_event_id for update;
    select * into v_claim from checklist_claims c where c.id = p_claim_id and c.task_id = v_task_id for update;
    if not found or v_claim.parent_id is distinct from v_parent then
      perform platform_field_invalid('claim_id', 'not_found');
    end if;
    if not checklist_event_is_open(v_event) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_claim.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    v_note := checklist_claim_details(v_event, v_task.time_matters, p_note, p_chosen_at);
    update checklist_claims set note = v_note, chosen_at = p_chosen_at where id = p_claim_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_claim_id);
    return platform_result('success', p_claim_id, null) || jsonb_build_object('version', v_claim.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function checklist_claim_withdraw(p_idempotency_key text, p_claim_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.claim_withdraw';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_event_id uuid;
  v_task_id uuid;
  v_event events%rowtype;
  v_task event_checklist_tasks%rowtype;
  v_claim checklist_claims%rowtype;
  v_owner boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_claim_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := current_parent_id();
    select c.event_id, c.task_id into v_event_id, v_task_id from checklist_claims c
     where c.id = p_claim_id and c.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    v_event := event_lock_for_parent(v_event_id, v_org);
    select * into v_task from event_checklist_tasks t where t.id = v_task_id and t.event_id = v_event_id for update;
    select * into v_claim from checklist_claims c where c.id = p_claim_id and c.task_id = v_task_id for update;
    if not found then
      perform platform_field_invalid('claim_id', 'not_found');
    end if;
    v_owner := v_parent is not null and v_claim.parent_id is not distinct from v_parent;
    if not v_owner and not checklist_in_team(v_event, v_parent) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_claim.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_task.done_at is not null then
      perform platform_abort('conflict', 'TASK_DONE');
    end if;
    -- The owner may give the claim up until the event has finished, also when it is cancelled; the organising team only
    -- while the event is open (BR165.4).
    if (v_owner and v_event.ends_at <= now()) or (not v_owner and not checklist_event_is_open(v_event)) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    delete from checklist_claims where id = p_claim_id;
    if not v_owner then
      perform platform_audit_write('checklist.claim_removed', 'checklist_claim', p_claim_id, v_org, v_event.group_id,
                                   'success', 'event:' || v_event_id::text);
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_claim_id);
    return platform_result('success', p_claim_id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function checklist_task_mark_done(p_idempotency_key text, p_task_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.mark_done';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_event_id uuid;
  v_event events%rowtype;
  v_task event_checklist_tasks%rowtype;
  v_kind text;
  v_team boolean;
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
    -- Who marked a task is stored as a parent, so the caller needs an active parent record (BR166.1).
    v_parent := current_parent_id();
    if v_parent is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select t.event_id into v_event_id from event_checklist_tasks t where t.id = p_task_id and t.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'CHECKLIST_TASK_UNAVAILABLE');
    end if;
    v_event := event_lock_for_parent(v_event_id, v_org);
    select * into v_task from event_checklist_tasks t where t.id = p_task_id and t.event_id = v_event_id for update;
    if not found then
      perform platform_abort('denied', 'CHECKLIST_TASK_UNAVAILABLE');
    end if;
    select s.kind into v_kind from event_checklist_sections s where s.id = v_task.section_id;
    v_team := checklist_in_team(v_event, v_parent);
    if v_kind = 'organisers' and not v_team then
      perform platform_abort('denied', 'CHECKLIST_TASK_UNAVAILABLE');
    end if;
    perform 1 from checklist_claims c where c.task_id = p_task_id order by c.id for update;
    if not v_team and not exists (select 1 from checklist_claims c where c.task_id = p_task_id and c.parent_id = v_parent) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_kind = 'teachers' then
      perform platform_abort('conflict', 'TASK_NOT_CLAIMABLE');
    end if;
    if not checklist_event_is_open(v_event) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    if v_task.done_at is not null then
      perform platform_abort('conflict', 'TASK_DONE');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_task.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    update event_checklist_tasks set done_at = now(), done_by_parent_id = v_parent where id = p_task_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_task_id);
    return platform_result('success', p_task_id, null) || jsonb_build_object('version', v_task.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function checklist_task_undo_done(p_idempotency_key text, p_task_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'checklist.undo_done';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_event_id uuid;
  v_event events%rowtype;
  v_task event_checklist_tasks%rowtype;
  v_own boolean;
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
    select t.event_id into v_event_id from event_checklist_tasks t where t.id = p_task_id and t.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    v_event := event_lock_for_parent(v_event_id, v_org);
    select * into v_task from event_checklist_tasks t where t.id = p_task_id and t.event_id = v_event_id for update;
    if not found then
      perform platform_field_invalid('task_id', 'not_found');
    end if;
    v_own := v_parent is not null and v_task.done_by_parent_id is not distinct from v_parent;
    if not v_own and not checklist_in_team(v_event, v_parent) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if not checklist_event_is_open(v_event) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_task.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_task.done_at is not null then
      update event_checklist_tasks set done_at = null, done_by_parent_id = null where id = p_task_id;
      if not v_own then
        perform platform_audit_write('checklist.done_undone', 'checklist_task', p_task_id, v_org, v_event.group_id,
                                     'success', 'event:' || v_event_id::text);
      end if;
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_task_id);
    return platform_result('success', p_task_id, null)
      || jsonb_build_object('version', (select t.version from event_checklist_tasks t where t.id = p_task_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 13. checklist_get (W7; BR167.1 to BR167.3). One event's checklist for any signed-in reader of the community: parents'
--     and teachers' sections for everyone, organisers' sections only for the organising team. Each task carries its
--     claims (names through C6 or the typed name), the done mark, and what the caller may do on it. The deadline of the
--     sign-up is returned and blocks nothing. A caller with no access gets the denied refusal, never an empty list.
-- ---------------------------------------------------------------------------------------------------
create or replace function checklist_get(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parent uuid;
  v_family uuid;
  v_event events%rowtype;
  v_head event_checklists%rowtype;
  v_team boolean;
  v_open boolean;
  v_finished boolean;
  v_sections jsonb;
  v_all_done boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select * into v_event from events e where e.id = p_event_id and e.organization_id = v_org;
  if not found then
    return platform_result('denied', null, 'EVENT_UNAVAILABLE');
  end if;
  v_parent := current_parent_id();
  v_family := current_family_id();
  v_team := checklist_in_team(v_event, v_parent);
  v_open := checklist_event_is_open(v_event);
  v_finished := v_event.ends_at <= now();
  select * into v_head from event_checklists h where h.event_id = p_event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'position', s.position, 'title', s.title, 'kind', s.kind, 'version', s.version,
           'tasks', coalesce((
             select jsonb_agg(jsonb_build_object(
               'id', t.id, 'position', t.position, 'title', t.title, 'place', t.place, 'props', t.props,
               'priority', t.priority, 'materials', t.materials, 'tip', t.tip, 'deadline', t.deadline,
               'summer_only', t.summer_only, 'helpers_needed', t.helpers_needed, 'time_matters', t.time_matters,
               'source_ref', case when v_team then t.source_ref end, 'version', t.version,
               'helpers_taken', (select count(*) from checklist_claims c where c.task_id = t.id),
               'done', case when t.done_at is null then null else jsonb_build_object(
                         'at', t.done_at,
                         'by_display_name', coalesce(parent_display_name(t.done_by_parent_id), 'korábbi tag'),
                         'is_own', v_parent is not null and t.done_by_parent_id = v_parent) end,
               'claims', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', c.id, 'version', c.version,
                          'parent_display_name', case when c.typed_name is null
                                then coalesce(parent_display_name(c.parent_id), 'korábbi tag') end,
                          'family_display_name', case when c.typed_name is null
                                then coalesce(family_display_name(c.family_id), 'korábbi tag') end,
                          'typed_name', c.typed_name, 'note', c.note, 'chosen_at', c.chosen_at,
                          'outside_event', c.chosen_at is not null
                                and (c.chosen_at < v_event.starts_at or c.chosen_at > v_event.ends_at),
                          'is_own', v_parent is not null and c.parent_id = v_parent,
                          'can_remove', t.done_at is null
                                and ((v_parent is not null and c.parent_id = v_parent and not v_finished)
                                     or (v_team and v_open)))
                        order by c.created_at, c.id)
                   from checklist_claims c where c.task_id = t.id), '[]'::jsonb),
               'can', jsonb_build_object(
                 'claim', v_parent is not null and v_family is not null and v_open and t.done_at is null
                          and s.kind in ('parents', 'organisers')
                          and (select count(*) from checklist_claims c where c.task_id = t.id) < t.helpers_needed
                          and not exists (select 1 from checklist_claims c where c.task_id = t.id and c.parent_id = v_parent),
                 'mark_done', v_parent is not null and v_open and t.done_at is null and s.kind <> 'teachers'
                          and (v_team or exists (select 1 from checklist_claims c
                                                  where c.task_id = t.id and c.parent_id = v_parent)),
                 'undo_done', v_open and t.done_at is not null
                          and (v_team or (v_parent is not null and t.done_by_parent_id = v_parent)))
             ) order by t.position)
             from event_checklist_tasks t where t.section_id = s.id), '[]'::jsonb))
         order by s.position), '[]'::jsonb)
    into v_sections
    from event_checklist_sections s
   where s.event_id = p_event_id and (s.kind <> 'organisers' or v_team);

  -- Every claimable task, in parents' and organisers' sections, is done (BR167.2); shown to the organising team only.
  select count(*) > 0 and bool_and(t.done_at is not null) into v_all_done
    from event_checklist_tasks t join event_checklist_sections s on s.id = t.section_id
   where t.event_id = p_event_id and s.kind in ('parents', 'organisers');

  return platform_result('success', p_event_id, null) || jsonb_build_object('item', jsonb_build_object(
    'event_id', p_event_id, 'event_title', v_event.title, 'checklist_version', coalesce(v_head.version, 0),
    'copied_from_template_id', v_head.copied_from_template_id,
    'is_empty', not exists (select 1 from event_checklist_sections s where s.event_id = p_event_id),
    'is_open', v_open, 'is_finished', v_finished, 'is_cancelled', v_event.status = 'cancelled',
    'signup_deadline', v_event.signup_deadline, 'is_summer', v_event.is_summer,
    'sections', v_sections,
    'all_done', case when v_team then coalesce(v_all_done, false) end,
    'caller', jsonb_build_object('in_team', v_team,
                                 'can_manage', coalesce(has_core_scope(v_org, v_event.group_id), false),
                                 'can_claim_tasks', v_parent is not null and v_family is not null)));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 14. Functions for later units and U10's notices. Internal: executable by nobody who is signed in.
--     C15 checklist_add_task (BR170.5): U12 puts a to-do task into an event's checklist. It locks the event, then the
--     checklist head (created if missing), then the section, then adds the task; it knows nothing about to-do tasks and
--     checks no caller right. The same source_ref on the same event returns the existing task and changes nothing.
--     checklist_claimant_ids (BR170.6): the active parents who hold a claim on an event, read by event_save for its
--     cancellation and change notices.
-- ---------------------------------------------------------------------------------------------------
create or replace function checklist_claimant_ids(p_event_id uuid) returns uuid[]
language sql stable security definer set search_path from current
as $$
  select coalesce(array_agg(x.id order by x.id), '{}'::uuid[])
    from (select distinct p.id
            from checklist_claims c
            join parents p on p.id = c.parent_id and p.status = 'active'
           where c.event_id = p_event_id) x
$$;

create or replace function checklist_add_task(p_event_id uuid, p_task jsonb, p_source_ref text, p_claimant jsonb)
returns uuid
language plpgsql security definer set search_path from current
as $$
declare
  v_event events%rowtype;
  v_head event_checklists%rowtype;
  v_section_title text;
  v_section_id uuid;
  v_task_id uuid;
  v_ref text := nullif(btrim(coalesce(p_source_ref, '')), '');
  v_parent uuid;
  v_family uuid;
  v_name text;
begin
  select * into v_event from events e where e.id = p_event_id for update;
  if not found then
    perform platform_field_invalid('event_id', 'not_found');
  end if;
  if v_ref is not null then
    select t.id into v_task_id from event_checklist_tasks t where t.event_id = p_event_id and t.source_ref = v_ref;
    if found then
      return v_task_id;
    end if;
  end if;
  if not checklist_event_is_open(v_event) then
    perform platform_abort('conflict', 'EVENT_CLOSED');
  end if;
  if p_task is null or jsonb_typeof(p_task) <> 'object' then
    perform platform_abort('validation', 'request_invalid');
  end if;
  v_section_title := checklist_text(p_task->'section_title', 'section_title', 100, true);
  perform checklist_text(p_task->'title', 'title', 200, true);
  perform checklist_text(p_task->'place', 'place', 200);
  perform checklist_text(p_task->'props', 'props', 300);
  perform checklist_text(p_task->'materials', 'materials', 300);
  perform checklist_int(p_task->'priority', 'priority', 1, 3, null);
  if v_ref is not null and char_length(v_ref) > 100 then
    perform platform_field_invalid('source_ref');
  end if;
  select * into v_head from event_checklists h where h.event_id = p_event_id for update;
  if v_head.id is null then
    insert into event_checklists (organization_id, event_id) values (v_event.organization_id, p_event_id)
    returning * into v_head;
  end if;
  select s.id into v_section_id from event_checklist_sections s
   where s.event_id = p_event_id and s.kind = 'parents' and s.title = v_section_title
   order by s.position limit 1 for update;
  if v_section_id is null then
    if (select count(*) from event_checklist_sections s where s.event_id = p_event_id) >= 30 then
      perform platform_field_invalid('sections', 'too_many_sections');
    end if;
    insert into event_checklist_sections (organization_id, checklist_id, event_id, position, title, kind)
    values (v_event.organization_id, v_head.id, p_event_id,
            (select coalesce(max(s.position), 0) + 1 from event_checklist_sections s where s.event_id = p_event_id),
            v_section_title, 'parents')
    returning id into v_section_id;
  end if;
  if (select count(*) from event_checklist_tasks t where t.event_id = p_event_id) >= 300 then
    perform platform_field_invalid('tasks', 'too_many_tasks');
  end if;
  insert into event_checklist_tasks (organization_id, event_id, section_id, position, title, place, props, priority,
                                     materials, source_ref)
  values (v_event.organization_id, p_event_id, v_section_id,
          (select coalesce(max(t.position), 0) + 1 from event_checklist_tasks t where t.section_id = v_section_id),
          checklist_text(p_task->'title', 'title', 200, true), checklist_text(p_task->'place', 'place', 200),
          checklist_text(p_task->'props', 'props', 300), checklist_int(p_task->'priority', 'priority', 1, 3, null),
          checklist_text(p_task->'materials', 'materials', 300), v_ref)
  returning id into v_task_id;
  update event_checklists set updated_at = now() where id = v_head.id;

  if p_claimant is not null and jsonb_typeof(p_claimant) = 'object' then
    if nullif(p_claimant->>'parent_id', '') is not null then
      v_parent := platform_try_uuid(p_claimant->>'parent_id');
      -- A parent who is no longer active in an active family leaves the task without a claim (BR170.5).
      select p.id, p.family_id into v_parent, v_family
        from parents p join families f on f.id = p.family_id and f.status = 'active'
       where p.id = v_parent and p.status = 'active' and p.organization_id = v_event.organization_id;
      if v_parent is not null then
        insert into checklist_claims (organization_id, event_id, task_id, parent_id, family_id)
        values (v_event.organization_id, p_event_id, v_task_id, v_parent, v_family);
      end if;
    elsif nullif(p_claimant->>'typed_name', '') is not null then
      v_name := checklist_text(p_claimant->'typed_name', 'typed_name', 200, true);
      insert into checklist_claims (organization_id, event_id, task_id, typed_name)
      values (v_event.organization_id, p_event_id, v_task_id, v_name);
    end if;
  end if;
  return v_task_id;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 15. The two daily checks (W8; BR168.1 to BR168.3), registered in U5's registry (C9) with run kind daily and the highest
--     lock step it accepts. Both read and send through notice_send, take no checklist lock, are safe to run twice (the
--     once key), and note an event that failed in the run's detail while the others still run.
-- ---------------------------------------------------------------------------------------------------
create or replace function event_lead_notice_check(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_moment timestamptz := coalesce(p_now, now());
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Budapest')::date;
  v_event record;
  v_recipients uuid[];
  v_created integer := 0;
  v_skipped integer := 0;
  v_failed uuid[] := '{}'::uuid[];
begin
  for v_event in
    select e.id, e.organization_id, e.group_id
      from events e
     where e.status = 'planned' and e.notice_lead_days is not null and e.starts_at > v_moment
       and (e.starts_at at time zone 'Europe/Budapest')::date - e.notice_lead_days <= v_today
     order by e.id
  loop
    begin
      -- The same people as the new-event notice, with the creator included: this is a reminder for everyone (BR168.1).
      if v_event.group_id is null then
        select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_recipients
          from parents p join families f on f.id = p.family_id and f.status = 'active'
         where p.organization_id = v_event.organization_id and p.status = 'active' and p.account_id is not null;
      else
        v_recipients := group_members(v_event.group_id);
      end if;
      if cardinality(v_recipients) = 0 then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      v_created := v_created + notice_send(v_recipients, 'event_lead_time', 'event', v_event.id,
                                           'event_lead_time:' || v_event.id::text);
    exception when others then
      v_failed := v_failed || v_event.id;
    end;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped,
    'detail', case when cardinality(v_failed) = 0 then null else 'failed: ' || array_to_string(v_failed, ', ') end);
end $$;

create or replace function checklist_unclaimed_check(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_moment timestamptz := coalesce(p_now, now());
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Budapest')::date;
  v_event record;
  v_recipients uuid[];
  v_created integer := 0;
  v_skipped integer := 0;
  v_failed uuid[] := '{}'::uuid[];
begin
  for v_event in
    select e.id, e.signup_deadline
      from events e
     where e.status = 'planned' and e.signup_deadline is not null and e.starts_at > v_moment
       and v_today between e.signup_deadline - 3 and e.signup_deadline
       and exists (select 1 from event_checklist_tasks t
                     join event_checklist_sections s on s.id = t.section_id and s.kind = 'parents'
                    where t.event_id = e.id and t.done_at is null
                      and (select count(*) from checklist_claims c where c.task_id = t.id) < t.helpers_needed)
     order by e.id
  loop
    begin
      v_recipients := event_organisers(v_event.id);
      if cardinality(v_recipients) = 0 then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      -- The once key carries the deadline date, so moving the deadline allows one new alert (BR168.2).
      v_created := v_created + notice_send(v_recipients, 'checklist_unclaimed', 'event', v_event.id,
                                           'checklist_unclaimed:' || v_event.id::text || ':' || v_event.signup_deadline::text);
    exception when others then
      v_failed := v_failed || v_event.id;
    end;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped,
    'detail', case when cardinality(v_failed) = 0 then null else 'failed: ' || array_to_string(v_failed, ', ') end);
end $$;

insert into timed_check_registry (check_name, function_name, run_kind, is_active, lock_step, added_by) values
  ('event_lead_notice', 'event_lead_notice_check', 'daily', true, 4, 'u11-checklists'),
  ('checklist_unclaimed_alert', 'checklist_unclaimed_check', 'daily', true, 4, 'u11-checklists');

-- ---------------------------------------------------------------------------------------------------
-- 16. C16 (BR170.4): removing a parent, or a family. A claim on a task that is not done, in an event that has not
--     finished, is deleted so its place is free again; every other claim keeps its row and loses the parent and family
--     links, so it shows korábbi tag; the done mark of a task the person marked loses its parent. The block holds
--     nothing for another subject kind. Apply locks the checklist tasks ascending, then the claims ascending.
-- ---------------------------------------------------------------------------------------------------
create or replace function checklists_removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_parents uuid[];
  v_family uuid;
  v_count integer;
begin
  if p_subject_kind = 'parent' then
    select coalesce(array_agg(p.id), '{}'::uuid[]) into v_parents from parents p where p.id = p_subject_id;
  elsif p_subject_kind = 'family' then
    v_family := p_subject_id;
    select coalesce(array_agg(p.id), '{}'::uuid[]) into v_parents from parents p where p.family_id = p_subject_id;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;
  select (select count(*) from checklist_claims c
           where c.parent_id = any (v_parents) or (v_family is not null and c.family_id = v_family))
       + (select count(*) from event_checklist_tasks t where t.done_by_parent_id = any (v_parents))
    into v_count;
  return jsonb_build_object('to_clear', v_count, 'to_flag', 0);
end $$;

create or replace function checklists_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parents uuid[];
  v_family uuid;
  v_tasks uuid[];
  v_count integer := 0;
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
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;

  select coalesce(array_agg(x.id order by x.id), '{}'::uuid[]) into v_tasks
    from (select c.task_id as id from checklist_claims c
           where c.parent_id = any (v_parents) or (v_family is not null and c.family_id = v_family)
          union
          select t.id from event_checklist_tasks t where t.done_by_parent_id = any (v_parents)) x;
  perform 1 from event_checklist_tasks t where t.id = any (v_tasks) order by t.id for update;
  perform 1 from checklist_claims c
   where c.parent_id = any (v_parents) or (v_family is not null and c.family_id = v_family)
   order by c.id for update;

  -- Open claims free their place; the rest are anonymised.
  delete from checklist_claims c
   using event_checklist_tasks t, events e
   where t.id = c.task_id and e.id = c.event_id
     and (c.parent_id = any (v_parents) or (v_family is not null and c.family_id = v_family))
     and t.done_at is null and e.ends_at > now();
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;
  update checklist_claims set parent_id = null, family_id = null
   where parent_id = any (v_parents) or (v_family is not null and family_id = v_family);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;
  update event_checklist_tasks set done_by_parent_id = null where done_by_parent_id = any (v_parents);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  perform platform_audit_write('checklist.removal_applied', p_subject_kind, p_subject_id, v_org, null, 'success', null);
  return jsonb_build_object('to_clear', v_count, 'to_flag', 0);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 17. Two redefined functions. task_save_core (20261047) refuses a new link to an event (BR169.1); the rest of the body is
--     unchanged. event_save_core (20261056) adds the parents holding a checklist claim to the recipients of the
--     cancellation and change notice (BR170.6); the rest of the body is unchanged. The wrappers around them stay.
-- ---------------------------------------------------------------------------------------------------
create or replace function task_save_core(p_idempotency_key text, p_task jsonb) returns jsonb
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
    -- An absent or empty group means community-wide.
    if nullif(p_task->>'group_id', '') is not null then
      v_group := platform_try_uuid(p_task->>'group_id');
      if v_group is null then
        perform platform_field_invalid('group_id');
      end if;
      select g.status into v_group_status from groups g where g.id = v_group and g.organization_id = v_org;
      if not found then
        perform platform_deny_unless_super(v_org);
        perform platform_field_invalid('group_id', 'not_found');
      end if;
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
        perform platform_deny_unless_super(v_org);
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
      if v_group is distinct from v_task.group_id and v_taken > 0 then
        perform platform_field_invalid('group_id', 'locked');
      end if;
    else
      v_taken := 0;
    end if;

    -- BR169.1: an event's checklist replaces today's event tasks, so no save creates a link to an event. Saving a task with
    -- the event it already has, and removing the link, still work.
    if p_task->'event_id' is not null and jsonb_typeof(p_task->'event_id') <> 'null'
       and (v_creating or platform_try_uuid(p_task->>'event_id') is distinct from v_task.event_id) then
      perform platform_field_invalid('event_id', 'retired');
    end if;
    -- The event, when there is one: of this organization, reached by the caller, and of the task's scope.
    if p_task->'event_id' is not null and jsonb_typeof(p_task->'event_id') <> 'null' then
      v_event_id := platform_try_uuid(p_task->>'event_id');
      if v_event_id is null then
        perform platform_field_invalid('event_id');
      end if;
      select * into v_event from events where id = v_event_id and organization_id = v_org;
      if not found then
        perform platform_deny_unless_super(v_org);
        perform platform_field_invalid('event_id', 'not_found');
      end if;
      if not has_core_scope(v_org, v_event.group_id) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
      if v_event.group_id is distinct from v_group then
        perform platform_field_invalid('event_id', 'group_mismatch');
      end if;
    elsif not v_creating and p_task->'event_id' is null then
      v_event_id := v_task.event_id;
      select * into v_event from events where id = v_event_id;
    end if;
    -- A task that keeps its event cannot move to another scope (the event's scope is the task's).
    if v_event_id is not null and v_event.group_id is distinct from v_group then
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

create or replace function event_save_core(p_idempotency_key text, p_event jsonb) returns jsonb
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
  v_starts timestamptz;
  v_ends timestamptz;
  v_status text;
  v_summer boolean;
  v_food boolean;
  v_deadline date;
  v_lead integer;
  v_was_finished boolean;
  v_new_version integer;
  v_caller uuid;
  v_recipients uuid[];
  v_cancelled boolean := false;
  v_changed boolean := false;
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
    -- An absent or empty group means community-wide.
    if nullif(p_event->>'group_id', '') is not null then
      v_group := platform_try_uuid(p_event->>'group_id');
      if v_group is null then
        perform platform_field_invalid('group_id');
      end if;
      -- A group of another organization answers exactly like a missing one.
      select g.status into v_group_status from groups g where g.id = v_group and g.organization_id = v_org;
      if not found then
        perform platform_deny_unless_super(v_org);
        perform platform_field_invalid('group_id', 'not_found');
      end if;
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
      -- The event row is locked before any of its tasks (BR122.1).
      select * into v_event from events where id = v_id and organization_id = v_org for update;
      if not found then
        perform platform_deny_unless_super(v_org);
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
      if v_group is distinct from v_event.group_id and exists (select 1 from tasks t where t.event_id = v_id) then
        perform platform_field_invalid('group_id', 'locked');
      end if;
      v_was_finished := v_event.ends_at <= now();
    end if;

    v_title := btrim(coalesce(p_event->>'title', ''));
    v_location := nullif(btrim(coalesce(p_event->>'location', '')), '');
    v_starts := platform_try_timestamptz(p_event->>'starts_at');
    v_ends := platform_try_timestamptz(p_event->>'ends_at');
    v_status := coalesce(p_event->>'status', case when v_creating then 'planned' else v_event.status end);
    if char_length(v_title) not between 1 and 200 then
      perform platform_field_invalid('title');
    end if;
    if v_location is not null and char_length(v_location) > 200 then
      perform platform_field_invalid('location');
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

    -- The four settings (BR102.1). A key that is absent leaves a changed event as it is; a created event gets the default.
    if p_event ? 'is_summer' then
      if jsonb_typeof(p_event->'is_summer') <> 'boolean' then
        perform platform_field_invalid('is_summer');
      end if;
      v_summer := (p_event->>'is_summer')::boolean;
    else
      v_summer := case when v_creating then false else v_event.is_summer end;
    end if;
    if p_event ? 'food_signup_on' then
      if jsonb_typeof(p_event->'food_signup_on') <> 'boolean' then
        perform platform_field_invalid('food_signup_on');
      end if;
      v_food := (p_event->>'food_signup_on')::boolean;
    else
      v_food := case when v_creating then false else v_event.food_signup_on end;
    end if;
    if p_event ? 'signup_deadline' then
      if nullif(p_event->>'signup_deadline', '') is null then
        v_deadline := null;
      else
        v_deadline := case when p_event->>'signup_deadline' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                           then platform_try_date(p_event->>'signup_deadline') end;
        if v_deadline is null then
          perform platform_field_invalid('signup_deadline');
        end if;
      end if;
    else
      v_deadline := case when v_creating then null else v_event.signup_deadline end;
    end if;
    if v_deadline is not null and v_deadline > (v_ends at time zone 'Europe/Budapest')::date then
      perform platform_field_invalid('signup_deadline', 'after_end');
    end if;
    if p_event ? 'notice_lead_days' then
      if nullif(p_event->>'notice_lead_days', '') is null then
        v_lead := null;
      else
        v_lead := platform_try_integer(p_event->>'notice_lead_days');
        if v_lead is null or v_lead not between 1 and 60 then
          perform platform_field_invalid('notice_lead_days');
        end if;
      end if;
    else
      v_lead := case when v_creating then null else v_event.notice_lead_days end;
    end if;

    -- After its end the event keeps its tale, roles, notices and settings open to the manager, but not its dates or status.
    if not v_creating and v_was_finished
       and (v_starts is distinct from v_event.starts_at or v_ends is distinct from v_event.ends_at
            or v_status is distinct from v_event.status) then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;

    if v_creating then
      insert into events (organization_id, group_id, title, location, starts_at, ends_at, status,
                          is_summer, signup_deadline, notice_lead_days, food_signup_on)
      values (v_org, v_group, v_title, v_location, v_starts, v_ends, v_status,
              v_summer, v_deadline, v_lead, v_food)
      returning id into v_id;
      v_new_version := 1;
    else
      update events
         set group_id = v_group, title = v_title, location = v_location, starts_at = v_starts, ends_at = v_ends,
             status = v_status, is_summer = v_summer, signup_deadline = v_deadline, notice_lead_days = v_lead,
             food_signup_on = v_food
       where id = v_id;
      v_new_version := v_event.version + 1;
      -- A cancelled event closes its open tasks for new sign-ups (BR118.1): the tasks are locked in ascending id order
      -- after the event row, in the same transaction as the status change (NFR7.2).
      if v_status = 'cancelled' and v_event.status <> 'cancelled' then
        perform 1 from tasks where event_id = v_id order by id for update;
        update tasks set status = 'closed' where event_id = v_id and status = 'open';
        perform platform_audit_write('event.cancelled', 'event', v_id, v_org, v_group, 'success', null);
        v_cancelled := not v_was_finished;
      elsif v_status = 'planned' and v_event.status = 'planned' and not v_was_finished and v_ends > now()
            and (v_starts is distinct from v_event.starts_at or v_ends is distinct from v_event.ends_at
                 or v_location is distinct from v_event.location) then
        v_changed := true;
      end if;
    end if;

    v_caller := identity_linked_parent();
    if v_creating then
      -- BR117.1: a new open event tells the community, or the members of its group; the creator is left out.
      if v_status = 'planned' and v_ends > now() then
        if v_group is null then
          select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_recipients
            from parents p join families f on f.id = p.family_id and f.status = 'active'
           where p.organization_id = v_org and p.status = 'active' and p.account_id is not null
             and p.id is distinct from v_caller;
        else
          select coalesce(array_agg(m.id order by m.id), '{}'::uuid[]) into v_recipients
            from unnest(group_members(v_group)) as m(id) where m.id is distinct from v_caller;
        end if;
        if cardinality(v_recipients) > 0 then
          perform notice_send(v_recipients, 'event_new', 'event', v_id, 'event_new:' || v_id::text);
        end if;
      end if;
    elsif v_cancelled or v_changed then
      -- BR117.2, BR170.6: the parents with a sign-up or an offer, the parents holding a checklist claim, and the parents of every
      -- family holding a place on a task.
      select coalesce(array_agg(r.id order by r.id), '{}'::uuid[]) into v_recipients
        from (
          select s.parent_id as id from event_signups s where s.event_id = v_id and s.parent_id is not null
          union
          select o.parent_id from food_offers o where o.event_id = v_id and o.parent_id is not null
          union
          select p.id from assignments a
            join tasks t on t.id = a.task_id and t.event_id = v_id
            join parents p on p.family_id = a.family_id and p.status = 'active'
           where a.status <> 'removed'
          union
          select x from unnest(checklist_claimant_ids(v_id)) as x
        ) r
       where r.id is distinct from v_caller;
      if cardinality(v_recipients) > 0 then
        perform notice_send(
          v_recipients,
          case when v_cancelled then 'event_cancelled' else 'event_changed' end,
          'event', v_id,
          case when v_cancelled then 'event_cancelled:' else 'event_changed:' end
            || v_id::text || ':' || v_new_version::text);
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
-- 18. Function rights (C1, NFR3.7). Every function here starts with no rights. The signed-in commands and reads go to
--     signed-in accounts and check their caller themselves; the install goes to the service role; the helpers, the
--     facts and removal functions, the two checks and the later-unit functions stay with nobody who is signed in.
--     `create or replace` keeps the grants of the earlier files, so the rights of the two redefined functions are
--     stated again.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  checklist_template_can_manage(uuid, uuid),
  checklist_in_team(events, uuid),
  checklist_text(jsonb, text, integer, boolean),
  checklist_int(jsonb, text, integer, integer, integer),
  checklist_bool(jsonb, text, boolean),
  checklist_event_is_open(events),
  checklist_head_version(uuid),
  checklist_claim_details(events, boolean, text, timestamptz),
  checklist_claimant_ids(uuid),
  checklist_add_task(uuid, jsonb, text, jsonb),
  event_lead_notice_check(timestamptz),
  checklist_unclaimed_check(timestamptz),
  checklists_removal_preview(text, uuid),
  checklists_removal_apply(text, uuid),
  checklist_starting_templates_install(uuid),
  task_save_core(text, jsonb),
  event_save_core(text, jsonb),
  template_save(text, jsonb),
  template_set_removed(text, uuid, boolean, integer),
  template_get(uuid),
  template_list_admin(),
  template_list(uuid),
  template_options(uuid),
  checklist_copy_template(text, uuid, uuid),
  checklist_section_save(text, uuid, integer, jsonb),
  checklist_section_remove(text, uuid, integer),
  checklist_task_save(text, uuid, integer, jsonb),
  checklist_task_remove(text, uuid, integer),
  checklist_reorder(text, uuid, integer, jsonb),
  checklist_claim(text, uuid, text, timestamptz),
  checklist_claim_typed(text, uuid, text, text, timestamptz),
  checklist_claim_change(text, uuid, integer, text, timestamptz),
  checklist_claim_withdraw(text, uuid, integer),
  checklist_task_mark_done(text, uuid, integer),
  checklist_task_undo_done(text, uuid, integer),
  checklist_get(uuid)
  from public, anon, authenticated, service_role;

grant execute on function
  template_save(text, jsonb),
  template_set_removed(text, uuid, boolean, integer),
  template_get(uuid),
  template_list_admin(),
  template_list(uuid),
  template_options(uuid),
  checklist_copy_template(text, uuid, uuid),
  checklist_section_save(text, uuid, integer, jsonb),
  checklist_section_remove(text, uuid, integer),
  checklist_task_save(text, uuid, integer, jsonb),
  checklist_task_remove(text, uuid, integer),
  checklist_reorder(text, uuid, integer, jsonb),
  checklist_claim(text, uuid, text, timestamptz),
  checklist_claim_typed(text, uuid, text, text, timestamptz),
  checklist_claim_change(text, uuid, integer, text, timestamptz),
  checklist_claim_withdraw(text, uuid, integer),
  checklist_task_mark_done(text, uuid, integer),
  checklist_task_undo_done(text, uuid, integer),
  checklist_get(uuid)
  to authenticated;

grant execute on function checklist_starting_templates_install(uuid) to service_role;

commit;
