-- U2 of the Ovis tábla work: the school calendar, the shared duty and place model, and the first rota (indoor
-- cleaning): draft, adjust, discard and publish (W1 to W9 of functional-spec.md; BR20 to BR27; contracts C3, C4,
-- C5 and C18). The file opens and commits its own transaction, as 20261047_community_foundation.sql does, because
-- the migration runner adds none: the structure change and the rewritten functions succeed or fail together.
-- Technical names stay ("Conversion of Existing Code"): a duty is a `tasks` row and a place is an `assignments` row.
--
-- Refusals. A command looks an item up inside the caller's community only. A plan, a week or a break week that is
-- missing and one that belongs to another community give the same denied result (NFR3.3).
--
-- Lock order (C1, scalability-design.md): the active family rows of the community ascending, then the plan row, then
-- its week rows ascending, then duty rows ascending, then place rows ascending. Every function that changes a plan
-- takes its locks in this order and only forward.
begin;

-- ---------------------------------------------------------------------------------------------------
-- 1. The structure change.
-- ---------------------------------------------------------------------------------------------------

-- The changeover date of a school year (BR20.3): 1 July of the calendar year in which the year ends, unless a value
-- is given. It is never before the year starts, so a year that starts later than that 1 July uses its own start.
alter table school_years add column changeover_date date;
update school_years
   set changeover_date = greatest(make_date(extract(year from ends_on)::integer, 7, 1), starts_on);
alter table school_years alter column changeover_date set not null;
alter table school_years add constraint school_years_changeover_not_before_start check (changeover_date >= starts_on);

create or replace function school_years_default_changeover() returns trigger
language plpgsql set search_path from current
as $$
begin
  if new.changeover_date is null then
    new.changeover_date := greatest(make_date(extract(year from new.ends_on)::integer, 7, 1), new.starts_on);
  end if;
  return new;
end $$;
create trigger school_years_default_changeover before insert on school_years
  for each row execute function school_years_default_changeover();

-- One school-break week of a school year (BR20.1). Every rota reads it as a week with no duty.
create table break_weeks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  school_year_id uuid not null,
  week_start date not null check (extract(isodow from week_start) = 1),
  label text check (label is null or char_length(label) between 1 and 100),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_year_id, organization_id) references school_years (id, organization_id),
  unique (school_year_id, week_start)
);
create index break_weeks_organization on break_weeks (organization_id, week_start);
create trigger break_weeks_touch_version before update on break_weeks
  for each row execute function platform_touch_version();

-- The yearly rota of one school year (BR21.1): at most one per year, a draft until it is published.
create table rota_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  school_year_id uuid not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  published_by uuid,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_year_id, organization_id) references school_years (id, organization_id),
  unique (school_year_id),
  unique (id, organization_id),
  check ((status = 'published') = (published_at is not null)),
  check ((status = 'published') = (published_by is not null))
);
create trigger rota_plans_touch_version before update on rota_plans
  for each row execute function platform_touch_version();

-- The family on one rota for one week of a plan (BR21.2, BR22.1). The family is an id only; the functions check it
-- (ADR-010).
create table rota_weeks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  plan_id uuid not null,
  job text not null default 'indoor_cleaning' check (job in ('indoor_cleaning')),
  week_start date not null check (extract(isodow from week_start) = 1),
  family_id uuid,
  empty_reason text check (empty_reason in ('no_family', 'cleared')),
  changed_by_admin boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (plan_id, organization_id) references rota_plans (id, organization_id),
  unique (plan_id, job, week_start),
  check (family_id is null or empty_reason is null)
);
create index rota_weeks_family on rota_weeks (family_id) where family_id is not null;
create trigger rota_weeks_touch_version before update on rota_weeks
  for each row execute function platform_touch_version();

-- Application roles read only what they may and write nothing (BR27.2). A draft plan and its rows are a super
-- admin's; every other role reads the published rota through the overview function.
alter table break_weeks enable row level security;
alter table rota_plans enable row level security;
alter table rota_weeks enable row level security;
create policy break_weeks_read on break_weeks for select to authenticated
  using (directory_school_year_visible(organization_id, school_year_id));
create policy rota_plans_read on rota_plans for select to authenticated
  using (has_super_scope(organization_id));
create policy rota_weeks_read on rota_weeks for select to authenticated
  using (has_super_scope(organization_id));
revoke all on break_weeks, rota_plans, rota_weeks from public, anon, authenticated, service_role;
grant select on break_weeks, rota_plans, rota_weeks to authenticated;

-- Where a duty came from (ADR-002). Every existing row and every row made by task_save is manual.
alter table tasks add column origin_kind text not null default 'manual' check (origin_kind in ('manual', 'rota_week'));
alter table tasks add column origin_id uuid;
alter table tasks add constraint tasks_origin_consistent check ((origin_kind = 'manual') = (origin_id is null));
create unique index tasks_one_per_origin on tasks (origin_kind, origin_id) where origin_id is not null;

-- The done mark of a place (C18) and the rota source (C4). The mark is set once.
alter table assignments add column done_at timestamptz;
alter table assignments add column done_by uuid;
alter table assignments add constraint assignments_done_pair check ((done_at is null) = (done_by is null));
alter table assignments drop constraint assignments_source_check;
alter table assignments add constraint assignments_source_check
  check (source in ('parent_sign_up', 'admin_assign', 'swap', 'rota_publish'));

create or replace function assignments_guard_done() returns trigger
language plpgsql set search_path from current
as $$
begin
  if old.done_at is not null and (new.done_at is distinct from old.done_at or new.done_by is distinct from old.done_by) then
    raise exception 'assignments: the done mark is set once' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger assignments_guard_done before update on assignments
  for each row execute function assignments_guard_done();

-- The publishing notice (BR23.4): kind rota_published, target rota_plan, no task. The task link and the start time are
-- required for every other kind. The text is built when the list is read, so the row holds no name.
alter table notifications drop constraint notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
  'sign_up_confirmed', 'swap_requested', 'swap_decided', 'cancellation_decided', 'place_removed',
  'reminder_7d', 'reminder_24h', 'rota_published'));
alter table notifications drop constraint notifications_target_type_check;
alter table notifications add constraint notifications_target_type_check
  check (target_type in ('task', 'change_request', 'rota_plan'));
alter table notifications alter column task_id drop not null;
alter table notifications alter column task_starts_at drop not null;
alter table notifications add constraint notifications_task_shape check (
  (kind = 'rota_published' and target_type = 'rota_plan' and task_id is null and task_starts_at is null)
  or (kind <> 'rota_published' and target_type <> 'rota_plan' and task_id is not null and task_starts_at is not null));

