-- U6 of the Ovis tábla work: family standing and the changeover rule, all four yearly rotas in one draft and one
-- publish, the five weekend duties with their picks, the reminders and alerts around them, and the functions that later
-- units call (W1 to W11 of functional-spec.md; BR60 to BR67; contracts C3 to C5, C8, C9 and C10, C11, C12, C16, C20).
-- The file opens and commits its own transaction, as 20261048 and 20261050 do, because the migration runner adds
-- none: the new tables, the changed lists and every rewritten function succeed or fail together (NFR7.4).
-- Technical names stay: a duty is a `tasks` row, a place is an `assignments` row, a community is `organizations`.
--
-- Refusals are raised through U3R00 and rolled back (C1). Every new function pins its search path, starts with
-- `revoke all` and gets an explicit grant or none. The signed-in commands of this unit are `family_standing_set`,
-- `weekend_pick_set` and `weekend_pick_assign`; the read functions and the changed rota commands check their caller
-- themselves; everything else (the eligibility, standing, rota-rule, rota-week and removal functions, the three checks
-- and the helpers) is internal and granted to nobody.
--
-- Lock order (scalability-design.md): the families, then the plan row and the rota week rows ascending, then the weekend
-- pick rows, then the duty rows, then the place rows, each ascending. The draft and publish keep U2's order (all active
-- families first).
begin;

-- ---------------------------------------------------------------------------------------------------
-- 1. Family standing (BR60.1, BR60.5). One row per family and school year, created the first time a super admin sets
--    it; a family with no row is staying. Application roles read nothing: super admins read it through the calendar.
-- ---------------------------------------------------------------------------------------------------
create table family_year_standings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  family_id uuid not null,
  school_year_id uuid not null,
  standing text not null default 'staying' check (standing in ('staying', 'leaving', 'new')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (family_id, organization_id) references families (id, organization_id),
  foreign key (school_year_id, organization_id) references school_years (id, organization_id),
  unique (family_id, school_year_id)
);
create index family_year_standings_year on family_year_standings (school_year_id, standing);
create trigger family_year_standings_touch_version before update on family_year_standings
  for each row execute function platform_touch_version();
alter table family_year_standings enable row level security;
revoke all on family_year_standings from public, anon, authenticated, service_role;

-- The audit action list gains this unit's two actions (BR67.2).
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
  'family.standing_set', 'weekend_pick.assign'
));

-- ---------------------------------------------------------------------------------------------------
-- 1b. The weekend slot table, the duty origin and the place source. The reads below name them, so they come first; the
--     slot rows are written by publishing. One row per weekend week and slot (BR63.1).
-- ---------------------------------------------------------------------------------------------------
create table weekend_slots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  weekend_week_id uuid not null references rota_weeks (id),
  slot text not null check (slot in ('saturday_opening', 'saturday_closing', 'sunday_opening', 'sunday_closing',
                                     'shelter_cleaning')),
  created_at timestamptz not null default now(),
  unique (weekend_week_id, slot)
);
alter table weekend_slots enable row level security;
revoke all on weekend_slots from public, anon, authenticated, service_role;

-- The duty origin and the place source (ADR-002, BR67.2).
alter table tasks drop constraint tasks_origin_kind_check;
alter table tasks add constraint tasks_origin_kind_check check (origin_kind in ('manual', 'rota_week', 'weekend_slot'));
alter table assignments drop constraint assignments_source_check;
alter table assignments add constraint assignments_source_check
  check (source in ('parent_sign_up', 'admin_assign', 'swap', 'rota_publish', 'weekend_pick'));

-- ---------------------------------------------------------------------------------------------------
-- 2. The eligibility function (C10, BR60.2, BR60.3). Internal and read-only. A family may hold a duty on a date unless
--    it is not active, or it is leaving in a year whose changeover date is on or before the date, or it is new in a
--    year whose changeover date is after the date. Every row of the family counts, whichever year the date falls in.
-- ---------------------------------------------------------------------------------------------------
create or replace function family_hold_reason(p_family_id uuid, p_on date) returns text
language sql stable security definer set search_path from current
as $$
  select case
    when not exists (select 1 from families f where f.id = p_family_id and f.status = 'active') then 'family_inactive'
    when exists (select 1 from family_year_standings s join school_years y on y.id = s.school_year_id
                  where s.family_id = p_family_id and s.standing = 'leaving' and y.changeover_date <= p_on)
      then 'leaving_after_changeover'
    when exists (select 1 from family_year_standings s join school_years y on y.id = s.school_year_id
                  where s.family_id = p_family_id and s.standing = 'new' and y.changeover_date > p_on)
      then 'new_before_changeover'
  end
$$;

create or replace function family_may_hold_duty(p_family_id uuid, p_on date) returns jsonb
language sql stable security definer set search_path from current
as $$
  select jsonb_build_object('allowed', r.reason is null,
                            'code', case when r.reason is null then null else 'DUTY_INELIGIBLE' end,
                            'reason', r.reason)
    from (select family_hold_reason(p_family_id, p_on) as reason) r
$$;

-- The refusal a command returns for a family on the wrong side of the changeover date. The reason goes only to a super
-- admin or to a parent of the family it is about; every other caller gets the bare code (NFR1.3).
create or replace function duty_ineligible_result(p_family_id uuid, p_reason text) returns jsonb
language sql stable security definer set search_path from current
as $$
  select platform_result('validation', null, 'DUTY_INELIGIBLE')
         || case when coalesce(has_super_scope(identity_actor_organization()), false)
                   or coalesce(directory_actor_family() = p_family_id, false)
                 then jsonb_build_object('reason', p_reason) else '{}'::jsonb end
$$;

-- For the commands of today that give a family a duty: null when the family may hold it, else the refusal. Only the
-- changeover reasons refuse here; an inactive or unknown family keeps the refusals the command already has.
create or replace function duty_standing_check(p_family_id uuid, p_on date) returns jsonb
language sql stable security definer set search_path from current
as $$
  select case when r.reason in ('leaving_after_changeover', 'new_before_changeover')
              then duty_ineligible_result(p_family_id, r.reason) end
    from (select family_hold_reason(p_family_id, p_on) as reason) r
$$;

-- The same, for a duty identified by its place or task in the caller's community: the date is the duty's start date,
-- or the Monday of its rota week (BR60.3). Nothing for a duty that is not found.
create or replace function duty_standing_check_task(p_family_id uuid, p_task_id uuid) returns jsonb
language sql stable security definer set search_path from current
as $$
  select duty_standing_check(p_family_id, coalesce(
    (select w.week_start from tasks t join rota_weeks w on t.origin_kind = 'rota_week' and w.id = t.origin_id
      where t.id = p_task_id),
    (select w.week_start from tasks t join weekend_slots s on t.origin_kind = 'weekend_slot' and s.id = t.origin_id
       join rota_weeks w on w.id = s.weekend_week_id where t.id = p_task_id),
    (select (t.starts_at at time zone 'Europe/Budapest')::date from tasks t
      where t.id = p_task_id and t.organization_id = identity_actor_organization())))
$$;

