-- U10 of the Ovis tábla work: community and working-group events with notices, roles with an organiser mark, the
-- year's tale, sign-ups with a note, food offers, three event notice kinds, and the functions later units call
-- (W1 to W10 of functional-spec.md; BR100 to BR124; contracts C1, C2, C6, C8, C10, C13, C14, C16). The file opens and
-- commits its own transaction, as 20261048 to 20261053 do, because the migration runner adds none: the structure
-- change, the registry rows and every redefined function succeed or fail together (NFR7.5).
-- Technical names stay: a community is `organizations`, a working group is `groups`, a duty is a `tasks` row, a place
-- is an `assignments` row. An event with no `group_id` is a community event.
--
-- The local data is invented test data and the local database is reset, so the three fixed notes and the typed
-- coordinator name are dropped without conversion; every other column and row of `events`, `tasks` and `assignments`
-- stays as it was (NFR7.5).
--
-- Lock order of every path (scalability-design.md, NFR5.6): the event row first, then its notice, role, sign-up and
-- offer rows by ascending id, then the event's task rows by ascending id. A sign-up or offer command never locks a
-- family row. A row-based command reads the row's event id without a lock, locks the event, then locks the row and
-- re-checks that it still belongs to that event.
--
-- Refusals are raised through U3R00 and rolled back (C1). Every function pins its search path, starts with
-- `revoke all` and gets an explicit grant or none. The signed-in commands and reads are listed in section 14; the
-- facts functions for later units (C13), the removal pair (C16), the helpers and the notice facts function are
-- internal and granted to nobody.
begin;

-- ---------------------------------------------------------------------------------------------------
-- 1. The event row: five new fields, the three fixed notes and the typed coordinator name gone (BR102.1, BR103.1,
--    BR107.1). The deadline is a date compared in Budapest time (NFR7.6).
-- ---------------------------------------------------------------------------------------------------
alter table events drop column coordinator_name;
alter table events drop column allergen_note;
alter table events drop column supply_note;
alter table events drop column food_note;
alter table events add column is_summer boolean not null default false;
alter table events add column signup_deadline date;
alter table events add column notice_lead_days integer
  check (notice_lead_days is null or notice_lead_days between 1 and 60);
alter table events add column food_signup_on boolean not null default false;
alter table events add column tale text check (tale is null or char_length(tale) <= 5000);
alter table events add constraint events_deadline_not_after_end
  check (signup_deadline is null or signup_deadline <= (ends_at at time zone 'Europe/Budapest')::date);

-- ---------------------------------------------------------------------------------------------------
-- 2. The four new tables. Row-level security on, no policy and no right for any application role: the screens read
--    through the read functions below (NFR3.7). Links to people are typed ids with no foreign key (ADR-001), checked
--    inside the functions, so the lifecycle of a parent or family never fails on an event row. No column links a dish
--    or a sign-up to a child, a family's health or a diet (BR115.1, NFR1.3).
-- ---------------------------------------------------------------------------------------------------
create table event_notices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid not null references events (id) on delete cascade,
  position integer not null check (position between 1 and 10),
  text text not null check (char_length(text) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (event_id, position)
);
create index event_notices_event on event_notices (event_id, position);

create table event_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid not null references events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  parent_id uuid,
  person_name text check (person_name is null or char_length(person_name) between 1 and 200),
  is_organiser boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A role holds a parent or a typed name, never both. It may hold neither only after a removal (BR105.1, BR124.1).
  check (not (parent_id is not null and person_name is not null)),
  -- The organiser mark needs a parent (BR106.2).
  check (not is_organiser or parent_id is not null)
);
create index event_roles_event on event_roles (event_id, created_at, id);
create index event_roles_parent on event_roles (parent_id) where parent_id is not null;
create trigger event_roles_touch_version before update on event_roles
  for each row execute function platform_touch_version();

create table event_signups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid not null references events (id) on delete cascade,
  parent_id uuid,
  family_id uuid,
  note text check (note is null or char_length(note) <= 500),
  chosen_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((parent_id is null) = (family_id is null))
);
create index event_signups_event on event_signups (event_id, created_at, id);
create index event_signups_parent on event_signups (event_id, parent_id) where parent_id is not null;
create trigger event_signups_touch_version before update on event_signups
  for each row execute function platform_touch_version();

create table food_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid not null references events (id) on delete cascade,
  parent_id uuid,
  category text not null check (category in
    ('spreads', 'bread', 'free_from', 'savoury', 'sweet', 'drinks', 'vegetables_fruit', 'other')),
  text text not null check (char_length(text) between 1 and 200),
  has_milk boolean not null default false,
  has_egg boolean not null default false,
  has_garlic boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index food_offers_event on food_offers (event_id, category, created_at, id);
create index food_offers_parent on food_offers (event_id, parent_id) where parent_id is not null;
create trigger food_offers_touch_version before update on food_offers
  for each row execute function platform_touch_version();

alter table event_notices enable row level security;
alter table event_roles enable row level security;
alter table event_signups enable row level security;
alter table food_offers enable row level security;
revoke all on event_notices, event_roles, event_signups, food_offers from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 3. The audit action list gains the actions of BR123.1; every earlier action stays valid (NFR4.4).
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
  'event.offer_removed', 'event.name_cleared', 'event.removal_applied'
));

-- ---------------------------------------------------------------------------------------------------
-- 4. The notice registries (C8): the event is something a notice can point to, and the three event notice kinds. The
--    facts function names the event, its dates and its place, and the path of its page, and never a sign-up, an
--    offer or a person (BR117.3, NFR10.1). It answers for a cancelled or finished event too.
-- ---------------------------------------------------------------------------------------------------
create or replace function notice_facts_event(p_target_id uuid, p_parent_id uuid, p_kind text)
returns table (item_name text, item_date date, path text, full_title text, detail text)
language sql stable security definer set search_path from current
as $$
  select e.title,
         (e.starts_at at time zone 'Europe/Budapest')::date,
         '/szulo/esemenyek/' || e.id::text,
         null::text,
         to_char((e.starts_at at time zone 'Europe/Budapest')::date, 'YYYY. MM. DD.')
           || case when (e.ends_at at time zone 'Europe/Budapest')::date
                        <> (e.starts_at at time zone 'Europe/Budapest')::date
                   then ' – ' || to_char((e.ends_at at time zone 'Europe/Budapest')::date, 'MM. DD.')
                   else '' end
           || coalesce(', ' || nullif(e.location, ''), '')
    from events e
    join parents p on p.id = p_parent_id and p.organization_id = e.organization_id
   where e.id = p_target_id