-- Publishing and discarding a draft are audited (BR23.5).
alter table audit_events drop constraint audit_events_action_check;
alter table audit_events add constraint audit_events_action_check check (action in (
  'role.grant', 'role.revoke', 'role.first_super_admin',
  'approval.approve', 'approval.reject',
  'import.commit',
  'lifecycle.anonymize', 'lifecycle.delete', 'lifecycle.hold_place', 'lifecycle.hold_release',
  'account.deactivate', 'account.reactivate',
  'rota.publish', 'rota.discard'
));

-- ---------------------------------------------------------------------------------------------------
-- 2. The school calendar (C3, BR20.4). Internal. A school week is a Monday-to-Sunday week of which at least one
--    weekday falls inside the school year's dates; a week is named by its Monday (entities.md).
-- ---------------------------------------------------------------------------------------------------

-- Today's date in Budapest time (the week of a date is found in that time zone).
create or replace function school_today() returns date
language sql stable set search_path from current
as $$ select (now() at time zone 'Europe/Budapest')::date $$;

create or replace function school_year_for(p_date date, p_organization_id uuid default null) returns uuid
language sql stable security definer set search_path from current
as $$
  select s.id from school_years s
   where s.organization_id = coalesce(p_organization_id, identity_actor_organization())
     and s.status = 'active' and p_date between s.starts_on and s.ends_on
   order by s.starts_on desc, s.id
   limit 1
$$;

create or replace function school_weeks(p_year_id uuid) returns table (week_start date, is_break boolean)
language sql stable security definer set search_path from current
as $$
  select w.monday::date,
         exists (select 1 from break_weeks b where b.school_year_id = s.id and b.week_start = w.monday::date)
    from school_years s
   cross join lateral generate_series(date_trunc('week', s.starts_on::timestamp), s.ends_on::timestamp, interval '7 days') as w(monday)
   where s.id = p_year_id and w.monday::date + 4 >= s.starts_on
   order by w.monday
$$;

create or replace function changeover_date(p_year_id uuid) returns date
language sql stable security definer set search_path from current
as $$ select s.changeover_date from school_years s where s.id = p_year_id $$;

-- The year a screen shows: the one containing today, else the next one, else the latest.
create or replace function rota_pick_school_year(p_organization_id uuid) returns uuid
language sql stable security definer set search_path from current
as $$
  select s.id from school_years s
   where s.organization_id = p_organization_id and s.status = 'active'
   order by case when school_today() between s.starts_on and s.ends_on then 0
                 when s.starts_on > school_today() then 1 else 2 end,
            case when s.starts_on > school_today() then s.starts_on end asc,
            s.starts_on desc, s.id
   limit 1
$$;

-- Takes the family step of the lock order: every active family of the community, ascending. Internal.
create or replace function rota_lock_families(p_organization_id uuid) returns void
language plpgsql security definer set search_path from current
as $$
begin
  perform 1 from families f where f.organization_id = p_organization_id and f.status = 'active' order by f.id for share;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 3. School year save with the changeover date (BR20.3). The body is U1's structure_save; the school year branch
