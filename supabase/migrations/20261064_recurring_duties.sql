-- U9 of the Ovis tábla work: duties that repeat. A schedule owned by a group, a family or a rota job; its occurrences
-- created 14 days ahead; the done mark with a 24-hour undo; skipping with a reason; bottle cleaning that follows the water
-- week; the due and overdue notices; and the functions later units call: the reads for the My tasks page, the coordinator
-- page and the duty card, and the removal block (C16)
-- (W1 to W8 of functional-spec.md; BR141 to BR152; contracts C1, C2, C6, C8, C9, C12, C14, C16). The file opens and commits
-- its own transaction, as 20261048 to 20261063 do, because the migration runner adds none: the tables, the registry rows
-- and every function succeed or fail together (NFR7.9). It adds objects and rows only and changes no existing business
-- row; the one existing function it replaces is U5's daily run, which now also stores a short detail line of the check.
--
-- Technical names stay: a schedule is `recurring_schedules`, one due date of it is a `recurring_occurrences` row. An
-- occurrence is its own record and carries its own done mark (ADR-003); no duty or place row is created, so a swap writes
-- nothing of this unit (BR147.2).
--
-- Lock order of every command (scalability-design.md, D-SCAL-1): family, rota week, ..., then the schedule row, then the
-- occurrence rows by ascending id. The schedule and occurrence steps are the last two steps of the C1 order. A command
-- that works on one occurrence reads it without a lock first to find its schedule and owner (the owner of a schedule never
-- changes), locks the family and the rota week when the owner needs them, then the schedule row, then the occurrence, and
-- checks again. The daily check and the removal block take schedules and occurrences ascending and take no family or
-- rota-week lock after a schedule row.
--
-- Refusals are raised through U3R00 and rolled back (C1). Every function pins its search path, starts with `revoke all`
-- and gets an explicit grant or none. The signed-in commands and reads are granted to `authenticated` and check their
-- caller themselves; the daily check, the removal pair, the helpers and the notice facts function are internal.
begin;

-- ---------------------------------------------------------------------------------------------------
-- 1. The two tables. Row-level security on, no policy and no right for any application role: the screens read through
--    the read functions below (NFR1.2). Links to people and families are typed ids with no foreign key (ADR-001),
--    checked inside the functions, so the lifecycle of a parent or family never fails on a row of this unit.
-- ---------------------------------------------------------------------------------------------------
create table recurring_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  category text not null default 'általános' check (char_length(category) between 1 and 100),
  owner_kind text not null check (owner_kind in ('group', 'family', 'rota_week')),
  working_group_id uuid,
  family_id uuid,
  rota_job text check (rota_job in ('indoor_cleaning', 'front_garden', 'water_carrying', 'weekend_animal_care')),
  interval_kind text not null default 'weeks' check (interval_kind in ('weeks', 'rota_weeks')),
  interval_count integer not null check (interval_count between 1 and 52),
  start_date date not null,
  season_from_month integer check (season_from_month between 1 and 12),
  season_to_month integer check (season_to_month between 1 and 12),
  is_active boolean not null default true,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Exactly one owner, of the right kind (BR142.3).
  check ((owner_kind = 'group' and working_group_id is not null and family_id is null and rota_job is null)
      or (owner_kind = 'family' and family_id is not null and working_group_id is null and rota_job is null)
      or (owner_kind = 'rota_week' and rota_job is not null and working_group_id is null and family_id is null)),
  -- Published weeks of a rota job can be counted only for a rota-week owner (BR143.2).
  check (interval_kind <> 'rota_weeks' or owner_kind = 'rota_week'),
  -- A season has both months or none, and does not wrap over New Year (BR142.2).
  check ((season_from_month is null) = (season_to_month is null)),
  check (season_from_month is null or season_from_month <= season_to_month)
);
create index recurring_schedules_owner on recurring_schedules (owner_kind, working_group_id, family_id);
create index recurring_schedules_organization on recurring_schedules (organization_id, is_active);
create trigger recurring_schedules_touch_version before update on recurring_schedules
  for each row execute function platform_touch_version();

create table recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  schedule_id uuid not null references recurring_schedules (id),
  due_date date not null,
  rota_week_id uuid,
  status text not null default 'open' check (status in ('open', 'done', 'skipped')),
  done_by_parent_id uuid,
  done_at timestamptz,
  done_by_removed boolean not null default false,
  skipped_reason text check (skipped_reason is null or char_length(skipped_reason) between 1 and 200),
  skipped_at timestamptz,
  skipped_by_parent_id uuid,
  skipped_by_account_id uuid,
  skipped_by_removed boolean not null default false,
  due_notice_sent_at timestamptz,
  overdue_notice_sent_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One occurrence per schedule and due date: the last guard for two runs at once (NFR5.5).
  unique (schedule_id, due_date),
  -- Open: nothing about a done mark or a skip.
  check (status <> 'open' or (done_by_parent_id is null and done_at is null and not done_by_removed
         and skipped_reason is null and skipped_at is null and skipped_by_parent_id is null
         and skipped_by_account_id is null and not skipped_by_removed)),
  -- Done: the time, and either the person or the removed flag, never both and never neither (D-REL-3).
  check (status <> 'done' or (done_at is not null and (done_by_parent_id is not null) <> done_by_removed
         and skipped_reason is null and skipped_at is null and skipped_by_parent_id is null
         and skipped_by_account_id is null and not skipped_by_removed)),
  -- Skipped: the time, the reason and the account that did it; the person is optional (a super admin may have no parent
  -- record), and the removed flag excludes a person (D-REL-3).
  check (status <> 'skipped' or (skipped_at is not null and skipped_reason is not null
         and skipped_by_account_id is not null and not (skipped_by_removed and skipped_by_parent_id is not null)
         and done_by_parent_id is null and done_at is null and not done_by_removed))
);
create index recurring_occurrences_due_open on recurring_occurrences (due_date) where status = 'open';
create index recurring_occurrences_schedule on recurring_occurrences (schedule_id, due_date);
-- The version moves when the state a screen shows moves; recording that a notice went out does not move it, so a person
-- who has the page open is not sent back to refresh by the daily run.
create function recurring_occurrence_touch() returns trigger
language plpgsql set search_path from current
as $$ begin
  if (new.due_date, new.status, new.done_by_parent_id, new.done_at, new.done_by_removed, new.skipped_reason,
      new.skipped_at, new.skipped_by_parent_id, new.skipped_by_account_id, new.skipped_by_removed, new.rota_week_id)
     is distinct from
     (old.due_date, old.status, old.done_by_parent_id, old.done_at, old.done_by_removed, old.skipped_reason,
      old.skipped_at, old.skipped_by_parent_id, old.skipped_by_account_id, old.skipped_by_removed, old.rota_week_id) then
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end $$;
revoke all on function recurring_occurrence_touch() from public, anon, authenticated, service_role;
create trigger recurring_occurrences_touch_version before update on recurring_occurrences
  for each row execute function recurring_occurrence_touch();

alter table recurring_schedules enable row level security;
alter table recurring_occurrences enable row level security;
revoke all on recurring_schedules, recurring_occurrences from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 2. The audit action list gains the six actions of BR152.1; every earlier action stays valid (NFR4.1).
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
  'recurring_occurrence_undone', 'recurring_occurrence_skipped', 'recurring_removal_applied'
));

