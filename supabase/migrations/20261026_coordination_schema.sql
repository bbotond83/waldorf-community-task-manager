-- U3 Coordination: tables, constraints, indexes, reach helpers and row-level policies
-- (BR31.1, BR31.8, BR31.9, NFR1.29, NFR3.6). Conventions and the pinning of functions are those of
-- 20261024_directory_schema.sql. Inside Coordination the tables are linked by foreign keys; the links to
-- Directory (group, family and parent ids) are typed ids with no foreign key (ADR-001), checked inside the
-- named functions. Every change goes through the named functions of the next files: signed-in accounts
-- get select only, the service-role key nothing.
--
-- Who reads what at the table level. Admins read the events, tasks, assignments, requests and notes of
-- the groups they reach. The parents of a family read only their own family's assignments, change
-- requests and contribution notes. Events and tasks carry other families' information (the notes of an
-- event, the number of places taken), so parents do not read those tables at all: they read tasks through
-- the use-case functions, which return exactly what a family may see (BR31.9, BR31.11). Teachers read the
-- schedule function only.

create table events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  group_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  location text check (location is null or char_length(location) <= 200),
  coordinator_name text check (coordinator_name is null or char_length(coordinator_name) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  allergen_note text check (allergen_note is null or char_length(allergen_note) <= 300),
  supply_note text check (supply_note is null or char_length(supply_note) <= 300),
  food_note text check (food_note is null or char_length(food_note) <= 300),
  status text not null default 'planned' check (status in ('planned', 'cancelled')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  unique (id, group_id)
);
create index events_group_time on events (group_id, starts_at);
create index events_organization on events (organization_id, starts_at);
create trigger events_touch_version before update on events
  for each row execute function platform_touch_version();

create table tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  group_id uuid not null,
  event_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  category text not null default 'general' check (char_length(category) between 1 and 100),
  capacity integer not null check (capacity between 1 and 50),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '-' check (char_length(location) between 1 and 200),
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  -- A task of an event belongs to the event's group (BR31.1). The key is not checked while event_id is empty.
  foreign key (event_id, group_id) references events (id, group_id)
);
create index tasks_group_start on tasks (group_id, starts_at);
create index tasks_event on tasks (event_id) where event_id is not null;
create index tasks_organization on tasks (organization_id, starts_at);
create trigger tasks_touch_version before update on tasks
  for each row execute function platform_touch_version();

-- A family's place on a task. At most one place per family and task that is not removed (answer Q4);
-- a removed place is final and stays as history.
create table assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id uuid not null references tasks (id),
  family_id uuid not null,
  parent_id uuid,
  source text not null check (source in ('parent_sign_up', 'admin_assign', 'swap', 'import')),
  status text not null default 'active' check (status in ('active', 'swap_pending', 'cancellation_pending', 'removed')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index assignments_one_per_family_task on assignments (family_id, task_id)
  where status <> 'removed';
-- Also the support index of the capacity check: places taken per task.
create index assignments_task on assignments (task_id, status);
create index assignments_family on assignments (family_id, status);
create index assignments_organization_status on assignments (organization_id, status);
create trigger assignments_touch_version before update on assignments
  for each row execute function platform_touch_version();

-- The places taken on a task (active, swap pending or cancellation pending) never exceed its capacity.
-- The use-case functions lock the task and check first and give a coded result; this deferred trigger is
-- the database's own last word, checked when the transaction ends, so an exchange of two places that
-- crosses a full task is judged on its final state. It locks the task row so two commits cannot both
-- pass. A deferred trigger runs at commit with the role the transaction has then (a signed-in account
-- when a use-case function was called through the data API), so it runs as the owner and the schema
-- tests list it with the internal elevated functions.
create or replace function assignments_check_capacity() returns trigger
language plpgsql security definer set search_path from current
as $$
declare v_capacity integer;
begin
  if new.status = 'removed' then
    return null;
  end if;
  select t.capacity into v_capacity from tasks t where t.id = new.task_id for update;
  if (select count(*) from assignments a where a.task_id = new.task_id and a.status <> 'removed') > v_capacity then
    raise exception 'assignments: task % is over capacity', new.task_id using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger assignments_capacity after insert or update of task_id, status on assignments
  deferrable initially deferred for each row execute function assignments_check_capacity();

-- A request to swap an assignment with another family's, or to cancel it (FR5.2). The stored task ids
-- and assignment versions are compared again at confirmation and approval (BR31.4, BR31.5).
create table change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  assignment_id uuid not null references assignments (id),
  target_assignment_id uuid references assignments (id),
  kind text not null check (kind in ('swap', 'cancellation')),
  requested_by_parent_id uuid not null,
  source_task_id uuid not null,
  source_assignment_version integer not null,
  target_task_id uuid,
  target_assignment_version integer,
  reason text check (reason is null or char_length(reason) <= 500),
  source_confirmed boolean not null default true,
  target_confirmed boolean not null default false,
  status text not null default 'open' check (status in ('open', 'applied', 'approved', 'rejected', 'withdrawn')),
  decided_by_account_id uuid,
  decided_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'swap' and target_assignment_id is not null and target_task_id is not null
          and target_assignment_version is not null)
      or (kind = 'cancellation' and target_assignment_id is null and target_task_id is null
          and target_assignment_version is null and not target_confirmed)),
  check (status not in ('approved', 'rejected') or (decided_by_account_id is not null and decided_at is not null))
);
-- At most one open request per assignment: a duplicate is refused (BR31.4, BR31.6).
create unique index change_requests_one_open on change_requests (assignment_id) where status = 'open';
create index change_requests_assignment on change_requests (assignment_id, status);
create index change_requests_target on change_requests (target_assignment_id) where target_assignment_id is not null;
create index change_requests_status on change_requests (organization_id, status);
create trigger change_requests_touch_version before update on change_requests
  for each row execute function platform_touch_version();