--    gains the changeover date, and refuses a change of the year's dates while a rota plan exists (BR21.2) or when a
--    break week would no longer be a school week.
-- ---------------------------------------------------------------------------------------------------
create or replace function structure_save(p_idempotency_key text, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'structure.save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_id uuid;
  v_expected integer;
  v_name text;
  v_description text;
  v_starts date;
  v_ends date;
  v_changeover date;
  v_year_id uuid;
  v_year school_years%rowtype;
  v_group groups%rowtype;
  v_creating boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_kind, coalesce(p_payload::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not has_super_scope(v_org) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_kind is null or p_kind not in ('school_year', 'group')
       or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    v_creating := p_payload->'id' is null or jsonb_typeof(p_payload->'id') = 'null';
    if not v_creating then
      v_id := platform_try_uuid(p_payload->>'id');
      if v_id is null then
        perform platform_field_invalid('id');
      end if;
      v_expected := platform_try_integer(p_payload->>'expected_version');
      if v_expected is null then
        perform platform_field_invalid('expected_version');
      end if;
    end if;
    v_name := btrim(coalesce(p_payload->>'name', ''));
    if char_length(v_name) not between 1 and 100 then
      perform platform_field_invalid('name');
    end if;

    if p_kind = 'school_year' then
      v_starts := platform_try_date(p_payload->>'starts_on');
      v_ends := platform_try_date(p_payload->>'ends_on');
      if v_starts is null then
        perform platform_field_invalid('starts_on');
      end if;
      if v_ends is null then
        perform platform_field_invalid('ends_on');
      end if;
      if v_ends < v_starts then
        perform platform_field_invalid('ends_on', 'before_start');
      end if;
      -- An absent or empty changeover date keeps the stored one, or takes the default on a new year (BR20.3).
      if nullif(p_payload->>'changeover_date', '') is not null then
        v_changeover := platform_try_date(p_payload->>'changeover_date');
        if v_changeover is null then
          perform platform_field_invalid('changeover_date');
        end if;
        if v_changeover < v_starts then
          perform platform_field_invalid('changeover_date', 'before_start');
        end if;
      end if;
      if not exists (select 1 from organizations o where o.id = v_org and o.status = 'active') then
        perform platform_abort('validation', 'organization_not_found');
      end if;
      begin
        if v_creating then
          insert into school_years (organization_id, name, starts_on, ends_on, changeover_date)
          values (v_org, v_name, v_starts, v_ends, v_changeover) returning id into v_id;
        else
          select * into v_year from school_years where id = v_id and organization_id = v_org for update;
          if not found then
            perform platform_field_invalid('id', 'not_found');
          end if;
          if v_year.version <> v_expected then
            perform platform_abort('conflict', 'VERSION_CONFLICT');
          end if;
          if v_year.status = 'archived' then
            perform platform_field_invalid('id', 'archived');
          end if;
          if v_starts <> v_year.starts_on or v_ends <> v_year.ends_on then
            -- The plan's rows follow the year's dates, so the dates wait until the draft is discarded (BR21.2).
            if exists (select 1 from rota_plans p where p.school_year_id = v_id) then
              perform platform_abort('conflict', 'ROTA_PLAN_EXISTS');
            end if;
            if exists (select 1 from break_weeks b
                        where b.school_year_id = v_id and not (b.week_start <= v_ends and b.week_start + 4 >= v_starts)) then
              perform platform_field_invalid('starts_on', 'locked');
            end if;
          end if;
          v_changeover := coalesce(v_changeover, v_year.changeover_date);
          if v_changeover < v_starts then
            perform platform_field_invalid('changeover_date', 'before_start');
          end if;
          update school_years
             set name = v_name, starts_on = v_starts, ends_on = v_ends, changeover_date = v_changeover
           where id = v_id;
        end if;
      exception when unique_violation then
        perform platform_field_invalid('name', 'taken');
      end;
      perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
      return platform_result('success', v_id, null)
        || jsonb_build_object('version', (select s.version from school_years s where s.id = v_id));
    end if;

    -- group
    v_description := btrim(coalesce(p_payload->>'description', ''));
    if char_length(v_description) not between 1 and 1000 then
      perform platform_field_invalid('description');
    end if;
    v_year_id := platform_try_uuid(p_payload->>'school_year_id');
    if v_year_id is null and (v_creating or p_payload->'school_year_id' is not null) then
      perform platform_field_invalid('school_year_id');
    end if;
    begin
      if v_creating then
        select * into v_year from school_years where id = v_year_id and organization_id = v_org;
        if not found then
          perform platform_field_invalid('school_year_id', 'not_found');
        end if;
        if v_year.status = 'archived' then
          perform platform_field_invalid('school_year_id', 'archived');
        end if;
        insert into groups (organization_id, school_year_id, name, description)
        values (v_org, v_year_id, v_name, v_description)
        returning id into v_id;
      else
        select * into v_group from groups where id = v_id and organization_id = v_org for update;
        if not found then
          perform platform_field_invalid('id', 'not_found');
        end if;
        if v_group.version <> v_expected then
          perform platform_abort('conflict', 'VERSION_CONFLICT');
        end if;
        if v_group.status = 'archived' then
          perform platform_field_invalid('id', 'archived');
        end if;
        if v_year_id is not null and v_year_id <> v_group.school_year_id then
          perform platform_field_invalid('school_year_id', 'locked');
        end if;
        update groups set name = v_name, description = v_description where id = v_id;
      end if;
    exception when unique_violation then
      perform platform_field_invalid('name', 'taken');
    end;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null)
      || jsonb_build_object('version', (select g.version from groups g where g.id = v_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 4. Break weeks (BR20.1, BR20.2). Only a super admin adds or removes one. A late change never touches a plan or a
--    published duty (BR20.5): the calendar screen lists the weeks that now carry a warning.
-- ---------------------------------------------------------------------------------------------------
create or replace function break_week_add(
  p_idempotency_key text, p_school_year_id uuid, p_week_start text, p_label text default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'break_week.add';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_year school_years%rowtype;
  v_week date;
  v_label text;
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
    concat_ws('|', p_school_year_id::text, p_week_start, p_label), 'UTF8')), 'hex');
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
    -- The year row is held while the week is added, so two additions of one week are serialised.
    select * into v_year from school_years where id = p_school_year_id and organization_id = v_org for update;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_year.status = 'archived' then
      perform platform_field_invalid('school_year_id', 'archived');
    end if;
    v_week := case when p_week_start ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then platform_try_date(p_week_start) end;
    v_label := nullif(btrim(coalesce(p_label, '')), '');
    if v_label is not null and char_length(v_label) > 100 then
      perform platform_field_invalid('label');
    end if;
    if v_week is null or extract(isodow from v_week) <> 1
       or not exists (select 1 from school_weeks(v_year.id) w where w.week_start = v_week) then
      perform platform_abort('validation', 'BREAK_WEEK_INVALID', jsonb_build_object('field', 'week_start'));
    end if;
    if exists (select 1 from break_weeks b where b.school_year_id = v_year.id and b.week_start = v_week) then
      perform platform_abort('validation', 'BREAK_WEEK_EXISTS', jsonb_build_object('field', 'week_start'));
    end if;
    insert into break_weeks (organization_id, school_year_id, week_start, label)
    values (v_org, v_year.id, v_week, v_label)
    returning id into v_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null)
      || jsonb_build_object('version', (select b.version from break_weeks b where b.id = v_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function break_week_remove(p_idempotency_key text, p_break_week_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'break_week.remove';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_week break_weeks%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_break_week_id::text, p_expected_version::text), 'UTF8')), 'hex');
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
    if p_break_week_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_week from break_weeks where id = p_break_week_id and organization_id = v_org for update;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_week.version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    delete from break_weeks where id = v_week.id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_week.id);
    return platform_result('success', v_week.id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 5. The shared duty model (C4, C5, C18).
-- ---------------------------------------------------------------------------------------------------

-- Creates a duty and its places for one origin (C4, BR26.1). Internal: rota publishing calls it, and later units. A
-- repeat for the same origin returns the existing duty and places and creates nothing. It checks no eligibility; the
-- caller does. A made-up origin, a malformed place list or a family that is not of the origin's community ends the
-- caller's whole transaction with an error.
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
  if p_origin_kind is null or p_origin_kind <> 'rota_week' or p_origin_id is null then
    raise exception 'duty_create: the origin is not known' using errcode = '22023';
  end if;
  select w.organization_id into v_org from rota_weeks w where w.id = p_origin_id;
  if not found then
    raise exception 'duty_create: the origin does not exist' using errcode = '22023';
  end if;
  if p_place_holders is null or cardinality(p_place_holders) not between 1 and 50 then
    raise exception 'duty_create: the place list is malformed' using errcode = '22023';
  end if;
  if p_source is null or p_source not in ('rota_publish', 'parent_sign_up', 'admin_assign', 'swap') then
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
    -- Another transaction created the duty between the look-up and the insert: its row is the answer.
    select * into v_task from tasks where origin_kind = p_origin_kind and origin_id = p_origin_id;
  end if;
  select coalesce(jsonb_agg(a.id order by a.created_at, a.id), '[]'::jsonb) into v_ids
    from assignments a where a.task_id = v_task.id and a.status <> 'removed';
  return jsonb_build_object('duty_id', v_task.id, 'place_ids', v_ids);
end $$;

-- The done mark (C18, BR26.2): once, by a parent of the holding family or a coordinator of the duty's working group.
-- A super admin with no family, and a duty with no group, are denied here. The duty is locked before the place.
create or replace function place_mark_done(p_idempotency_key text, p_place_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'place.mark_done';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_task_id uuid;
  v_task tasks%rowtype;
  v_place assignments%rowtype;
  v_parent uuid;
  v_allowed boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_place_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_place_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select a.task_id into v_task_id from assignments a where a.id = p_place_id and a.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_task from tasks where id = v_task_id for update;
    select * into v_place from assignments where id = p_place_id for update;
    v_parent := coalesce(current_parent_id(), identity_linked_parent());
    v_allowed := (directory_actor_family() is not null and directory_actor_family() = v_place.family_id)
      or (v_task.group_id is not null and v_parent is not null
          and has_current_role_scope('group_admin', v_org, 'group', v_task.group_id));
    if not v_allowed then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_place.status = 'removed' or v_task.status in ('closed', 'cancelled') then
      perform platform_abort('conflict', 'DUTY_CLOSED');
    end if;
    if v_place.done_at is not null then
      perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_place.id);
      return platform_result('success', v_place.id, null) || jsonb_build_object('version', v_place.version);
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_place.version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    update assignments set done_at = now(), done_by = v_parent where id = v_place.id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_place.id);
    return platform_result('success', v_place.id, null) || jsonb_build_object('version', v_place.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- The three functions that change who holds a place (C5, BR26.3). Internal: only the DutyChanges block calls them,
-- in its own transaction, so a refusal is raised through U3R00 and ends that caller's whole change. They check no
-- eligibility and write no audit (the caller does both). A duty that has passed or is closed cannot change.

-- Locks the duties of the given places ascending, then the places ascending, and returns nothing. Internal.
create or replace function place_lock(p_place_ids uuid[]) returns void
language plpgsql security definer set search_path from current
as $$
begin
  perform 1 from tasks t where t.id in (select a.task_id from assignments a where a.id = any (p_place_ids)) order by t.id for update;
  perform 1 from assignments a where a.id = any (p_place_ids) order by a.id for update;
end $$;

create or replace function place_exchange(p_place_a uuid, p_version_a integer, p_place_b uuid, p_version_b integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_a assignments%rowtype;
  v_b assignments%rowtype;
  v_task_a tasks%rowtype;
  v_task_b tasks%rowtype;
begin
  perform place_lock(array[p_place_a, p_place_b]);
  select * into v_a from assignments where id = p_place_a;
  if not found then
    perform platform_abort('validation', 'place_not_found');
  end if;
  select * into v_b from assignments where id = p_place_b;
  if not found then
    perform platform_abort('validation', 'place_not_found');
  end if;
  select * into v_task_a from tasks where id = v_a.task_id;
  select * into v_task_b from tasks where id = v_b.task_id;
  if v_a.version <> p_version_a or v_b.version <> p_version_b then
    perform platform_abort('conflict', 'VERSION_CONFLICT');
  end if;
  if v_a.status = 'removed' or v_b.status = 'removed'
     or v_task_a.status <> 'open' or v_task_b.status <> 'open'
     or v_task_a.starts_at <= now() or v_task_b.starts_at <= now() then
    perform platform_abort('conflict', 'DUTY_CLOSED');
  end if;
  if v_a.task_id = v_b.task_id or v_a.family_id = v_b.family_id
     or exists (select 1 from assignments x
                 where x.status <> 'removed'
                   and ((x.task_id = v_b.task_id and x.family_id = v_a.family_id)
                     or (x.task_id = v_a.task_id and x.family_id = v_b.family_id))) then
    perform platform_abort('conflict', 'DUTY_ALREADY_ASSIGNED');
  end if;
  update assignments
     set family_id = case id when v_a.id then v_b.family_id else v_a.family_id end, parent_id = null
   where id in (v_a.id, v_b.id);
  return platform_result('success', v_a.id, null);
end $$;

create or replace function place_reassign(p_place uuid, p_version integer, p_family uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_place assignments%rowtype;
  v_task tasks%rowtype;
begin
  perform place_lock(array[p_place]);
  select * into v_place from assignments where id = p_place;
  if not found then
    perform platform_abort('validation', 'place_not_found');
  end if;
  select * into v_task from tasks where id = v_place.task_id;
  if v_place.version <> p_version then
    perform platform_abort('conflict', 'VERSION_CONFLICT');
  end if;
  if v_place.status = 'removed' or v_task.status <> 'open' or v_task.starts_at <= now() then
    perform platform_abort('conflict', 'DUTY_CLOSED');
  end if;
  if p_family is null
     or not exists (select 1 from families f where f.id = p_family and f.organization_id = v_place.organization_id)
     or exists (select 1 from assignments x
                 where x.task_id = v_place.task_id and x.family_id = p_family and x.status <> 'removed') then
    perform platform_abort('conflict', 'DUTY_ALREADY_ASSIGNED');
  end if;
  update assignments set family_id = p_family, parent_id = null where id = v_place.id;
  return platform_result('success', v_place.id, null);
end $$;

create or replace function place_release(p_place uuid, p_version integer) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_place assignments%rowtype;
  v_task tasks%rowtype;
begin
  perform place_lock(array[p_place]);
  select * into v_place from assignments where id = p_place;
  if not found then
    perform platform_abort('validation', 'place_not_found');
  end if;
  select * into v_task from tasks where id = v_place.task_id;
  if v_place.version <> p_version then
    perform platform_abort('conflict', 'VERSION_CONFLICT');
  end if;
  if v_place.status = 'removed' or v_task.status <> 'open' or v_task.starts_at <= now() then
    perform platform_abort('conflict', 'DUTY_CLOSED');
  end if;
  update assignments set status = 'removed' where id = v_place.id;
  perform coordination_withdraw_requests(array[v_place.id]);
  return platform_result('success', v_place.id, null);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 6. The rota plan (BR21 to BR23). Only a super admin makes a draft, changes a week, discards or publishes.
-- ---------------------------------------------------------------------------------------------------

-- Makes the draft of a school year (BR21.1 to BR21.4): one indoor-cleaning row for every school week; a break week
-- stays empty; the duty weeks take the active families by name, the cycle starting at the calendar year of the
-- year's start modulo the number of families and advancing one family per duty week.
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
  v_families uuid[];
  v_count integer;
  v_offset integer;
  v_index integer := 0;
  v_week record;
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
    select coalesce(array_agg(f.id order by lower(f.display_name), f.id), '{}'::uuid[]) into v_families
      from families f where f.organization_id = v_org and f.status = 'active';
    v_count := cardinality(v_families);
    v_offset := case when v_count > 0 then extract(year from v_year.starts_on)::integer % v_count else 0 end;
    begin
      insert into rota_plans (organization_id, school_year_id) values (v_org, v_year.id) returning id into v_plan_id;
    exception when unique_violation then
      perform platform_abort('conflict', 'ROTA_PLAN_EXISTS');
    end;
    for v_week in select w.week_start, w.is_break from school_weeks(v_year.id) w order by w.week_start loop
      if v_week.is_break then
        insert into rota_weeks (organization_id, plan_id, week_start) values (v_org, v_plan_id, v_week.week_start);
      elsif v_count = 0 then
        insert into rota_weeks (organization_id, plan_id, week_start, empty_reason)
        values (v_org, v_plan_id, v_week.week_start, 'no_family');
      else
        insert into rota_weeks (organization_id, plan_id, week_start, family_id)
        values (v_org, v_plan_id, v_week.week_start, v_families[((v_index + v_offset) % v_count) + 1]);
        v_index := v_index + 1;
      end if;
    end loop;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_plan_id);
    return platform_result('success', v_plan_id, null)
      || jsonb_build_object('version', (select p.version from rota_plans p where p.id = v_plan_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- Sets one week of a draft to an active family, or empties it (BR22.1 to BR22.4). Evenness is a warning only.
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
    -- Families, then the plan row, then the week row (the lock order).
    perform rota_lock_families(v_org);
    select * into v_plan from rota_plans where id = v_plan_id and organization_id = v_org for update;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
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
      if exists (select 1 from school_weeks(v_plan.school_year_id) sw where sw.week_start = v_week.week_start and sw.is_break) then
        perform platform_abort('validation', 'ROTA_BREAK_WEEK', jsonb_build_object('field', 'family_id'));
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

-- Discards a draft (BR21.5): only a draft, only with its current version, and only when the number of hand-changed
-- weeks the screen showed is still right. The plan and its rows go, and the discard is audited.
create or replace function rota_plan_discard(
  p_idempotency_key text, p_plan_id uuid, p_expected_version integer, p_changed_weeks integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'rota_plan.discard';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_plan rota_plans%rowtype;
  v_changed integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_plan_id::text, p_expected_version::text, p_changed_weeks::text), 'UTF8')), 'hex');
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
    select count(*)::integer into v_changed from rota_weeks w where w.plan_id = v_plan.id and w.changed_by_admin;
    if p_changed_weeks is distinct from v_changed then
      perform platform_abort('invalidated', 'ROTA_DISCARD_OUTDATED', jsonb_build_object('changed_weeks', v_changed));
    end if;
    delete from rota_weeks where plan_id = v_plan.id;
    delete from rota_plans where id = v_plan.id;
    perform platform_audit_write('rota.discard', 'rota_plan', v_plan.id, v_org, null, 'success',
                                 'weeks_changed:' || v_changed::text);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_plan.id);
    return platform_result('success', v_plan.id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- Publishes a draft (BR23.1 to BR23.5): in one transaction, a duty and its one place for every filled week, the
-- plan marked published, one notice per active parent with an account of each family that has a week, and the audit
-- event. Anything that fails rolls all of it back and leaves the draft as it was.
create or replace function rota_plan_publish(p_idempotency_key text, p_plan_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'rota_plan.publish';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_plan rota_plans%rowtype;
  v_week rota_weeks%rowtype;
  v_duties integer := 0;
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
    if exists (select 1 from rota_weeks w join school_weeks(v_plan.school_year_id) sw on sw.week_start = w.week_start
                where w.plan_id = v_plan.id and not sw.is_break and w.family_id is null) then
      perform platform_abort('validation', 'ROTA_WEEKS_EMPTY');
    end if;
    if exists (select 1 from rota_weeks w join school_weeks(v_plan.school_year_id) sw on sw.week_start = w.week_start
                where w.plan_id = v_plan.id and sw.is_break and w.family_id is not null) then
      perform platform_abort('validation', 'ROTA_BREAK_WEEK');
    end if;
    if exists (select 1 from rota_weeks w
                where w.plan_id = v_plan.id and w.family_id is not null
                  and not exists (select 1 from families f
                                   where f.id = w.family_id and f.organization_id = v_org and f.status = 'active')) then
      perform platform_abort('validation', 'ROTA_FAMILY_INELIGIBLE');
    end if;

    -- One duty and one place for every filled week, in week order (BR23.2). Monday 00:00 to Sunday 23:59:59,
    -- Budapest time (entities.md).
    for v_week in select * from rota_weeks w where w.plan_id = v_plan.id and w.family_id is not null order by w.week_start loop
      perform duty_create('rota_week', v_week.id, 'Belső takarítás', 'rota_indoor_cleaning',
                          v_week.week_start::timestamp at time zone 'Europe/Budapest',
                          ((v_week.week_start + 6)::timestamp + interval '23 hours 59 minutes 59 seconds') at time zone 'Europe/Budapest',
                          null, array[v_week.family_id], 'rota_publish');
      v_duties := v_duties + 1;
    end loop;
    update rota_plans set status = 'published', published_at = now(), published_by = auth.uid() where id = v_plan.id;

    -- One notice for each active parent with an account of every family that has a week (BR23.4). The text is built
    -- when the list is read. The key makes a second publishing impossible to notify twice.
    insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key)
    select p.organization_id, p.id, 'rota_published', 'rota_plan', v_plan.id, null, null,
           'rota_published:' || v_plan.id::text || ':' || p.id::text
      from parents p join families f on f.id = p.family_id
     where p.account_id is not null and p.status = 'active' and f.status = 'active'
       and p.family_id in (select w.family_id from rota_weeks w where w.plan_id = v_plan.id and w.family_id is not null)
    on conflict (dedupe_key) do nothing;

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
-- 7. The reads. Each returns rows or a denied refusal, never an empty list for a caller with no access (BR27.1).
-- ---------------------------------------------------------------------------------------------------

-- The school calendar screen (W1): the year, its weeks with their break flags, and the filled rota weeks that are
-- now break weeks (BR20.5). A super admin only.
create or replace function school_calendar_get(p_school_year_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_year school_years%rowtype;
  v_years jsonb;
  v_weeks jsonb;
  v_warnings jsonb;
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
      || jsonb_build_object('school_year', null, 'school_years', v_years, 'items', '[]'::jsonb, 'warnings', '[]'::jsonb, 'has_plan', false);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'week_start', sw.week_start, 'is_break', sw.is_break,
           'break_week_id', b.id, 'label', b.label, 'version', b.version) order by sw.week_start), '[]'::jsonb)
    into v_weeks
    from school_weeks(v_year.id) sw
    left join break_weeks b on b.school_year_id = v_year.id and b.week_start = sw.week_start;
  select coalesce(jsonb_agg(jsonb_build_object('week_start', rw.week_start, 'family_display_name', family_display_name(rw.family_id))
                            order by rw.week_start), '[]'::jsonb)
    into v_warnings
    from rota_plans p
    join rota_weeks rw on rw.plan_id = p.id
    join school_weeks(v_year.id) sw on sw.week_start = rw.week_start
   where p.school_year_id = v_year.id and rw.family_id is not null and sw.is_break;
  return platform_result('success', v_year.id, null) || jsonb_build_object(
    'school_year', jsonb_build_object('id', v_year.id, 'name', v_year.name, 'starts_on', v_year.starts_on,
                                       'ends_on', v_year.ends_on, 'changeover_date', v_year.changeover_date,
                                       'version', v_year.version),
    'school_years', v_years,
    'items', v_weeks,
    'warnings', v_warnings,
    'has_plan', exists (select 1 from rota_plans p where p.school_year_id = v_year.id));