$$;

insert into notice_targets (target_type, facts_function, added_by) values
  ('event', 'notice_facts_event', 'u10-events');

insert into notice_kinds (kind, target_type, title_prefix, label, added_by) values
  ('event_new', 'event', 'Új esemény:', 'Új esemény', 'u10-events'),
  ('event_cancelled', 'event', 'Esemény elmarad:', 'Esemény elmarad', 'u10-events'),
  ('event_changed', 'event', 'Esemény módosult:', 'Esemény módosult', 'u10-events');

-- ---------------------------------------------------------------------------------------------------
-- 5. Helpers. Internal. Each raises through U3R00, so the caller's block answers with the envelope.
-- ---------------------------------------------------------------------------------------------------

-- The event of a community, locked, for a caller who must manage it (BR100.1). For a caller who is not a super admin a
-- missing event and an event out of reach give the same denied result (NFR3.3); an event of another community answers as
-- if it did not exist. A coordinator of the event's group and a super admin pass; a parent marked as organiser, a
-- teacher and a coordinator of another group do not (BR106.2).
create or replace function event_lock_managed(p_event_id uuid, p_org uuid) returns events
language plpgsql security definer set search_path from current
as $$
declare v_event events%rowtype;
begin
  if p_event_id is null then
    perform platform_abort('validation', 'request_invalid');
  end if;
  select * into v_event from events e where e.id = p_event_id and e.organization_id = p_org for update;
  if not found then
    perform platform_deny_unless_super(p_org);
    perform platform_field_invalid('event_id', 'not_found');
  end if;
  if not has_core_scope(p_org, v_event.group_id) then
    perform platform_abort('denied', 'authorization_denied');
  end if;
  return v_event;
end $$;

-- The event of a community, locked, for a parent's command. A missing event and an event of another community give the
-- same denied result.
create or replace function event_lock_for_parent(p_event_id uuid, p_org uuid) returns events
language plpgsql security definer set search_path from current
as $$
declare v_event events%rowtype;
begin
  select * into v_event from events e where e.id = p_event_id and e.organization_id = p_org for update;
  if not found then
    perform platform_abort('denied', 'EVENT_UNAVAILABLE');
  end if;
  return v_event;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 6. event_save (W1, W8, W9; BR100 to BR102, BR117, BR118). The core of 20261047 extended with the new fields, the
--    closed-event rule and the three notices; the wrapper of 20261038 around it is unchanged. The event row is locked
--    before its tasks, and the row is updated once, so the version goes up by one. A new open event tells everyone it
--    concerns except the creator; a cancellation tells the people with a sign-up, an offer or a place on one of its
--    tasks; a change of dates or place of a planned event tells the same people; the title, notices, roles, tale and
--    settings tell nobody. The once key of a cancellation and of a change carries the new version, so a second
--    cancellation after a reopening tells again. A finished event sends nothing; after its end the dates and the
--    status are refused with EVENT_CLOSED (BR101.1, BR117.2).
-- ---------------------------------------------------------------------------------------------------
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
      -- BR117.2: the parents with a sign-up or an offer, and the parents of every family holding a place on a task.
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
-- 7. The notices at the top, replacing the three fixed notes (W2; BR103.1, BR103.2). The caller sends the whole list and
--    the event's version; the access check comes first, then the version, then the list. The old list is replaced in
--    one transaction and the event's version goes up by one, also for a list equal to the stored one.
-- ---------------------------------------------------------------------------------------------------
drop function event_save_notes(text, uuid, integer, text, text, text);