-- ---------------------------------------------------------------------------------------------------
-- 3. The daily run keeps a short detail line of a check (D-REL-2): the schedules that failed in a check that went on. The
--    column is new and optional; the function is U5's, replaced with one added column in its record insert and nothing
--    else changed.
-- ---------------------------------------------------------------------------------------------------
alter table timed_check_runs add column detail text check (detail is null or char_length(detail) <= 400);

create or replace function timed_checks_run_system(p_run_kind text, p_moment timestamptz default null)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_run uuid;
  v_moment timestamptz;
  v_check record;
  v_started timestamptz;
  v_result jsonb;
  v_checks jsonb := '[]'::jsonb;
  v_outcome text;
  v_created integer;
  v_skipped integer;
  v_code text;
  v_detail text;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_run_kind is null or p_run_kind not in ('daily', 'friday_noon') then
    return platform_result('validation', null, 'run_kind_invalid');
  end if;
  v_moment := coalesce(p_moment, now());
  insert into timed_runs (run_kind, run_at) values (p_run_kind, v_moment) returning id into v_run;

  for v_check in
    select c.check_name, c.function_name from timed_check_registry c
     where c.run_kind = p_run_kind and c.is_active
     order by c.lock_step, c.check_name
  loop
    v_started := clock_timestamp();
    v_outcome := 'success';
    v_created := 0;
    v_skipped := 0;
    v_code := null;
    v_detail := null;
    if to_regprocedure(format('%I(timestamptz)', v_check.function_name)) is null then
      v_outcome := 'missing';
    else
      begin
        execute format('select %I($1)', v_check.function_name) into v_result using v_moment;
        v_created := coalesce((v_result->>'created')::integer, 0);
        v_skipped := coalesce((v_result->>'skipped')::integer, 0);
        v_detail := left(v_result->>'detail', 400);
      exception when others then
        v_outcome := 'failed';
        v_code := sqlstate;
        v_created := 0;
        v_skipped := 0;
        v_detail := null;
      end;
    end if;
    insert into timed_check_runs (run_id, check_name, run_kind, started_at, outcome, created, skipped, error_code, detail)
    values (v_run, v_check.check_name, p_run_kind, v_started, v_outcome, v_created, v_skipped, v_code, v_detail);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'check', v_check.check_name, 'outcome', v_outcome, 'created', v_created, 'skipped', v_skipped,
      'error_code', v_code, 'detail', v_detail));
  end loop;

  update timed_runs set finished_at = clock_timestamp() where id = v_run;
  return platform_result('success', v_run, null) || jsonb_build_object('checks', v_checks);
end $$;