end $$;

-- The planning screen (W2 to W5): the plan of a year, its weeks, each family's count of weeks with the warning of
-- BR22.3, and what blocks publishing (BR23.1). A super admin only, so a draft is never read by anyone else (BR22.5).
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
  v_lowest integer;
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
  v_school_year := jsonb_build_object('id', v_year.id, 'name', v_year.name, 'starts_on', v_year.starts_on, 'ends_on', v_year.ends_on);
  select * into v_plan from rota_plans where school_year_id = v_year.id;
  if not found then
    return platform_result('success', v_year.id, null) || jsonb_build_object(
      'school_year', v_school_year, 'plan', null,
      'week_count', (select count(*)::integer from school_weeks(v_year.id)));
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', rw.id, 'week_start', rw.week_start, 'is_break', coalesce(sw.is_break, false),
           'family_id', rw.family_id,
           'family_display_name', case when rw.family_id is not null then family_display_name(rw.family_id) end,
           'empty_reason', rw.empty_reason, 'changed_by_admin', rw.changed_by_admin, 'version', rw.version)
         order by rw.week_start), '[]'::jsonb)
    into v_weeks
    from rota_weeks rw left join school_weeks(v_year.id) sw on sw.week_start = rw.week_start
   where rw.plan_id = v_plan.id;
  select min(counted.weeks) into v_lowest from (
    select (select count(*) from rota_weeks w where w.plan_id = v_plan.id and w.family_id = f.id)::integer as weeks
      from families f where f.organization_id = v_org and f.status = 'active') counted;
  select coalesce(jsonb_agg(jsonb_build_object(
           'family_id', counted.id, 'display_name', family_display_name(counted.id), 'weeks', counted.weeks,
           'above_lowest', counted.weeks - v_lowest > 1) order by lower(counted.display_name), counted.id), '[]'::jsonb)
    into v_families
    from (select f.id, f.display_name,
                 (select count(*) from rota_weeks w where w.plan_id = v_plan.id and w.family_id = f.id)::integer as weeks
            from families f where f.organization_id = v_org and f.status = 'active') counted;
  select coalesce(jsonb_agg(jsonb_build_object('week_start', rw.week_start, 'reason', rw.empty_reason) order by rw.week_start), '[]'::jsonb)
    into v_empty
    from rota_weeks rw join school_weeks(v_year.id) sw on sw.week_start = rw.week_start
   where rw.plan_id = v_plan.id and not sw.is_break and rw.family_id is null;
  select coalesce(jsonb_agg(jsonb_build_object('week_start', rw.week_start) order by rw.week_start), '[]'::jsonb)
    into v_breaks
    from rota_weeks rw join school_weeks(v_year.id) sw on sw.week_start = rw.week_start
   where rw.plan_id = v_plan.id and sw.is_break and rw.family_id is not null;
  select coalesce(jsonb_agg(jsonb_build_object('week_start', rw.week_start) order by rw.week_start), '[]'::jsonb)
    into v_ineligible
    from rota_weeks rw
   where rw.plan_id = v_plan.id and rw.family_id is not null
     and not exists (select 1 from families f where f.id = rw.family_id and f.organization_id = v_org and f.status = 'active');
  select count(*)::integer into v_changed from rota_weeks w where w.plan_id = v_plan.id and w.changed_by_admin;
  return platform_result('success', v_plan.id, null) || jsonb_build_object(
    'school_year', v_school_year,
    'plan', jsonb_build_object('id', v_plan.id, 'status', v_plan.status, 'version', v_plan.version, 'published_at', v_plan.published_at),
    'items', v_weeks,
    'families', v_families,
    'changed_weeks', v_changed,
    'blockers', jsonb_build_object('empty_weeks', v_empty, 'break_weeks', v_breaks, 'ineligible_weeks', v_ineligible),
    'can_publish', v_plan.status = 'draft' and v_empty = '[]'::jsonb and v_breaks = '[]'::jsonb and v_ineligible = '[]'::jsonb);