-- ---------------------------------------------------------------------------------------------------
-- 3. Standing reads for other units (C20, BR60.6). Internal and read-only. The active weeks count the rows of
--    school_weeks: all of them for staying, those whose Monday is before the changeover date for leaving, those from
--    it on for new. An unknown family or year gives null.
-- ---------------------------------------------------------------------------------------------------
create or replace function family_standing(p_family_id uuid, p_school_year_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_year school_years%rowtype;
  v_standing text;
begin
  select * into v_year from school_years y where y.id = p_school_year_id;
  if not found or not exists (select 1 from families f where f.id = p_family_id and f.organization_id = v_year.organization_id) then
    return null;
  end if;
  select s.standing into v_standing from family_year_standings s
   where s.family_id = p_family_id and s.school_year_id = v_year.id;
  v_standing := coalesce(v_standing, 'staying');
  return jsonb_build_object('standing', v_standing, 'active_weeks', (
    select count(*)::integer from school_weeks(v_year.id) w
     where v_standing = 'staying'
        or (v_standing = 'leaving' and w.week_start < v_year.changeover_date)
        or (v_standing = 'new' and w.week_start >= v_year.changeover_date)));
end $$;

create or replace function families_with_standing(p_school_year_id uuid, p_standing text) returns setof uuid
language sql stable security definer set search_path from current
as $$
  select f.id
    from school_years y
    join families f on f.organization_id = y.organization_id and f.status = 'active'
   where y.id = p_school_year_id
     and coalesce((select s.standing from family_year_standings s where s.family_id = f.id and s.school_year_id = y.id),
                  'staying') = p_standing
   order by f.id
$$;

-- ---------------------------------------------------------------------------------------------------
-- 4. Flagged duties (BR60.5): a future place, or a draft week, whose family is no longer allowed on its date. Computed
--    when read, never stored. The date is the Monday of the week for a rota or weekend duty, else the duty's start date.
--    Internal; the calendar screen and the standing command read it.
-- ---------------------------------------------------------------------------------------------------
create or replace function rota_flagged_duties(p_organization_id uuid)
returns table (source text, family_id uuid, title text, job text, on_date date, reason text, duty_id uuid, week_id uuid)
language sql stable security definer set search_path from current
as $$
  select 'draft_week'::text, w.family_id, null::text, w.job, w.week_start, family_hold_reason(w.family_id, w.week_start),
         null::uuid, w.id
    from rota_plans p join rota_weeks w on w.plan_id = p.id
   where p.organization_id = p_organization_id and p.status = 'draft' and w.family_id is not null
     and family_hold_reason(w.family_id, w.week_start) is not null
  union all
  select 'place'::text, a.family_id, t.title,
         case t.origin_kind when 'rota_week' then rw.job when 'weekend_slot' then 'weekend_animal_care' end,
         d.on_date, family_hold_reason(a.family_id, d.on_date), t.id, coalesce(rw.id, ww.id)
    from assignments a
    join tasks t on t.id = a.task_id
    left join rota_weeks rw on t.origin_kind = 'rota_week' and rw.id = t.origin_id
    left join weekend_slots s on t.origin_kind = 'weekend_slot' and s.id = t.origin_id
    left join rota_weeks ww on ww.id = s.weekend_week_id
    cross join lateral (select coalesce(rw.week_start, ww.week_start,
                                        (t.starts_at at time zone 'Europe/Budapest')::date) as on_date) d
   where a.organization_id = p_organization_id and a.status <> 'removed'
     and t.status <> 'cancelled' and t.starts_at > now()
     and family_hold_reason(a.family_id, d.on_date) is not null
$$;

-- ---------------------------------------------------------------------------------------------------
-- 5. Setting a standing (W1, BR60.1). A super admin only. The caller sends the standing's version (0 when the family
--    has no row yet); a stale one is refused. The family row is locked first (NFR5.4). The answer says how many duties
--    are flagged now; nothing is taken from the family.
-- ---------------------------------------------------------------------------------------------------
create or replace function family_standing_set(
  p_idempotency_key text, p_family_id uuid, p_school_year_id uuid, p_standing text, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'family.standing_set';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_family families%rowtype;
  v_year school_years%rowtype;
  v_row family_year_standings%rowtype;
  v_id uuid;
  v_version integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_family_id::text, p_school_year_id::text, p_standing, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not coalesce(has_super_scope(v_org), false) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_family_id is null or p_school_year_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    -- The family row first (the lock order), then the standing row.
    select * into v_family from families f where f.id = p_family_id and f.organization_id = v_org for update;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_year from school_years y where y.id = p_school_year_id and y.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_family.status <> 'active' or v_year.status <> 'active'
       or p_standing is null or p_standing not in ('staying', 'leaving', 'new') then
      perform platform_abort('validation', 'STANDING_INVALID');
    end if;
    if p_expected_version is null or p_expected_version < 0 then
      perform platform_field_invalid('expected_version');
    end if;
    select * into v_row from family_year_standings s
     where s.family_id = v_family.id and s.school_year_id = v_year.id for update;
    if found then
      if v_row.version <> p_expected_version then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
      update family_year_standings set standing = p_standing where id = v_row.id;
      v_id := v_row.id;
      v_version := v_row.version + 1;
    else
      if p_expected_version <> 0 then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
      begin
        insert into family_year_standings (organization_id, family_id, school_year_id, standing)
        values (v_org, v_family.id, v_year.id, p_standing) returning id into v_id;
      exception when unique_violation then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end;
      v_version := 1;
    end if;
    perform platform_audit_write('family.standing_set', 'family', v_family.id, v_org, null, 'success',
                                 'year:' || v_year.id::text || ':standing:' || p_standing);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object(
      'version', v_version,
      'flagged', (select count(*)::integer from rota_flagged_duties(v_org)));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 7. The changeover rule wherever a family is given a duty (BR60.4): today's sign-up, manual assignment, and proposing
--    and accepting a swap. The body of each is the one 20261048 gave it, with the check added after the refusal for a
--    rota duty. Nothing else about them changes.
-- ---------------------------------------------------------------------------------------------------
create or replace function duty_sign_up(p_idempotency_key text, p_task_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_result jsonb;
  v_refusal jsonb;
begin
  if duty_rota_managed(array[p_task_id], 'family') then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
  end if;
  if current_session_is_active() and directory_actor_family() is not null then
    v_refusal := duty_standing_check_task(directory_actor_family(), p_task_id);
    if v_refusal is not null then
      return v_refusal;
    end if;
  end if;
  v_result := duty_sign_up_core(p_idempotency_key, p_task_id, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_place_added((v_result->>'reference')::uuid);
  end if;
  return v_result;
end $$;

create or replace function assignment_assign(
  p_idempotency_key text, p_task_id uuid, p_family_id uuid, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_result jsonb;
  v_refusal jsonb;
begin
  if duty_rota_managed(array[p_task_id], 'admin') then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
  end if;
  if current_session_is_active() and p_family_id is not null
     and coalesce(directory_is_admin(identity_actor_organization()), false) then
    v_refusal := duty_standing_check_task(p_family_id, p_task_id);
    if v_refusal is not null then
      return v_refusal;
    end if;
  end if;
  v_result := assignment_assign_core(p_idempotency_key, p_task_id, p_family_id, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_place_added((v_result->>'reference')::uuid);
  end if;
  return v_result;
end $$;

-- The two families that would receive a duty in a swap, each judged on the date of the duty it would receive. Only a
-- caller who is the family of the place offered is judged; any other caller reaches the refusals of the command itself.
create or replace function swap_standing_check(p_assignment_id uuid, p_target_assignment_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_family uuid := directory_actor_family();
  v_src assignments%rowtype;
  v_tgt assignments%rowtype;
  v_org uuid := identity_actor_organization();
  v_refusal jsonb;
begin
  if not current_session_is_active() or v_family is null or p_assignment_id is null or p_target_assignment_id is null then
    return null;
  end if;
  select * into v_src from assignments a where a.id = p_assignment_id and a.organization_id = v_org;
  select * into v_tgt from assignments a where a.id = p_target_assignment_id and a.organization_id = v_org;
  if v_src.id is null or v_tgt.id is null or v_src.family_id <> v_family then
    return null;
  end if;
  v_refusal := duty_standing_check_task(v_src.family_id, v_tgt.task_id);
  if v_refusal is not null then
    return v_refusal;
  end if;
  return duty_standing_check_task(v_tgt.family_id, v_src.task_id);
end $$;

create or replace function swap_request(
  p_idempotency_key text, p_assignment_id uuid, p_expected_version integer,
  p_target_assignment_id uuid, p_target_version integer, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_result jsonb;
  v_refusal jsonb;
begin
  if duty_rota_managed_places(array[p_assignment_id, p_target_assignment_id], 'family') then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
  end if;
  v_refusal := swap_standing_check(p_assignment_id, p_target_assignment_id);
  if v_refusal is not null then
    return v_refusal;
  end if;
  v_result := swap_request_core(p_idempotency_key, p_assignment_id, p_expected_version,
                                p_target_assignment_id, p_target_version, p_reason);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_swap_request((v_result->>'reference')::uuid);
  end if;
  return v_result;
end $$;

create or replace function swap_respond(
  p_idempotency_key text, p_request_id uuid, p_accept boolean, p_expected_version integer default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_result jsonb;
  v_refusal jsonb;
  v_family uuid;
  v_request change_requests%rowtype;
begin
  if duty_rota_managed_request(p_request_id, 'family') then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
  end if;
  -- Only a community that has marked a family as leaving or new can have anything to refuse, so the plain case adds
  -- no reads before the command's own locking.
  if p_accept is true and exists (select 1 from family_year_standings s where s.standing <> 'staying') then
    v_family := directory_actor_family();
  end if;
  if v_family is not null then
    select * into v_request from change_requests r
     where r.id = p_request_id and r.organization_id = identity_actor_organization();
    if v_request.id is not null and v_request.target_assignment_id is not null then
      -- The accepting family is the owner of the target place, so the check starts from that place.
      v_refusal := swap_standing_check(v_request.target_assignment_id, v_request.assignment_id);
    end if;
    if v_refusal is not null then
      return v_refusal;
    end if;
  end if;
  v_result := swap_respond_core(p_idempotency_key, p_request_id, p_accept, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_swap_response((v_result->>'reference')::uuid, v_result->>'outcome');
  end if;
  return v_result;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 8. The calendar screen also returns the standings and the flagged duties (W1, BR65.4). Super admins only, as before.
-- ---------------------------------------------------------------------------------------------------
create or replace function school_calendar_get(p_school_year_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_year school_years%rowtype;
  v_years jsonb;
  v_weeks jsonb;
  v_warnings jsonb;
  v_standings jsonb;
  v_flagged jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if v_org is null or not coalesce(has_super_scope(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.starts_on desc, s.id), '[]'::jsonb)
    into v_years from school_years s where s.organization_id = v_org and s.status = 'active';
  select * into v_year from school_years s
   where s.organization_id = v_org and s.id = coalesce(p_school_year_id, rota_pick_school_year(v_org));
  if not found then
    if p_school_year_id is not null then
      return platform_result('denied', null, 'authorization_denied');
    end if;
    return platform_result('success', null, null)
      || jsonb_build_object('school_year', null, 'school_years', v_years, 'items', '[]'::jsonb, 'warnings', '[]'::jsonb,
                            'has_plan', false, 'standings', '[]'::jsonb, 'flagged_duties', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'week_start', sw.week_start, 'is_break', sw.is_break,
           'break_week_id', b.id, 'label', b.label, 'version', b.version) order by sw.week_start), '[]'::jsonb)
    into v_weeks
    from school_weeks(v_year.id) sw
    left join break_weeks b on b.school_year_id = v_year.id and b.week_start = sw.week_start;
  select coalesce(jsonb_agg(jsonb_build_object('week_start', rw.week_start, 'family_display_name', family_display_name(rw.family_id))
                            order by rw.week_start, rw.job), '[]'::jsonb)
    into v_warnings
    from rota_plans p
    join rota_weeks rw on rw.plan_id = p.id
    join school_weeks(v_year.id) sw on sw.week_start = rw.week_start
   where p.school_year_id = v_year.id and rw.family_id is not null and sw.is_break
     and rw.job in ('indoor_cleaning', 'water_carrying');
  select coalesce(jsonb_agg(jsonb_build_object(
           'family_id', f.id, 'display_name', f.display_name,
           'standing', coalesce(s.standing, 'staying'), 'version', coalesce(s.version, 0))
         order by lower(f.display_name), f.id), '[]'::jsonb)
    into v_standings
    from families f
    left join family_year_standings s on s.family_id = f.id and s.school_year_id = v_year.id
   where f.organization_id = v_org and f.status = 'active';
  select coalesce(jsonb_agg(jsonb_build_object(
           'source', d.source, 'family_id', d.family_id, 'family_display_name', family_display_name(d.family_id),
           'title', d.title, 'job', d.job, 'on_date', d.on_date, 'reason', d.reason, 'duty_id', d.duty_id)
         order by d.on_date, d.job, d.family_id), '[]'::jsonb)
    into v_flagged from rota_flagged_duties(v_org) d;
  return platform_result('success', v_year.id, null) || jsonb_build_object(
    'school_year', jsonb_build_object('id', v_year.id, 'name', v_year.name, 'starts_on', v_year.starts_on,
                                       'ends_on', v_year.ends_on, 'changeover_date', v_year.changeover_date,
                                       'version', v_year.version),
    'school_years', v_years,
    'items', v_weeks,
    'warnings', v_warnings,
    'has_plan', exists (select 1 from rota_plans p where p.school_year_id = v_year.id),
    'standings', v_standings,
    'flagged_duties', v_flagged);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 9. Function rights (BR67.1).
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  family_hold_reason(uuid, date),
  family_may_hold_duty(uuid, date),
  duty_ineligible_result(uuid, text),
  duty_standing_check(uuid, date),
  duty_standing_check_task(uuid, uuid),
  family_standing(uuid, uuid),
  families_with_standing(uuid, text),
  rota_flagged_duties(uuid),
  swap_standing_check(uuid, uuid)
  from public, anon, authenticated, service_role;

revoke all on function
  family_standing_set(text, uuid, uuid, text, integer),
  duty_sign_up(text, uuid, integer),
  assignment_assign(text, uuid, uuid, integer),
  swap_request(text, uuid, integer, uuid, integer, text),
  swap_respond(text, uuid, boolean, integer),
  school_calendar_get(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  family_standing_set(text, uuid, uuid, text, integer),
  duty_sign_up(text, uuid, integer),
  assignment_assign(text, uuid, uuid, integer),
  swap_request(text, uuid, integer, uuid, integer, text),
  swap_respond(text, uuid, boolean, integer),
  school_calendar_get(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 10. The four rotas: the widened lists and the rows older plans need (BR61.1, BR62.6).
-- ---------------------------------------------------------------------------------------------------
alter table rota_weeks drop constraint rota_weeks_job_check;
alter table rota_weeks add constraint rota_weeks_job_check
  check (job in ('indoor_cleaning', 'front_garden', 'water_carrying', 'weekend_animal_care'));
alter table rota_weeks drop constraint rota_weeks_empty_reason_check;
alter table rota_weeks add constraint rota_weeks_empty_reason_check
  check (empty_reason in ('no_family', 'rule_clash', 'cleared', 'not_drafted'));

-- A plan made before this unit gets the three new rotas as empty weeks, not drafted. A draft can be filled by hand or
-- discarded and drafted again; a published plan keeps its indoor-cleaning duties and its new weeks have no duty.
insert into rota_weeks (organization_id, plan_id, job, week_start, empty_reason)
select w.organization_id, w.plan_id, j.job, w.week_start, 'not_drafted'
  from rota_weeks w
 cross join (values ('front_garden'), ('water_carrying'), ('weekend_animal_care')) as j(job)
 where w.job = 'indoor_cleaning'
on conflict (plan_id, job, week_start) do nothing;

-- ---------------------------------------------------------------------------------------------------
-- 11. Small helpers. Internal. The titles, categories and time windows of the duties a plan creates, and the times of
--     a rota week in Budapest time (BR60.3, "Times of a week"): the Friday before, Wednesday 00:00, Friday noon and
--     Saturday 00:00. Times are built from the date in local time, so a clock change inside the week never moves them.
-- ---------------------------------------------------------------------------------------------------
create or replace function rota_week_times(p_monday date)
returns table (reminder_from timestamptz, wednesday timestamptz, friday_noon timestamptz, saturday timestamptz,
               starts_at timestamptz, ends_at timestamptz)
language sql stable set search_path from current
as $$
  select ((p_monday - 3)::timestamp) at time zone 'Europe/Budapest',
         ((p_monday + 2)::timestamp) at time zone 'Europe/Budapest',
         ((p_monday + 4)::timestamp + interval '12 hours') at time zone 'Europe/Budapest',
         ((p_monday + 5)::timestamp) at time zone 'Europe/Budapest',
         (p_monday::timestamp) at time zone 'Europe/Budapest',
         ((p_monday + 7)::timestamp) at time zone 'Europe/Budapest'
$$;

create or replace function rota_job_title(p_job text) returns text
language sql immutable set search_path from current
as $$ select case p_job
  when 'indoor_cleaning' then 'Belső takarítás'
  when 'front_garden' then 'Előkert'
  when 'water_carrying' then 'Vízhordás'
  when 'weekend_animal_care' then 'Hétvégi állatgondozás' end $$;

create or replace function rota_job_order(p_job text) returns integer
language sql immutable set search_path from current
as $$ select array_position(array['indoor_cleaning', 'front_garden', 'water_carrying', 'weekend_animal_care'], p_job) $$;

create or replace function weekend_slot_title(p_slot text) returns text
language sql immutable set search_path from current
as $$ select case p_slot
  when 'saturday_opening' then 'Szombat reggeli nyitás'
  when 'saturday_closing' then 'Szombat esti zárás'
  when 'sunday_opening' then 'Vasárnap reggeli nyitás'
  when 'sunday_closing' then 'Vasárnap esti zárás'
  when 'shelter_cleaning' then 'Hétvégi takarítás' end $$;

create or replace function weekend_slot_category(p_slot text) returns text
language sql immutable set search_path from current
as $$ select case p_slot
  when 'saturday_opening' then 'rota_weekend_opening'
  when 'sunday_opening' then 'rota_weekend_opening'
  when 'saturday_closing' then 'rota_weekend_closing'
  when 'sunday_closing' then 'rota_weekend_closing'
  when 'shelter_cleaning' then 'rota_shelter_cleaning' end $$;

-- An opening is the morning half of its day, a closing the afternoon and evening half, and the shelter cleaning spans the
-- weekend (entities.md).
create or replace function weekend_slot_window(p_monday date, p_slot text)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable set search_path from current
as $$
  select (d.first_day::timestamp + d.from_offset) at time zone 'Europe/Budapest',
         (d.last_day::timestamp + d.to_offset) at time zone 'Europe/Budapest'
    from (select case p_slot when 'saturday_opening' then p_monday + 5 when 'saturday_closing' then p_monday + 5
                             when 'sunday_opening' then p_monday + 6 when 'sunday_closing' then p_monday + 6
                             else p_monday + 5 end as first_day,
                 case p_slot when 'saturday_opening' then p_monday + 5 when 'saturday_closing' then p_monday + 5
                             when 'sunday_opening' then p_monday + 6 when 'sunday_closing' then p_monday + 6
                             else p_monday + 6 end as last_day,
                 case p_slot when 'saturday_closing' then interval '12 hours'
                             when 'sunday_closing' then interval '12 hours' else interval '0' end as from_offset,
                 case p_slot when 'saturday_opening' then interval '12 hours'
                             when 'sunday_opening' then interval '12 hours'
                             else interval '23 hours 59 minutes 59 seconds' end as to_offset) d
$$;

-- ---------------------------------------------------------------------------------------------------
-- 12. The duty creator (C4) also makes the weekend duties: origin weekend_slot, place source weekend_pick. The body is
--     20261048's; only the origin and source lists grow.
-- ---------------------------------------------------------------------------------------------------
create or replace function duty_create(
  p_origin_kind text, p_origin_id uuid, p_title text, p_category text,
  p_starts_at timestamptz, p_ends_at timestamptz, p_working_group_id uuid, p_place_holders uuid[], p_source text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_task tasks%rowtype;
  v_holder uuid;
  v_place uuid;
  v_ids jsonb := '[]'::jsonb;
begin
  if p_origin_kind is null or p_origin_kind not in ('rota_week', 'weekend_slot') or p_origin_id is null then
    raise exception 'duty_create: the origin is not known' using errcode = '22023';
  end if;
  if p_origin_kind = 'rota_week' then
    select w.organization_id into v_org from rota_weeks w where w.id = p_origin_id;
  else
    select s.organization_id into v_org from weekend_slots s where s.id = p_origin_id;
  end if;
  if not found then
    raise exception 'duty_create: the origin does not exist' using errcode = '22023';
  end if;
  if p_place_holders is null or cardinality(p_place_holders) not between 1 and 50 then
    raise exception 'duty_create: the place list is malformed' using errcode = '22023';
  end if;
  if p_source is null or p_source not in ('rota_publish', 'parent_sign_up', 'admin_assign', 'swap', 'weekend_pick') then
    raise exception 'duty_create: the source is not known' using errcode = '22023';
  end if;
  if p_working_group_id is not null
     and not exists (select 1 from groups g where g.id = p_working_group_id and g.organization_id = v_org) then
    raise exception 'duty_create: the working group is not of the community' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_place_holders) as h(family_id)
              where h.family_id is not null
                and not exists (select 1 from families f where f.id = h.family_id and f.organization_id = v_org)) then
    raise exception 'duty_create: a family is not of the community' using errcode = '22023';
  end if;

  select * into v_task from tasks where origin_kind = p_origin_kind and origin_id = p_origin_id;
  if not found then
    insert into tasks (organization_id, group_id, title, category, capacity, starts_at, ends_at, origin_kind, origin_id)
    values (v_org, p_working_group_id, p_title, p_category, cardinality(p_place_holders), p_starts_at, p_ends_at,
            p_origin_kind, p_origin_id)
    on conflict (origin_kind, origin_id) where origin_id is not null do nothing
    returning * into v_task;
    if found then
      foreach v_holder in array p_place_holders loop
        if v_holder is null then
          v_ids := v_ids || jsonb_build_array(null);
        else
          insert into assignments (organization_id, task_id, family_id, source)
          values (v_org, v_task.id, v_holder, p_source)
          returning id into v_place;
          v_ids := v_ids || jsonb_build_array(v_place);
        end if;
      end loop;
      return jsonb_build_object('duty_id', v_task.id, 'place_ids', v_ids);
    end if;
    select * into v_task from tasks where origin_kind = p_origin_kind and origin_id = p_origin_id;
  end if;
  select coalesce(jsonb_agg(a.id order by a.created_at, a.id), '[]'::jsonb) into v_ids
    from assignments a where a.task_id = v_task.id and a.status <> 'removed';
  return jsonb_build_object('duty_id', v_task.id, 'place_ids', v_ids);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 13. The draft of four rotas (BR61.1 to BR61.6). Internal and read-only: it computes the rows of a draft from the
--     active families, their standings, the calendar and the year, and writes nothing. The same input always gives the
--     same rows. The rotas are drafted in the order indoor cleaning, front garden, weekend animal care, water carrying,
--     each over its duty weeks in date order; everything is held in arrays, so the counts of the turns are in memory.
--       - a family is a candidate for a week when it may hold the week's Monday (BR60.2);
--       - front garden never takes that week's indoor-cleaning family (BR61.2);
--       - among the candidates the family with the fewest weeks so far in this rota goes next; a family that joins
--         part-way starts level with the lowest count among the others (BR61.4); then a family with no other job in
--         that week, then the family whose last week is longest ago, then the family order starting at position
--         (calendar year of the start) modulo the number of families (BR61.3);
--       - afterwards the rota evens itself out: while two full-year families differ by more than one week, the latest
--         week of the one with the most that the other may take moves to it, preferring a week in which the receiving
--         family has no other job, and repeating over all full-year pairs until no week can move (BR61.5).
--     A week with no candidate stays empty with the reason no_family, one where every candidate would break the
--     same-week rule with rule_clash (BR61.6). Indoor cleaning and water carrying have no duty in a break week.
-- ---------------------------------------------------------------------------------------------------
create or replace function rota_draft_compute(p_organization_id uuid, p_school_year_id uuid)
returns table (o_job text, o_week_start date, o_family_id uuid, o_empty_reason text)
language plpgsql stable security definer set search_path from current
as $$
declare
  c_jobs constant text[] := array['indoor_cleaning', 'front_garden', 'weekend_animal_care', 'water_carrying'];
  v_year school_years%rowtype;
  v_families uuid[];
  v_n integer;
  v_weeks date[];
  v_breaks boolean[];
  v_w integer;
  v_offset integer;
  v_ok boolean[];
  v_full boolean[];
  v_assign integer[];
  v_reason text[];
  v_count integer[];
  v_joined boolean[];
  v_last integer[];
  v_r integer;
  v_wk integer;
  v_i integer;
  v_j integer;
  v_k integer;
  v_a integer;
  v_b integer;
  v_d integer;
  v_pass integer;
  v_idx integer;
  v_any boolean;
  v_min integer;
  v_max integer;
  v_best integer;
  v_best_key integer[];
  v_key integer[];
  v_other integer;
  v_moved boolean;
  v_pick integer;
begin
  select * into v_year from school_years y where y.id = p_school_year_id and y.organization_id = p_organization_id;
  if not found then
    return;
  end if;
  select coalesce(array_agg(f.id order by lower(f.display_name), f.id), '{}'::uuid[]) into v_families
    from families f where f.organization_id = p_organization_id and f.status = 'active';
  v_n := cardinality(v_families);
  select coalesce(array_agg(w.week_start order by w.week_start), '{}'::date[]),
         coalesce(array_agg(w.is_break order by w.week_start), '{}'::boolean[])
    into v_weeks, v_breaks from school_weeks(v_year.id) w;
  v_w := cardinality(v_weeks);
  if v_w = 0 then
    return;
  end if;
  v_offset := case when v_n > 0 then extract(year from v_year.starts_on)::integer % v_n else 0 end;
  v_assign := array_fill(0, array[4 * v_w]);
  v_reason := array_fill(null::text, array[4 * v_w]);

  if v_n > 0 then
    -- Who may hold which week (BR60.2), asked once per family and week; a full-year family may hold every week.
    v_ok := array_fill(false, array[v_n * v_w]);
    v_full := array_fill(true, array[v_n]);
    for v_wk in 1..v_w loop
      for v_i in 1..v_n loop
        v_ok[(v_wk - 1) * v_n + v_i] := family_hold_reason(v_families[v_i], v_weeks[v_wk]) is null;
        if not v_ok[(v_wk - 1) * v_n + v_i] then
          v_full[v_i] := false;
        end if;
      end loop;
    end loop;
  end if;

  for v_r in 1..4 loop
    v_count := array_fill(0, array[greatest(v_n, 1)]);
    v_joined := array_fill(false, array[greatest(v_n, 1)]);
    v_last := array_fill(-1, array[greatest(v_n, 1)]);
    for v_wk in 1..v_w loop
      v_idx := (v_r - 1) * v_w + v_wk;
      if c_jobs[v_r] in ('indoor_cleaning', 'water_carrying') and v_breaks[v_wk] then
        continue;
      end if;
      v_any := false;
      for v_i in 1..v_n loop
        if v_ok[(v_wk - 1) * v_n + v_i] then
          v_any := true;
          if not v_joined[v_i] then
            v_min := null;
            for v_j in 1..v_n loop
              if v_j <> v_i and v_joined[v_j] and v_ok[(v_wk - 1) * v_n + v_j] then
                v_min := case when v_min is null then v_count[v_j] else least(v_min, v_count[v_j]) end;
              end if;
            end loop;
            v_count[v_i] := coalesce(v_min, 0);
            v_joined[v_i] := true;
          end if;
        end if;
      end loop;
      if not v_any then
        v_reason[v_idx] := 'no_family';
        continue;
      end if;
      v_best := 0;
      for v_i in 1..v_n loop
        if not v_ok[(v_wk - 1) * v_n + v_i] then
          continue;
        end if;
        if c_jobs[v_r] = 'front_garden' and v_assign[v_wk] = v_i then
          continue;
        end if;
        v_other := 0;
        for v_k in 1..(v_r - 1) loop
          if v_assign[(v_k - 1) * v_w + v_wk] = v_i then
            v_other := 1;
          end if;
        end loop;
        v_key := array[v_count[v_i], v_other, v_last[v_i], ((v_i - 1 - v_offset) % v_n + v_n) % v_n];
        if v_best = 0 or v_key < v_best_key then
          v_best := v_i;
          v_best_key := v_key;
        end if;
      end loop;
      if v_best = 0 then
        v_reason[v_idx] := 'rule_clash';
      else
        v_assign[v_idx] := v_best;
        v_count[v_best] := v_count[v_best] + 1;
        v_last[v_best] := v_wk;
      end if;
    end loop;

    -- Evening out (BR61.5).
    loop
      v_moved := false;
      v_count := array_fill(0, array[greatest(v_n, 1)]);
      for v_wk in 1..v_w loop
        v_i := v_assign[(v_r - 1) * v_w + v_wk];
        if v_i > 0 then
          v_count[v_i] := v_count[v_i] + 1;
        end if;
      end loop;
      v_min := null;
      v_max := null;
      for v_i in 1..v_n loop
        if v_full[v_i] then
          v_min := case when v_min is null then v_count[v_i] else least(v_min, v_count[v_i]) end;
          v_max := case when v_max is null then v_count[v_i] else greatest(v_max, v_count[v_i]) end;
        end if;
      end loop;
      exit when v_max is null or v_max - v_min <= 1;
      <<pairs>>
      for v_d in reverse (v_max - v_min)..2 loop
        for v_k in 0..(v_n - 1) loop
          v_a := ((v_k + v_offset) % v_n) + 1;
          continue when not v_full[v_a];
          for v_j in 0..(v_n - 1) loop
            v_b := ((v_j + v_offset) % v_n) + 1;
            continue when v_a = v_b or not v_full[v_b] or v_count[v_a] - v_count[v_b] <> v_d;
            v_pick := 0;
            for v_pass in 1..2 loop
              for v_wk in reverse v_w..1 loop
                continue when v_assign[(v_r - 1) * v_w + v_wk] <> v_a or not v_ok[(v_wk - 1) * v_n + v_b];
                continue when c_jobs[v_r] = 'front_garden' and v_assign[v_wk] = v_b;
                continue when c_jobs[v_r] = 'indoor_cleaning' and v_assign[v_w + v_wk] = v_b;
                v_other := 0;
                for v_i in 1..4 loop
                  if v_i <> v_r and v_assign[(v_i - 1) * v_w + v_wk] = v_b then
                    v_other := 1;
                  end if;
                end loop;
                continue when v_pass = 1 and v_other > 0;
                v_pick := v_wk;
                exit;
              end loop;
              exit when v_pick > 0;
            end loop;
            if v_pick > 0 then
              v_assign[(v_r - 1) * v_w + v_pick] := v_b;
              v_moved := true;
              exit pairs;
            end if;
          end loop;
        end loop;
      end loop;
      exit when not v_moved;
    end loop;
  end loop;

  for v_r in 1..4 loop
    for v_wk in 1..v_w loop
      v_idx := (v_r - 1) * v_w + v_wk;
      o_job := c_jobs[v_r];
      o_week_start := v_weeks[v_wk];
      o_family_id := case when v_assign[v_idx] > 0 then v_families[v_assign[v_idx]] end;
      o_empty_reason := v_reason[v_idx];
      return next;
    end loop;
  end loop;
end $$;

-- The draft of a school year: four rows for every school week (BR61.1). Super admin only, as in U2.
create or replace function rota_plan_make(p_idempotency_key text, p_school_year_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'rota_plan.make';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_year school_years%rowtype;
  v_plan_id uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(coalesce(p_school_year_id::text, ''), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not coalesce(has_super_scope(v_org), false) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_school_year_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    perform rota_lock_families(v_org);
    select * into v_year from school_years where id = p_school_year_id and organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_year.status = 'archived' then
      perform platform_field_invalid('school_year_id', 'archived');
    end if;
    if exists (select 1 from rota_plans p where p.school_year_id = v_year.id) then
      perform platform_abort('conflict', 'ROTA_PLAN_EXISTS');
    end if;
    begin
      insert into rota_plans (organization_id, school_year_id) values (v_org, v_year.id) returning id into v_plan_id;
    exception when unique_violation then
      perform platform_abort('conflict', 'ROTA_PLAN_EXISTS');
    end;
    insert into rota_weeks (organization_id, plan_id, job, week_start, family_id, empty_reason)
    select v_org, v_plan_id, d.o_job, d.o_week_start, d.o_family_id, d.o_empty_reason
      from rota_draft_compute(v_org, v_year.id) d
     order by d.o_week_start, rota_job_order(d.o_job);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_plan_id);
    return platform_result('success', v_plan_id, null)
      || jsonb_build_object('version', (select p.version from rota_plans p where p.id = v_plan_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 14. Setting one week of a draft (BR62.1). The rules of U2 hold for every rota; in addition a break week is refused
--     only for indoor cleaning and water carrying, a family on the wrong side of the changeover date is refused with
--     the reason, and a family that holds the other of indoor cleaning and front garden that week is refused.
-- ---------------------------------------------------------------------------------------------------
create or replace function rota_week_set(
  p_idempotency_key text, p_week_id uuid, p_family_id uuid, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'rota_week.set';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_plan_id uuid;
  v_plan rota_plans%rowtype;
  v_week rota_weeks%rowtype;
  v_reason text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_week_id::text, p_family_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not coalesce(has_super_scope(v_org), false) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_week_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select w.plan_id into v_plan_id from rota_weeks w where w.id = p_week_id and w.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    -- Families, then the plan row, then the week rows (the lock order). The other job of the pair is locked with it,
    -- ascending, so two simultaneous edits of the pair queue.
    perform rota_lock_families(v_org);
    select * into v_plan from rota_plans where id = v_plan_id and organization_id = v_org for update;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform 1 from rota_weeks w
     where w.plan_id = v_plan.id
       and w.week_start = (select x.week_start from rota_weeks x where x.id = p_week_id)
       and w.job in ('indoor_cleaning', 'front_garden')
     order by w.id for update;
    select * into v_week from rota_weeks where id = p_week_id and plan_id = v_plan.id for update;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_plan.status <> 'draft' then
      perform platform_abort('conflict', 'ROTA_PLAN_PUBLISHED');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_week.version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if p_family_id is not null then
      if not exists (select 1 from families f
                      where f.id = p_family_id and f.organization_id = v_org and f.status = 'active') then
        perform platform_abort('validation', 'ROTA_FAMILY_INELIGIBLE', jsonb_build_object('field', 'family_id'));
      end if;
      if v_week.job in ('indoor_cleaning', 'water_carrying')
         and exists (select 1 from school_weeks(v_plan.school_year_id) sw where sw.week_start = v_week.week_start and sw.is_break) then
        perform platform_abort('validation', 'ROTA_BREAK_WEEK', jsonb_build_object('field', 'family_id'));
      end if;
      v_reason := family_hold_reason(p_family_id, v_week.week_start);
      if v_reason is not null then
        perform platform_abort('validation', 'DUTY_INELIGIBLE',
                               jsonb_build_object('field', 'family_id', 'reason', v_reason));
      end if;
      if v_week.job in ('indoor_cleaning', 'front_garden')
         and exists (select 1 from rota_weeks o
                      where o.plan_id = v_plan.id and o.week_start = v_week.week_start
                        and o.job = case v_week.job when 'indoor_cleaning' then 'front_garden' else 'indoor_cleaning' end
                        and o.family_id = p_family_id) then
        perform platform_abort('validation', 'ROTA_SAME_WEEK_CLASH', jsonb_build_object('field', 'family_id'));
      end if;
    end if;
    update rota_weeks
       set family_id = p_family_id,
           empty_reason = case when p_family_id is null then 'cleared' end,
           changed_by_admin = true
     where id = v_week.id;
    -- Any change of the draft raises the plan's version, so a screen that is out of date cannot publish or discard it.
    update rota_plans set updated_at = now() where id = v_plan.id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_week.id);
    return platform_result('success', v_week.id, null)
      || jsonb_build_object('version', v_week.version + 1, 'plan_version', v_plan.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 15. Reading a plan (BR62.2, BR62.3, BR61.6, BR60.5). A super admin only. Per rota each family's number of weeks, the
--     weeks that block publishing and the warnings that do not.
-- ---------------------------------------------------------------------------------------------------
create or replace function rota_plan_get(p_school_year_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_year school_years%rowtype;
  v_plan rota_plans%rowtype;
  v_weeks jsonb;
  v_families jsonb;
  v_empty jsonb;
  v_breaks jsonb;
  v_ineligible jsonb;
  v_flagged jsonb;
  v_clash jsonb;
  v_two jsonb;
  v_changed integer;
  v_school_year jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if v_org is null or not coalesce(has_super_scope(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_year from school_years s
   where s.organization_id = v_org and s.id = coalesce(p_school_year_id, rota_pick_school_year(v_org));
  if not found then
    if p_school_year_id is not null then
      return platform_result('denied', null, 'authorization_denied');
    end if;
    return platform_result('success', null, null) || jsonb_build_object('school_year', null, 'plan', null);
  end if;
  v_school_year := jsonb_build_object('id', v_year.id, 'name', v_year.name, 'starts_on', v_year.starts_on,
                                       'ends_on', v_year.ends_on, 'changeover_date', v_year.changeover_date);
  select * into v_plan from rota_plans where school_year_id = v_year.id;
  if not found then
    return platform_result('success', v_year.id, null) || jsonb_build_object(
      'school_year', v_school_year, 'plan', null,
      'week_count', (select count(*)::integer from school_weeks(v_year.id)));
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', rw.id, 'job', rw.job, 'week_start', rw.week_start, 'is_break', coalesce(sw.is_break, false),
           'family_id', rw.family_id,
           'family_display_name', case when rw.family_id is not null then family_display_name(rw.family_id) end,
           'empty_reason', rw.empty_reason, 'changed_by_admin', rw.changed_by_admin, 'version', rw.version)
         order by rw.week_start, rota_job_order(rw.job)), '[]'::jsonb)
    into v_weeks
    from rota_weeks rw left join school_weeks(v_year.id) sw on sw.week_start = rw.week_start
   where rw.plan_id = v_plan.id;

  -- Each family's weeks per rota, and the full-year families more than one week above the lowest full-year count of
  -- that rota (BR62.2). A part-year family is never marked.
  select coalesce(jsonb_agg(jsonb_build_object(
           'family_id', fam.id, 'display_name', family_display_name(fam.id), 'full_year', fam.full_year,
           'counts', fam.counts, 'above_lowest', fam.above) order by lower(fam.display_name), fam.id), '[]'::jsonb)
    into v_families
    from (
      with counted as (
        select f.id, f.display_name,
               not exists (select 1 from family_year_standings s
                            where s.family_id = f.id and s.school_year_id = v_year.id
                              and s.standing in ('leaving', 'new')) as full_year,
               j.job,
               (select count(*) from rota_weeks w
                 where w.plan_id = v_plan.id and w.job = j.job and w.family_id = f.id)::integer as weeks
          from families f
         cross join (values ('indoor_cleaning'), ('front_garden'), ('water_carrying'), ('weekend_animal_care')) as j(job)
         where f.organization_id = v_org and f.status = 'active'
      ), lowest as (
        select c.job, min(c.weeks) as m from counted c where c.full_year group by c.job
      )
      select c.id, c.display_name, c.full_year,
             jsonb_object_agg(c.job, c.weeks) as counts,
             coalesce(jsonb_agg(c.job order by rota_job_order(c.job))
                        filter (where c.full_year and l.m is not null and c.weeks - l.m > 1), '[]'::jsonb) as above
        from counted c left join lowest l on l.job = c.job
       group by c.id, c.display_name, c.full_year
    ) fam;

  select coalesce(jsonb_agg(jsonb_build_object('week_start', rw.week_start, 'job', rw.job, 'reason', rw.empty_reason)
                            order by rw.week_start, rota_job_order(rw.job)), '[]'::jsonb)
    into v_empty
    from rota_weeks rw join school_weeks(v_year.id) sw on sw.week_start = rw.week_start
   where rw.plan_id = v_plan.id and rw.family_id is null
     and (rw.job in ('front_garden', 'weekend_animal_care') or not sw.is_break);
  select coalesce(jsonb_agg(jsonb_build_object('week_start', rw.week_start, 'job', rw.job)
                            order by rw.week_start, rota_job_order(rw.job)), '[]'::jsonb)
    into v_breaks
    from rota_weeks rw join school_weeks(v_year.id) sw on sw.week_start = rw.week_start
   where rw.plan_id = v_plan.id and sw.is_break and rw.family_id is not null
     and rw.job in ('indoor_cleaning', 'water_carrying');
  select coalesce(jsonb_agg(jsonb_build_object('week_start', rw.week_start, 'job', rw.job)
                            order by rw.week_start, rota_job_order(rw.job)), '[]'::jsonb)
    into v_ineligible
    from rota_weeks rw
   where rw.plan_id = v_plan.id and rw.family_id is not null
     and not exists (select 1 from families f where f.id = rw.family_id and f.organization_id = v_org and f.status = 'active');
  select coalesce(jsonb_agg(jsonb_build_object(
           'week_start', rw.week_start, 'job', rw.job, 'family_id', rw.family_id,
           'family_display_name', family_display_name(rw.family_id), 'reason', family_hold_reason(rw.family_id, rw.week_start))
         order by rw.week_start, rota_job_order(rw.job)), '[]'::jsonb)
    into v_flagged
    from rota_weeks rw
   where rw.plan_id = v_plan.id and rw.family_id is not null
     and family_hold_reason(rw.family_id, rw.week_start) in ('leaving_after_changeover', 'new_before_changeover');
  select coalesce(jsonb_agg(jsonb_build_object(
           'week_start', a.week_start, 'family_id', a.family_id, 'family_display_name', family_display_name(a.family_id))
         order by a.week_start, a.family_id), '[]'::jsonb)
    into v_clash
    from rota_weeks a join rota_weeks b
      on b.plan_id = a.plan_id and b.week_start = a.week_start and b.job = 'front_garden' and b.family_id = a.family_id
   where a.plan_id = v_plan.id and a.job = 'indoor_cleaning' and a.family_id is not null;
  select coalesce(jsonb_agg(jsonb_build_object(
           'week_start', g.week_start, 'family_id', g.family_id, 'family_display_name', family_display_name(g.family_id),
           'jobs', g.jobs) order by g.week_start, g.family_id), '[]'::jsonb)
    into v_two
    from (select rw.week_start, rw.family_id,
                 jsonb_agg(rw.job order by rota_job_order(rw.job)) as jobs
            from rota_weeks rw
           where rw.plan_id = v_plan.id and rw.family_id is not null
           group by rw.week_start, rw.family_id
          having count(*) >= 2
             and not (bool_or(rw.job = 'indoor_cleaning') and bool_or(rw.job = 'front_garden'))) g;
  select count(*)::integer into v_changed from rota_weeks w where w.plan_id = v_plan.id and w.changed_by_admin;
  return platform_result('success', v_plan.id, null) || jsonb_build_object(
    'school_year', v_school_year,
    'plan', jsonb_build_object('id', v_plan.id, 'status', v_plan.status, 'version', v_plan.version, 'published_at', v_plan.published_at),
    'items', v_weeks,
    'families', v_families,
    'changed_weeks', v_changed,
    'blockers', jsonb_build_object('empty_weeks', v_empty, 'break_weeks', v_breaks, 'ineligible_weeks', v_ineligible,
                                   'flagged_weeks', v_flagged, 'clash_weeks', v_clash),
    'warnings', jsonb_build_object('two_jobs', v_two),
    'can_publish', v_plan.status = 'draft' and v_empty = '[]'::jsonb and v_breaks = '[]'::jsonb
                   and v_ineligible = '[]'::jsonb and v_flagged = '[]'::jsonb and v_clash = '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 16. Publishing the whole plan (BR62.3 to BR62.5, BR63.1, BR63.2). In one transaction: a weekly duty with one place for
--     every indoor-cleaning, front-garden and water-carrying week, five weekend slots and their five duties for every
--     weekend week, all held by the weekend family; the plan marked published; the publishing notice through
--     notice_send; and one audit event. Anything that fails rolls all of it back.
-- ---------------------------------------------------------------------------------------------------
create or replace function rota_plan_publish(p_idempotency_key text, p_plan_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'rota_plan.publish';
  c_slots constant text[] := array['saturday_opening', 'saturday_closing', 'sunday_opening', 'sunday_closing',
                                   'shelter_cleaning'];
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_plan rota_plans%rowtype;
  v_week rota_weeks%rowtype;
  v_slot text;
  v_slot_id uuid;
  v_from timestamptz;
  v_to timestamptz;
  v_duties integer := 0;
  v_parents uuid[];
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_plan_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not coalesce(has_super_scope(v_org), false) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_plan_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    -- Locks first, state afterwards: the second of two simultaneous publishes waits here, then finds it published.
    perform rota_lock_families(v_org);
    select * into v_plan from rota_plans where id = p_plan_id and organization_id = v_org for update;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform 1 from rota_weeks w where w.plan_id = v_plan.id order by w.id for update;
    if v_plan.status <> 'draft' then
      perform platform_abort('conflict', 'ROTA_PLAN_PUBLISHED');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_plan.version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    -- The preconditions of all four rotas at once (BR62.3).
    if exists (select 1 from rota_weeks w join school_weeks(v_plan.school_year_id) sw on sw.week_start = w.week_start
                where w.plan_id = v_plan.id and w.family_id is null
                  and (w.job in ('front_garden', 'weekend_animal_care') or not sw.is_break)) then
      perform platform_abort('validation', 'ROTA_WEEKS_EMPTY');
    end if;
    if exists (select 1 from rota_weeks w join school_weeks(v_plan.school_year_id) sw on sw.week_start = w.week_start
                where w.plan_id = v_plan.id and sw.is_break and w.family_id is not null
                  and w.job in ('indoor_cleaning', 'water_carrying')) then
      perform platform_abort('validation', 'ROTA_BREAK_WEEK');
    end if;
    if exists (select 1 from rota_weeks w
                where w.plan_id = v_plan.id and w.family_id is not null
                  and not exists (select 1 from families f
                                   where f.id = w.family_id and f.organization_id = v_org and f.status = 'active')) then
      perform platform_abort('validation', 'ROTA_FAMILY_INELIGIBLE');
    end if;
    if exists (select 1 from rota_weeks w
                where w.plan_id = v_plan.id and w.family_id is not null
                  and family_hold_reason(w.family_id, w.week_start) in ('leaving_after_changeover', 'new_before_changeover')) then
      perform platform_abort('validation', 'DUTY_INELIGIBLE');
    end if;
    if exists (select 1 from rota_weeks a join rota_weeks b
                 on b.plan_id = a.plan_id and b.week_start = a.week_start and b.job = 'front_garden'
                    and b.family_id = a.family_id
                where a.plan_id = v_plan.id and a.job = 'indoor_cleaning' and a.family_id is not null) then
      perform platform_abort('validation', 'ROTA_SAME_WEEK_CLASH');
    end if;

    -- The duties, in week order and then rota order (BR62.4, BR63.1). A weekly duty runs Monday 00:00 to Sunday 23:59:59,
    -- Budapest time (entities.md). A weekend week has no weekly duty: its five slots are the work, all held by the
    -- weekend family until a pick moves one (BR63.2).
    for v_week in select * from rota_weeks w where w.plan_id = v_plan.id and w.family_id is not null
                   order by w.week_start, rota_job_order(w.job) loop
      if v_week.job = 'weekend_animal_care' then
        foreach v_slot in array c_slots loop
          insert into weekend_slots (organization_id, weekend_week_id, slot)
          values (v_org, v_week.id, v_slot) returning id into v_slot_id;
          select x.starts_at, x.ends_at into v_from, v_to from weekend_slot_window(v_week.week_start, v_slot) x;
          perform duty_create('weekend_slot', v_slot_id, weekend_slot_title(v_slot), weekend_slot_category(v_slot),
                              v_from, v_to, null, array[v_week.family_id], 'rota_publish');
          v_duties := v_duties + 1;
        end loop;
      else
        perform duty_create('rota_week', v_week.id, rota_job_title(v_week.job), 'rota_' || v_week.job,
                            v_week.week_start::timestamp at time zone 'Europe/Budapest',
                            ((v_week.week_start + 6)::timestamp + interval '23 hours 59 minutes 59 seconds') at time zone 'Europe/Budapest',
                            null, array[v_week.family_id], 'rota_publish');
        v_duties := v_duties + 1;
      end if;
    end loop;
    update rota_plans set status = 'published', published_at = now(), published_by = auth.uid() where id = v_plan.id;

    -- One notice, also by email, for each active parent with an account of every family that has a week (BR62.5). The
    -- once key makes a second publishing impossible to notify twice.
    select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_parents
      from parents p join families f on f.id = p.family_id
     where p.account_id is not null and p.status = 'active' and f.status = 'active'
       and p.family_id in (select w.family_id from rota_weeks w where w.plan_id = v_plan.id and w.family_id is not null);
    if cardinality(v_parents) > 0 then
      perform notice_send(v_parents, 'rota_published', 'rota_plan', v_plan.id, 'rota_published:' || v_plan.id::text);
    end if;

    perform platform_audit_write('rota.publish', 'rota_plan', v_plan.id, v_org, null, 'success',
                                 'duties:' || v_duties::text);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_plan.id);
    return platform_result('success', v_plan.id, null)
      || jsonb_build_object('version', v_plan.version + 1, 'duties', v_duties);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 17. The publishing notice lists all four rotas (BR62.5). The detail line holds the weeks of the reading parent's own
--     family for each rota and says that an indoor-cleaning or front-garden week comes with a weekend pick. It names no
--     other family (NFR10.2). The registry row of the notice is unchanged.
-- ---------------------------------------------------------------------------------------------------
create or replace function notice_facts_rota_plan(p_target_id uuid, p_parent_id uuid, p_kind text)
returns table (item_name text, item_date date, path text, full_title text, detail text)
language sql stable security definer set search_path from current
as $$
  select 'Beosztás'::text, null::date, '/szulo/beosztas', 'Közzétették a beosztást',
         coalesce((
           select string_agg(r.job_title || ', a ti heteitek: ' || r.weeks, '. ' order by r.job_order)
             from (select rota_job_order(w.job) as job_order, rota_job_title(w.job) as job_title,
                          string_agg(to_char(w.week_start, 'YYYY. MM. DD.') || ' – ' || to_char(w.week_start + 6, 'MM. DD.'),
                                     '; ' order by w.week_start) as weeks
                     from rota_weeks w
                     join parents pr on pr.id = p_parent_id and pr.family_id = w.family_id
                    where w.plan_id = p.id and p.status = 'published'
                    group by w.job) r), 'Belső takarítás, a ti heteitek: -')
         || case when exists (select 1 from rota_weeks w join parents pr on pr.id = p_parent_id and pr.family_id = w.family_id
                               where w.plan_id = p.id and w.job in ('indoor_cleaning', 'front_garden'))
                 then '. A belső takarítás és az előkert heteihez hétvégi feladatot is választanotok kell.' else '' end
    from rota_plans p
    join parents reader on reader.id = p_parent_id and reader.organization_id = p.organization_id
   where p.id = p_target_id
$$;

-- ---------------------------------------------------------------------------------------------------
-- 18. Function rights for this section (BR67.1).
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  rota_week_times(date),
  rota_job_title(text),
  rota_job_order(text),
  weekend_slot_title(text),
  weekend_slot_category(text),
  weekend_slot_window(date, text),
  duty_create(text, uuid, text, text, timestamptz, timestamptz, uuid, uuid[], text),
  rota_draft_compute(uuid, uuid),
  notice_facts_rota_plan(uuid, uuid, text)
  from public, anon, authenticated, service_role;

revoke all on function
  rota_plan_make(text, uuid),
  rota_week_set(text, uuid, uuid, integer),
  rota_plan_get(uuid),
  rota_plan_publish(text, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function
  rota_plan_make(text, uuid),
  rota_week_set(text, uuid, uuid, integer),
  rota_plan_get(uuid),
  rota_plan_publish(text, uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 19. Weekend picks (BR63.2 to BR63.9). A pick links a picking week (indoor cleaning or front garden) to the opening or
--     closing it took. It stores no family and no person: the picking family is the family of the rota week, so a later
--     change of that week cannot leave a pick out of date (entities.md). The slot's place says who holds the duty; the
--     pick and the place are always written in the same step (BR63.9).
-- ---------------------------------------------------------------------------------------------------
create table weekend_picks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rota_week_id uuid not null unique references rota_weeks (id),
  weekend_slot_id uuid not null unique references weekend_slots (id),
  source text not null check (source in ('family', 'administrator')),
  picked_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger weekend_picks_touch_version before update on weekend_picks
  for each row execute function platform_touch_version();
alter table weekend_picks enable row level security;
revoke all on weekend_picks from public, anon, authenticated, service_role;

-- A pick is only ever an opening or a closing, of the weekend of the picking week's own plan and week.
create or replace function weekend_picks_guard() returns trigger
language plpgsql set search_path from current
as $$
declare
  v_job text;
  v_plan uuid;
  v_week date;
  v_slot text;
  v_weekend_job text;
  v_weekend_plan uuid;
  v_weekend_week date;
begin
  select w.job, w.plan_id, w.week_start into v_job, v_plan, v_week from rota_weeks w where w.id = new.rota_week_id;
  select s.slot, ww.job, ww.plan_id, ww.week_start into v_slot, v_weekend_job, v_weekend_plan, v_weekend_week
    from weekend_slots s join rota_weeks ww on ww.id = s.weekend_week_id where s.id = new.weekend_slot_id;
  if v_job is null or v_job not in ('indoor_cleaning', 'front_garden')
     or v_slot is null or v_slot = 'shelter_cleaning'
     or v_weekend_job is distinct from 'weekend_animal_care'
     or v_plan is distinct from v_weekend_plan or v_week is distinct from v_weekend_week then
    raise exception 'weekend_picks: the pick does not fit its week or slot' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger weekend_picks_guard_row before insert or update on weekend_picks
  for each row execute function weekend_picks_guard();

-- The six notice kinds of this unit and the three checks are registered here and in section 22 (BR67.2). The kinds
-- come first because assigning a pick already sends one.
insert into notice_kinds (kind, target_type, title_prefix, label, added_by) values
  ('rota_week_reminder', 'task', 'Hamarosan a beosztásod:', 'Beosztás emlékeztető', 'U6'),
  ('weekend_pick_reminder', 'task', 'Válassz hétvégi feladatot:', 'Hétvégi választás emlékeztető', 'U6'),
  ('weekend_pick_overdue', 'task', 'Hiányzó hétvégi választás:', 'Hiányzó hétvégi választás', 'U6'),
  ('weekend_pick_assigned', 'task', 'Hétvégi feladatot kaptatok:', 'Hétvégi feladat kijelölve', 'U6'),
  ('weekend_slot_returned', 'task', 'Hétvégi feladat visszakerült hozzátok:', 'Hétvégi feladat visszakerült', 'U6'),
  ('weekend_picker_missing', 'task', 'Hiányzó hétvégi választó:', 'Hiányzó hétvégi választó', 'U6');

create or replace function weekend_slot_order(p_slot text) returns integer
language sql immutable set search_path from current
as $$ select array_position(array['saturday_opening', 'saturday_closing', 'sunday_opening', 'sunday_closing',
                                  'shelter_cleaning'], p_slot) $$;

-- Does this picking week owe a pick? A published indoor-cleaning or front-garden week with a family owes one, unless the
-- family is also that week's weekend family, the week has no weekend family, or the weekend had already started when
-- the plan was published (BR63.3). Internal and read-only.
create or replace function weekend_pick_owed(p_rota_week_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$
  select exists (
    select 1
      from rota_weeks w
      join rota_plans p on p.id = w.plan_id and p.status = 'published'
      join rota_weeks ww on ww.plan_id = w.plan_id and ww.job = 'weekend_animal_care' and ww.week_start = w.week_start
      join weekend_slots s on s.weekend_week_id = ww.id and s.slot = 'saturday_opening'
     where w.id = p_rota_week_id and w.job in ('indoor_cleaning', 'front_garden') and w.family_id is not null
       and ww.family_id is not null and ww.family_id <> w.family_id
       and p.published_at < (select t.saturday from rota_week_times(w.week_start) t))
$$;

-- The state of one weekend, as the duty card shows it (BR65.3): the five slots with their holders, and for each picking
-- week who has picked, who still may and who missed it. Names are family display names only. Internal and read-only;
-- the caller decides who may see it.
create or replace function weekend_picking_state(p_weekend_week_id uuid, p_now timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_wend rota_weeks%rowtype;
  v_t record;
  v_slots jsonb;
  v_pickers jsonb;
begin
  select * into v_wend from rota_weeks w where w.id = p_weekend_week_id and w.job = 'weekend_animal_care';
  if not found then
    return null;
  end if;
  select * into v_t from rota_week_times(v_wend.week_start);
  select coalesce(jsonb_agg(jsonb_build_object(
           'slot', s.slot, 'duty_id', t.id, 'place_version', a.version,
           'holder_family_display_name', family_display_name(a.family_id),
           'held_by_weekend_family', a.family_id = v_wend.family_id,
           'picked', pk.id is not null) order by weekend_slot_order(s.slot)), '[]'::jsonb)
    into v_slots
    from weekend_slots s
    join tasks t on t.origin_kind = 'weekend_slot' and t.origin_id = s.id
    left join assignments a on a.task_id = t.id and a.status <> 'removed'
    left join weekend_picks pk on pk.weekend_slot_id = s.id
   where s.weekend_week_id = v_wend.id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'job', w.job,
           'family_display_name', case when w.family_id is not null then family_display_name(w.family_id) end,
           'state', case when not weekend_pick_owed(w.id) then 'not_needed'
                         when pk.id is not null then 'picked'
                         when p_now >= v_t.saturday then 'missed'
                         else 'open' end,
           'slot', ps.slot) order by rota_job_order(w.job)), '[]'::jsonb)
    into v_pickers
    from rota_weeks w
    left join weekend_picks pk on pk.rota_week_id = w.id
    left join weekend_slots ps on ps.id = pk.weekend_slot_id
   where w.plan_id = v_wend.plan_id and w.week_start = v_wend.week_start and w.job in ('indoor_cleaning', 'front_garden');
  return jsonb_build_object(
    'week_start', v_wend.week_start,
    'picks_close_at', v_t.saturday,
    'change_until', v_t.friday_noon,
    'weekend_family_display_name', case when v_wend.family_id is not null then family_display_name(v_wend.family_id) end,
    'slots', v_slots,
    'pickers', v_pickers);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 20. The pick step (BR63.4 to BR63.9). Internal: writes or changes one pick and moves the slot's place, in the one
--     step the caller's transaction holds. The caller has checked who is asking and has taken the family locks. The
--     moment is a parameter so the time boundaries can be tested; the commands pass now().
--       - p_source 'family': a first pick until Saturday begins, a change until Friday noon;
--       - p_source 'administrator': a first pick or a change until Saturday begins.
--     Both families, the picking week, the pick, the slot's duty and its place are locked in that order, and the place
--     version the screen sent is compared with the real one: the loser of a race gets WEEKEND_SLOT_TAKEN (BR63.7).
-- ---------------------------------------------------------------------------------------------------
create or replace function weekend_pick_step(
  p_rota_week_id uuid, p_slot text, p_expected_version integer, p_source text, p_now timestamptz
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_week rota_weeks%rowtype;
  v_plan rota_plans%rowtype;
  v_wend rota_weeks%rowtype;
  v_slot weekend_slots%rowtype;
  v_old_slot weekend_slots%rowtype;
  v_pick weekend_picks%rowtype;
  v_task tasks%rowtype;
  v_old_task tasks%rowtype;
  v_place assignments%rowtype;
  v_old_place assignments%rowtype;
  v_t record;
  v_reason text;
  v_result jsonb;
begin
  select * into v_week from rota_weeks w where w.id = p_rota_week_id;
  if not found then
    perform platform_abort('validation', 'WEEKEND_PICK_NOT_NEEDED');
  end if;
  select * into v_wend from rota_weeks ww
   where ww.plan_id = v_week.plan_id and ww.job = 'weekend_animal_care' and ww.week_start = v_week.week_start;
  perform 1 from rota_weeks w where w.id in (v_week.id, v_wend.id) order by w.id for update;
  select * into v_week from rota_weeks w where w.id = p_rota_week_id;
  select * into v_plan from rota_plans p where p.id = v_week.plan_id;
  if v_plan.status <> 'published' or v_week.job not in ('indoor_cleaning', 'front_garden') or v_week.family_id is null
     or v_wend.id is null or v_wend.family_id is null or v_wend.family_id = v_week.family_id then
    perform platform_abort('validation', 'WEEKEND_PICK_NOT_NEEDED');
  end if;
  if p_slot is null or p_slot not in ('saturday_opening', 'saturday_closing', 'sunday_opening', 'sunday_closing',
                                      'shelter_cleaning') then
    perform platform_abort('validation', 'request_invalid');
  end if;
  if p_slot = 'shelter_cleaning' then
    perform platform_abort('validation', 'WEEKEND_SLOT_NOT_PICKABLE');
  end if;
  select * into v_slot from weekend_slots s where s.weekend_week_id = v_wend.id and s.slot = p_slot;
  if not found or not weekend_pick_owed(v_week.id) then
    perform platform_abort('validation', 'WEEKEND_PICK_NOT_NEEDED');
  end if;
  select * into v_t from rota_week_times(v_week.week_start);
  if p_now >= v_t.saturday then
    perform platform_abort('conflict', 'WEEKEND_PICK_CLOSED');
  end if;

  select * into v_pick from weekend_picks pk where pk.rota_week_id = v_week.id for update;
  if found and v_pick.weekend_slot_id = v_slot.id then
    return jsonb_build_object('pick_id', v_pick.id, 'duty_id', (select t.id from tasks t
                               where t.origin_kind = 'weekend_slot' and t.origin_id = v_slot.id), 'changed', false);
  end if;
  if found and p_source = 'family' and p_now >= v_t.friday_noon then
    perform platform_abort('conflict', 'WEEKEND_PICK_LOCKED');
  end if;
  v_reason := family_hold_reason(v_week.family_id, v_week.week_start);
  if v_reason is not null then
    perform platform_abort('validation', 'DUTY_INELIGIBLE', jsonb_build_object('reason', v_reason));
  end if;

  select * into v_task from tasks t where t.origin_kind = 'weekend_slot' and t.origin_id = v_slot.id;
  select * into v_place from assignments a where a.task_id = v_task.id and a.status <> 'removed';
  if found and v_pick.id is not null then
    select * into v_old_slot from weekend_slots s where s.id = v_pick.weekend_slot_id;
    select * into v_old_task from tasks t where t.origin_kind = 'weekend_slot' and t.origin_id = v_old_slot.id;
    select * into v_old_place from assignments a where a.task_id = v_old_task.id and a.status <> 'removed';
    perform place_lock(array[v_old_place.id, v_place.id]);
  else
    perform place_lock(array[v_place.id]);
  end if;
  select * into v_place from assignments a where a.id = v_place.id;
  if v_place.family_id is distinct from v_wend.family_id or p_expected_version is null
     or v_place.version <> p_expected_version then
    perform platform_abort('conflict', 'WEEKEND_SLOT_TAKEN');
  end if;

  -- Give the old slot back, then take the new one: two moves of one family's places in one transaction.
  if v_pick.id is not null then
    select * into v_old_place from assignments a where a.id = v_old_place.id;
    v_result := place_reassign(v_old_place.id, v_old_place.version, v_wend.family_id);
    update assignments set source = 'rota_publish' where id = v_old_place.id;
  end if;
  v_result := place_reassign(v_place.id, v_place.version, v_week.family_id);
  update assignments set source = 'weekend_pick' where id = v_place.id;
  if v_pick.id is null then
    insert into weekend_picks (organization_id, rota_week_id, weekend_slot_id, source, picked_at)
    values (v_week.organization_id, v_week.id, v_slot.id,
            case p_source when 'administrator' then 'administrator' else 'family' end, p_now)
    returning * into v_pick;
  else
    update weekend_picks
       set weekend_slot_id = v_slot.id,
           source = case p_source when 'administrator' then 'administrator' else 'family' end,
           picked_at = p_now
     where id = v_pick.id
    returning * into v_pick;
  end if;
  return jsonb_build_object('pick_id', v_pick.id, 'duty_id', v_task.id, 'changed', true);
end $$;

-- A parent of the picking family picks one free opening or closing of the weekend, or changes the pick (BR63.4,
-- BR63.5). A repeated call with the same key returns the stored result.
create or replace function weekend_pick_set(
  p_idempotency_key text, p_rota_week_id uuid, p_slot text, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'weekend_pick.set';
  v_org uuid;
  v_family uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_week rota_weeks%rowtype;
  v_done jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_rota_week_id::text, p_slot, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_family := directory_actor_family();
    if p_rota_week_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_week from rota_weeks w where w.id = p_rota_week_id and w.organization_id = v_org;
    if not found or v_family is null or v_week.family_id is distinct from v_family then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform rota_lock_families(v_org);
    v_done := weekend_pick_step(v_week.id, p_slot, p_expected_version, 'family', now());
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success',
                                       (v_done->>'pick_id')::uuid);
    return platform_result('success', (v_done->>'pick_id')::uuid, null)
      || jsonb_build_object('duty_id', v_done->>'duty_id');
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- A super admin assigns or changes a family's pick until the weekend starts (BR63.6). Audited without a name; the
-- family's parents get the notice weekend_pick_assigned.
create or replace function weekend_pick_assign(
  p_idempotency_key text, p_rota_week_id uuid, p_slot text, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'weekend_pick.assign';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_week rota_weeks%rowtype;
  v_done jsonb;
  v_parents uuid[];
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_rota_week_id::text, p_slot, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not coalesce(has_super_scope(v_org), false) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_rota_week_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_week from rota_weeks w where w.id = p_rota_week_id and w.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform rota_lock_families(v_org);
    v_done := weekend_pick_step(v_week.id, p_slot, p_expected_version, 'administrator', now());
    if (v_done->>'changed')::boolean then
      select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_parents
        from parents p join families f on f.id = p.family_id
       where p.family_id = v_week.family_id and p.account_id is not null and p.status = 'active' and f.status = 'active';
      if cardinality(v_parents) > 0 then
        perform notice_send(v_parents, 'weekend_pick_assigned', 'task', (v_done->>'duty_id')::uuid,
                            'weekend_pick_assigned:' || (v_done->>'duty_id') || ':' || (v_done->>'pick_id') || ':'
                            || (select pk.version::text from weekend_picks pk where pk.id = (v_done->>'pick_id')::uuid));
      end if;
      perform platform_audit_write('weekend_pick.assign', 'rota_week', v_week.id, v_org, null, 'success', 'slot:' || p_slot);
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success',
                                       (v_done->>'pick_id')::uuid);
    return platform_result('success', (v_done->>'pick_id')::uuid, null)
      || jsonb_build_object('duty_id', v_done->>'duty_id');
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 21. What people see (BR65.1 to BR65.4). The duty card of every rota and weekend duty, the overview of all four rotas
--     and the five weekend duties, and the administrator's unpicked list.
-- ---------------------------------------------------------------------------------------------------
create or replace function rota_duty_card(p_duty_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_task tasks%rowtype;
  v_week rota_weeks%rowtype;
  v_wend rota_weeks%rowtype;
  v_slot weekend_slots%rowtype;
  v_plan rota_plans%rowtype;
  v_holder uuid;
  v_actor uuid;
  v_t record;
  v_state jsonb;
  v_own jsonb;
  v_pick weekend_picks%rowtype;
  v_picker_state text;
  v_now timestamptz := now();
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not coalesce(can_read_community(), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select * into v_task from tasks t
   where t.id = p_duty_id and t.organization_id = v_org and t.origin_kind in ('rota_week', 'weekend_slot');
  if not found then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if v_task.origin_kind = 'rota_week' then
    select * into v_week from rota_weeks w where w.id = v_task.origin_id;
  else
    select * into v_slot from weekend_slots s where s.id = v_task.origin_id;
    select * into v_week from rota_weeks w where w.id = v_slot.weekend_week_id;
  end if;
  select * into v_plan from rota_plans p where p.id = v_week.plan_id and p.status = 'published';
  select a.family_id into v_holder from assignments a where a.task_id = v_task.id and a.status <> 'removed' limit 1;
  v_actor := directory_actor_family();
  if v_plan.id is null
     or not (coalesce(has_super_scope(v_org), false) or (v_actor is not null and v_actor = v_holder)) then
    return platform_result('denied', null, 'authorization_denied');
  end if;

  select * into v_t from rota_week_times(v_week.week_start);
  -- The weekend part: for the picking weeks and the weekend duties, to the holders and the super admins (BR65.3).
  if v_week.job in ('indoor_cleaning', 'front_garden', 'weekend_animal_care') then
    select * into v_wend from rota_weeks ww
     where ww.plan_id = v_week.plan_id and ww.job = 'weekend_animal_care' and ww.week_start = v_week.week_start;
    v_state := case when v_wend.id is not null then weekend_picking_state(v_wend.id, v_now) end;
  end if;
  -- What the picking family itself can do (the screen's picker).
  if v_task.origin_kind = 'rota_week' and v_week.job in ('indoor_cleaning', 'front_garden') and v_actor is not null
     and v_actor = v_week.family_id then
    select * into v_pick from weekend_picks pk where pk.rota_week_id = v_week.id;
    v_picker_state := case when v_state is null or not weekend_pick_owed(v_week.id) then 'not_needed'
                           when v_pick.id is not null then 'picked'
                           when v_now >= v_t.saturday then 'missed'
                           else 'open' end;
    v_own := jsonb_build_object(
      'rota_week_id', v_week.id,
      'state', v_picker_state,
      'slot', (select s.slot from weekend_slots s where s.id = v_pick.weekend_slot_id),
      'can_pick', v_picker_state in ('open', 'picked') and v_now < v_t.saturday
                  and (v_pick.id is null or v_now < v_t.friday_noon),
      'free_slots', case when v_picker_state in ('open', 'picked') and v_now < v_t.saturday
                           and (v_pick.id is null or v_now < v_t.friday_noon)
                         then (select coalesce(jsonb_agg(jsonb_build_object('slot', x->>'slot', 'duty_id', x->>'duty_id',
                                                                              'place_version', (x->>'place_version')::integer)), '[]'::jsonb)
                                 from jsonb_array_elements(v_state->'slots') x
                                where (x->>'held_by_weekend_family')::boolean and x->>'slot' <> 'shelter_cleaning')
                         else '[]'::jsonb end,
      'picks_close_at', v_t.saturday,
      'change_until', v_t.friday_noon);
  end if;
  return platform_result('success', v_task.id, null) || jsonb_build_object('item', jsonb_build_object(
    'duty_id', v_task.id,
    'job', v_week.job,
    'slot', v_slot.slot,
    'title', v_task.title,
    'family_display_name', family_display_name(v_holder),
    'week_start', v_week.week_start,
    'week_end', v_week.week_start + 6,
    'no_fixed_day', v_task.origin_kind = 'rota_week',
    'is_break_week', exists (select 1 from school_weeks(v_plan.school_year_id) sw
                              where sw.week_start = v_week.week_start and sw.is_break),
    'includes_watering', v_week.job = 'front_garden' and v_task.origin_kind = 'rota_week'
                         and extract(month from v_week.week_start) between 3 and 10,
    'bottles_at_week_end', v_week.job = 'water_carrying',
    'day', case v_slot.slot when 'saturday_opening' then 'saturday' when 'saturday_closing' then 'saturday'
                            when 'sunday_opening' then 'sunday' when 'sunday_closing' then 'sunday'
                            when 'shelter_cleaning' then 'weekend' end,
    'part_of_day', case v_slot.slot when 'saturday_opening' then 'morning' when 'sunday_opening' then 'morning'
                                    when 'saturday_closing' then 'evening' when 'sunday_closing' then 'evening'
                                    when 'shelter_cleaning' then 'all_day' end,
    'weekend', v_state,
    'own_pick', v_own));
end $$;

create or replace function rota_overview() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_year school_years%rowtype;
  v_plan rota_plans%rowtype;
  v_family uuid;
  v_items jsonb;
  v_weekend jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not coalesce(can_read_community(), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select * into v_year from school_years s where s.id = rota_pick_school_year(v_org);
  if not found then
    return platform_result('success', null, null)
      || jsonb_build_object('overview_state', 'nothing_published', 'school_year', null, 'items', '[]'::jsonb,
                            'weekend_items', '[]'::jsonb);
  end if;
  select * into v_plan from rota_plans p where p.school_year_id = v_year.id and p.status = 'published';
  if not found then
    return platform_result('success', null, null)
      || jsonb_build_object('overview_state', 'nothing_published',
                            'school_year', jsonb_build_object('id', v_year.id, 'name', v_year.name),
                            'items', '[]'::jsonb, 'weekend_items', '[]'::jsonb);
  end if;
  v_family := directory_actor_family();
  select coalesce(jsonb_agg(jsonb_build_object(
           'job', j.job,
           'week_start', sw.week_start,
           'is_break', sw.is_break,
           'family_id', rw.family_id,
           'family_display_name', case when rw.family_id is not null then family_display_name(rw.family_id) end,
           'is_own', v_family is not null and rw.family_id = v_family,
           'duty_id', case when v_family is not null and rw.family_id = v_family then t.id end)
         order by sw.week_start, rota_job_order(j.job)), '[]'::jsonb)
    into v_items
    from school_weeks(v_year.id) sw
    cross join (values ('indoor_cleaning'), ('front_garden'), ('water_carrying'), ('weekend_animal_care')) as j(job)
    left join rota_weeks rw on rw.plan_id = v_plan.id and rw.job = j.job and rw.week_start = sw.week_start
    left join tasks t on t.origin_kind = 'rota_week' and t.origin_id = rw.id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'week_start', ww.week_start,
           'slot', s.slot,
           'family_id', a.family_id,
           'family_display_name', case when a.family_id is not null then family_display_name(a.family_id) end,
           'is_own', v_family is not null and a.family_id = v_family,
           'duty_id', case when v_family is not null and a.family_id = v_family then t.id end)
         order by ww.week_start, weekend_slot_order(s.slot)), '[]'::jsonb)
    into v_weekend
    from weekend_slots s
    join rota_weeks ww on ww.id = s.weekend_week_id and ww.plan_id = v_plan.id
    join tasks t on t.origin_kind = 'weekend_slot' and t.origin_id = s.id
    left join assignments a on a.task_id = t.id and a.status <> 'removed';
  return platform_result('success', v_plan.id, null)
    || jsonb_build_object('overview_state', 'published',
                          'school_year', jsonb_build_object('id', v_year.id, 'name', v_year.name),
                          'items', v_items, 'weekend_items', v_weekend);
end $$;

-- The unpicked list (BR63.8, BR65.4): super admins only. The owed picks not yet made, from this week on, each with its
-- free openings and closings, and the picks nobody made in time during the school year.
create or replace function weekend_unpicked_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_year school_years%rowtype;
  v_plan rota_plans%rowtype;
  v_now timestamptz := now();
  v_open jsonb;
  v_missed jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if v_org is null or not coalesce(has_super_scope(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_year from school_years s where s.id = rota_pick_school_year(v_org);
  if found then
    select * into v_plan from rota_plans p where p.school_year_id = v_year.id and p.status = 'published';
  end if;
  if v_plan.id is null then
    return platform_result('success', null, null)
      || jsonb_build_object('items', '[]'::jsonb, 'missed', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'rota_week_id', w.id, 'job', w.job, 'week_start', w.week_start,
           'family_display_name', family_display_name(w.family_id),
           'weekend_family_display_name', family_display_name(ww.family_id),
           'picks_close_at', t.saturday, 'change_until', t.friday_noon,
           'free_slots', (select coalesce(jsonb_agg(jsonb_build_object('slot', x->>'slot', 'duty_id', x->>'duty_id',
                                                                         'place_version', (x->>'place_version')::integer)), '[]'::jsonb)
                            from jsonb_array_elements(weekend_picking_state(ww.id, v_now)->'slots') x
                           where (x->>'held_by_weekend_family')::boolean and x->>'slot' <> 'shelter_cleaning'))
         order by w.week_start, rota_job_order(w.job)), '[]'::jsonb)
    into v_open
    from rota_weeks w
    join rota_weeks ww on ww.plan_id = w.plan_id and ww.job = 'weekend_animal_care' and ww.week_start = w.week_start
    cross join lateral rota_week_times(w.week_start) t
   where w.plan_id = v_plan.id and w.job in ('indoor_cleaning', 'front_garden')
     and weekend_pick_owed(w.id) and v_now < t.saturday
     and not exists (select 1 from weekend_picks pk where pk.rota_week_id = w.id);
  select coalesce(jsonb_agg(jsonb_build_object(
           'rota_week_id', w.id, 'job', w.job, 'week_start', w.week_start,
           'family_display_name', family_display_name(w.family_id),
           'weekend_family_display_name', family_display_name(ww.family_id))
         order by w.week_start, rota_job_order(w.job)), '[]'::jsonb)
    into v_missed
    from rota_weeks w
    join rota_weeks ww on ww.plan_id = w.plan_id and ww.job = 'weekend_animal_care' and ww.week_start = w.week_start
    cross join lateral rota_week_times(w.week_start) t
   where w.plan_id = v_plan.id and w.job in ('indoor_cleaning', 'front_garden')
     and weekend_pick_owed(w.id) and v_now >= t.saturday
     and not exists (select 1 from weekend_picks pk where pk.rota_week_id = w.id);
  return platform_result('success', v_plan.id, null) || jsonb_build_object('items', v_open, 'missed', v_missed);
end $$;

revoke all on function
  weekend_picks_guard(),
  weekend_slot_order(text),
  weekend_pick_owed(uuid),
  weekend_picking_state(uuid, timestamptz),
  weekend_pick_step(uuid, text, integer, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function
  weekend_pick_set(text, uuid, text, integer),
  weekend_pick_assign(text, uuid, text, integer),
  rota_duty_card(uuid),
  rota_overview(),
  weekend_unpicked_list()
  from public, anon, authenticated, service_role;
grant execute on function
  weekend_pick_set(text, uuid, text, integer),
  weekend_pick_assign(text, uuid, text, integer),
  rota_duty_card(uuid),
  rota_overview(),
  weekend_unpicked_list()
  to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 22. The notices of this unit (BR64.6). Rota and weekend duties link to their card, the two administrator kinds to the
--     unpicked list on the dashboard. The text is built from the duty alone: job, week, slot; the administrator kinds
--     also name the family. Nothing here holds a phone number, an email address or a child's name.
-- ---------------------------------------------------------------------------------------------------
create or replace function notice_facts_task(p_target_id uuid, p_parent_id uuid, p_kind text)
returns table (item_name text, item_date date, path text, full_title text, detail text)
language sql stable security definer set search_path from current
as $$
  select t.title,
         (t.starts_at at time zone 'Europe/Budapest')::date,
         case when p_kind in ('weekend_pick_overdue', 'weekend_picker_missing') then '/admin'
              when t.origin_kind in ('rota_week', 'weekend_slot') then '/szulo/beosztas/' || t.id::text
              else '/szulo/feladatok/' || t.id::text end,
         null::text,
         case p_kind
           when 'rota_week_reminder' then t.title || ', ' || ctx.week_text
           when 'weekend_pick_reminder' then
             'Válasszatok egy nyitást vagy zárást a hétvégéhez (' || ctx.week_text
             || '): szombat éjfélig lehet választani, péntek délig módosítani.'
           when 'weekend_pick_overdue' then
             'Egy család még nem választott hétvégi nyitást vagy zárást (' || t.title || ', ' || ctx.week_text
             || '). A névsor a "Ki nem választott?" listán van.'
           when 'weekend_pick_assigned' then
             'Az adminisztrátor kijelölte a hétvégi feladatotokat: ' || t.title || ', '
             || to_char((t.starts_at at time zone 'Europe/Budapest')::date, 'YYYY. MM. DD.') || '.'
           when 'weekend_slot_returned' then
             'Nincs család, amely a hétvégi nyitást vagy zárást választaná (' || ctx.week_text
             || '), ezért a hétvégi feladatok nálatok maradnak.'
           when 'weekend_picker_missing' then
             'Nincs család az előkertre vagy a belső takarításra (' || ctx.week_text
             || '), a hétvégi feladatok a hétvégi családnál maradnak.'
         end
    from tasks t
    join parents p on p.id = p_parent_id and p.organization_id = t.organization_id
    cross join lateral (
      select to_char(c.week_start, 'YYYY. MM. DD.') || ' – ' || to_char(c.week_start + 6, 'MM. DD.') as week_text
        from (select coalesce(
                       (select w.week_start from rota_weeks w where t.origin_kind = 'rota_week' and w.id = t.origin_id),
                       (select ww.week_start from weekend_slots s join rota_weeks ww on ww.id = s.weekend_week_id
                         where t.origin_kind = 'weekend_slot' and s.id = t.origin_id),
                       (t.starts_at at time zone 'Europe/Budapest')::date) as week_start) c
    ) ctx
   where t.id = p_target_id
$$;

-- Internal helpers of the checks. The parents of a family that can read a notice, and those of the super admins.
create or replace function rota_notice_parents(p_family_id uuid) returns uuid[]
language sql stable security definer set search_path from current
as $$
  select coalesce(array_agg(p.id order by p.id), '{}'::uuid[])
    from parents p join families f on f.id = p.family_id
   where p.family_id = p_family_id and p.account_id is not null and p.status = 'active' and f.status = 'active'
$$;

create or replace function rota_notice_super_admins(p_organization_id uuid) returns uuid[]
language sql stable security definer set search_path from current
as $$
  select coalesce(array_agg(p.id order by p.id), '{}'::uuid[])
    from parents p
   where p.organization_id = p_organization_id and p.account_id is not null and p.status = 'active'
     and exists (select 1 from app_role_grants g
                  where g.subject_id = p.account_id and g.role = 'super_admin' and g.revoked_at is null
                    and g.organization_id = p_organization_id)
$$;

-- The weekly duty of a rota week and the shelter-cleaning duty of a weekend week.
create or replace function rota_week_duty(p_rota_week_id uuid) returns uuid
language sql stable security definer set search_path from current
as $$ select t.id from tasks t where t.origin_kind = 'rota_week' and t.origin_id = p_rota_week_id $$;

create or replace function weekend_shelter_duty(p_weekend_week_id uuid) returns uuid
language sql stable security definer set search_path from current
as $$
  select t.id from weekend_slots s join tasks t on t.origin_kind = 'weekend_slot' and t.origin_id = s.id
   where s.weekend_week_id = p_weekend_week_id and s.slot = 'shelter_cleaning'
$$;

-- ---------------------------------------------------------------------------------------------------
-- 23. The three checks of the timed run (BR64.1 to BR64.5). Each takes the moment of the run, reads published plans
--     only, sends through notice_send_core with a once key built from the kind and the week or duty, and returns how
--     many notices it created and how many cases it skipped. A run made late still sends what is due and not yet
--     sent; a second run sends nothing. They run as the system and are callable by nobody else.
-- ---------------------------------------------------------------------------------------------------

-- The alert for the administrators (BR64.2), shared by the Friday-noon run and, for a run that came late, the daily run.
create or replace function weekend_pick_alert_send(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_row record;
  v_parents uuid[];
  v_n integer;
  v_created integer := 0;
  v_skipped integer := 0;
begin
  for v_row in
    select w.id as week_id, w.organization_id, rota_week_duty(w.id) as duty_id
      from rota_weeks w
      join rota_plans p on p.id = w.plan_id and p.status = 'published'
      cross join lateral rota_week_times(w.week_start) t
     where w.job in ('indoor_cleaning', 'front_garden') and weekend_pick_owed(w.id)
       and p_now >= t.friday_noon and p_now < t.ends_at
       and not exists (select 1 from weekend_picks pk where pk.rota_week_id = w.id)
     order by w.id
  loop
    v_parents := rota_notice_super_admins(v_row.organization_id);
    if v_row.duty_id is null or cardinality(v_parents) = 0 then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_n := notice_send_core(v_parents, 'weekend_pick_overdue', 'task', v_row.duty_id,
                            'weekend_pick_overdue:' || v_row.week_id::text, null);
    if v_n > 0 then v_created := v_created + v_n; else v_skipped := v_skipped + 1; end if;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end $$;

create or replace function weekend_picks_due_check(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_row record;
  v_parents uuid[];
  v_n integer;
  v_created integer := 0;
  v_skipped integer := 0;
  v_alert jsonb;
begin
  -- The reminder to a family that has not picked, from the Wednesday before the weekend (BR64.1).
  for v_row in
    select w.id as week_id, w.family_id, rota_week_duty(w.id) as duty_id
      from rota_weeks w
      join rota_plans p on p.id = w.plan_id and p.status = 'published'
      cross join lateral rota_week_times(w.week_start) t
     where w.job in ('indoor_cleaning', 'front_garden') and weekend_pick_owed(w.id)
       and p_now >= t.wednesday and p_now < t.saturday
       and not exists (select 1 from weekend_picks pk where pk.rota_week_id = w.id)
     order by w.id
  loop
    v_parents := rota_notice_parents(v_row.family_id);
    if v_row.duty_id is null or cardinality(v_parents) = 0 then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_n := notice_send_core(v_parents, 'weekend_pick_reminder', 'task', v_row.duty_id,
                            'weekend_pick_reminder:' || v_row.week_id::text, null);
    if v_n > 0 then v_created := v_created + v_n; else v_skipped := v_skipped + 1; end if;
  end loop;

  -- A picking family is missing: the front garden has no family, or it is not a break week and indoor cleaning has none
  -- (BR64.3). The weekend family and the administrators are told once for each week and job.
  for v_row in
    select ww.id as weekend_id, ww.organization_id, ww.family_id as weekend_family, w.job,
           weekend_shelter_duty(ww.id) as duty_id
      from rota_weeks ww
      join rota_plans p on p.id = ww.plan_id and p.status = 'published'
      join rota_weeks w on w.plan_id = ww.plan_id and w.week_start = ww.week_start
                       and w.job in ('indoor_cleaning', 'front_garden') and w.family_id is null
      cross join lateral rota_week_times(ww.week_start) t
     where ww.job = 'weekend_animal_care' and ww.family_id is not null
       and p_now >= t.wednesday and p_now < t.saturday
       and (w.job = 'front_garden'
            or not exists (select 1 from school_weeks(p.school_year_id) sw
                            where sw.week_start = ww.week_start and sw.is_break))
     order by ww.id, w.job
  loop
    if v_row.duty_id is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_parents := rota_notice_parents(v_row.weekend_family);
    if cardinality(v_parents) > 0 then
      v_n := notice_send_core(v_parents, 'weekend_slot_returned', 'task', v_row.duty_id,
                              'weekend_slot_returned:' || v_row.weekend_id::text || ':' || v_row.job, null);
      if v_n > 0 then v_created := v_created + v_n; else v_skipped := v_skipped + 1; end if;
    end if;
    v_parents := rota_notice_super_admins(v_row.organization_id);
    if cardinality(v_parents) > 0 then
      v_n := notice_send_core(v_parents, 'weekend_picker_missing', 'task', v_row.duty_id,
                              'weekend_picker_missing:' || v_row.weekend_id::text || ':' || v_row.job, null);
      if v_n > 0 then v_created := v_created + v_n; else v_skipped := v_skipped + 1; end if;
    end if;
  end loop;

  -- A run that comes late still sends the alert that is due (BR64.5).
  v_alert := weekend_pick_alert_send(p_now);
  return jsonb_build_object('created', v_created + (v_alert->>'created')::integer,
                            'skipped', v_skipped + (v_alert->>'skipped')::integer);
end $$;

create or replace function weekend_picks_alert_check(p_now timestamptz) returns jsonb
language sql security definer set search_path from current
as $$ select weekend_pick_alert_send(p_now) $$;

-- The reminder on the Friday before a rota week (BR64.4): the family holding the week's indoor-cleaning, front-garden or
-- water-carrying duty, and the family holding the weekend's shelter cleaning, once for each duty.
create or replace function rota_week_reminder_check(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_row record;
  v_parents uuid[];
  v_n integer;
  v_created integer := 0;
  v_skipped integer := 0;
begin
  for v_row in
    select d.duty_id
      from (
        select rota_week_duty(w.id) as duty_id, w.week_start
          from rota_weeks w join rota_plans p on p.id = w.plan_id and p.status = 'published'
         where w.job in ('indoor_cleaning', 'front_garden', 'water_carrying') and w.family_id is not null
        union all
        select weekend_shelter_duty(ww.id), ww.week_start
          from rota_weeks ww join rota_plans p on p.id = ww.plan_id and p.status = 'published'
         where ww.job = 'weekend_animal_care' and ww.family_id is not null) d
     cross join lateral rota_week_times(d.week_start) t
     where d.duty_id is not null and p_now >= t.reminder_from and p_now < t.starts_at
     order by d.duty_id
  loop
    v_parents := rota_notice_parents((select a.family_id from assignments a
                                       where a.task_id = v_row.duty_id and a.status <> 'removed' limit 1));
    if cardinality(v_parents) = 0 then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_n := notice_send_core(v_parents, 'rota_week_reminder', 'task', v_row.duty_id,
                            'rota_week_reminder:' || v_row.duty_id::text, null);
    if v_n > 0 then v_created := v_created + v_n; else v_skipped := v_skipped + 1; end if;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end $$;

insert into timed_check_registry (check_name, function_name, run_kind, is_active, lock_step, added_by) values
  ('weekend_picks_reminder', 'weekend_picks_due_check', 'daily', true, 4, 'U6'),
  ('weekend_picks_alert', 'weekend_picks_alert_check', 'friday_noon', true, 4, 'U6'),
  ('rota_week_reminder', 'rota_week_reminder_check', 'daily', true, 4, 'U6');

-- ---------------------------------------------------------------------------------------------------
-- 24. What later units call (C11, C12, C16; BR66.1 to BR66.4). Internal: granted to nobody.
-- ---------------------------------------------------------------------------------------------------

-- Would a set of place changes, taken together, give one family indoor cleaning and front garden in one week? Read-only;
-- it looks at nothing else, eligibility is the caller's check (BR66.1). The changes are an array of
-- { place_id, new_family_id }.
create or replace function rota_check_change(p_changes jsonb) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_clash boolean;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    return jsonb_build_object('allowed', false, 'code', 'request_invalid');
  end if;
  select exists (
    select 1
      from (
        select w.plan_id, w.week_start, w.job,
               coalesce(ch.new_family_id, a.family_id, w.family_id) as holder
          from (select distinct w2.plan_id, w2.week_start
                  from (select (e->>'place_id')::uuid as place_id from jsonb_array_elements(p_changes) e) c
                  join assignments a2 on a2.id = c.place_id
                  join tasks t2 on t2.id = a2.task_id and t2.origin_kind = 'rota_week'
                  join rota_weeks w2 on w2.id = t2.origin_id and w2.job in ('indoor_cleaning', 'front_garden')) aff
          join rota_weeks w on w.plan_id = aff.plan_id and w.week_start = aff.week_start
                           and w.job in ('indoor_cleaning', 'front_garden')
          left join tasks t on t.origin_kind = 'rota_week' and t.origin_id = w.id
          left join assignments a on a.task_id = t.id and a.status <> 'removed'
          left join (select (e->>'place_id')::uuid as place_id, (e->>'new_family_id')::uuid as new_family_id
                       from jsonb_array_elements(p_changes) e) ch on ch.place_id = a.id) h
     where h.holder is not null
     group by h.plan_id, h.week_start, h.holder
    having count(distinct h.job) = 2) into v_clash;
  return jsonb_build_object('allowed', not v_clash, 'code', case when v_clash then 'ROTA_SAME_WEEK_CLASH' end);
end $$;

-- After a rota duty has changed hands, the plan and the weekend follow it (BR66.2). Called in the same step as the
-- change. For each changed place the rota week takes the new family. For a picking week with a pick: the slot moves to
-- the new family and the pick stays when the new family is not that week's weekend family and picks have not closed;
-- otherwise the pick is removed, the slot returns to the weekend family, and the new family is asked to pick when it
-- still owes one. For a weekend family's week, named by its shelter-cleaning place: every weekend place the old family
-- still held moves to the new family, and a pick the new family had for that weekend is removed. Returns the number of
-- picks reopened. Once the weekend has started nothing moves: the duties are under way.
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
      update rota_weeks set family_id = v_change.new_family_id, empty_reason = null where id = v_week.id;
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
            if v_change.new_family_id is distinct from v_wend.family_id then
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

-- Which family is on a rota week (C12, BR66.3): the family of that job's row for that Monday in a published plan, or null.
create or replace function rota_family_for(p_job text, p_week_start date) returns uuid
language sql stable security definer set search_path from current
as $$
  select w.family_id
    from rota_weeks w join rota_plans p on p.id = w.plan_id and p.status = 'published'
   where w.job = p_job and w.week_start = p_week_start
     and (platform_caller_is_system() or w.organization_id = identity_actor_organization())
   order by p.published_at desc
   limit 1
$$;

-- Removing a family: its future rota weeks and picks show as flagged by BR60.5 with no further write, so the preview and
-- the apply return the same count and change nothing. A parent holds nothing here (C16, BR66.4).
create or replace function rota_planning_removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language sql stable security definer set search_path from current
as $$
  select jsonb_build_object('to_clear', 0, 'to_flag',
    case when p_subject_kind = 'family' then
      (select count(*)::integer from rota_weeks w
        where w.family_id = p_subject_id and w.week_start >= date_trunc('week', school_today()::timestamp)::date)
      + (select count(*)::integer from weekend_picks pk join rota_weeks w on w.id = pk.rota_week_id
          where w.family_id = p_subject_id and w.week_start >= date_trunc('week', school_today()::timestamp)::date)
    else 0 end)
$$;

create or replace function rota_planning_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language sql stable security definer set search_path from current
as $$ select rota_planning_removal_preview(p_subject_kind, p_subject_id) $$;

revoke all on function
  notice_facts_task(uuid, uuid, text),
  rota_notice_parents(uuid),
  rota_notice_super_admins(uuid),
  rota_week_duty(uuid),
  weekend_shelter_duty(uuid),
  weekend_pick_alert_send(timestamptz),
  weekend_picks_due_check(timestamptz),
  weekend_picks_alert_check(timestamptz),
  rota_week_reminder_check(timestamptz),
  rota_check_change(jsonb),
  rota_adjust_picks_after_change(jsonb),
  rota_family_for(text, date),
  rota_planning_removal_preview(text, uuid),
  rota_planning_removal_apply(text, uuid)
  from public, anon, authenticated, service_role;

-- @@NEXT-SECTION@@

commit;