-- The note a family keeps for what it brings to its task (BR31.8). One per assignment.
create table contribution_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  assignment_id uuid not null unique references assignments (id),
  text text not null check (char_length(text) <= 500),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger contribution_notes_touch_version before update on contribution_notes
  for each row execute function platform_touch_version();

-- ---------------------------------------------------------------------------------------------------
-- Reach helpers. Defined once and reused by the policies here and by the use-case functions.
-- ---------------------------------------------------------------------------------------------------

-- The group reach of a task, and so of its assignments and requests: a super admin of the organization,
-- or a group admin of the task's group (entities.md, "Placeholder tables").
create or replace function coordination_task_reached(p_organization_id uuid, p_task_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$ select current_session_is_active() and exists (
  select 1 from tasks t
   where t.id = p_task_id and t.organization_id = p_organization_id
     and has_core_scope(t.organization_id, t.group_id)) $$;

-- The group reach of an assignment is its task's group (the assignment has no group of its own).
create or replace function coordination_assignment_reached(p_organization_id uuid, p_assignment_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$ select current_session_is_active() and exists (
  select 1 from assignments a join tasks t on t.id = a.task_id
   where a.id = p_assignment_id and a.organization_id = p_organization_id
     and has_core_scope(t.organization_id, t.group_id)) $$;

-- True when the signed-in account is a parent of the family that holds the assignment (an active family).
create or replace function coordination_assignment_family_parent(p_assignment_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$ select current_session_is_active() and exists (
  select 1 from assignments a where a.id = p_assignment_id and directory_is_family_parent(a.family_id)) $$;

-- ---------------------------------------------------------------------------------------------------
-- Row-level security: select only, no insert, update or delete policy.
-- ---------------------------------------------------------------------------------------------------
alter table events enable row level security;
alter table tasks enable row level security;
alter table assignments enable row level security;
alter table change_requests enable row level security;
alter table contribution_notes enable row level security;

create policy events_read on events for select to authenticated
  using (has_core_scope(organization_id, group_id));
create policy tasks_read on tasks for select to authenticated
  using (has_core_scope(organization_id, group_id));
create policy assignments_read on assignments for select to authenticated
  using (coordination_task_reached(organization_id, task_id) or directory_is_family_parent(family_id));
create policy change_requests_read on change_requests for select to authenticated
  using (coordination_task_reached(organization_id, source_task_id)
         or coordination_assignment_family_parent(assignment_id));
create policy contribution_notes_read on contribution_notes for select to authenticated
  using (coordination_assignment_reached(organization_id, assignment_id)
         or coordination_assignment_family_parent(assignment_id));

revoke all on events, tasks, assignments, change_requests, contribution_notes
  from public, anon, authenticated, service_role;
grant select on events, tasks, assignments, change_requests, contribution_notes to authenticated;

revoke all on function
  assignments_check_capacity(),
  coordination_task_reached(uuid, uuid),
  coordination_assignment_reached(uuid, uuid),
  coordination_assignment_family_parent(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  coordination_task_reached(uuid, uuid),
  coordination_assignment_reached(uuid, uuid),
  coordination_assignment_family_parent(uuid)
  to authenticated;