end $$;

-- The overview (W6, BR24.1): the school weeks of the year with each week's break flag and, for the filled weeks of a
-- published plan, the family name. A draft never shows: with no published plan the answer is the state
-- nothing_published, which is not a refusal. The family id and name are the only family fields.
create or replace function rota_overview() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_year school_years%rowtype;
  v_plan rota_plans%rowtype;
  v_family uuid;
  v_items jsonb;
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
      || jsonb_build_object('overview_state', 'nothing_published', 'school_year', null, 'items', '[]'::jsonb);
  end if;
  select * into v_plan from rota_plans p where p.school_year_id = v_year.id and p.status = 'published';
  if not found then
    return platform_result('success', null, null)
      || jsonb_build_object('overview_state', 'nothing_published',
                            'school_year', jsonb_build_object('id', v_year.id, 'name', v_year.name),
                            'items', '[]'::jsonb);
  end if;
  v_family := directory_actor_family();
  select coalesce(jsonb_agg(jsonb_build_object(
           'job', 'indoor_cleaning',
           'week_start', sw.week_start,
           'is_break', sw.is_break,
           'family_id', rw.family_id,
           'family_display_name', case when rw.family_id is not null then family_display_name(rw.family_id) end,
           'is_own', v_family is not null and rw.family_id = v_family,
           'duty_id', case when v_family is not null and rw.family_id = v_family then t.id end)
         order by sw.week_start), '[]'::jsonb)
    into v_items
    from school_weeks(v_year.id) sw
    left join rota_weeks rw on rw.plan_id = v_plan.id and rw.job = 'indoor_cleaning' and rw.week_start = sw.week_start
    left join tasks t on t.origin_kind = 'rota_week' and t.origin_id = rw.id;
  return platform_result('success', v_plan.id, null)
    || jsonb_build_object('overview_state', 'published',
                          'school_year', jsonb_build_object('id', v_year.id, 'name', v_year.name),
                          'items', v_items);