create or replace function event_notices_save(
  p_idempotency_key text, p_event_id uuid, p_expected_version integer, p_notices jsonb
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.notices_save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event events%rowtype;
  v_item jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_event_id::text, p_expected_version::text, coalesce(p_notices::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_event := event_lock_managed(p_event_id, v_org);
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_event.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if p_notices is null or jsonb_typeof(p_notices) <> 'array' then
      perform platform_field_invalid('notices', 'text_invalid');
    end if;
    if jsonb_array_length(p_notices) > 10 then
      perform platform_field_invalid('notices', 'too_many');
    end if;
    for v_item in select value from jsonb_array_elements(p_notices) loop
      if jsonb_typeof(v_item) <> 'string' or char_length(btrim(v_item #>> '{}')) not between 1 and 300 then
        perform platform_field_invalid('notices', 'text_invalid');
      end if;
    end loop;
    perform 1 from event_notices n where n.event_id = p_event_id order by n.id for update;
    delete from event_notices where event_id = p_event_id;
    insert into event_notices (organization_id, event_id, position, text)
    select v_org, p_event_id, t.ordinality::integer, btrim(t.value #>> '{}')
      from jsonb_array_elements(p_notices) with ordinality as t(value, ordinality);
    update events set updated_at = now() where id = p_event_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_event_id);
    return platform_result('success', p_event_id, null) || jsonb_build_object('version', v_event.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 8. The year's tale (W6; BR107.1). Free text up to 5000 characters, empty to clear it. Allowed after the event ended.
-- ---------------------------------------------------------------------------------------------------
create or replace function event_tale_save(
  p_idempotency_key text, p_event_id uuid, p_expected_version integer, p_tale text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.tale_save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event events%rowtype;
  v_tale text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_event_id::text, p_expected_version::text, coalesce(p_tale, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_event := event_lock_managed(p_event_id, v_org);
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_event.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    v_tale := nullif(btrim(coalesce(p_tale, '')), '');
    if char_length(v_tale) > 5000 then
      perform platform_field_invalid('tale');
    end if;
    update events set tale = v_tale where id = p_event_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_event_id);
    return platform_result('success', p_event_id, null) || jsonb_build_object('version', v_event.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 9. Roles and organisers (W5; BR105.1 to BR106.2). A role has a name and exactly one person when it is saved: a parent
--    with an account of the community, or a typed name. The organiser mark needs a parent and gives no right to edit
--    the event (BR106.2); marking and unmarking are audited without names (BR123.1). Up to 20 roles, counted under the
--    event lock. Roles stay changeable after the event ended. Removing a role deletes it.
-- ---------------------------------------------------------------------------------------------------
create or replace function event_role_save(
  p_idempotency_key text, p_event_id uuid, p_role_id uuid, p_expected_version integer,
  p_name text, p_parent_id uuid, p_person_name text, p_is_organiser boolean
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.role_save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event events%rowtype;
  v_role event_roles%rowtype;
  v_name text;
  v_person text;
  v_flag boolean;
  v_was boolean := false;
  v_id uuid;
  v_version integer := 1;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_event_id::text, p_role_id::text, p_expected_version::text, p_name, p_parent_id::text,
              p_person_name, p_is_organiser::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_event := event_lock_managed(p_event_id, v_org);
    if p_role_id is not null then
      select * into v_role from event_roles r where r.id = p_role_id and r.event_id = p_event_id for update;
      if not found then
        perform platform_field_invalid('role_id', 'not_found');
      end if;
      if p_expected_version is null then
        perform platform_field_invalid('expected_version');
      end if;
      if p_expected_version <> v_role.version then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
      v_was := v_role.is_organiser;
    end if;

    v_name := btrim(coalesce(p_name, ''));
    v_person := nullif(btrim(coalesce(p_person_name, '')), '');
    v_flag := coalesce(p_is_organiser, false);
    if char_length(v_name) not between 1 and 100 then
      perform platform_field_invalid('name');
    end if;
    -- Exactly one person (BR105.1).
    if (p_parent_id is not null) = (v_person is not null) then
      perform platform_field_invalid('person', 'person_invalid');
    end if;
    if v_person is not null and char_length(v_person) > 200 then
      perform platform_field_invalid('person_name');
    end if;
    if p_parent_id is not null and not exists (
         select 1 from parents p join families f on f.id = p.family_id and f.status = 'active'
          where p.id = p_parent_id and p.organization_id = v_org and p.status = 'active'
            and p.account_id is not null) then
      perform platform_field_invalid('person', 'person_invalid');
    end if;
    if v_flag and p_parent_id is null then
      perform platform_abort('validation', 'ROLE_ORGANISER_NEEDS_ACCOUNT');
    end if;

    if p_role_id is null then
      perform 1 from event_roles r where r.event_id = p_event_id order by r.id for update;
      if (select count(*) from event_roles r where r.event_id = p_event_id) >= 20 then
        perform platform_field_invalid('roles', 'too_many');
      end if;
      insert into event_roles (organization_id, event_id, name, parent_id, person_name, is_organiser)
      values (v_org, p_event_id, v_name, p_parent_id, v_person, v_flag)
      returning id into v_id;
    else
      update event_roles
         set name = v_name, parent_id = p_parent_id, person_name = v_person, is_organiser = v_flag
       where id = p_role_id;
      v_id := p_role_id;
      v_version := v_role.version + 1;
    end if;
    if v_flag is distinct from v_was then
      perform platform_audit_write(
        case when v_flag then 'event.organiser_marked' else 'event.organiser_unmarked' end,
        'event_role', v_id, v_org, v_event.group_id, 'success', 'event:' || p_event_id::text);
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object('version', v_version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function event_role_remove(p_idempotency_key text, p_role_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.role_remove';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event_id uuid;
  v_event events%rowtype;
  v_role event_roles%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_role_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_role_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    -- The event of a role never changes, so it is read before the lock; the role is read again under it.
    select r.event_id into v_event_id from event_roles r where r.id = p_role_id and r.organization_id = v_org;
    if not found then
      perform platform_deny_unless_super(v_org);
      perform platform_field_invalid('role_id', 'not_found');
    end if;
    v_event := event_lock_managed(v_event_id, v_org);
    select * into v_role from event_roles r where r.id = p_role_id and r.event_id = v_event_id for update;
    if not found then
      perform platform_field_invalid('role_id', 'not_found');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_role.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    delete from event_roles where id = p_role_id;
    if v_role.is_organiser then
      perform platform_audit_write('event.organiser_unmarked', 'event_role', p_role_id, v_org, v_event.group_id,
                                   'success', 'event:' || v_event_id::text);
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_role_id);
    return platform_result('success', p_role_id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- A super admin clears a typed name that refers to a removed person (BR124.2). The decision point comes first, before any
-- lookup; the role then shows korábbi tag. Audited without the name.
create or replace function event_role_clear_name(p_idempotency_key text, p_role_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.role_clear_name';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event_id uuid;
  v_event events%rowtype;
  v_role event_roles%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_role_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    perform platform_deny_unless_super(v_org);
    if p_role_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select r.event_id into v_event_id from event_roles r where r.id = p_role_id and r.organization_id = v_org;
    if not found then
      perform platform_field_invalid('role_id', 'not_found');
    end if;
    v_event := event_lock_managed(v_event_id, v_org);
    select * into v_role from event_roles r where r.id = p_role_id and r.event_id = v_event_id for update;
    if not found then
      perform platform_field_invalid('role_id', 'not_found');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_role.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_role.person_name is null then
      perform platform_abort('validation', 'no_typed_name');
    end if;
    update event_roles set person_name = null where id = p_role_id;
    perform platform_audit_write('event.name_cleared', 'event_role', p_role_id, v_org, v_event.group_id,
                                 'success', 'event:' || v_event_id::text);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_role_id);
    return platform_result('success', p_role_id, null) || jsonb_build_object('version', v_role.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 10. Sign-ups with a note (W4; BR108.1 to BR111.1). A parent with a family signs up for an open event, up to 10 times
--     per event, each with a note and an optional time inside the event. The deadline informs and blocks nothing
--     (BR108.4). A sign-up is not a duty: nothing here calls the eligibility check of C10 (BR112.1), no family row is
--     locked, and no rota, fair-share, standing or reminder function reads the table (BR111.1). Changing needs an open
--     event; withdrawing is allowed on a cancelled or finished one, and a manager of the event may withdraw any.
-- ---------------------------------------------------------------------------------------------------
create or replace function event_signup_add(p_idempotency_key text, p_event_id uuid, p_note text, p_chosen_at timestamptz)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.signup_add';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_family uuid;
  v_event events%rowtype;
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
    concat_ws('|', p_event_id::text, coalesce(p_note, ''), coalesce(p_chosen_at::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := current_parent_id();
    v_family := current_family_id();
    -- A teacher, or a caller with no family, is refused as for every family-based command (BR104.3, BR108.1).
    if v_parent is null or v_family is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    v_event := event_lock_for_parent(p_event_id, v_org);
    if v_event.status <> 'planned' or v_event.ends_at <= now() then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    v_note := nullif(btrim(coalesce(p_note, '')), '');
    if char_length(v_note) > 500 then
      perform platform_field_invalid('note');
    end if;
    if p_chosen_at is not null and (p_chosen_at < v_event.starts_at or p_chosen_at > v_event.ends_at) then
      perform platform_field_invalid('chosen_at', 'outside_event');
    end if;
    -- Counted after the event lock is held, so two requests at once cannot pass the limit together (BR109.2).
    if (select count(*) from event_signups s where s.event_id = p_event_id and s.parent_id = v_parent) >= 10 then
      perform platform_abort('validation', 'EVENT_LIMIT_REACHED');
    end if;
    insert into event_signups (organization_id, event_id, parent_id, family_id, note, chosen_at)
    values (v_org, p_event_id, v_parent, v_family, v_note, p_chosen_at)
    returning id into v_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object('version', 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function event_signup_change(
  p_idempotency_key text, p_signup_id uuid, p_expected_version integer, p_note text, p_chosen_at timestamptz
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.signup_change';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_event_id uuid;
  v_event events%rowtype;
  v_signup event_signups%rowtype;
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
    concat_ws('|', p_signup_id::text, p_expected_version::text, coalesce(p_note, ''), coalesce(p_chosen_at::text, '')),
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
    -- Only the parent who made the sign-up finds it: a real sign-up of another family and a made-up id fail the same
    -- lookup with the same denied result (NFR3.3).
    select s.event_id into v_event_id from event_signups s
     where s.id = p_signup_id and s.organization_id = v_org and s.parent_id = v_parent;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    v_event := event_lock_for_parent(v_event_id, v_org);
    select * into v_signup from event_signups s where s.id = p_signup_id and s.event_id = v_event_id for update;
    if not found then
      -- Withdrawn while this request waited for the lock.
      perform platform_field_invalid('signup_id', 'not_found');
    end if;
    if v_signup.parent_id is distinct from v_parent then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_event.status <> 'planned' or v_event.ends_at <= now() then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_signup.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    v_note := nullif(btrim(coalesce(p_note, '')), '');
    if char_length(v_note) > 500 then
      perform platform_field_invalid('note');
    end if;
    if p_chosen_at is not null and (p_chosen_at < v_event.starts_at or p_chosen_at > v_event.ends_at) then
      perform platform_field_invalid('chosen_at', 'outside_event');
    end if;
    update event_signups set note = v_note, chosen_at = p_chosen_at where id = p_signup_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_signup_id);
    return platform_result('success', p_signup_id, null) || jsonb_build_object('version', v_signup.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function event_signup_withdraw(p_idempotency_key text, p_signup_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.signup_withdraw';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_event_id uuid;
  v_event events%rowtype;
  v_signup event_signups%rowtype;
  v_owner boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_signup_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := current_parent_id();
    -- The event of a sign-up never changes, so it is read before the lock. A made-up id and a sign-up of another
    -- community give the same denied result as one the caller may not touch (NFR3.3, BR110.2).
    select s.event_id into v_event_id from event_signups s where s.id = p_signup_id and s.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    v_event := event_lock_for_parent(v_event_id, v_org);
    select * into v_signup from event_signups s where s.id = p_signup_id and s.event_id = v_event_id for update;
    if not found then
      perform platform_field_invalid('signup_id', 'not_found');
    end if;
    v_owner := v_parent is not null and v_signup.parent_id is not distinct from v_parent;
    if not v_owner and not coalesce(has_core_scope(v_org, v_event.group_id), false) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_signup.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    delete from event_signups where id = p_signup_id;
    if not v_owner then
      perform platform_audit_write('event.signup_removed', 'event_signup', p_signup_id, v_org, v_event.group_id,
                                   'success', 'event:' || v_event_id::text);
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_signup_id);
    return platform_result('success', p_signup_id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 11. Food offers (W7; BR113.1 to BR116.1). One of eight categories, a text and three ingredient ticks that describe
--     the dish only (BR115.1). New offers only while the event is open and its food sign-up is on; changing needs an open
--     event but not the switch; withdrawing is allowed on a closed event and by a manager. Up to 20 per parent and event.
-- ---------------------------------------------------------------------------------------------------
create or replace function food_offer_add(
  p_idempotency_key text, p_event_id uuid, p_category text, p_text text,
  p_has_milk boolean, p_has_egg boolean, p_has_garlic boolean
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.offer_add';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_family uuid;
  v_event events%rowtype;
  v_text text;
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
    concat_ws('|', p_event_id::text, coalesce(p_category, ''), coalesce(p_text, ''),
              coalesce(p_has_milk, false)::text, coalesce(p_has_egg, false)::text, coalesce(p_has_garlic, false)::text),
    'UTF8')), 'hex');
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
    v_event := event_lock_for_parent(p_event_id, v_org);
    if v_event.status <> 'planned' or v_event.ends_at <= now() then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    if not v_event.food_signup_on then
      perform platform_abort('conflict', 'FOOD_SIGNUP_OFF');
    end if;
    if p_category is null or p_category not in
         ('spreads', 'bread', 'free_from', 'savoury', 'sweet', 'drinks', 'vegetables_fruit', 'other') then
      perform platform_field_invalid('category');
    end if;
    v_text := btrim(coalesce(p_text, ''));
    if char_length(v_text) not between 1 and 200 then
      perform platform_field_invalid('text');
    end if;
    if (select count(*) from food_offers o where o.event_id = p_event_id and o.parent_id = v_parent) >= 20 then
      perform platform_abort('validation', 'EVENT_LIMIT_REACHED');
    end if;
    insert into food_offers (organization_id, event_id, parent_id, category, text, has_milk, has_egg, has_garlic)
    values (v_org, p_event_id, v_parent, p_category, v_text, coalesce(p_has_milk, false), coalesce(p_has_egg, false),
            coalesce(p_has_garlic, false))
    returning id into v_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object('version', 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function food_offer_change(
  p_idempotency_key text, p_offer_id uuid, p_expected_version integer, p_category text, p_text text,
  p_has_milk boolean, p_has_egg boolean, p_has_garlic boolean
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.offer_change';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_event_id uuid;
  v_event events%rowtype;
  v_offer food_offers%rowtype;
  v_text text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_offer_id::text, p_expected_version::text, coalesce(p_category, ''), coalesce(p_text, ''),
              coalesce(p_has_milk, false)::text, coalesce(p_has_egg, false)::text, coalesce(p_has_garlic, false)::text),
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
    select o.event_id into v_event_id from food_offers o
     where o.id = p_offer_id and o.organization_id = v_org and o.parent_id = v_parent;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    v_event := event_lock_for_parent(v_event_id, v_org);
    select * into v_offer from food_offers o where o.id = p_offer_id and o.event_id = v_event_id for update;
    if not found then
      perform platform_field_invalid('offer_id', 'not_found');
    end if;
    if v_offer.parent_id is distinct from v_parent then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_event.status <> 'planned' or v_event.ends_at <= now() then
      perform platform_abort('conflict', 'EVENT_CLOSED');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_offer.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if p_category is null or p_category not in
         ('spreads', 'bread', 'free_from', 'savoury', 'sweet', 'drinks', 'vegetables_fruit', 'other') then
      perform platform_field_invalid('category');
    end if;
    v_text := btrim(coalesce(p_text, ''));
    if char_length(v_text) not between 1 and 200 then
      perform platform_field_invalid('text');
    end if;
    update food_offers
       set category = p_category, text = v_text, has_milk = coalesce(p_has_milk, false),
           has_egg = coalesce(p_has_egg, false), has_garlic = coalesce(p_has_garlic, false)
     where id = p_offer_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_offer_id);
    return platform_result('success', p_offer_id, null) || jsonb_build_object('version', v_offer.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function food_offer_withdraw(p_idempotency_key text, p_offer_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.offer_withdraw';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_event_id uuid;
  v_event events%rowtype;
  v_offer food_offers%rowtype;
  v_owner boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_offer_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := current_parent_id();
    select o.event_id into v_event_id from food_offers o where o.id = p_offer_id and o.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    v_event := event_lock_for_parent(v_event_id, v_org);
    select * into v_offer from food_offers o where o.id = p_offer_id and o.event_id = v_event_id for update;
    if not found then
      perform platform_field_invalid('offer_id', 'not_found');
    end if;
    v_owner := v_parent is not null and v_offer.parent_id is not distinct from v_parent;
    if not v_owner and not coalesce(has_core_scope(v_org, v_event.group_id), false) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_offer.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    delete from food_offers where id = p_offer_id;
    if not v_owner then
      perform platform_audit_write('event.offer_removed', 'food_offer', p_offer_id, v_org, v_event.group_id,
                                   'success', 'event:' || v_event_id::text);
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_offer_id);
    return platform_result('success', p_offer_id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 12. The reads (W3; BR104, BR119.1). Every signed-in reader of the community reads every event, a teacher included; a
--     caller outside the community, or with no session, gets a denied refusal and never an empty list (C1). Each read
--     returns one document, so a page needs one call (NFR9.4). The people are built from the display functions of C6
--     only: no contact detail, no child, no sharing choice, and a typed name without a link (NFR1.2). A removed person
--     and a cleared role show korábbi tag. "Open" is planned and not ended; "finished" is ended, whatever the status.
-- ---------------------------------------------------------------------------------------------------
create or replace function event_list(p_past boolean default false) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  -- The default list holds the events that have not ended, soonest start first, a cancelled one marked as such. The past
  -- list holds the ended events, newest end first (BR104.2).
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'title', e.title, 'location', e.location, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
           'status', e.status, 'is_finished', e.ends_at <= now(), 'group_id', e.group_id, 'group_name', g.name)
         order by case when coalesce(p_past, false) then null else e.starts_at end,
                  case when coalesce(p_past, false) then e.ends_at end desc, e.id), '[]'::jsonb)
    into v_items
    from events e left join groups g on g.id = e.group_id
   where e.organization_id = v_org
     and ((coalesce(p_past, false) and e.ends_at <= now()) or (not coalesce(p_past, false) and e.ends_at > now()));
  return platform_result('success', null, null) || jsonb_build_object(
    'items', v_items,
    'caller', jsonb_build_object(
      'can_manage_community', coalesce(has_super_scope(v_org), false),
      'managed_group_ids', to_jsonb(coordination_reach_groups())));
end $$;

-- The same rows for one working group, for its page and for the coordinator's page (C14; BR119.1). A group of another
-- community answers as if it did not exist.
create or replace function event_list_for_group(p_group_id uuid, p_past boolean default false) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  if p_group_id is null or not exists (select 1 from groups g where g.id = p_group_id and g.organization_id = v_org) then
    return platform_result('denied', null, 'GROUP_UNAVAILABLE');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'title', e.title, 'location', e.location, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
           'status', e.status, 'is_finished', e.ends_at <= now(), 'group_id', e.group_id, 'group_name', g.name)
         order by case when coalesce(p_past, false) then null else e.starts_at end,
                  case when coalesce(p_past, false) then e.ends_at end desc, e.id), '[]'::jsonb)
    into v_items
    from events e join groups g on g.id = e.group_id
   where e.organization_id = v_org and e.group_id = p_group_id
     and ((coalesce(p_past, false) and e.ends_at <= now()) or (not coalesce(p_past, false) and e.ends_at > now()));
  return platform_result('success', p_group_id, null) || jsonb_build_object(
    'items', v_items,
    'caller', jsonb_build_object('can_manage', coalesce(can_manage_group(p_group_id), false)));
end $$;

-- One event with its notices, roles, sign-ups and food offers (BR104.1, BR105.2, BR108.3, BR114.1). Each sign-up and
-- offer carries `is_own` and its version, and the caller block says what the caller may do. Nothing in the document links
-- an offer or a tick to a child, a family's health or a diet (BR115.1).
create or replace function event_get(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_event events%rowtype;
  v_group_name text;
  v_parent uuid;
  v_family uuid;
  v_notices jsonb;
  v_roles jsonb;
  v_signups jsonb;
  v_food jsonb;
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
  select g.name into v_group_name from groups g where g.id = v_event.group_id;
  v_parent := current_parent_id();
  v_family := current_family_id();

  select coalesce(jsonb_agg(jsonb_build_object('position', n.position, 'text', n.text) order by n.position), '[]'::jsonb)
    into v_notices from event_notices n where n.event_id = p_event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'name', r.name, 'is_organiser', r.is_organiser, 'version', r.version,
           'kind', case when r.parent_id is not null then 'parent' when r.person_name is not null then 'typed' else 'former' end,
           'parent_id', r.parent_id,
           'display_name', case when r.parent_id is not null then coalesce(parent_display_name(r.parent_id), 'korábbi tag')
                                when r.person_name is not null then r.person_name
                                else 'korábbi tag' end)
         order by r.created_at, r.id), '[]'::jsonb)
    into v_roles from event_roles r where r.event_id = p_event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'parent_display_name', coalesce(parent_display_name(s.parent_id), 'korábbi tag'),
           'family_display_name', coalesce(family_display_name(s.family_id), 'korábbi tag'),
           'note', s.note, 'chosen_at', s.chosen_at, 'version', s.version,
           'is_own', v_parent is not null and s.parent_id is not distinct from v_parent)
         order by s.created_at, s.id), '[]'::jsonb)
    into v_signups from event_signups s where s.event_id = p_event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'category', c.category,
           'offers', coalesce((select jsonb_agg(jsonb_build_object(
                        'id', o.id, 'parent_display_name', coalesce(parent_display_name(o.parent_id), 'korábbi tag'),
                        'text', o.text, 'has_milk', o.has_milk, 'has_egg', o.has_egg, 'has_garlic', o.has_garlic,
                        'version', o.version,
                        'is_own', v_parent is not null and o.parent_id is not distinct from v_parent)
                      order by o.created_at, o.id)
                       from food_offers o where o.event_id = p_event_id and o.category = c.category), '[]'::jsonb))
         order by c.position), '[]'::jsonb)
    into v_food
    from unnest(array['spreads', 'bread', 'free_from', 'savoury', 'sweet', 'drinks', 'vegetables_fruit', 'other'])
         with ordinality as c(category, position);

  return platform_result('success', p_event_id, null) || jsonb_build_object(
    'event', jsonb_build_object(
      'id', v_event.id, 'title', v_event.title, 'location', v_event.location,
      'starts_at', v_event.starts_at, 'ends_at', v_event.ends_at, 'status', v_event.status,
      'is_finished', v_event.ends_at <= now(), 'is_open', v_event.status = 'planned' and v_event.ends_at > now(),
      'group_id', v_event.group_id, 'group_name', v_group_name, 'is_summer', v_event.is_summer,
      'signup_deadline', v_event.signup_deadline, 'notice_lead_days', v_event.notice_lead_days,
      'food_signup_on', v_event.food_signup_on, 'tale', v_event.tale, 'version', v_event.version),
    'notices', v_notices,
    'roles', v_roles,
    'signups', v_signups,
    'food', jsonb_build_object('on', v_event.food_signup_on, 'categories', v_food),
    'caller', jsonb_build_object(
      'can_manage', coalesce(has_core_scope(v_org, v_event.group_id), false),
      'can_sign_up', v_parent is not null and v_family is not null));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 13. Functions for later units. Internal: executable by nobody who is signed in, called by other functions or by the
--     schema owner. They return facts only and write nothing.
--     C13 (BR106.1, BR120.1): the checklist work reads the summer flag, the deadline and the organisers of an event.
--     The organisers are the active super admins who have a parent record (a community event) or the coordinators of the
--     group (a group event), plus every active parent whose role on the event is marked organiser; no duplicates, empty for
--     an unknown event.
-- ---------------------------------------------------------------------------------------------------
create or replace function event_is_summer(p_event_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$ select e.is_summer from events e where e.id = p_event_id $$;

create or replace function event_deadline(p_event_id uuid) returns date
language sql stable security definer set search_path from current
as $$ select e.signup_deadline from events e where e.id = p_event_id $$;

create or replace function event_organisers(p_event_id uuid) returns uuid[]
language sql stable security definer set search_path from current
as $$
  select coalesce(array_agg(o.id order by o.id), '{}'::uuid[])
    from (
      select m.id
        from events e, unnest(group_coordinators(e.group_id)) as m(id)
       where e.id = p_event_id and e.group_id is not null
      union
      select p.id
        from events e
        join app_role_grants g on g.organization_id = e.organization_id and g.role = 'super_admin'
                              and g.scope_type = 'organization' and g.revoked_at is null
        join accounts a on a.id = g.subject_id and a.status = 'active'
        join parents p on p.account_id = a.id and p.status = 'active'
        join families f on f.id = p.family_id and f.status = 'active'
       where e.id = p_event_id and e.group_id is null
      union
      select p.id
        from event_roles r
        join parents p on p.id = r.parent_id and p.status = 'active'
        join families f on f.id = p.family_id and f.status = 'active'
       where r.event_id = p_event_id and r.is_organiser
    ) o
$$;

-- C16 (BR124.1): removing a parent, or a family, anonymises their sign-ups and offers and clears their roles. The rows stay,
-- so the event's history stays whole; the parent and family links go, and the rows show korábbi tag through C6. Roles lose
-- the parent and the organiser mark, and a typed name that equals a removed parent's display name exactly is cleared too.
-- The notes of anonymised sign-ups stay (an open point for U14). The block holds nothing for another subject kind.
create or replace function events_removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_parents uuid[];
  v_family uuid;
  v_names text[];
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
  select coalesce(array_agg(p.display_name), '{}'::text[]) into v_names from parents p where p.id = any (v_parents);
  select (select count(*) from event_signups s
           where s.parent_id = any (v_parents) or (v_family is not null and s.family_id = v_family))
       + (select count(*) from food_offers o where o.parent_id = any (v_parents))
       + (select count(*) from event_roles r
           where r.parent_id = any (v_parents) or r.person_name = any (v_names))
    into v_count;
  return jsonb_build_object('to_clear', v_count, 'to_flag', 0);
end $$;

create or replace function events_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parents uuid[];
  v_family uuid;
  v_names text[];
  v_events uuid[];
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
  select coalesce(array_agg(p.display_name), '{}'::text[]) into v_names from parents p where p.id = any (v_parents);

  -- The events touched, locked ascending; then their roles, sign-ups and offers, each by ascending id (BR122.1).
  select coalesce(array_agg(x.event_id order by x.event_id), '{}'::uuid[]) into v_events
    from (
      select s.event_id from event_signups s
       where s.parent_id = any (v_parents) or (v_family is not null and s.family_id = v_family)
      union
      select o.event_id from food_offers o where o.parent_id = any (v_parents)
      union
      select r.event_id from event_roles r where r.parent_id = any (v_parents) or r.person_name = any (v_names)
    ) x;
  perform 1 from events e where e.id = any (v_events) order by e.id for update;
  perform 1 from event_roles r
   where r.event_id = any (v_events) and (r.parent_id = any (v_parents) or r.person_name = any (v_names))
   order by r.id for update;
  perform 1 from event_signups s
   where s.event_id = any (v_events)
     and (s.parent_id = any (v_parents) or (v_family is not null and s.family_id = v_family))
   order by s.id for update;
  perform 1 from food_offers o where o.event_id = any (v_events) and o.parent_id = any (v_parents) order by o.id for update;

  update event_roles
     set parent_id = null, is_organiser = false,
         person_name = case when person_name = any (v_names) then null else person_name end
   where parent_id = any (v_parents) or person_name = any (v_names);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;
  update event_signups set parent_id = null, family_id = null
   where parent_id = any (v_parents) or (v_family is not null and family_id = v_family);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;
  update food_offers set parent_id = null where parent_id = any (v_parents);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  perform platform_audit_write('event.removal_applied', p_subject_kind, p_subject_id, v_org, null, 'success', null);
  return jsonb_build_object('to_clear', v_count, 'to_flag', 0);
end $$;

-- The removal screen's list for a super admin (BR124.2): the typed names on event roles that do not match the removed
-- person exactly, so the super admin can clear any that refer to them with event_role_clear_name. A caller who is not a
-- super admin gets a denied refusal, never an empty list.
create or replace function event_typed_roles_list(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_names text[];
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if not coalesce(has_super_scope(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_subject_kind = 'parent' then
    select coalesce(array_agg(p.display_name), '{}'::text[]) into v_names
      from parents p where p.id = p_subject_id and p.organization_id = v_org;
  elsif p_subject_kind = 'family' then
    select coalesce(array_agg(p.display_name), '{}'::text[]) into v_names
      from parents p where p.family_id = p_subject_id and p.organization_id = v_org;
  else
    return platform_result('validation', null, 'request_invalid');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'role_id', r.id, 'role_name', r.name, 'person_name', r.person_name, 'version', r.version,
           'event_id', e.id, 'event_title', e.title, 'starts_at', e.starts_at)
         order by e.starts_at, e.id, r.created_at, r.id), '[]'::jsonb)
    into v_items
    from event_roles r join events e on e.id = r.event_id
   where e.organization_id = v_org and r.person_name is not null and not (r.person_name = any (v_names));
  return platform_result('success', p_subject_id, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 14. The teacher schedule shows the name of the event's oldest role, and no person, in place of the typed coordinator
--     name (functional-spec.md, "Conversion of Existing Code"). Otherwise the body of 20261047, unchanged.
-- ---------------------------------------------------------------------------------------------------
create or replace function schedule_get(
  p_scope text, p_group_id uuid default null, p_from text default null, p_to text default null
) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_from date;
  v_to date;
  v_whole boolean;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_scope is null or p_scope not in ('all', 'community', 'group') then
    return platform_result('validation', null, 'request_invalid');
  end if;
  v_org := identity_actor_organization();
  v_whole := has_super_scope(v_org) or has_current_role_scope('kindergarten_teacher', v_org, 'organization', v_org);
  if p_scope = 'group' then
    if p_group_id is null
       or not exists (select 1 from groups g where g.id = p_group_id and g.organization_id = v_org)
       or not (v_whole or has_core_scope(v_org, p_group_id)) then
      return platform_result('denied', null, 'authorization_denied');
    end if;
  elsif not v_whole then
    return platform_result('denied', null, 'authorization_denied');
  end if;

  if nullif(p_from, '') is not null then
    v_from := case when p_from ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then platform_try_date(p_from) end;
    if v_from is null then
      return platform_result('validation', null, 'VAL-DATE-RANGE');
    end if;
  end if;
  if nullif(p_to, '') is not null then
    v_to := case when p_to ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then platform_try_date(p_to) end;
    if v_to is null then
      return platform_result('validation', null, 'VAL-DATE-RANGE');
    end if;
  end if;
  if v_from is not null and v_to is not null and (v_from > v_to or v_to - v_from > 31) then
    return platform_result('validation', null, 'VAL-DATE-RANGE');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'group_id', t.group_id,
           'starts_at', t.starts_at,
           'ends_at', t.ends_at,
           'title', t.title,
           'location', t.location,
           'coordination_display_name',
             (select r.name from event_roles r where r.event_id = e.id order by r.created_at, r.id limit 1),
           'owner_display_name', asg.owner_name,
           'assignee_display_names', coalesce(asg.names, '[]'::jsonb),
           'current_status_label', case
             when t.status = 'cancelled' or e.status = 'cancelled' then 'cancelled'
             when asg.taken >= t.capacity then 'full'
             else 'open' end)
         order by t.starts_at, t.id), '[]'::jsonb)
    into v_items
    from tasks t
    left join events e on e.id = t.event_id
    left join lateral (
      select jsonb_agg(f.display_name order by a.created_at, a.id) as names,
             (array_agg(f.display_name order by a.created_at, a.id))[1] as owner_name,
             count(*) as taken
        from assignments a join families f on f.id = a.family_id
       where a.task_id = t.id and a.status <> 'removed') asg on true
   where t.organization_id = v_org
     and (p_scope = 'all' or (p_scope = 'community' and t.group_id is null) or (p_scope = 'group' and t.group_id = p_group_id))
     and (v_from is null or t.starts_at >= (v_from::timestamp at time zone 'UTC'))
     and (v_to is null or t.starts_at < ((v_to + 1)::timestamp at time zone 'UTC'));
  return platform_result('success', p_group_id, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 15. duty_get no longer reads the three fixed notes. The family holding a place on an event task, and a manager of the
--     event, see the event's notices (the lines at the top of the event) in their place. Otherwise the body of 20261048.
-- ---------------------------------------------------------------------------------------------------
create or replace function duty_get(p_task_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_family uuid;
  v_org uuid;
  v_task tasks%rowtype;
  v_view jsonb;
  v_notices jsonb;
  v_note text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_family := directory_actor_family();
  if v_family is null then
    return platform_result('denied', null, 'no_family');
  end if;
  select f.organization_id into v_org from families f where f.id = v_family;
  select * into v_task from tasks t
   where t.id = p_task_id and t.organization_id = v_org and t.status <> 'cancelled' and t.origin_kind = 'manual';
  if not found then
    return platform_result('validation', null, 'duty_not_found');
  end if;
  v_view := coordination_duty_view(v_task.id, v_family);
  if v_task.event_id is not null
     and (v_view->>'assignment_id' is not null or has_core_scope(v_org, v_task.group_id)) then
    select coalesce(jsonb_agg(n.text order by n.position), '[]'::jsonb) into v_notices
      from event_notices n where n.event_id = v_task.event_id;
  end if;
  if v_view->>'assignment_id' is not null then
    select n.text into v_note from contribution_notes n where n.assignment_id = (v_view->>'assignment_id')::uuid;
  end if;
  return platform_result('success', v_task.id, null)
    || jsonb_build_object('item', v_view || jsonb_build_object(
         'event_notices', v_notices, 'own_contribution_note', v_note));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 16. Function rights (C1, NFR3.7). Every function here starts with no rights. The signed-in commands and reads go to
--     signed-in accounts and check their caller themselves; the facts functions for later units, the removal pair, the
--     helpers and the notice facts function stay with nobody. `create or replace` keeps the grants of the earlier files,
--     so the rights of the three redefined functions are stated again.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  notice_facts_event(uuid, uuid, text),
  event_lock_managed(uuid, uuid),
  event_lock_for_parent(uuid, uuid),
  event_save_core(text, jsonb),
  event_notices_save(text, uuid, integer, jsonb),
  event_tale_save(text, uuid, integer, text),
  event_role_save(text, uuid, uuid, integer, text, uuid, text, boolean),
  event_role_remove(text, uuid, integer),
  event_role_clear_name(text, uuid, integer),
  event_signup_add(text, uuid, text, timestamptz),
  event_signup_change(text, uuid, integer, text, timestamptz),
  event_signup_withdraw(text, uuid, integer),
  food_offer_add(text, uuid, text, text, boolean, boolean, boolean),
  food_offer_change(text, uuid, integer, text, text, boolean, boolean, boolean),
  food_offer_withdraw(text, uuid, integer),
  event_list(boolean),
  event_list_for_group(uuid, boolean),
  event_get(uuid),
  event_is_summer(uuid),
  event_deadline(uuid),
  event_organisers(uuid),
  events_removal_preview(text, uuid),
  events_removal_apply(text, uuid),
  event_typed_roles_list(text, uuid),
  schedule_get(text, uuid, text, text),
  duty_get(uuid)
  from public, anon, authenticated, service_role;

grant execute on function
  event_notices_save(text, uuid, integer, jsonb),
  event_tale_save(text, uuid, integer, text),
  event_role_save(text, uuid, uuid, integer, text, uuid, text, boolean),
  event_role_remove(text, uuid, integer),
  event_role_clear_name(text, uuid, integer),
  event_signup_add(text, uuid, text, timestamptz),
  event_signup_change(text, uuid, integer, text, timestamptz),
  event_signup_withdraw(text, uuid, integer),
  food_offer_add(text, uuid, text, text, boolean, boolean, boolean),
  food_offer_change(text, uuid, integer, text, text, boolean, boolean, boolean),
  food_offer_withdraw(text, uuid, integer),
  event_list(boolean),
  event_list_for_group(uuid, boolean),
  event_get(uuid),
  event_typed_roles_list(text, uuid),
  schedule_get(text, uuid, text, text),
  duty_get(uuid)
  to authenticated;

commit;