revoke all on function timed_checks_run_system(text, timestamptz) from public, anon, authenticated, service_role;
grant execute on function timed_checks_run_system(text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------------------------------
-- 4. The notice registries (C8): the occurrence is something a notice can point to, and the two notice kinds. The facts
--    function names the duty and its due date and the path of the page that lists it; it never names a person who marked
--    it, another family or a contact detail (BR149.2, NFR10.1). It answers for the service role too.
-- ---------------------------------------------------------------------------------------------------
create or replace function recurring_notice_facts(p_target_id uuid, p_parent_id uuid, p_kind text)
returns table (item_name text, item_date date, path text, full_title text, detail text)
language sql stable security definer set search_path from current
as $$
  select s.title,
         o.due_date,
         case when s.owner_kind = 'group'
              then '/szulo/munkacsoportok/' || s.working_group_id::text || '/ismetlodo'
              else '/szulo/ismetlodo' end,
         null::text,
         'Esedékes: ' || to_char(o.due_date, 'YYYY. MM. DD.')
    from recurring_occurrences o
    join recurring_schedules s on s.id = o.schedule_id
    join parents p on p.id = p_parent_id and p.organization_id = s.organization_id
   where o.id = p_target_id
$$;

insert into notice_targets (target_type, facts_function, added_by) values
  ('recurring_duty', 'recurring_notice_facts', 'u9-recurring');

insert into notice_kinds (kind, target_type, title_prefix, label, added_by) values
  ('recurring_due', 'recurring_duty', 'Esedékes:', 'Esedékes ismétlődő feladat', 'u9-recurring'),
  ('recurring_overdue', 'recurring_duty', 'Lejárt:', 'Lejárt ismétlődő feladat', 'u9-recurring');

-- ---------------------------------------------------------------------------------------------------
-- 5. The daily check is registered in U5's registry (C9): run kind daily, active, the highest lock step the registry
--    accepts. U5's function is not edited for this; the function itself is defined with the daily check below.
-- ---------------------------------------------------------------------------------------------------
insert into timed_check_registry (check_name, function_name, run_kind, is_active, lock_step, added_by) values
  ('recurring_duties', 'recurring_due_check', 'daily', true, 4, 'u9-recurring');

-- ---------------------------------------------------------------------------------------------------
-- 6. Helpers. Internal. Reach is read live from the grants, the memberships and the published rota, so a right that was
--    lost applies on the next request and nothing about reach is copied onto a row (NFR3.8, NFR3.9).
-- ---------------------------------------------------------------------------------------------------

-- The family of the signed-in parent, or null for a teacher, a super admin with no parent record and a signed-out caller.
create or replace function recurring_caller_family() returns uuid
language sql stable security definer set search_path from current
as $$ select p.family_id from parents p where p.id = identity_linked_parent() $$;

-- An active member or a coordinator of the group, of the caller's own community (C7). A super admin who is neither is not
-- a participant (D-SEC-1).
create or replace function recurring_group_participant(p_group_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce(can_read_community()
    and exists (select 1 from groups g where g.id = p_group_id and g.organization_id = identity_actor_organization())
    and (exists (select 1 from group_memberships m
                  where m.group_id = p_group_id and m.parent_id = identity_linked_parent() and m.status = 'active')
         or has_current_role_scope('group_admin', identity_actor_organization(), 'group', p_group_id)), false)
$$;

-- The family that is responsible for an occurrence now: the owning family, or the family on the rota week at this moment
-- (C12). Null for a group.
create or replace function recurring_holder_family(p_kind text, p_family uuid, p_job text, p_due date) returns uuid
language sql stable security definer set search_path from current
as $$
  select case when p_kind = 'family' then p_family
              when p_kind = 'rota_week' then rota_family_for(p_job, p_due) end
$$;

-- May the caller manage this schedule: the coordinator of its group, or a super admin; a super admin only for a family or
-- a rota job (BR141.1).
create or replace function recurring_can_manage(p_kind text, p_group uuid, p_org uuid) returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce(case when p_kind = 'group' then can_manage_group(p_group)
                       else has_super_scope(p_org) and p_org = identity_actor_organization() end, false)
$$;

-- The fields of a schedule that a screen needs (no person).
create or replace function recurring_schedule_json(s recurring_schedules) returns jsonb
language sql stable set search_path from current
as $$
  select jsonb_build_object(
    'id', s.id, 'title', s.title, 'category', s.category, 'owner_kind', s.owner_kind,
    'working_group_id', s.working_group_id, 'family_id', s.family_id, 'rota_job', s.rota_job,
    'interval_kind', s.interval_kind, 'interval_count', s.interval_count, 'start_date', s.start_date,
    'season_from_month', s.season_from_month, 'season_to_month', s.season_to_month,
    'is_active', s.is_active, 'status', case when s.is_active then 'active' else 'switched_off' end,
    'version', s.version)
$$;

-- One occurrence with what the caller may do. The people are built from the display functions of C6 only: no contact
-- detail, and a removed person shows as korábbi tag. "Overdue" is not stored: it is open with a past due date (BR146.1).
create or replace function recurring_item_json(
  o recurring_occurrences, s recurring_schedules, p_mark boolean, p_manage boolean, p_parent uuid
) returns jsonb
language sql stable security definer set search_path from current
as $$
  select jsonb_build_object(
    'id', o.id, 'schedule_id', s.id, 'title', s.title, 'category', s.category, 'owner_kind', s.owner_kind,
    'working_group_id', s.working_group_id, 'due_date', o.due_date, 'status', o.status,
    'is_overdue', o.status = 'open' and o.due_date < school_today(),
    'version', o.version,
    'done_by_display_name', case when o.status = 'done' then
        case when o.done_by_removed then 'korábbi tag'
             else coalesce(parent_display_name(o.done_by_parent_id), 'korábbi tag') end end,
    'done_at', o.done_at,
    'skipped_reason', o.skipped_reason,
    'skipped_by_display_name', case when o.status = 'skipped' then
        case when o.skipped_by_removed then 'korábbi tag'
             when o.skipped_by_parent_id is not null then coalesce(parent_display_name(o.skipped_by_parent_id), 'korábbi tag')
             else 'adminisztrátor' end end,
    'can_mark_done', o.status = 'open' and p_mark,
    'can_undo', o.status = 'done' and now() < o.done_at + interval '24 hours'
                and (p_manage or (p_parent is not null and o.done_by_parent_id = p_parent)),
    'can_skip', o.status = 'open' and p_manage)
$$;

-- ---------------------------------------------------------------------------------------------------
-- 7. The reads (W2, W3, W8; BR146.1, BR146.3, BR147.2, BR150). A group's duties are read by every signed-in reader of the
--    community, a teacher included; family and rota-week duties by the parents of the owning family and by super admins.
--    A caller with no access, an unknown id and an id of another community get the same denied refusal and never an empty
--    list (C1, NFR4.9). Each read returns one document, so a page needs one call (NFR9.4). The current list holds open
--    occurrences up to 60 days overdue and finished ones of the last 14 days; the rest is history (BR146.3).
-- ---------------------------------------------------------------------------------------------------
create or replace function recurring_list_for_group(p_group_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_group groups%rowtype;
  v_parent uuid;
  v_mark boolean;
  v_manage boolean;
  v_today date := school_today();
  v_schedules jsonb;
  v_items jsonb;
  v_history jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select * into v_group from groups g where g.id = p_group_id and g.organization_id = v_org;
  if not found then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_parent := identity_linked_parent();
  v_mark := recurring_group_participant(p_group_id);
  v_manage := can_manage_group(p_group_id);
  select coalesce(jsonb_agg(recurring_schedule_json(s) order by s.category, s.title, s.id), '[]'::jsonb) into v_schedules
    from recurring_schedules s
   where s.owner_kind = 'group' and s.working_group_id = p_group_id and s.organization_id = v_org;
  select coalesce(jsonb_agg(recurring_item_json(o, s, v_mark, v_manage, v_parent) order by o.due_date, s.title, o.id),
                  '[]'::jsonb) into v_items
    from recurring_occurrences o join recurring_schedules s on s.id = o.schedule_id
   where s.owner_kind = 'group' and s.working_group_id = p_group_id and s.organization_id = v_org
     and ((o.status = 'open' and o.due_date >= v_today - 60) or (o.status <> 'open' and o.due_date >= v_today - 14));
  select coalesce(jsonb_agg(h.item order by h.due_date desc, h.id), '[]'::jsonb) into v_history
    from (select o.due_date, o.id, recurring_item_json(o, s, false, false, v_parent) as item
            from recurring_occurrences o join recurring_schedules s on s.id = o.schedule_id
           where s.owner_kind = 'group' and s.working_group_id = p_group_id and s.organization_id = v_org
             and not ((o.status = 'open' and o.due_date >= v_today - 60) or (o.status <> 'open' and o.due_date >= v_today - 14))
           order by o.due_date desc, o.id
           limit 50) h;
  return platform_result('success', p_group_id, null) || jsonb_build_object(
    'group', jsonb_build_object('id', v_group.id, 'name', v_group.name, 'status', v_group.status),
    'schedules', v_schedules, 'items', v_items, 'history', v_history,
    'caller', jsonb_build_object('can_manage', coalesce(v_manage, false), 'can_mark', coalesce(v_mark, false)));
end $$;

-- One occurrence with its schedule and what the caller may do (W3, W4).
create or replace function recurring_occurrence_get(p_occurrence_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_o recurring_occurrences%rowtype;
  v_s recurring_schedules%rowtype;
  v_family uuid;
  v_holder uuid;
  v_mark boolean;
  v_manage boolean;
  v_super boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select o.* into v_o from recurring_occurrences o where o.id = p_occurrence_id and o.organization_id = v_org;
  if not found then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_s from recurring_schedules s where s.id = v_o.schedule_id;
  v_family := recurring_caller_family();
  v_super := coalesce(has_super_scope(v_org), false);
  v_holder := recurring_holder_family(v_s.owner_kind, v_s.family_id, v_s.rota_job, v_o.due_date);
  if v_s.owner_kind <> 'group' and not (v_super or (v_family is not null and v_family = v_holder)) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_mark := case when v_s.owner_kind = 'group' then recurring_group_participant(v_s.working_group_id)
                 else v_family is not null and v_family = v_holder end;
  v_manage := recurring_can_manage(v_s.owner_kind, v_s.working_group_id, v_org);
  return platform_result('success', p_occurrence_id, null) || jsonb_build_object(
    'item', recurring_item_json(v_o, v_s, coalesce(v_mark, false), coalesce(v_manage, false), identity_linked_parent()),
    'schedule', recurring_schedule_json(v_s));
end $$;

-- The caller's own duties: the family's, the rota weeks the family holds now, and the duties of the groups the caller
-- belongs to or coordinates (W8; BR150.1). A caller with no parent record has none and is refused.
create or replace function recurring_my_occurrences() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parent uuid;
  v_family uuid;
  v_today date := school_today();
  v_groups uuid[];
  v_coordinated uuid[];
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_parent := identity_linked_parent();
  v_family := recurring_caller_family();
  if not can_read_community() or v_parent is null or v_family is null then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select coalesce(array_agg(g.id order by g.id), '{}'::uuid[]) into v_coordinated
    from groups g
   where g.organization_id = v_org and g.status = 'active'
     and has_current_role_scope('group_admin', v_org, 'group', g.id);
  select coalesce(array_agg(x.group_id order by x.group_id), '{}'::uuid[]) into v_groups
    from (select m.group_id from group_memberships m join groups g on g.id = m.group_id
           where m.parent_id = v_parent and m.status = 'active' and g.status = 'active' and g.organization_id = v_org
          union select unnest(v_coordinated)) x;
  select coalesce(jsonb_agg(m.item order by m.due_date, m.title, m.id), '[]'::jsonb) into v_items
    from (
      select o.due_date, s.title, o.id,
             recurring_item_json(o, s, true, s.owner_kind = 'group' and s.working_group_id = any (v_coordinated), v_parent)
             || jsonb_build_object('group_name', (select g.name from groups g where g.id = s.working_group_id)) as item
        from recurring_occurrences o join recurring_schedules s on s.id = o.schedule_id
       where s.organization_id = v_org
         and ((s.owner_kind = 'family' and s.family_id = v_family)
              or (s.owner_kind = 'rota_week' and rota_family_for(s.rota_job, o.due_date) = v_family)
              or (s.owner_kind = 'group' and s.working_group_id = any (v_groups)))
         and ((o.status = 'open' and o.due_date >= v_today - 60) or (o.status <> 'open' and o.due_date >= v_today - 14))
    ) m;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- The duty card of a rota-week duty: the occurrences that belong to its week, for the family that holds the week now and
-- for super admins (W5, BR147.2). The holder is read live (C12), so after a swap, a cancellation or a reassignment the new
-- holder sees the line and the previous one is refused. Anything that is not a rota-week duty of the caller's reach is the
-- same denied refusal.
create or replace function recurring_bottle_for_duty(p_duty_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_task tasks%rowtype;
  v_week rota_weeks%rowtype;
  v_holder uuid;
  v_family uuid;
  v_super boolean;
  v_mark boolean;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select * into v_task from tasks t where t.id = p_duty_id and t.organization_id = v_org and t.origin_kind = 'rota_week';
  if not found then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_week from rota_weeks w where w.id = v_task.origin_id and w.organization_id = v_org;
  if not found then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_holder := rota_family_for(v_week.job, v_week.week_start);
  v_family := recurring_caller_family();
  v_super := coalesce(has_super_scope(v_org), false);
  if not (v_super or (v_family is not null and v_family = v_holder)) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_mark := v_family is not null and v_family = v_holder;
  select coalesce(jsonb_agg(recurring_item_json(o, s, v_mark, v_super, identity_linked_parent()) order by s.title, o.id),
                  '[]'::jsonb) into v_items
    from recurring_occurrences o join recurring_schedules s on s.id = o.schedule_id
   where s.organization_id = v_org and s.owner_kind = 'rota_week' and s.rota_job = v_week.job
     and o.due_date = v_week.week_start;
  return platform_result('success', p_duty_id, null) || jsonb_build_object('items', v_items);
end $$;

-- The coordinator page's list (C14): id, title and status of a group's schedules, answered only to a caller who may manage
-- the group (BR150.2).
create or replace function recurring_list(p_group_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_group_id is null or not can_manage_group(p_group_id) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title,
           'status', case when s.is_active then 'active' else 'switched_off' end) order by s.category, s.title, s.id),
         '[]'::jsonb) into v_items
    from recurring_schedules s
   where s.owner_kind = 'group' and s.working_group_id = p_group_id and s.organization_id = identity_actor_organization();
  return platform_result('success', p_group_id, null) || jsonb_build_object('items', v_items);
end $$;

-- One schedule for the form. A group's schedule is read by every signed-in reader (the group page is community-wide); a
-- family's or a rota job's by super admins only.
create or replace function recurring_schedule_get(p_schedule_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_s recurring_schedules%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select * into v_s from recurring_schedules s where s.id = p_schedule_id and s.organization_id = v_org;
  if not found or (v_s.owner_kind <> 'group' and not coalesce(has_super_scope(v_org), false)) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  return platform_result('success', p_schedule_id, null) || jsonb_build_object(
    'schedule', recurring_schedule_json(v_s),
    'caller', jsonb_build_object('can_manage', coalesce(recurring_can_manage(v_s.owner_kind, v_s.working_group_id, v_org), false)));
end $$;

-- The schedules of families and rota jobs, for super admins (the admin menu and the school calendar page).
create or replace function recurring_list_admin() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if not coalesce(has_super_scope(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select coalesce(jsonb_agg(recurring_schedule_json(s)
           || jsonb_build_object('family_display_name', case when s.family_id is not null then family_display_name(s.family_id) end)
           order by s.owner_kind, s.title, s.id), '[]'::jsonb) into v_items
    from recurring_schedules s
   where s.organization_id = v_org and s.owner_kind <> 'group';
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 8. Function rights (C1, NFR3.7). Every function starts with no rights. The reads go to signed-in accounts and check
--    their caller themselves; the helpers and the notice facts function stay with nobody.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  recurring_notice_facts(uuid, uuid, text),
  recurring_caller_family(),
  recurring_group_participant(uuid),
  recurring_holder_family(text, uuid, text, date),
  recurring_can_manage(text, uuid, uuid),
  recurring_schedule_json(recurring_schedules),
  recurring_item_json(recurring_occurrences, recurring_schedules, boolean, boolean, uuid),
  recurring_list_for_group(uuid),
  recurring_occurrence_get(uuid),
  recurring_my_occurrences(),
  recurring_bottle_for_duty(uuid),
  recurring_list(uuid),
  recurring_schedule_get(uuid),
  recurring_list_admin()
  from public, anon, authenticated, service_role;

grant execute on function
  recurring_list_for_group(uuid),
  recurring_occurrence_get(uuid),
  recurring_my_occurrences(),
  recurring_bottle_for_duty(uuid),
  recurring_list(uuid),
  recurring_schedule_get(uuid),
  recurring_list_admin()
  to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 9. The due dates of a schedule and the creation of its occurrences (BR143.1 to BR143.3). Due dates come from the
--    schedule alone, never from a done mark: for calendar weeks the start date plus whole multiples of the interval; for a
--    rota job the published weeks of that job in date order, numbered from 1 for the first week on or after the start date
--    inside each published plan (so the count starts again with a new school year), where the week is due when its number
--    minus 1 divides by the interval. Break weeks have no rota rows and so do not count; a week nobody holds is counted
--    and gets no occurrence. A due date outside the season has no occurrence and moves no other date. Internal.
-- ---------------------------------------------------------------------------------------------------
create or replace function recurring_due_dates(p_s recurring_schedules, p_from date, p_to date)
returns table (due_date date, rota_week_id uuid)
language sql stable security definer set search_path from current
as $$
  select d.due, null::uuid
    from (select p_s.start_date + (k * 7 * p_s.interval_count) as due
            from generate_series(
                   greatest(0, ceil((p_from - p_s.start_date)::numeric / (7 * p_s.interval_count))::integer),
                   floor((p_to - p_s.start_date)::numeric / (7 * p_s.interval_count))::integer) k) d
   where p_s.interval_kind = 'weeks' and d.due between p_from and p_to
     and (p_s.season_from_month is null
          or extract(month from d.due) between p_s.season_from_month and p_s.season_to_month)
  union all
  select w.week_start, w.id
    from (select rw.id, rw.week_start, rw.family_id,
                 row_number() over (partition by rp.id order by rw.week_start) as n
            from rota_weeks rw join rota_plans rp on rp.id = rw.plan_id and rp.status = 'published'
           where p_s.interval_kind = 'rota_weeks' and rw.job = p_s.rota_job
             and rw.organization_id = p_s.organization_id and rw.week_start >= p_s.start_date) w
   where (w.n - 1) % p_s.interval_count = 0 and w.week_start between p_from and p_to
     and w.family_id is not null
     and (p_s.season_from_month is null
          or extract(month from w.week_start) between p_s.season_from_month and p_s.season_to_month)
$$;

-- Creates the missing occurrences of an active schedule between two dates and returns how many it made. A second call,
-- or a call racing with another, makes nothing twice: the unique key on schedule and due date is the last guard (NFR5.5).
create or replace function recurring_create_occurrences(p_schedule_id uuid, p_from date, p_to date) returns integer
language plpgsql security definer set search_path from current
as $$
declare
  v_s recurring_schedules%rowtype;
  v_n integer;
begin
  select * into v_s from recurring_schedules s where s.id = p_schedule_id;
  if not found or not v_s.is_active then
    return 0;
  end if;
  insert into recurring_occurrences (organization_id, schedule_id, due_date, rota_week_id)
  select v_s.organization_id, v_s.id, d.due_date, d.rota_week_id
    from recurring_due_dates(v_s, p_from, p_to) d
   order by d.due_date
  on conflict (schedule_id, due_date) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 10. Save and switch on or off (W1; BR141, BR142, BR144, BR147.1). A coordinator saves the schedules of their own group
--     and a super admin all schedules; a family's or a rota job's schedule is a super admin's only. The owner of an
--     existing schedule is never changed. Saving a change to the interval, the start or the season removes the later open
--     occurrences nobody was told about and makes today's, in the same transaction, and the daily run makes the rest.
--     Switching off skips the later open occurrences with the fixed reason "kikapcsolva". Lock order: the family when the
--     owner is one, then the schedule row, then its occurrence rows ascending. Each command writes one audit entry in the
--     same transaction, holding the action, the actor and the schedule id and never a title or a reason.
-- ---------------------------------------------------------------------------------------------------
create or replace function recurring_schedule_save(
  p_idempotency_key text, p_schedule_id uuid, p_expected_version integer,
  p_title text, p_category text,
  p_owner_kind text, p_working_group_id uuid, p_family_id uuid, p_rota_job text,
  p_interval_count integer, p_start_date date, p_season_from integer, p_season_to integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'recurring.schedule_save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_super boolean;
  v_today date := school_today();
  v_existing recurring_schedules%rowtype;
  v_s recurring_schedules%rowtype;
  v_kind text;
  v_group uuid;
  v_family uuid;
  v_job text;
  v_group_row groups%rowtype;
  v_title text;
  v_category text;
  v_changed boolean;
  v_id uuid;
  v_new_version integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', coalesce(p_schedule_id::text, ''),
    coalesce(p_expected_version::text, ''), coalesce(p_title, ''), coalesce(p_category, ''),
    coalesce(p_owner_kind, ''), coalesce(p_working_group_id::text, ''), coalesce(p_family_id::text, ''),
    coalesce(p_rota_job, ''), coalesce(p_interval_count::text, ''), coalesce(p_start_date::text, ''),
    coalesce(p_season_from::text, ''), coalesce(p_season_to::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_super := coalesce(has_super_scope(v_org), false);
    -- Which schedule and which owner: an existing schedule keeps its owner for good (BR142.3).
    if p_schedule_id is not null then
      select * into v_existing from recurring_schedules s where s.id = p_schedule_id and s.organization_id = v_org;
      if not found then
        if not v_super then
          perform platform_abort('denied', 'authorization_denied');
        end if;
        perform platform_field_invalid('schedule_id', 'not_found');
      end if;
      v_kind := v_existing.owner_kind;
      v_group := v_existing.working_group_id;
      v_family := v_existing.family_id;
      v_job := v_existing.rota_job;
    else
      v_kind := p_owner_kind;
      v_group := p_working_group_id;
      v_family := p_family_id;
      v_job := p_rota_job;
    end if;
    -- Reach first (BR141.1), so a caller who may not touch the schedule learns nothing else about it.
    if v_kind = 'group' then
      select * into v_group_row from groups g where g.id = v_group and g.organization_id = v_org;
      if not found then
        if not v_super then
          perform platform_abort('denied', 'authorization_denied');
        end if;
        perform platform_field_invalid('owner', 'not_found');
      end if;
      if not can_manage_group(v_group) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
    else
      if not v_super then
        perform platform_abort('denied', 'authorization_denied');
      end if;
      if v_kind is null or v_kind not in ('family', 'rota_week') then
        perform platform_field_invalid('owner_kind');
      end if;
    end if;
    -- The owner of a new schedule must fit its kind; an existing one cannot change owner (BR142.3).
    if p_schedule_id is not null then
      if (p_owner_kind is not null and p_owner_kind <> v_kind)
         or (p_working_group_id is not null and p_working_group_id is distinct from v_group)
         or (p_family_id is not null and p_family_id is distinct from v_family)
         or (p_rota_job is not null and p_rota_job is distinct from v_job) then
        perform platform_field_invalid('owner', 'cannot_change');
      end if;
    elsif v_kind = 'group' then
      if v_group_row.status <> 'active' or v_family is not null or v_job is not null then
        perform platform_field_invalid('owner', case when v_group_row.status <> 'active' then 'archived' else 'invalid' end);
      end if;
    elsif v_kind = 'family' then
      if v_family is null or v_group is not null or v_job is not null then
        perform platform_field_invalid('owner', 'invalid');
      end if;
    else
      if v_job is null or v_job not in ('indoor_cleaning', 'front_garden', 'water_carrying', 'weekend_animal_care')
         or v_group is not null or v_family is not null then
        perform platform_field_invalid('owner', 'invalid');
      end if;
    end if;
    -- The family first when the owner is one (the C1 order), then the schedule row.
    if v_kind = 'family' then
      perform 1 from families f
       where f.id = v_family and f.organization_id = v_org
         and (p_schedule_id is not null or (f.status = 'active' and f.anonymized_at is null))
         for update;
      if not found then
        perform platform_field_invalid('owner', 'not_found');
      end if;
    end if;
    if p_schedule_id is not null then
      select * into v_s from recurring_schedules s where s.id = p_schedule_id for update;
      if p_expected_version is null then
        perform platform_field_invalid('expected_version');
      end if;
      if p_expected_version <> v_s.version then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
    end if;

    v_title := btrim(coalesce(p_title, ''));
    v_category := coalesce(nullif(btrim(coalesce(p_category, '')), ''), 'általános');
    if char_length(v_title) not between 1 and 200 then
      perform platform_field_invalid('title');
    end if;
    if char_length(v_category) > 100 then
      perform platform_field_invalid('category');
    end if;
    if p_interval_count is null or p_interval_count not between 1 and 52 then
      perform platform_field_invalid('interval');
    end if;
    if p_start_date is null then
      perform platform_field_invalid('start_date');
    end if;
    if (p_season_from is null) <> (p_season_to is null)
       or (p_season_from is not null and (p_season_from not between 1 and 12 or p_season_to not between 1 and 12
                                          or p_season_from > p_season_to)) then
      perform platform_field_invalid('season');
    end if;

    if p_schedule_id is null then
      insert into recurring_schedules (organization_id, title, category, owner_kind, working_group_id, family_id,
                                       rota_job, interval_kind, interval_count, start_date, season_from_month,
                                       season_to_month)
      values (v_org, v_title, v_category, v_kind, v_group, v_family, v_job,
              case when v_kind = 'rota_week' then 'rota_weeks' else 'weeks' end,
              p_interval_count, p_start_date, p_season_from, p_season_to)
      returning id into v_id;
      v_new_version := 1;
      perform recurring_create_occurrences(v_id, v_today, v_today);
    else
      v_id := p_schedule_id;
      v_changed := v_s.interval_count <> p_interval_count or v_s.start_date <> p_start_date
                   or v_s.season_from_month is distinct from p_season_from
                   or v_s.season_to_month is distinct from p_season_to;
      update recurring_schedules
         set title = v_title, category = v_category, interval_count = p_interval_count, start_date = p_start_date,
             season_from_month = p_season_from, season_to_month = p_season_to
       where id = v_id
       returning version into v_new_version;
      if v_changed then
        -- Later open occurrences nobody was told about go, and today's is made by the new rule (BR144.1).
        perform 1 from recurring_occurrences o
         where o.schedule_id = v_id and o.status = 'open' and o.due_date > v_today
           and o.due_notice_sent_at is null and o.overdue_notice_sent_at is null
         order by o.id for update;
        delete from recurring_occurrences o
         where o.schedule_id = v_id and o.status = 'open' and o.due_date > v_today
           and o.due_notice_sent_at is null and o.overdue_notice_sent_at is null;
        perform recurring_create_occurrences(v_id, v_today, v_today);
      end if;
    end if;
    perform platform_audit_write('recurring_schedule_saved', 'recurring_schedule', v_id, v_org, v_group, 'success', null);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object('version', v_new_version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function recurring_schedule_set_active(
  p_idempotency_key text, p_schedule_id uuid, p_expected_version integer, p_active boolean
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'recurring.schedule_set_active';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_today date := school_today();
  v_existing recurring_schedules%rowtype;
  v_s recurring_schedules%rowtype;
  v_new_version integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', coalesce(p_schedule_id::text, ''),
    coalesce(p_expected_version::text, ''), coalesce(p_active::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    select * into v_existing from recurring_schedules s where s.id = p_schedule_id and s.organization_id = v_org;
    if not found or not recurring_can_manage(v_existing.owner_kind, v_existing.working_group_id, v_org) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_active is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    if v_existing.owner_kind = 'family' then
      perform 1 from families f where f.id = v_existing.family_id for update;
    end if;
    select * into v_s from recurring_schedules s where s.id = p_schedule_id for update;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_s.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_s.is_active = p_active then
      -- Already in the wanted state: nothing to change, nothing to audit.
      perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_schedule_id);
      return platform_result('success', p_schedule_id, null) || jsonb_build_object('version', v_s.version);
    end if;
    if not p_active then
      -- The later open occurrences are skipped with the fixed reason; the caller is the one who skipped them (BR144.2).
      perform 1 from recurring_occurrences o
       where o.schedule_id = p_schedule_id and o.status = 'open' and o.due_date > v_today
       order by o.id for update;
      update recurring_occurrences o
         set status = 'skipped', skipped_reason = 'kikapcsolva', skipped_at = now(),
             skipped_by_account_id = platform_actor_account(), skipped_by_parent_id = identity_linked_parent()
       where o.schedule_id = p_schedule_id and o.status = 'open' and o.due_date > v_today;
    end if;
    update recurring_schedules set is_active = p_active where id = p_schedule_id returning version into v_new_version;
    perform platform_audit_write('recurring_schedule_set_active', 'recurring_schedule', p_schedule_id, v_org,
                                 v_existing.working_group_id, 'success', case when p_active then 'on' else 'off' end);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_schedule_id);
    return platform_result('success', p_schedule_id, null) || jsonb_build_object('version', v_new_version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

revoke all on function
  recurring_due_dates(recurring_schedules, date, date),
  recurring_create_occurrences(uuid, date, date),
  recurring_schedule_save(text, uuid, integer, text, text, text, uuid, uuid, text, integer, date, integer, integer),
  recurring_schedule_set_active(text, uuid, integer, boolean)
  from public, anon, authenticated, service_role;

grant execute on function
  recurring_schedule_save(text, uuid, integer, text, text, text, uuid, uuid, text, integer, date, integer, integer),
  recurring_schedule_set_active(text, uuid, integer, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 8. The three occurrence commands (W3, W4, W5; BR145, BR146, BR147.2; NFR3.5, NFR3.8, NFR4.1, NFR5.1, NFR5.4).
--    Reach is read live on every request. A caller with no right, an unknown id and an id of another community get the same
--    denied refusal. The lock order is the family (the owner, or the holder of the rota week), then the occurrence; the
--    holder is read before the lock and again after it, so a swap that moved the week in between is a conflict, not a
--    mark by the wrong family (D-SEC-1, C12).
-- ---------------------------------------------------------------------------------------------------

-- What the caller may do with one occurrence, read without a lock: null when it does not exist in the caller's community.
create or replace function recurring_occurrence_access(p_occurrence_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid := identity_actor_organization();
  v_o recurring_occurrences%rowtype;
  v_s recurring_schedules%rowtype;
  v_parent uuid := identity_linked_parent();
  v_family uuid := recurring_caller_family();
  v_holder uuid;
  v_mark boolean;
begin
  select o.* into v_o from recurring_occurrences o where o.id = p_occurrence_id and o.organization_id = v_org;
  if not found then
    return null;
  end if;
  select * into v_s from recurring_schedules s where s.id = v_o.schedule_id;
  v_holder := recurring_holder_family(v_s.owner_kind, v_s.family_id, v_s.rota_job, v_o.due_date);
  v_mark := coalesce(v_parent is not null and can_read_community()
    and case when v_s.owner_kind = 'group' then recurring_group_participant(v_s.working_group_id)
             else v_family is not null and v_family = v_holder end, false);
  return jsonb_build_object(
    'owner_kind', v_s.owner_kind, 'working_group_id', v_s.working_group_id, 'rota_job', v_s.rota_job,
    'due_date', v_o.due_date, 'holder_family', v_holder, 'mark', v_mark,
    'manage', coalesce(recurring_can_manage(v_s.owner_kind, v_s.working_group_id, v_org), false),
    'marker', v_o.status = 'done' and not v_o.done_by_removed and v_parent is not null
              and v_o.done_by_parent_id = v_parent);
end $$;

-- Locks the family that decides the right (the owner or the holder), then re-reads the holder of a rota week. A holder that
-- changed while the caller waited is a conflict for a caller whose right came from being that family (C12).
create or replace function recurring_lock_holder(p_access jsonb, p_depends boolean) returns void
language plpgsql security definer set search_path from current
as $$
begin
  if p_access->>'holder_family' is null then
    return;
  end if;
  perform 1 from families f where f.id = (p_access->>'holder_family')::uuid for update;
  if p_depends and p_access->>'owner_kind' = 'rota_week'
     and rota_family_for(p_access->>'rota_job', (p_access->>'due_date')::date)
         is distinct from (p_access->>'holder_family')::uuid then
    perform platform_abort('conflict', 'VERSION_CONFLICT');
  end if;
end $$;

create or replace function recurring_occurrence_mark_done(
  p_idempotency_key text, p_occurrence_id uuid, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'recurring.occurrence_mark_done';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_a jsonb;
  v_o recurring_occurrences%rowtype;
  v_new_version integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', coalesce(p_occurrence_id::text, ''),
    coalesce(p_expected_version::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_a := recurring_occurrence_access(p_occurrence_id);
    if v_a is null or not (v_a->>'mark')::boolean then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    perform recurring_lock_holder(v_a, true);
    select * into v_o from recurring_occurrences o where o.id = p_occurrence_id for update;
    if not found then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if p_expected_version <> v_o.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_o.status <> 'open' then
      perform platform_abort('conflict', 'RECURRING_CLOSED');
    end if;
    update recurring_occurrences
       set status = 'done', done_by_parent_id = identity_linked_parent(), done_at = now(), done_by_removed = false
     where id = p_occurrence_id returning version into v_new_version;
    perform platform_audit_write('recurring_occurrence_done', 'recurring_occurrence', p_occurrence_id, v_org,
                                 (v_a->>'working_group_id')::uuid, 'success', null);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_occurrence_id);
    return platform_result('success', p_occurrence_id, null) || jsonb_build_object('version', v_new_version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function recurring_occurrence_undo_done(
  p_idempotency_key text, p_occurrence_id uuid, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'recurring.occurrence_undo_done';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_a jsonb;
  v_manage boolean;
  v_o recurring_occurrences%rowtype;
  v_new_version integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', coalesce(p_occurrence_id::text, ''),
    coalesce(p_expected_version::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_a := recurring_occurrence_access(p_occurrence_id);
    v_manage := coalesce((v_a->>'manage')::boolean, false);
    -- The coordinator or a super admin, or the person who marked it while they still belong to it (BR146.2).
    if v_a is null or not (v_manage or ((v_a->>'marker')::boolean and (v_a->>'mark')::boolean)) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    perform recurring_lock_holder(v_a, not v_manage);
    select * into v_o from recurring_occurrences o where o.id = p_occurrence_id for update;
    if not found then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if p_expected_version <> v_o.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_o.status <> 'done' then
      perform platform_abort('conflict', 'RECURRING_CLOSED');
    end if;
    if now() >= v_o.done_at + interval '24 hours' then
      perform platform_abort('conflict', 'RECURRING_UNDO_TOO_LATE');
    end if;
    update recurring_occurrences
       set status = 'open', done_by_parent_id = null, done_at = null, done_by_removed = false
     where id = p_occurrence_id returning version into v_new_version;
    perform platform_audit_write('recurring_occurrence_undone', 'recurring_occurrence', p_occurrence_id, v_org,
                                 (v_a->>'working_group_id')::uuid, 'success', null);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_occurrence_id);
    return platform_result('success', p_occurrence_id, null) || jsonb_build_object('version', v_new_version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function recurring_occurrence_skip(
  p_idempotency_key text, p_occurrence_id uuid, p_expected_version integer, p_reason text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'recurring.occurrence_skip';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_a jsonb;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_o recurring_occurrences%rowtype;
  v_new_version integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', coalesce(p_occurrence_id::text, ''),
    coalesce(p_expected_version::text, ''), v_reason), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_a := recurring_occurrence_access(p_occurrence_id);
    if v_a is null or not (v_a->>'manage')::boolean then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if char_length(v_reason) not between 1 and 200 then
      perform platform_field_invalid('reason');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    perform recurring_lock_holder(v_a, false);
    select * into v_o from recurring_occurrences o where o.id = p_occurrence_id for update;
    if not found then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if p_expected_version <> v_o.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_o.status <> 'open' then
      perform platform_abort('conflict', 'RECURRING_CLOSED');
    end if;
    update recurring_occurrences
       set status = 'skipped', skipped_reason = v_reason, skipped_at = now(),
           skipped_by_account_id = platform_actor_account(), skipped_by_parent_id = identity_linked_parent(),
           skipped_by_removed = false
     where id = p_occurrence_id returning version into v_new_version;
    perform platform_audit_write('recurring_occurrence_skipped', 'recurring_occurrence', p_occurrence_id, v_org,
                                 (v_a->>'working_group_id')::uuid, 'success', null);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_occurrence_id);
    return platform_result('success', p_occurrence_id, null) || jsonb_build_object('version', v_new_version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

revoke all on function
  recurring_occurrence_access(uuid),
  recurring_lock_holder(jsonb, boolean),
  recurring_occurrence_mark_done(text, uuid, integer),
  recurring_occurrence_undo_done(text, uuid, integer),
  recurring_occurrence_skip(text, uuid, integer, text)
  from public, anon, authenticated, service_role;

grant execute on function
  recurring_occurrence_mark_done(text, uuid, integer),
  recurring_occurrence_undo_done(text, uuid, integer),
  recurring_occurrence_skip(text, uuid, integer, text)
  to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 9b. The daily check (W7; BR148, BR149, D-REL-1; NFR5.5, NFR5.6, NFR7.5, NFR7.6, NFR7.7, NFR9.3). Internal: reached only
--     through the daily run of U5 (never granted to a signed-in role). For each active schedule, in ascending id order and
--     each in its own sub-transaction, it (1) recalculates the future unnoticed occurrences of a rota-week schedule against
--     the published weeks, (2) makes the missing occurrences up to 14 days ahead, and (3) tells the people in charge: an
--     occurrence at 0 to 2 days past its due date gets one due notice when nothing was sent yet, and one at 3 days or more
--     gets one overdue notice when it has none, so a run never sends both for one occurrence. Group duties go to the
--     coordinators, or to the members when the group has none; family and rota-week duties go to the parents of the family
--     responsible on the day. A schedule of an archived group, a removed family, or whose week nobody holds is skipped.
--     The day is the Budapest date of the moment of the run. A schedule that fails is rolled back alone and named in the
--     detail; the others and the other checks still run (NFR7.5). Lock order: the owning family, the schedule row, then its
--     occurrences ascending; the notice call takes no family lock, so it keeps that order.
-- ---------------------------------------------------------------------------------------------------
create or replace function recurring_notice_recipients(p_schedule recurring_schedules, p_due date) returns uuid[]
language plpgsql stable security definer set search_path from current
as $$
declare
  v_family uuid;
  v_ids uuid[];
begin
  if p_schedule.owner_kind = 'group' then
    select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_ids
      from parents p
     where p.account_id is not null and p.status = 'active' and p.organization_id = p_schedule.organization_id
       and exists (select 1 from app_role_grants g
                    where g.subject_id = p.account_id and g.role = 'group_admin' and g.scope_type = 'group'
                      and g.scope_id = p_schedule.working_group_id and g.revoked_at is null);
    if cardinality(v_ids) = 0 then
      select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_ids
        from group_memberships m join parents p on p.id = m.parent_id
       where m.group_id = p_schedule.working_group_id and m.status = 'active'
         and p.account_id is not null and p.status = 'active';
    end if;
    return v_ids;
  end if;
  v_family := recurring_holder_family(p_schedule.owner_kind, p_schedule.family_id, p_schedule.rota_job, p_due);
  if v_family is null then
    return '{}'::uuid[];
  end if;
  return rota_notice_parents(v_family);
end $$;

create or replace function recurring_due_check(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_moment timestamptz := coalesce(p_now, now());
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Budapest')::date;
  v_row record;
  v_s recurring_schedules%rowtype;
  v_o record;
  v_recipients uuid[];
  v_n integer;
  v_days integer;
  v_kind text;
  v_created integer := 0;
  v_skipped integer := 0;
  v_local_created integer;
  v_local_skipped integer;
  v_failed uuid[] := '{}'::uuid[];
begin
  for v_row in
    select s.id, s.owner_kind, s.family_id
      from recurring_schedules s
     where s.is_active
       and (s.owner_kind <> 'group'
            or exists (select 1 from groups g where g.id = s.working_group_id and g.status = 'active'))
       and (s.owner_kind <> 'family'
            or exists (select 1 from families f
                        where f.id = s.family_id and f.status = 'active' and f.anonymized_at is null))
     order by s.id
  loop
    begin
      v_local_created := 0;
      v_local_skipped := 0;
      if v_row.owner_kind = 'family' then
        perform 1 from families f where f.id = v_row.family_id for update;
      end if;
      select * into v_s from recurring_schedules s where s.id = v_row.id for update;
      if not found or not v_s.is_active then
        continue;
      end if;
      -- A republished plan: the future occurrences nobody was told about follow the published water weeks (BR143.2).
      if v_s.interval_kind = 'rota_weeks' then
        perform 1 from recurring_occurrences o
         where o.schedule_id = v_s.id and o.status = 'open' and o.due_date > v_today
           and o.due_notice_sent_at is null and o.overdue_notice_sent_at is null
         order by o.id for update;
        delete from recurring_occurrences o
         where o.schedule_id = v_s.id and o.status = 'open' and o.due_date > v_today
           and o.due_notice_sent_at is null and o.overdue_notice_sent_at is null
           and not exists (select 1 from recurring_due_dates(v_s, v_today + 1, v_today + 14) d where d.due_date = o.due_date);
        update recurring_occurrences o set rota_week_id = d.rota_week_id
          from recurring_due_dates(v_s, v_today + 1, v_today + 14) d
         where o.schedule_id = v_s.id and o.due_date = d.due_date and o.status = 'open'
           and o.rota_week_id is distinct from d.rota_week_id;
      end if;
      v_local_created := recurring_create_occurrences(v_s.id, v_today, v_today + 14);
      for v_o in
        select o.id, o.due_date, o.due_notice_sent_at, o.overdue_notice_sent_at
          from recurring_occurrences o
         where o.schedule_id = v_s.id and o.status = 'open' and o.due_date <= v_today
           and ((v_today - o.due_date <= 2 and o.due_notice_sent_at is null and o.overdue_notice_sent_at is null)
                or (v_today - o.due_date >= 3 and o.overdue_notice_sent_at is null))
         order by o.id
           for update
      loop
        v_days := v_today - v_o.due_date;
        v_kind := case when v_days <= 2 then 'recurring_due' else 'recurring_overdue' end;
        v_recipients := recurring_notice_recipients(v_s, v_o.due_date);
        if cardinality(v_recipients) = 0 then
          v_local_skipped := v_local_skipped + 1;
          continue;
        end if;
        v_n := notice_send(v_recipients, v_kind, 'recurring_duty', v_o.id,
                           v_kind || ':' || v_s.id::text || ':' || v_o.due_date::text);
        update recurring_occurrences set
          due_notice_sent_at = case when v_kind = 'recurring_due' then v_moment else due_notice_sent_at end,
          overdue_notice_sent_at = case when v_kind = 'recurring_overdue' then v_moment else overdue_notice_sent_at end
         where id = v_o.id;
        v_local_created := v_local_created + v_n;
      end loop;
      v_created := v_created + v_local_created;
      v_skipped := v_skipped + v_local_skipped;
    exception when others then
      v_failed := v_failed || v_row.id;
    end;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped,
    'detail', case when cardinality(v_failed) = 0 then null
                   else 'failed: ' || array_to_string(v_failed, ', ') end);
end $$;

revoke all on function
  recurring_notice_recipients(recurring_schedules, date),
  recurring_due_check(timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 11. The removal block (C16; BR151). U14 calls it when a person or a family is removed. For a parent, every occurrence the
--     parent marked done or skipped loses the person and gets the removed flag in one update, so the screens show
--     korábbi tag and the row stays; `to_clear` counts those rows and `to_flag` is 0. For a family, nothing is written:
--     the family's schedules stop with the family (the daily check and the screens read the family's state live), and
--     `to_flag` counts them. Any other subject kind, or a subject that holds nothing, gets zero counts. Preview and apply
--     return the same counts for the same state. Lock order: the family, the schedules ascending, then the occurrences
--     ascending. Service role and database owner only.
-- ---------------------------------------------------------------------------------------------------
create or replace function recurring_duties_removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_clear integer := 0;
  v_flag integer := 0;
begin
  if p_subject_kind = 'parent' then
    select count(*)::integer into v_clear from recurring_occurrences o
     where o.done_by_parent_id = p_subject_id or o.skipped_by_parent_id = p_subject_id;
  elsif p_subject_kind = 'family' then
    select count(*)::integer into v_flag from recurring_schedules s
     where s.owner_kind = 'family' and s.family_id = p_subject_id;
  end if;
  return jsonb_build_object('to_clear', v_clear, 'to_flag', v_flag);
end $$;

create or replace function recurring_duties_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_family uuid;
  v_clear integer := 0;
  v_flag integer := 0;
begin
  if p_subject_kind = 'parent' then
    select p.organization_id, p.family_id into v_org, v_family from parents p where p.id = p_subject_id;
    if not found then
      return jsonb_build_object('to_clear', 0, 'to_flag', 0);
    end if;
    perform 1 from families f where f.id = v_family for update;
    perform 1 from recurring_schedules s
     where s.id in (select o.schedule_id from recurring_occurrences o
                     where o.done_by_parent_id = p_subject_id or o.skipped_by_parent_id = p_subject_id)
     order by s.id for update;
    perform 1 from recurring_occurrences o
     where o.done_by_parent_id = p_subject_id or o.skipped_by_parent_id = p_subject_id
     order by o.id for update;
    update recurring_occurrences set
      done_by_parent_id = case when done_by_parent_id = p_subject_id then null else done_by_parent_id end,
      done_by_removed = done_by_removed or coalesce(done_by_parent_id = p_subject_id, false),
      skipped_by_parent_id = case when skipped_by_parent_id = p_subject_id then null else skipped_by_parent_id end,
      skipped_by_removed = skipped_by_removed or coalesce(skipped_by_parent_id = p_subject_id, false)
     where done_by_parent_id = p_subject_id or skipped_by_parent_id = p_subject_id;
    get diagnostics v_clear = row_count;
  elsif p_subject_kind = 'family' then
    select f.organization_id into v_org from families f where f.id = p_subject_id;
    if not found then
      return jsonb_build_object('to_clear', 0, 'to_flag', 0);
    end if;
    perform 1 from families f where f.id = p_subject_id for update;
    perform 1 from recurring_schedules s where s.owner_kind = 'family' and s.family_id = p_subject_id order by s.id for update;
    select count(*)::integer into v_flag from recurring_schedules s
     where s.owner_kind = 'family' and s.family_id = p_subject_id;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;
  perform platform_audit_write('recurring_removal_applied', p_subject_kind, p_subject_id, v_org, null, 'success',
                               'cleared:' || v_clear::text || ':flagged:' || v_flag::text);
  return jsonb_build_object('to_clear', v_clear, 'to_flag', v_flag);
end $$;

revoke all on function
  recurring_duties_removal_preview(text, uuid),
  recurring_duties_removal_apply(text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function
  recurring_duties_removal_preview(text, uuid),
  recurring_duties_removal_apply(text, uuid)
  to service_role;

commit;