end $$;

-- The duty card (W7, BR24.2): for a parent of the holding family and for a super admin. Anyone else, a teacher, and a
-- made-up id get the same denied result.
create or replace function rota_duty_card(p_duty_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_task tasks%rowtype;
  v_week rota_weeks%rowtype;
  v_plan rota_plans%rowtype;
  v_holder uuid;
  v_actor uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not coalesce(can_read_community(), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select * into v_task from tasks t where t.id = p_duty_id and t.organization_id = v_org and t.origin_kind = 'rota_week';
  if not found then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_week from rota_weeks w where w.id = v_task.origin_id;
  select * into v_plan from rota_plans p where p.id = v_week.plan_id and p.status = 'published';
  select a.family_id into v_holder from assignments a where a.task_id = v_task.id and a.status <> 'removed' limit 1;
  v_actor := directory_actor_family();
  if v_plan.id is null
     or not (coalesce(has_super_scope(v_org), false) or (v_actor is not null and v_actor = v_holder)) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  return platform_result('success', v_task.id, null) || jsonb_build_object('item', jsonb_build_object(
    'duty_id', v_task.id,
    'job', v_week.job,
    'title', v_task.title,
    'family_display_name', family_display_name(v_holder),
    'week_start', v_week.week_start,
    'week_end', v_week.week_start + 6,
    'no_fixed_day', true,
    'is_break_week', exists (select 1 from school_weeks(v_plan.school_year_id) sw
                              where sw.week_start = v_week.week_start and sw.is_break)));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 8. Rota duties are left out of today's lists (BR24.4) and refused by today's change functions (BR25.1).
-- ---------------------------------------------------------------------------------------------------

-- Today's sign-up list and detail: a rota duty is found through the overview and the card only.
create or replace function duty_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_family uuid;
  v_org uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_family := directory_actor_family();
  if v_family is null then
    return platform_result('denied', null, 'no_family');
  end if;
  select f.organization_id into v_org from families f where f.id = v_family;
  select coalesce(jsonb_agg(coordination_duty_view(visible.id, v_family) order by visible.starts_at, visible.id), '[]'::jsonb)
    into v_items
    from (select t.id, t.starts_at from tasks t
           where t.organization_id = v_org and t.status <> 'cancelled' and t.origin_kind = 'manual') visible;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

create or replace function duty_get(p_task_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_family uuid;
  v_org uuid;
  v_task tasks%rowtype;
  v_view jsonb;
  v_allergen text;
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
    select e.allergen_note into v_allergen from events e where e.id = v_task.event_id;
  end if;
  if v_view->>'assignment_id' is not null then
    select n.text into v_note from contribution_notes n where n.assignment_id = (v_view->>'assignment_id')::uuid;
  end if;
  return platform_result('success', v_task.id, null)
    || jsonb_build_object('item', v_view || jsonb_build_object(
         'allergen_note', v_allergen, 'own_contribution_note', v_note));
end $$;

-- Swap partners never include a rota duty, and a rota duty has no partners of its own.
create or replace function swap_candidates(p_assignment_id uuid) returns jsonb
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
  select f.organization_id into v_org from families f where f.id = v_family;
  select * into v_src from assignments a where a.id = p_assignment_id and a.organization_id = v_org;
  if not found then
    return platform_result('validation', null, 'assignment_not_found');
  end if;
  if v_src.family_id <> v_family then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_task from tasks t where t.id = v_src.task_id;
  if v_task.origin_kind <> 'manual' then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
  end if;
  if v_src.status <> 'active' then
    return platform_result('conflict', null, 'REQUEST_DUPLICATE');
  end if;
  if v_task.status = 'cancelled' or v_task.starts_at <= now() then
    return platform_result('conflict', null, 'DUTY_CLOSED');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'assignment_id', ta.id, 'assignment_version', ta.version, 'task_id', tt.id,
           'title', tt.title, 'starts_at', tt.starts_at, 'family_display_name', f.display_name)
         order by tt.starts_at, ta.id), '[]'::jsonb)
    into v_items
    from assignments ta
    join tasks tt on tt.id = ta.task_id
    join families f on f.id = ta.family_id
   where ta.organization_id = v_org and ta.status = 'active' and ta.family_id <> v_family and f.status = 'active'
     and tt.id <> v_task.id and tt.status = 'open' and tt.starts_at > now() and tt.origin_kind = 'manual'
     and not exists (select 1 from assignments x
                      where x.family_id = v_family and x.task_id = tt.id and x.status <> 'removed')
     and not exists (select 1 from assignments y
                      where y.family_id = ta.family_id and y.task_id = v_task.id and y.status <> 'removed');
  return platform_result('success', v_src.id, null) || jsonb_build_object('items', v_items);
end $$;

-- The shared check (BR25.1, NFR3.5): true when the caller would reach one of these duties and one of them is not a
-- manual duty. A caller who would be refused anyway is not told whether the duty is a rota duty: they get the
-- refusal of the function itself. `p_who` is 'admin' (an administrator of the community) or 'family' (a family
-- member). Internal. U7 replaces the check with its own rules.
create or replace function duty_rota_managed(p_task_ids uuid[], p_who text) returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce(current_session_is_active(), false)
     and case p_who
           when 'admin' then coalesce(directory_is_admin(identity_actor_organization()), false)
           else directory_actor_family() is not null end
     and exists (select 1 from tasks t
                  where t.id = any (p_task_ids) and t.origin_kind <> 'manual'
                    and t.organization_id = identity_actor_organization())
$$;

create or replace function duty_rota_managed_places(p_place_ids uuid[], p_who text) returns boolean
language sql stable security definer set search_path from current
as $$
  select duty_rota_managed(coalesce((select array_agg(a.task_id) from assignments a where a.id = any (p_place_ids)), '{}'::uuid[]), p_who)
$$;

create or replace function duty_rota_managed_request(p_request_id uuid, p_who text) returns boolean
language sql stable security definer set search_path from current
as $$
  select duty_rota_managed_places(
    coalesce((select array[r.assignment_id, r.target_assignment_id] from change_requests r where r.id = p_request_id), '{}'::uuid[]),
    p_who)
$$;

-- The change functions of today. Each keeps its body and its checks; a refusal for a rota duty comes first.
create or replace function duty_sign_up(p_idempotency_key text, p_task_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  if duty_rota_managed(array[p_task_id], 'family') then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
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
declare v_result jsonb;
begin
  if duty_rota_managed(array[p_task_id], 'admin') then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
  end if;
  v_result := assignment_assign_core(p_idempotency_key, p_task_id, p_family_id, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_place_added((v_result->>'reference')::uuid);
  end if;
  return v_result;
end $$;

create or replace function assignment_remove(p_idempotency_key text, p_assignment_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  if duty_rota_managed_places(array[p_assignment_id], 'admin') then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
  end if;
  v_result := assignment_remove_core(p_idempotency_key, p_assignment_id, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_place_removed((v_result->>'reference')::uuid);
  end if;
  return v_result;
end $$;

create or replace function swap_request(
  p_idempotency_key text, p_assignment_id uuid, p_expected_version integer,
  p_target_assignment_id uuid, p_target_version integer, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  if duty_rota_managed_places(array[p_assignment_id, p_target_assignment_id], 'family') then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
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
declare v_result jsonb;
begin
  if duty_rota_managed_request(p_request_id, 'family') then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
  end if;
  v_result := swap_respond_core(p_idempotency_key, p_request_id, p_accept, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_swap_response((v_result->>'reference')::uuid, v_result->>'outcome');
  end if;
  return v_result;
end $$;

-- swap_decide and cancellation_decide call this one.
create or replace function coordination_decide(
  p_kind text, p_idempotency_key text, p_request_id uuid, p_approve boolean, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  if duty_rota_managed_request(p_request_id, 'admin') then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
  end if;
  v_result := coordination_decide_core(p_kind, p_idempotency_key, p_request_id, p_approve, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_decision((v_result->>'reference')::uuid, p_kind, v_result->>'outcome');
  end if;
  return v_result;
end $$;

create or replace function task_save(p_idempotency_key text, p_task jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_result jsonb;
begin
  if jsonb_typeof(p_task) = 'object' and duty_rota_managed(array[platform_try_uuid(p_task->>'id')], 'admin') then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
  end if;
  v_result := task_save_core(p_idempotency_key, p_task);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform reminder_plan((v_result->>'reference')::uuid);
  end if;
  return v_result;
end $$;

-- Withdrawing a swap request and asking to cancel a place had no wrapper. They become cores (internal) and get one.
alter function swap_withdraw(text, uuid) rename to swap_withdraw_core;
alter function cancellation_request(text, uuid, integer, text) rename to cancellation_request_core;

create or replace function swap_withdraw(p_idempotency_key text, p_request_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
begin
  if duty_rota_managed_request(p_request_id, 'family') then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
  end if;
  return swap_withdraw_core(p_idempotency_key, p_request_id);
end $$;

create or replace function cancellation_request(
  p_idempotency_key text, p_assignment_id uuid, p_expected_version integer, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
begin
  if duty_rota_managed_places(array[p_assignment_id], 'family') then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
  end if;
  return cancellation_request_core(p_idempotency_key, p_assignment_id, p_expected_version, p_reason);
end $$;

-- Archiving a family that holds a place on a rota duty is refused until U7 and U14 define what happens (BR25.1). The
-- body is U1's family_archive.
create or replace function family_archive(p_idempotency_key text, p_family_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_result jsonb;
  v_org uuid;
  v_account uuid;
begin
  v_org := identity_actor_organization();
  if current_session_is_active() and not coalesce(has_super_scope(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if current_session_is_active() and p_family_id is not null
     and exists (select 1 from assignments a join tasks t on t.id = a.task_id
                  where a.family_id = p_family_id and a.status <> 'removed'
                    and t.origin_kind <> 'manual' and t.organization_id = v_org) then
    return platform_result('conflict', null, 'DUTY_ROTA_MANAGED');
  end if;
  if p_family_id is not null and v_org is not null and directory_reaches_family(v_org, p_family_id) then
    perform 1 from families f where f.id = p_family_id and f.organization_id = v_org for update;
    if found then
      perform reminder_lock_family_tasks(p_family_id);
    end if;
  end if;
  v_result := family_archive_core(p_idempotency_key, p_family_id, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform reminder_plan_tasks(reminder_family_tasks((v_result->>'reference')::uuid));
    for v_account in select p.account_id from parents p where p.family_id = p_family_id and p.account_id is not null loop
      perform identity_bump_authorization_version(v_account);
    end loop;
  end if;
  return v_result;
end $$;

-- Reminders are planned for manual duties only (BR23.6): a rota duty has no start time to remind about, so it is
-- skipped here, which every re-planning path (a setting change, a family archive) goes through.
create or replace function reminder_plan_tasks(p_task_ids uuid[]) returns void
language plpgsql security definer set search_path from current
as $$
declare v_id uuid;
begin
  for v_id in select distinct x.t from unnest(coalesce(p_task_ids, '{}'::uuid[])) as x(t)
               join tasks k on k.id = x.t and k.origin_kind = 'manual'
               order by x.t loop
    perform reminder_plan(v_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 9. The notice with no task (BR23.4, NFR1.3). The link of a rota notice is the parent's rota overview. The list builds
--    the title and the text from the weeks the reader's own family holds on the plan, so it names no other family.
-- ---------------------------------------------------------------------------------------------------
create or replace function notification_link(p_target_type text, p_task_id uuid) returns text
language sql immutable set search_path from current
as $$ select case p_target_type
  when 'task' then '/szulo/feladatok/' || p_task_id::text
  when 'rota_plan' then '/szulo/beosztas'
  else '/szulo/cserek' end $$;

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
           'title', case when n.kind = 'rota_published' then 'Közzétették a beosztást'
             else case n.kind
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
               else 'Holnap: ' end || coalesce(t.title, 'Feladat') end,
           'text', case when n.kind = 'rota_published'
             then 'Belső takarítás, a ti heteitek: ' || coalesce(rw.weeks, '-') end,
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
    left join lateral (
      select string_agg(to_char(w.week_start, 'YYYY. MM. DD.') || ' – ' || to_char(w.week_start + 6, 'MM. DD.'),
                        '; ' order by w.week_start) as weeks
        from rota_plans p
        join rota_weeks w on w.plan_id = p.id
        join parents pr on pr.id = n.parent_id and pr.family_id = w.family_id
       where n.kind = 'rota_published' and p.id = n.target_ref and p.status = 'published'
    ) rw on true
   where n.parent_id = v_parent;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 10. Function rights (BR27.1). Signed-in commands and reads check their caller themselves; the calendar, the duty
--     and place functions and the helpers are internal and granted to nobody.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  school_today(),
  school_year_for(date, uuid),
  school_weeks(uuid),
  changeover_date(uuid),
  rota_pick_school_year(uuid),
  rota_lock_families(uuid),
  duty_create(text, uuid, text, text, timestamptz, timestamptz, uuid, uuid[], text),
  place_lock(uuid[]),
  place_exchange(uuid, integer, uuid, integer),
  place_reassign(uuid, integer, uuid),
  place_release(uuid, integer),
  duty_rota_managed(uuid[], text),
  duty_rota_managed_places(uuid[], text),
  duty_rota_managed_request(uuid, text),
  swap_withdraw_core(text, uuid),
  cancellation_request_core(text, uuid, integer, text),
  school_years_default_changeover(),
  assignments_guard_done()
  from public, anon, authenticated, service_role;

revoke all on function
  break_week_add(text, uuid, text, text),
  break_week_remove(text, uuid, integer),
  place_mark_done(text, uuid, integer),
  rota_plan_make(text, uuid),
  rota_week_set(text, uuid, uuid, integer),
  rota_plan_discard(text, uuid, integer, integer),
  rota_plan_publish(text, uuid, integer),
  school_calendar_get(uuid),
  rota_plan_get(uuid),
  rota_overview(),
  rota_duty_card(uuid),
  swap_withdraw(text, uuid),
  cancellation_request(text, uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function
  break_week_add(text, uuid, text, text),
  break_week_remove(text, uuid, integer),
  place_mark_done(text, uuid, integer),
  rota_plan_make(text, uuid),
  rota_week_set(text, uuid, uuid, integer),
  rota_plan_discard(text, uuid, integer, integer),
  rota_plan_publish(text, uuid, integer),
  school_calendar_get(uuid),
  rota_plan_get(uuid),
  rota_overview(),
  rota_duty_card(uuid),
  swap_withdraw(text, uuid),
  cancellation_request(text, uuid, integer, text)
  to authenticated;

commit;
