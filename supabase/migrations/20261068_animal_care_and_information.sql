-- U8 of the Ovis tábla work: the daily animal-care slots, signing up and giving up, the fair share and its monthly
-- reminder, the daily empty-slot warnings, the information page with its six starting sections, and the information
-- links on duty cards (BR80 to BR89; contracts C1, C3, C4, C5, C7 to C10, C18 to C20). The file opens and commits its own
-- transaction, as 20261048 to 20261067 do, because the migration runner adds none: the structure, the registry rows,
-- the starting text and every function succeed or fail together.
-- Technical names stay: a community is `organizations`, a working group is `groups`, a duty is a `tasks` row and a place
-- is an `assignments` row. A slot is a duty with origin `animal_slot`; the family that holds its place holds the slot.
--
-- Lock order (BR89.1): the calendar row, then the slot duties ascending, then the places ascending. No command locks a
-- family row and none locks a row only to look at a family's standing.
--
-- Refusals are raised through U3R00 and rolled back (C1). Every function pins its search path, starts with `revoke all`
-- and gets an explicit grant or none: the signed-in commands and reads check their caller themselves; the two daily
-- checks, the facts function and the helpers are internal and granted to nobody who is signed in.
begin;

-- ---------------------------------------------------------------------------------------------------
-- 1. The duty origin gains `animal_slot`; the four new tables. Row-level security on, no policy and no right for any
--    application role: the screens read through the read functions below (NFR3.8).
-- ---------------------------------------------------------------------------------------------------
alter table tasks drop constraint tasks_origin_kind_check;
alter table tasks add constraint tasks_origin_kind_check
  check (origin_kind in ('manual', 'rota_week', 'weekend_slot', 'animal_slot'));

create table animal_calendars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  school_year_id uuid not null unique references school_years (id),
  morning_start time not null default '07:30',
  afternoon_start time not null default '16:00',
  care_group_id uuid references groups (id),
  generated_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (morning_start < afternoon_start)
);
create trigger animal_calendars_touch_version before update on animal_calendars
  for each row execute function platform_touch_version();

create table animal_slots (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references animal_calendars (id),
  slot_date date not null,
  part text not null check (part in ('morning', 'afternoon')),
  duty_id uuid not null unique references tasks (id),
  unique (calendar_id, slot_date, part)
);
create index animal_slots_date on animal_slots (slot_date);

create table animal_fair_share_rounds (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references animal_calendars (id),
  month date not null check (month = date_trunc('month', month)::date),
  decided_on date not null,
  average_at_round numeric(8, 3) not null,
  families_reminded integer not null check (families_reminded >= 0),
  unique (calendar_id, month)
);

create table info_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  key text not null check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(key) <= 80),
  title text not null check (char_length(title) between 1 and 120 and title = btrim(title)),
  body text not null check (char_length(body) between 1 and 20000),
  owning_group_name text check (owning_group_name is null or char_length(owning_group_name) between 1 and 120),
  season_months integer[] check (season_months is null
    or (cardinality(season_months) between 1 and 12 and season_months <@ array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])),
  position integer not null check (position >= 1),
  hidden boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);
create trigger info_sections_touch_version before update on info_sections
  for each row execute function platform_touch_version();

alter table animal_calendars enable row level security;
alter table animal_slots enable row level security;
alter table animal_fair_share_rounds enable row level security;
alter table info_sections enable row level security;
revoke all on animal_calendars, animal_slots, animal_fair_share_rounds, info_sections
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 2. The audit action list gains two actions; every earlier action stays valid (NFR4).
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
  'animal_calendar.saved', 'animal_slots.created'
));

-- ---------------------------------------------------------------------------------------------------
-- 3. The notice registry rows (C8): the target type `animal_signup` is a school year and opens the sign-up page; the
--    four kinds. The facts function is defined in section 8, and the two daily checks are registered in section 10.
-- ---------------------------------------------------------------------------------------------------

-- ---------------------------------------------------------------------------------------------------
-- 4. Helpers. Internal.
-- ---------------------------------------------------------------------------------------------------

-- The slot's start in Budapest time as an instant.
create or replace function animal_slot_start(p_date date, p_time time) returns timestamptz
language sql immutable set search_path from current
as $$ select (p_date + p_time) at time zone 'Europe/Budapest' $$;

-- The year's working group of this name (lower case compared), or null. Internal.
create or replace function animal_care_group_of_year(p_school_year_id uuid) returns uuid
language sql stable security definer set search_path from current
as $$
  select g.id from groups g
   where g.school_year_id = p_school_year_id and g.status = 'active' and lower(g.name) = lower('Állatgondozás')
   order by g.id limit 1
$$;

-- The shared rota-managed check (20261048) lets a family sign up for a slot: a slot is a duty families take for
-- themselves (BR81.2). Everything else it said stays: an administrator still cannot assign or reassign a slot in
-- this unit, and no other rota or weekend duty can be signed up for.
create or replace function duty_rota_managed(p_task_ids uuid[], p_who text) returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce(current_session_is_active(), false)
     and case p_who
           when 'admin' then coalesce(directory_is_admin(identity_actor_organization()), false)
           else directory_actor_family() is not null end
     and exists (select 1 from tasks t
                  where t.id = any (p_task_ids) and t.origin_kind <> 'manual'
                    and not (p_who <> 'admin' and t.origin_kind = 'animal_slot')
                    and t.organization_id = identity_actor_organization())
$$;

-- ---------------------------------------------------------------------------------------------------
-- 5. animal_calendar_get (BR80.1): the year's times and alert group, or the defaults before a calendar exists. Super
--    admin only; everyone else is denied.
-- ---------------------------------------------------------------------------------------------------
create or replace function animal_calendar_get(p_school_year_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_year school_years%rowtype;
  v_cal animal_calendars%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if not coalesce(has_super_scope(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_year from school_years y where y.id = p_school_year_id and y.organization_id = v_org;
  if not found then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_cal from animal_calendars c where c.school_year_id = v_year.id;
  return platform_result('success', null, null) || jsonb_build_object(
    'school_year_id', v_year.id,
    'exists', v_cal.id is not null,
    'morning_start', to_char(coalesce(v_cal.morning_start, '07:30'::time), 'HH24:MI'),
    'afternoon_start', to_char(coalesce(v_cal.afternoon_start, '16:00'::time), 'HH24:MI'),
    'care_group_id', case when v_cal.id is null then animal_care_group_of_year(v_year.id) else v_cal.care_group_id end,
    'generated_at', v_cal.generated_at,
    'slot_count', coalesce((select count(*) from animal_slots s where s.calendar_id = v_cal.id), 0),
    'version', coalesce(v_cal.version, 0),
    'groups', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) order by g.name, g.id)
                          from groups g where g.school_year_id = v_year.id and g.status = 'active'), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 6. animal_calendar_save (BR80.1, BR80.4, BR80.5). The version is 0 when the year has no calendar yet. A change of a
--    start time moves the slots dated after today (their duties locked ascending) and gives each family holding a moved
--    slot one notice, once per calendar version.
-- ---------------------------------------------------------------------------------------------------
create or replace function animal_calendar_save(
  p_idempotency_key text, p_school_year_id uuid, p_morning_start time, p_afternoon_start time,
  p_care_group_id uuid, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'animal_calendar.save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_year school_years%rowtype;
  v_cal animal_calendars%rowtype;
  v_old_morning time;
  v_old_afternoon time;
  v_today date := school_today();
  v_families uuid[];
  v_parents uuid[];
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_school_year_id::text, p_morning_start::text,
    p_afternoon_start::text, coalesce(p_care_group_id::text, ''), p_expected_version::text), 'UTF8')), 'hex');
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
    select * into v_year from school_years y where y.id = p_school_year_id and y.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null or p_expected_version < 0 then
      perform platform_field_invalid('expected_version');
    end if;
    if p_morning_start is null then
      perform platform_field_invalid('morning_start');
    end if;
    if p_afternoon_start is null then
      perform platform_field_invalid('afternoon_start');
    end if;
    if p_morning_start >= p_afternoon_start then
      perform platform_abort('validation', 'ANIMAL_TIMES_INVALID');
    end if;
    if p_care_group_id is not null and not exists (
         select 1 from groups g where g.id = p_care_group_id and g.school_year_id = v_year.id
            and g.organization_id = v_org and g.status = 'active') then
      perform platform_abort('validation', 'ANIMAL_GROUP_INVALID');
    end if;

    select * into v_cal from animal_calendars c where c.school_year_id = v_year.id for update;
    if not found then
      if p_expected_version <> 0 then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
      insert into animal_calendars (organization_id, school_year_id, morning_start, afternoon_start, care_group_id)
      values (v_org, v_year.id, p_morning_start, p_afternoon_start,
              coalesce(p_care_group_id, animal_care_group_of_year(v_year.id)))
      returning * into v_cal;
    else
      if p_expected_version <> v_cal.version then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
      v_old_morning := v_cal.morning_start;
      v_old_afternoon := v_cal.afternoon_start;
      if v_old_morning <> p_morning_start or v_old_afternoon <> p_afternoon_start then
        -- The slot duties dated after today, ascending, then the new start times.
        perform 1 from tasks t where t.id in (
          select s.duty_id from animal_slots s where s.calendar_id = v_cal.id and s.slot_date > v_today)
         order by t.id for update;
        update tasks t
           set starts_at = animal_slot_start(s.slot_date, case s.part when 'morning' then p_morning_start else p_afternoon_start end),
               ends_at = animal_slot_start(s.slot_date, case s.part when 'morning' then p_morning_start else p_afternoon_start end)
                         + interval '1 hour'
          from animal_slots s
         where s.calendar_id = v_cal.id and s.slot_date > v_today and t.id = s.duty_id
           and ((s.part = 'morning' and v_old_morning <> p_morning_start)
             or (s.part = 'afternoon' and v_old_afternoon <> p_afternoon_start));
        select coalesce(array_agg(distinct a.family_id), '{}'::uuid[]) into v_families
          from animal_slots s
          join assignments a on a.task_id = s.duty_id and a.status <> 'removed'
         where s.calendar_id = v_cal.id and s.slot_date > v_today
           and ((s.part = 'morning' and v_old_morning <> p_morning_start)
             or (s.part = 'afternoon' and v_old_afternoon <> p_afternoon_start));
      end if;
      update animal_calendars
         set morning_start = p_morning_start, afternoon_start = p_afternoon_start, care_group_id = p_care_group_id
       where id = v_cal.id
       returning * into v_cal;
      if v_families is not null and cardinality(v_families) > 0 then
        select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_parents
          from parents p
         where p.family_id = any (v_families) and p.status = 'active' and p.account_id is not null;
        if cardinality(v_parents) > 0 then
          perform notice_send(v_parents, 'animal_slot_time_changed', 'animal_signup', v_year.id,
                              'animal_slot_time_changed:' || v_cal.id::text || ':' || v_cal.version::text);
        end if;
      end if;
    end if;

    perform platform_audit_write('animal_calendar.saved', 'animal_calendar', v_cal.id, v_org, null, 'success',
                                 'school_year:' || v_year.id::text);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_cal.id);
    return platform_result('success', v_cal.id, null) || jsonb_build_object('version', v_cal.version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 7. animal_slots_create (BR80.2, BR80.3). For every Monday to Friday of every school week, breaks included, the
--    missing morning and afternoon slots are made with their duties; existing slots are left alone. A calendar that
--    does not exist yet is made with the default times. The slot's id is its duty's origin id.
-- ---------------------------------------------------------------------------------------------------
create or replace function animal_slots_create(p_idempotency_key text, p_school_year_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'animal_slots.create';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_year school_years%rowtype;
  v_cal animal_calendars%rowtype;
  v_added integer;
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
    select * into v_year from school_years y where y.id = p_school_year_id and y.organization_id = v_org;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    insert into animal_calendars (organization_id, school_year_id, care_group_id)
    values (v_org, v_year.id, animal_care_group_of_year(v_year.id))
    on conflict (school_year_id) do nothing;
    select * into v_cal from animal_calendars c where c.school_year_id = v_year.id for update;

    with wanted as (
      select d.slot_date, p.part, gen_random_uuid() as slot_id, gen_random_uuid() as duty_id
        from school_weeks(v_year.id) w
        cross join generate_series(0, 4) as o(n)
        cross join lateral (select (w.week_start + o.n) as slot_date) d
        cross join (values ('morning'), ('afternoon')) as p(part)
       where d.slot_date between v_year.starts_on and v_year.ends_on
         and not exists (select 1 from animal_slots s
                          where s.calendar_id = v_cal.id and s.slot_date = d.slot_date and s.part = p.part)
    ), made as (
      insert into tasks (organization_id, group_id, title, category, capacity, starts_at, ends_at, origin_kind, origin_id, id)
      select v_org, null,
             case w.part when 'morning' then 'Reggeli állatgondozás' else 'Délutáni állatgondozás' end,
             'állatgondozás', 1,
             animal_slot_start(w.slot_date, case w.part when 'morning' then v_cal.morning_start else v_cal.afternoon_start end),
             animal_slot_start(w.slot_date, case w.part when 'morning' then v_cal.morning_start else v_cal.afternoon_start end)
               + interval '1 hour',
             'animal_slot', w.slot_id, w.duty_id
        from wanted w
      returning id
    ), slots as (
      insert into animal_slots (id, calendar_id, slot_date, part, duty_id)
      select w.slot_id, v_cal.id, w.slot_date, w.part, w.duty_id from wanted w
      returning id
    )
    select count(*) into v_added from slots;

    update animal_calendars set generated_at = now() where id = v_cal.id;
    perform platform_audit_write('animal_slots.created', 'animal_calendar', v_cal.id, v_org, null, 'success',
                                 'added:' || v_added::text);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_cal.id);
    return platform_result('success', v_cal.id, null) || jsonb_build_object('added', v_added);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 8. animal_slots_list (BR81.6, BR82.3). Every signed-in member of the community reads the slots from a date, a number
--    of weeks at a time. A row carries the holder's family display name only, never a contact detail; the caller's own
--    family sees whether it may hold the day and whether giving up is still allowed. The duty links for the two parts
--    come from info_links_for_duty.
-- ---------------------------------------------------------------------------------------------------
create or replace function animal_slots_list(p_school_year_id uuid, p_from_date date, p_weeks integer)
returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_family uuid;
  v_from date := coalesce(p_from_date, school_today());
  v_weeks integer := coalesce(p_weeks, 2);
  v_to date;
  v_rows jsonb;
  v_morning uuid;
  v_afternoon uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not coalesce(can_read_community(), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  if v_weeks not between 1 and 8 then
    return platform_result('validation', null, 'request_invalid');
  end if;
  if not exists (select 1 from school_years y where y.id = p_school_year_id and y.organization_id = v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_family := directory_actor_family();
  v_to := v_from + v_weeks * 7 - 1;

  select coalesce(jsonb_agg(jsonb_build_object(
           'slot_date', s.slot_date,
           'part', s.part,
           'start_time', to_char(t.starts_at at time zone 'Europe/Budapest', 'HH24:MI'),
           'duty_id', t.id,
           'duty_version', t.version,
           'place_id', pl.id,
           'place_version', pl.version,
           'family_name', case when pl.id is null then null else family_display_name(pl.family_id) end,
           'mine', pl.id is not null and v_family is not null and pl.family_id = v_family,
           'in_swap', pl.id is not null and (pl.status in ('swap_pending', 'cancellation_pending') or exists (
                        select 1 from change_requests r
                         where r.status = 'open' and (r.assignment_id = pl.id or r.target_assignment_id = pl.id))),
           'started', t.starts_at <= now(),
           'cancelled', t.status = 'cancelled',
           'can_give_up', pl.id is not null and v_family is not null and pl.family_id = v_family
                          and t.status = 'open' and t.starts_at - now() > interval '24 hours'
                          and pl.status = 'active' and not exists (
                            select 1 from change_requests r
                             where r.status = 'open' and (r.assignment_id = pl.id or r.target_assignment_id = pl.id)),
           'may_hold', case when v_family is null then false
                            else coalesce((family_may_hold_duty(v_family, s.slot_date)->>'allowed')::boolean, false) end,
           'hold_reason', case when v_family is null then 'no_family'
                               else family_may_hold_duty(v_family, s.slot_date)->>'reason' end
         ) order by s.slot_date, s.part desc), '[]'::jsonb)
    into v_rows
    from animal_calendars c
    join animal_slots s on s.calendar_id = c.id
    join tasks t on t.id = s.duty_id
    left join lateral (select a.* from assignments a where a.task_id = t.id and a.status <> 'removed'
                        order by a.created_at, a.id limit 1) pl on true
   where c.school_year_id = p_school_year_id and c.organization_id = v_org
     and s.slot_date between v_from and v_to;

  select (select s.duty_id from animal_slots s join animal_calendars c on c.id = s.calendar_id
           where c.school_year_id = p_school_year_id and s.part = 'morning' and s.slot_date >= v_from
           order by s.slot_date limit 1),
         (select s.duty_id from animal_slots s join animal_calendars c on c.id = s.calendar_id
           where c.school_year_id = p_school_year_id and s.part = 'afternoon' and s.slot_date >= v_from
           order by s.slot_date limit 1)
    into v_morning, v_afternoon;

  return platform_result('success', null, null) || jsonb_build_object(
    'school_year_id', p_school_year_id,
    'from_date', v_from,
    'to_date', v_to,
    'slots', v_rows,
    'info_links_morning', case when v_morning is null then '[]'::jsonb else info_links_for_duty(v_morning, v_from) end,
    'info_links_afternoon', case when v_afternoon is null then '[]'::jsonb else info_links_for_duty(v_afternoon, v_from) end);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 9. slot_give_up (C19, BR82). The caller's own place on a slot is released until 24 hours before it starts, when it
--    is not in an open swap. The place is read without a lock first and "not yours" and "does not exist" answer
--    alike, before any lock is taken. Only the caller's own place then locks the duty and the place.
-- ---------------------------------------------------------------------------------------------------
create or replace function slot_give_up(p_idempotency_key text, p_place_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'slot.give_up';
  v_org uuid;
  v_family uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_place assignments%rowtype;
  v_task tasks%rowtype;
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
    v_family := directory_actor_family();
    if v_family is null or p_place_id is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_place from assignments a
     where a.id = p_place_id and a.organization_id = v_org and a.family_id = v_family;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;

    perform place_lock(array[p_place_id]);
    select * into v_place from assignments a where a.id = p_place_id;
    if v_place.family_id <> v_family then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_task from tasks t where t.id = v_place.task_id;
    if v_task.origin_kind <> 'animal_slot' then
      perform platform_abort('conflict', 'SLOT_NOT_RELEASABLE');
    end if;
    if v_place.status = 'removed' then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_task.status <> 'open' or v_task.starts_at <= now() then
      perform platform_abort('conflict', 'DUTY_CLOSED');
    end if;
    if v_task.starts_at - now() <= interval '24 hours' then
      perform platform_abort('conflict', 'SLOT_GIVE_UP_TOO_LATE');
    end if;
    if v_place.status in ('swap_pending', 'cancellation_pending') or exists (
         select 1 from change_requests r
          where r.status = 'open' and (r.assignment_id = v_place.id or r.target_assignment_id = v_place.id)) then
      perform platform_abort('conflict', 'REQUEST_CONFLICT');
    end if;
    if p_expected_version <> v_place.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;

    perform place_release(v_place.id, v_place.version);
    -- The reminders the family had for this slot are planned again without it (U5); the family is not told, it did this itself.
    perform reminder_plan(v_place.task_id);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_place.id);
    return platform_result('success', v_place.id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 10. The fair share (BR83). Counted families are the active families with at least one active week (no standing row
--     counts as staying). T is the slots they hold, past and coming; W the school weeks of the year; S the sum of their
--     active weeks. A family's share is T times its weeks over S; the average is T times W over S. Worked out when read.
-- ---------------------------------------------------------------------------------------------------
create or replace function animal_fair_share_figures(p_school_year_id uuid)
returns table (family_id uuid, active_weeks integer, held integer, share numeric, average numeric)
language sql stable security definer set search_path from current
as $$
  with y as (select s.id, s.organization_id from school_years s where s.id = p_school_year_id),
  fam as (
    select f.id as family_id, (family_standing(f.id, y.id)->>'active_weeks')::integer as active_weeks
      from y join families f on f.organization_id = y.organization_id and f.status = 'active'
  ), counted as (
    select * from fam where coalesce(active_weeks, 0) >= 1
  ), held as (
    select a.family_id, count(*)::integer as n
      from animal_calendars c
      join animal_slots s on s.calendar_id = c.id
      join assignments a on a.task_id = s.duty_id and a.status <> 'removed'
     where c.school_year_id = p_school_year_id
     group by a.family_id
  ), tot as (
    select coalesce(sum(coalesce(h.n, 0)), 0)::numeric as t, coalesce(sum(c.active_weeks), 0)::numeric as s
      from counted c left join held h on h.family_id = c.family_id
  ), w as (
    select count(*)::numeric as w from school_weeks(p_school_year_id)
  )
  select c.family_id, c.active_weeks, coalesce(h.n, 0),
         case when tot.s = 0 then 0 else tot.t * c.active_weeks / tot.s end,
         case when tot.s = 0 then 0 else tot.t * w.w / tot.s end
    from counted c left join held h on h.family_id = c.family_id cross join tot cross join w
   order by c.family_id
$$;

create or replace function animal_fair_share(p_school_year_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_family uuid;
  v_rows jsonb;
  v_mine jsonb;
  v_average numeric;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not coalesce(can_read_community(), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  if not exists (select 1 from school_years y where y.id = p_school_year_id and y.organization_id = v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_family := directory_actor_family();
  select coalesce(jsonb_agg(jsonb_build_object(
           'family_name', family_display_name(r.family_id),
           'count', r.held,
           'share', round(r.share, 1),
           'active_weeks', r.active_weeks,
           'mine', v_family is not null and r.family_id = v_family)
         order by (v_family is not null and r.family_id = v_family) desc, family_display_name(r.family_id), r.family_id),
         '[]'::jsonb),
         max(r.average)
    into v_rows, v_average
    from animal_fair_share_figures(p_school_year_id) r;
  select x into v_mine from jsonb_array_elements(v_rows) x where (x->>'mine')::boolean limit 1;
  return platform_result('success', null, null) || jsonb_build_object(
    'average', round(coalesce(v_average, 0), 1),
    'mine', v_mine,
    'families', v_rows);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 11. The notice registry rows and the facts function (C8). The text is worked out when the notice is read, from the
--     slots as they are then: a message about empty slots lists what is still free, the fair-share reminder gives the
--     family's own count and share and the average, and no message names another family.
-- ---------------------------------------------------------------------------------------------------
create or replace function animal_notice_facts(p_target_id uuid, p_parent_id uuid, p_kind text)
returns table (item_name text, item_date date, path text, full_title text, detail text)
language plpgsql stable security definer set search_path from current
as $$
declare
  v_parent parents%rowtype;
  v_created date;
  v_detail text;
  v_row record;
begin
  select * into v_parent from parents p where p.id = p_parent_id;
  if not found or not exists (select 1 from school_years y where y.id = p_target_id and y.organization_id = v_parent.organization_id) then
    return;
  end if;
  select (n.created_at at time zone 'Europe/Budapest')::date into v_created from notifications n
   where n.parent_id = p_parent_id and n.kind = p_kind and n.target_ref = p_target_id
   order by n.created_at desc limit 1;
  v_created := coalesce(v_created, school_today());

  if p_kind in ('animal_empty_slots', 'animal_empty_slots_alert') then
    select string_agg(to_char(s.slot_date, 'YYYY. MM. DD.') || ' ' || case s.part when 'morning' then 'reggel' else 'délután' end,
                      '; ' order by s.slot_date, s.part desc)
      into v_detail
      from animal_calendars c
      join animal_slots s on s.calendar_id = c.id
      join tasks t on t.id = s.duty_id and t.status = 'open' and t.starts_at > now()
     where c.school_year_id = p_target_id
       and s.slot_date between v_created + (case p_kind when 'animal_empty_slots_alert' then 1 else 1 end)
                           and v_created + (case p_kind when 'animal_empty_slots_alert' then 1 else 3 end)
       and not exists (select 1 from assignments a where a.task_id = t.id and a.status <> 'removed')
       and (p_kind = 'animal_empty_slots_alert'
            or coalesce((family_may_hold_duty(v_parent.family_id, s.slot_date)->>'allowed')::boolean, false));
    return query select 'Állatgondozás'::text, v_created, '/szulo/allatok'::text, null::text,
      case when v_detail is null then 'Az üres időpontok közben betelt.' else 'Még üres: ' || v_detail end;
  elsif p_kind = 'animal_fair_share' then
    select r.held, r.share, r.average into v_row from animal_fair_share_figures(p_target_id) r where r.family_id = v_parent.family_id;
    return query select 'Állatgondozás'::text, v_created, '/szulo/allatok'::text, null::text,
      case when v_row is null then 'Nézzétek meg az állatgondozási beosztást.'
           else 'Eddig ' || v_row.held::text || ' időpontot vállaltatok; a ti méltányos részetek '
                || replace(round(v_row.share, 1)::text, '.', ',') || ', az átlag '
                || replace(round(v_row.average, 1)::text, '.', ',') || '.' end;
  else
    return query select 'Állatgondozás'::text, v_created, '/szulo/allatok'::text, null::text,
      'Az állatgondozási időpontok kezdete megváltozott. Nézzétek meg a beosztást.'::text;
  end if;
end $$;

insert into notice_targets (target_type, facts_function, added_by) values
  ('animal_signup', 'animal_notice_facts', 'u8-animal-care');

insert into notice_kinds (kind, target_type, title_prefix, label, added_by) values
  ('animal_empty_slots', 'animal_signup', 'Üres időpontok:', 'Üres állatgondozási időpontok', 'u8-animal-care'),
  ('animal_empty_slots_alert', 'animal_signup', 'Holnap üres:', 'Holnapra üres állatgondozási időpont', 'u8-animal-care'),
  ('animal_fair_share', 'animal_signup', 'Méltányos rész:', 'Állatgondozás méltányos része', 'u8-animal-care'),
  ('animal_slot_time_changed', 'animal_signup', 'Időpont változás:', 'Állatgondozási időpont változott', 'u8-animal-care');

-- ---------------------------------------------------------------------------------------------------
-- 12. The two daily checks (C9, BR84, BR85). Each takes the run's moment, works per community, and returns the counts
--     created and skipped; a community that fails is named in the detail line and does not stop the others.
-- ---------------------------------------------------------------------------------------------------
create or replace function animal_fair_share_check(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Budapest')::date;
  v_first_weekday date;
  v_month date := date_trunc('month', (coalesce(p_now, now()) at time zone 'Europe/Budapest')::date)::date;
  v_org record;
  v_year uuid;
  v_cal animal_calendars%rowtype;
  v_round uuid;
  v_average numeric;
  v_families uuid[];
  v_parents uuid[];
  v_created integer := 0;
  v_skipped integer := 0;
  v_failed uuid[] := '{}'::uuid[];
begin
  v_first_weekday := v_month;
  while extract(isodow from v_first_weekday) > 5 loop
    v_first_weekday := v_first_weekday + 1;
  end loop;
  if v_today < v_first_weekday then
    return jsonb_build_object('created', 0, 'skipped', 0, 'detail', null);
  end if;
  for v_org in
    select distinct y.organization_id from school_years y
     where y.status = 'active' and v_today between y.starts_on and y.ends_on order by 1
  loop
    begin
      v_year := school_year_for(v_today, v_org.organization_id);
      if v_year is null or not exists (select 1 from school_weeks(v_year) w where v_today between w.week_start and w.week_start + 6) then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      select * into v_cal from animal_calendars c where c.school_year_id = v_year;
      if not found then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      select coalesce(array_agg(r.family_id order by r.family_id), '{}'::uuid[]), max(r.average)
        into v_families, v_average
        from animal_fair_share_figures(v_year) r
       where r.held < r.share
         and coalesce((family_may_hold_duty(r.family_id, v_today)->>'allowed')::boolean, false);
      insert into animal_fair_share_rounds (calendar_id, month, decided_on, average_at_round, families_reminded)
      values (v_cal.id, v_month, v_today,
              coalesce(v_average, (select max(r.average) from animal_fair_share_figures(v_year) r), 0),
              cardinality(v_families))
      on conflict (calendar_id, month) do nothing
      returning id into v_round;
      if v_round is null then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_parents
        from parents p where p.family_id = any (v_families) and p.status = 'active' and p.account_id is not null;
      if cardinality(v_parents) > 0 then
        v_created := v_created + notice_send(v_parents, 'animal_fair_share', 'animal_signup', v_year,
                                             'animal_fair_share:' || v_year::text || ':' || to_char(v_month, 'YYYY-MM'));
      end if;
    exception when others then
      v_failed := v_failed || v_org.organization_id;
    end;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped,
    'detail', case when cardinality(v_failed) = 0 then null else 'failed: ' || array_to_string(v_failed, ', ') end);
end $$;

create or replace function animal_empty_slots_check(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Budapest')::date;
  v_org record;
  v_year uuid;
  v_care_group uuid;
  v_family record;
  v_recipients uuid[];
  v_created integer := 0;
  v_skipped integer := 0;
  v_failed uuid[] := '{}'::uuid[];
begin
  for v_org in
    select distinct c.organization_id from animal_calendars c
      join school_years y on y.id = c.school_year_id and y.status = 'active'
     where v_today + 1 between y.starts_on and y.ends_on order by 1
  loop
    begin
      v_year := school_year_for(v_today, v_org.organization_id);
      select c.care_group_id into v_care_group from animal_calendars c where c.school_year_id = v_year;
      if v_year is null or not found then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      -- One message per family: the free slots of the next three days that the family may hold.
      for v_family in
        select f.id as family_id
          from families f
         where f.organization_id = v_org.organization_id and f.status = 'active'
           and exists (
             select 1 from animal_calendars c
               join animal_slots s on s.calendar_id = c.id and s.slot_date between v_today + 1 and v_today + 3
               join tasks t on t.id = s.duty_id and t.status = 'open' and t.starts_at > coalesce(p_now, now())
              where c.school_year_id = v_year
                and not exists (select 1 from assignments a where a.task_id = t.id and a.status <> 'removed')
                and coalesce((family_may_hold_duty(f.id, s.slot_date)->>'allowed')::boolean, false))
         order by f.id
      loop
        select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_recipients
          from parents p where p.family_id = v_family.family_id and p.status = 'active' and p.account_id is not null;
        if cardinality(v_recipients) = 0 then
          v_skipped := v_skipped + 1;
        else
          v_created := v_created + notice_send(v_recipients, 'animal_empty_slots', 'animal_signup', v_year,
                                               'animal_empty_slots:' || v_today::text);
        end if;
      end loop;
      -- The day-before alert: super admins and the coordinators of the alert group, once per person per day.
      if exists (select 1 from animal_calendars c
                   join animal_slots s on s.calendar_id = c.id and s.slot_date = v_today + 1
                   join tasks t on t.id = s.duty_id and t.status = 'open' and t.starts_at > coalesce(p_now, now())
                  where c.school_year_id = v_year
                    and not exists (select 1 from assignments a where a.task_id = t.id and a.status <> 'removed')) then
        select coalesce(array_agg(distinct x.id order by x.id), '{}'::uuid[]) into v_recipients from (
          select p.id from parents p
            join app_role_grants g on g.subject_id = p.account_id and g.role = 'super_admin' and g.revoked_at is null
                                  and g.organization_id = v_org.organization_id
           where p.organization_id = v_org.organization_id and p.status = 'active'
          union
          select unnest(case when v_care_group is null then '{}'::uuid[] else group_coordinators(v_care_group) end)
        ) x;
        if cardinality(v_recipients) > 0 then
          v_created := v_created + notice_send(v_recipients, 'animal_empty_slots_alert', 'animal_signup', v_year,
                                               'animal_empty_slots_alert:' || v_today::text);
        end if;
      end if;
    exception when others then
      v_failed := v_failed || v_org.organization_id;
    end;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped,
    'detail', case when cardinality(v_failed) = 0 then null else 'failed: ' || array_to_string(v_failed, ', ') end);
end $$;

insert into timed_check_registry (check_name, function_name, run_kind, is_active, lock_step, added_by) values
  ('animal_empty_slots', 'animal_empty_slots_check', 'daily', true, 4, 'u8-animal-care'),
  ('animal_fair_share', 'animal_fair_share_check', 'daily', true, 4, 'u8-animal-care');

-- ---------------------------------------------------------------------------------------------------
-- 13. The information page (BR86, BR87). Helpers first: the link rule (BR87.3, NFR3.13: a link is an http or https
--     address or a path of this app), the owner resolver (BR87.6: the current school year's active group of the
--     section's owner name, compared in lower case) and the coordinator test.
-- ---------------------------------------------------------------------------------------------------
create or replace function info_text_valid(p_body text) returns boolean
language sql immutable set search_path from current
as $$
  select not exists (
    select 1 from regexp_matches(p_body, '\[[^\]]*\]\(([^)]*)\)', 'g') m
     where m[1] !~ '^(https?://[^[:space:]]+|/[^/\\[:space:]][^[:space:]]*)$')
$$;

create or replace function info_section_owner_group(p_section_id uuid) returns uuid
language sql stable security definer set search_path from current
as $$
  select g.id
    from info_sections s
    join groups g on g.organization_id = s.organization_id and g.status = 'active'
                 and g.school_year_id = school_year_for(school_today(), s.organization_id)
                 and lower(g.name) = lower(s.owning_group_name)
   where s.id = p_section_id and s.owning_group_name is not null
   order by g.id
   limit 1
$$;

create or replace function info_caller_coordinates(p_section_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce(
    (select has_current_role_scope('group_admin', s.organization_id, 'group', info_section_owner_group(s.id))
       from info_sections s where s.id = p_section_id and info_section_owner_group(s.id) is not null), false)
$$;

-- The key a new section gets from its title: lower case, accents removed, other characters turned into hyphens, made
-- unique inside the community.
create or replace function info_make_key(p_organization_id uuid, p_title text) returns text
language plpgsql stable security definer set search_path from current
as $$
declare
  v_base text;
  v_key text;
  v_n integer := 1;
begin
  v_base := regexp_replace(translate(lower(p_title), 'áéíóöőúüű', 'aeiooouuu'), '[^a-z0-9]+', '-', 'g');
  v_base := btrim(v_base, '-');
  if v_base = '' then
    v_base := 'szekcio';
  end if;
  v_base := left(v_base, 70);
  v_key := v_base;
  while exists (select 1 from info_sections s where s.organization_id = p_organization_id and s.key = v_key) loop
    v_n := v_n + 1;
    v_key := v_base || '-' || v_n::text;
  end loop;
  return v_key;
end $$;

-- Whether the owner name is empty or the name of an active group of the current school year; returns the cleaned name.
create or replace function info_clean_owner(p_organization_id uuid, p_name text) returns text
language plpgsql stable security definer set search_path from current
as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if v_name is null then
    return null;
  end if;
  if char_length(v_name) > 120 or not exists (
       select 1 from groups g
        where g.organization_id = p_organization_id and g.status = 'active'
          and g.school_year_id = school_year_for(school_today(), p_organization_id) and lower(g.name) = lower(v_name)) then
    perform platform_field_invalid('owning_group_name');
  end if;
  return (select g.name from groups g
           where g.organization_id = p_organization_id and g.status = 'active'
             and g.school_year_id = school_year_for(school_today(), p_organization_id) and lower(g.name) = lower(v_name)
           order by g.id limit 1);
end $$;

create or replace function info_clean_months(p_months integer[]) returns integer[]
language plpgsql immutable set search_path from current
as $$
begin
  if p_months is null or cardinality(p_months) = 0 then
    return null;
  end if;
  if exists (select 1 from unnest(p_months) m where m is null or m not between 1 and 12)
     or (select count(distinct m) from unnest(p_months) m) <> cardinality(p_months) then
    perform platform_field_invalid('season_months');
  end if;
  return (select array_agg(m order by m) from unnest(p_months) m);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 14. info_sections_list (BR86.1, BR86.3). Every signed-in member reads the visible sections in order; a super admin
--     also gets the hidden ones, marked. Each item says whether the caller may edit its text, or everything.
-- ---------------------------------------------------------------------------------------------------
create or replace function info_sections_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_super boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not coalesce(can_read_community(), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  v_super := coalesce(has_super_scope(v_org), false);
  return platform_result('success', null, null) || jsonb_build_object(
    'can_manage', v_super,
    'owner_group_names', case when v_super then coalesce((
        select jsonb_agg(g.name order by g.name) from groups g
         where g.organization_id = v_org and g.status = 'active'
           and g.school_year_id = school_year_for(school_today(), v_org)), '[]'::jsonb) else '[]'::jsonb end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'key', s.key, 'title', s.title, 'body', s.body,
               'owning_group_name', s.owning_group_name, 'season_months', to_jsonb(s.season_months),
               'position', s.position, 'hidden', s.hidden, 'version', s.version,
               'can_edit_text', v_super or info_caller_coordinates(s.id),
               'can_edit_all', v_super)
             order by s.position, s.id)
        from info_sections s
       where s.organization_id = v_org and (v_super or not s.hidden)), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 15. info_section_update (BR87.1 to BR87.6). A super admin changes every field; a coordinator of the owning group
--     only the text (any other difference is refused as denied). The section row is locked, the version checked.
-- ---------------------------------------------------------------------------------------------------
create or replace function info_section_update(
  p_idempotency_key text, p_section_id uuid, p_title text, p_body text, p_owning_group_name text,
  p_season_months integer[], p_position integer, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'info_section.update';
  v_org uuid;
  v_super boolean;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_section info_sections%rowtype;
  v_owner text;
  v_months integer[];
  v_title text := btrim(coalesce(p_title, ''));
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_section_id::text, v_title, coalesce(p_body, ''),
    coalesce(p_owning_group_name, ''), coalesce(array_to_string(p_season_months, ','), ''),
    p_position::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_super := coalesce(has_super_scope(v_org), false);
    select * into v_section from info_sections s where s.id = p_section_id and s.organization_id = v_org for update;
    if not found or not (v_super or info_caller_coordinates(p_section_id)) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if not v_super and (v_title is distinct from v_section.title
         or nullif(btrim(coalesce(p_owning_group_name, '')), '') is distinct from v_section.owning_group_name
         or p_season_months is distinct from v_section.season_months
         or p_position is distinct from v_section.position) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if char_length(v_title) not between 1 and 120 then
      perform platform_field_invalid('title');
    end if;
    if p_body is null or char_length(p_body) not between 1 and 20000 then
      perform platform_field_invalid('body');
    end if;
    if not info_text_valid(p_body) then
      perform platform_abort('validation', 'INFO_TEXT_INVALID');
    end if;
    if p_position is null or p_position < 1 then
      perform platform_field_invalid('position');
    end if;
    if v_super then
      v_owner := info_clean_owner(v_org, p_owning_group_name);
      v_months := info_clean_months(p_season_months);
    else
      v_owner := v_section.owning_group_name;
      v_months := v_section.season_months;
    end if;
    if p_expected_version <> v_section.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    update info_sections
       set title = v_title, body = p_body, owning_group_name = v_owner, season_months = v_months, position = p_position
     where id = v_section.id
     returning * into v_section;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_section.id);
    return platform_result('success', v_section.id, null) || jsonb_build_object('version', v_section.version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 16. info_section_create and info_section_set_hidden (BR87.2, BR87.4, BR87.5). Super admin only.
-- ---------------------------------------------------------------------------------------------------
create or replace function info_section_create(
  p_idempotency_key text, p_title text, p_body text, p_owning_group_name text, p_season_months integer[],
  p_position integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'info_section.create';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_title text := btrim(coalesce(p_title, ''));
  v_owner text;
  v_months integer[];
  v_id uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', v_title, coalesce(p_body, ''),
    coalesce(p_owning_group_name, ''), coalesce(array_to_string(p_season_months, ','), ''), p_position::text), 'UTF8')), 'hex');
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
    if char_length(v_title) not between 1 and 120 then
      perform platform_field_invalid('title');
    end if;
    if p_body is null or char_length(p_body) not between 1 and 20000 then
      perform platform_field_invalid('body');
    end if;
    if not info_text_valid(p_body) then
      perform platform_abort('validation', 'INFO_TEXT_INVALID');
    end if;
    if p_position is null or p_position < 1 then
      perform platform_field_invalid('position');
    end if;
    v_owner := info_clean_owner(v_org, p_owning_group_name);
    v_months := info_clean_months(p_season_months);
    insert into info_sections (organization_id, key, title, body, owning_group_name, season_months, position)
    values (v_org, info_make_key(v_org, v_title), v_title, p_body, v_owner, v_months, p_position)
    returning id into v_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function info_section_set_hidden(
  p_idempotency_key text, p_section_id uuid, p_hidden boolean, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'info_section.set_hidden';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_section info_sections%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_section_id::text, p_hidden::text, p_expected_version::text), 'UTF8')), 'hex');
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
    select * into v_section from info_sections s where s.id = p_section_id and s.organization_id = v_org for update;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_hidden is null then
      perform platform_field_invalid('hidden');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_section.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    update info_sections set hidden = p_hidden where id = v_section.id returning * into v_section;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_section.id);
    return platform_result('success', v_section.id, null) || jsonb_build_object('version', v_section.version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 17. info_links_for_duty (BR88). The sections a duty card links to, visible ones only: morning or afternoon on a
--     slot (plus watering in its season), the Saturday cleaning and the animal feeding on a weekend duty. Internal.
-- ---------------------------------------------------------------------------------------------------
create or replace function info_links_for_duty(p_duty_id uuid, p_on date default null) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_task tasks%rowtype;
  v_keys text[];
  v_month integer;
  v_part text;
begin
  select * into v_task from tasks t where t.id = p_duty_id;
  if not found then
    return '[]'::jsonb;
  end if;
  v_month := extract(month from coalesce(p_on, (v_task.starts_at at time zone 'Europe/Budapest')::date))::integer;
  if v_task.origin_kind = 'animal_slot' then
    select s.part into v_part from animal_slots s where s.id = v_task.origin_id;
    v_keys := case v_part when 'morning' then array['morning', 'watering']
                          when 'afternoon' then array['afternoon', 'watering'] else '{}'::text[] end;
  elsif v_task.origin_kind = 'weekend_slot'
        or (v_task.origin_kind = 'rota_week' and exists (
              select 1 from rota_weeks w where w.id = v_task.origin_id and w.job = 'weekend_animal_care')) then
    v_keys := array['saturday-cleaning', 'animal-feeding'];
  else
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('key', i.key, 'title', i.title) order by k.ord)
      from unnest(v_keys) with ordinality k(key, ord)
      join info_sections i on i.organization_id = v_task.organization_id and i.key = k.key and not i.hidden
                          and (i.season_months is null or v_month = any (i.season_months))), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 18. The six starting sections (FR10.3). An internal install function, granted to the service role only, so a hosted
--     database gets the same sections as the local one; the content is not test data. The text is copied from the
--     appendices of the spreadsheet review, checked for names and contact details (none are included; the carpet
--     cleaning company's contact stays in the original). A section whose key the community already has is skipped, so
--     running it twice adds nothing. Returns the number of sections it added. Run here for every existing community.
-- ---------------------------------------------------------------------------------------------------
create or replace function info_starting_sections_install(p_organization_id uuid) returns integer
language plpgsql security definer set search_path from current
as $$
declare
  v_added integer := 0;
  v_row record;
begin
  for v_row in
    select * from (values
      (1, 'morning', 'Reggeli teendők', 'Állatgondozás', null::integer[], $body$**Minden reggel (kb. 5-10 perc):**

- Tyúkokat, nyuszikat kiengedni.
- Tyúkoknak a lábasba, nyusziknak az itatóba friss vizet adni. Ha koszos az edény, ki kell súrolni.
- Tyúkoknak 1 adagolókanál (fándli) tyúktáp az etetőbe a hordóból.
- Nyusziknak: 2 kislapát táp a fém tálkába és 2 marék széna a tároló rácsba.
- Ha kiürül bármelyik eledel tároló doboz vagy hordó, kérlek, vigyétek azt előre a padlásfeljáróhoz, és jelezzétek az ovis chat csoportban.$body$),
      (2, 'afternoon', 'Délutáni, esti teendők', 'Állatgondozás', null::integer[], $body$**Minden délután, este (kb. 5-10 perc):**

- Tiszta víz adása a nyusziknak és a csirkéknek, kint és bent is. Ha koszos az itató, a műanyag kefével ki kell súrolni!
- A nyuszik itatója alatt legyen a barna tálka vagy a tálca, hogy oda csepegjen a víz.
- Nyusziknak egy marék szénát lehet adni.
- Tyúkok és nyuszik bezárása a ketrecükbe.
- Tyúktojások összeszedése (ólból és szénatárolóból), a padlásfeljáróban lévő tárolókba kell tenni. Csak akkor, ha másnap nincs ovi! Ovinapokon a gyerekek szedik össze.$body$),
      (3, 'watering', 'Locsolás', 'Állatgondozás', array[3, 4, 5, 6, 7, 8, 9, 10], $body$**Márciustól októberig:**

Locsolni a hátsó udvari és utcai ágyásokat, friss ültetéseket, fákat, amikor nincs elég eső.

- Magaságyásokban lévő palánták, eperágyások, paradicsomágyások, az indiánsátor körül a hajnalka és a kerítés melletti évelő virágágyás.
- Kertfelelős (heti 1x): összes gyümölcsfa, málnás, mogyoróbokor, orgona, vagyis minden fás szárú cserje, fa, bokor, utcafronti virágok.

A füves kertrészben locsolórendszer működik, ott nem kell locsolni.$body$),
      (4, 'saturday-cleaning', 'Szombati takarítás', 'Állatgondozás', null::integer[], $body$**Szombat reggel, az állatok takarítása**

**Nyúl:**

- A nyúlketrec aljában lévő alomtálca tartalmát a komposztra kell üríteni.
- A koszos szénát cserélni kell az ól hátsó részéből!
- Külső rész: a sarokban össze kell szedni a nyúlbogyókat, és friss szalmát kell a helyére szórni.

**Tyúk:**

- A tyúkólban lévő koszos szalmát a komposztra kell dobni, a szalma helyén alaposan felsöpörni. Tisztítás után friss szalmát leteríteni.
- A teljes tyúkólat alaposan felseperni.
- Homokfürdőből a nagyobb piszokdarabokat kiszedni, és a homokot frissíteni. Kétszer rostált sóder jó nekik, vannak benne kis csigák, amiket tudnak csipegetni, kovafölddel és sima földdel keverve. Kovaföld van a szénatárolóban.
- A szalmatároló előtti betonrészt felseperni.$body$),
      (5, 'animal-feeding', 'Állatok etetése és ápolása', 'Állatgondozás', null::integer[], $body$**Fertőtlenítő:** [Greenman állatgondozási fertőtlenítő](https://greenman.hu/product/greenman-animal/)

**Tyúkok eledele**

- Ásványi sók bevitele miatt himalája só.
- Vitaminos víz: Gastro-fm vagy Jolovit, ami éppen van a boltban.
- Takarmánymész (tojótyúkoknál kiemelkedően fontos).
- Takarmányszén a jobb emésztésért és a trágya jobb minőségéért.
- Milyen növényeket ehetnek? Vörös here, fehér here, friss lucerna, pitypang, szinte bármilyen zöld, ők kiválogatják maguknak. Jót tesz a körömvirág és a kamilla. Csalán!

**Tyúkok ápolása**

- Naponta 2x friss víz, friss takarmány és egy csokor friss zöld adása.
- Hetente takarítás (az ólat és az itató-, etetőedényeket kefével elmosni).
- Hetente testi épség ellenőrzése.
- Ha egy tyúknak bárhol nyílt sebe van, azonnal el kell különíteni, mivel a többiek a vérszagra "megeszik".
- Tyúkjátszótér kialakítása (boldog tyúk = egészséges tyúk).
- Beszélni hozzájuk, simogatni őket.
- Évente 1x meszelni.

**Nyuszik eledele**

- Vitaminos víz, és amit éppen a kertben szedünk: vadon termő zöld és gyógynövények (kiszárítva).
- Sárgarépa, alma és cékla szárítva csemegének, főleg a szénhidrát- és vitaminbevitel miatt télen.
- Milyen növényeket ehetnek? Lóhere, vörös és fehér here, kamilla, pitypang, mezei virágok (kiszárítva).

**Nyuszik ápolása**

- 3 havonta körömvágás.
- Hetente mancsok, fülek és fogazat ellenőrzése.
- Minden alkalommal kedves szavak, sok-sok simogatás és kézből etetés.
- Kézhez szokottabb állapotban ölbe venni és simogatni, úgy etetni.
- Évente 1x állatorvos.
- Hetente ketrectakarítás.
- 2 havonta a kifutó rendbetétele, takarítása.
- Homokfürdő kialakítása a kifutóban.
- Tavaszi és őszi időszakban meszelni az épület belsejét.
- Búvóhelyek és játszópálya kialakítása a kifutóban (nem unatkozó nyúl = boldog nyúl).
- Rágófa a kifutóban és a ketrecben is.$body$),
      (6, 'big-cleaning', 'Nagytakarítás', 'Nagytakarítás szervezése', null::integer[], $body$**Figyelem!** Az ecetes bútorlemosó vagy a viasz után a rongyot, ami felhasználásra került, nem szabad azonnal a kukába dobni. Mindkét termék öngyulladásra hajlamos, ezért a rongyot előbb ki kell teregetni, hogy megszáradjon, és úgy lehet csak kidobni. Vászon függönyök mosása 60 fokon mehet.

**Nagytakarítások ideje:** téli szünet, tavaszi szünet, nyári szünet.

**Nagytakarítási specialitások**

- Csak a nyári nagytakarításkor van szőnyegtisztítás.
- Szőnyegtisztítás: korábbi években egy szőnyegtisztítóval tisztíttattuk a fényesben és a mesélősben lévő nagy szőnyeget. A maradó családoknak érdemes ezt is újratárgyalni, a tisztító cég elérhetősége a nagytakarítás táblázatban van, ők házhoz jönnek.
- Az alvósban lévő szőnyegeket (gyapjúszőnyegek!) és a bárányszőröket úgy érdemes tisztítani, hogy a kádba betesszük őket, lanolint kapnak, és lábbal jól áttapossuk őket, majd egy ugyanilyen áztató kört kapnak, utána meleg, napos időben gyorsan megszáradnak. Ezekre a jövőben is érdemes figyelni, mert más kezelést igényelnek, mint egy sima szőnyeg.
- A rongyszőnyegek esetében érdemes külön táblázatot vezetni arról, hogy melyik család hány darab szőnyeget vitt haza kimosni.
- Ha a fényesben lévő szőnyeg tisztítását család vállalja, figyelni kell, hogy sokféle anyagból összeállított rongyszőnyegről van szó, és az egyes anyagfajták máshogy nyúlnak meg, amikor vizesek!
- A téli és a nyári nagytakarítás során figyelni kell arra, hogy a téli és nyári ünnep miatt minden bútor és berendezés behordásra kerül az alvósba. Akinek az alvós takarítását vállalja, annak kell onnan kipakolni, vagy annak, akinek hiányzik a maga helyéről. Erre érdemes figyelmeztetni mindenkit, aki érintett lehet a maga területén.
- A téli nagytakarítás előtt feladat a spirál összeszedése is.
- A nyári nagytakarításnál az új szülőkkel mindenképp érdemes a szervezőnek együtt takarítani.
- Jelentkezésnél fontos beírni, hogy ki mikor megy takarítani, mivel vannak egymásra épülő folyamatok (például az alvósba behordott bútorok, vagy ha más csinálja az ablakot és a függönyt, mint az adott terület takarítását).
- Baldachin: érdemes nedvesen bevinni az oviba, ott vasalni és egyből feltenni. Figyelem, a nagy létra legtetejére állva lehet feltenni, egyedül senki ne tegye ezt, mindig legyen ott valaki még!
- Játszós anyagok mosása és vasalása: az étkezős részen van egy polcos kisbútor, azon vannak ilyen anyagok, ezeket is haza szoktuk vinni és kimossuk, mindegyik nagytakarításnál.
- A babaszobában lévő bababútor-anyagokat (takarók, párnácskák stb.) a nyári nagytakarításkor mindenképp érdemes átmosni, de akár évközben is, és egy kis portalanítás is ráfér évközben.

**Szervezési feladatok**

- Takarítás előtt legalább két héttel már megírni a szülőknek az értesítő e-mailt, hogy legyen idejük beírni magukat.
- A nagytakarítós táblázat kiürítése, esetleges szükséges megjegyzések felvitele.
- E-mailben jelentkezési határidőt érdemes megadni, és figyelni is, hogy feltöltésre került-e minden rész.
- Szükség esetén újra írni a szülőknek, ha nincs beírva elég jelentkező.
- Nyáron az új szülőkkel bemenni takarítani.
- A takarítás utolsó napjának mindig a szombati napot kell megadni. Ennek két oka van: egyrészt vasárnap várhatóan az óvónők is be szeretnének menni felkészülni a következő ovis napra, másrészt ha a szervező nem tud szombaton záró kört menni, akkor neki megmaradjon a vasárnap.
- Záró kör: amikor mindenki megcsinálta a feladatát, és a nagytakarítás táblázatban ezt KÉSZ felirattal jelölte is, a szervező bemegy, és átnézi az óvodát. Szükség esetén vagy megcsinálja, ami elmaradt, vagy bevonja az érintett családot. Ezért érdemes már közben is ránézni a dolgokra.
- Záró kör 2: fontos arra is figyelni, hogy minden oda került-e vissza, ahova való.

**Területek és feladatok** (a teljes, jelölhető lista a Nagytakarítás ellenőrzőlistában található)

- Padlásfeljáró: szelektív hulladék elvitele, asztal letakarítása, felsöprés, ablak tisztítása, víztároló rész rendbe tétele.
- Előtér, öltöző, mesélős, fényes, mosdók, óvónői, alvós: pókhálótlanítás és általános portörlés, ablak és ajtó lemosása, függöny kimosása és vasalása, ablakkeret belső részének áttörlése ecetes lemosóval, bútorok letisztítása ecetes lemosóval, kapcsolók portalanítása, padló tisztítása.
- Konyha-étkező és nagy játszós terület: konyhabútor és szekrények, hűtőgép külső-belső tisztítása, lámpabúrák, játéktartó, bútorok, kiskonyha, baldachin mosása és vasalása, kandalló külső portalanítása, szőnyegek portalanítása (nyáron a rongyszőnyegek kimosása), fuga átsikálása körömkefével.
- Mosdók: csempe, kézmosók és WC-k tisztítása, fuga átsikálása körömkefével.
- Alvós: galéria takarítása, nyáron a gyapjúszőnyeg tisztítása.$body$)
    ) as v(position, key, title, owner, months, body)
  loop
    insert into info_sections (organization_id, key, title, body, owning_group_name, season_months, position)
    values (p_organization_id, v_row.key, v_row.title, v_row.body, v_row.owner, v_row.months, v_row.position)
    on conflict (organization_id, key) do nothing;
    if found then
      v_added := v_added + 1;
    end if;
  end loop;
  return v_added;
end $$;

do $$
declare
  v_org record;
begin
  for v_org in select o.id from organizations o order by o.id loop
    perform info_starting_sections_install(v_org.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 19. The duty card read gains the information links (BR88.1 to BR88.3) and nothing else: this is the latest
--     definition (20261053) with one added field in the item.
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
    'own_pick', v_own,
    'info_links', info_links_for_duty(v_task.id, v_week.week_start)));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 20. Rights. Every function starts with `revoke all`; the signed-in commands and reads check their caller themselves
--     and are granted to `authenticated`; the helpers, the facts function and the two checks go to nobody who is
--     signed in; the starting-section install goes to the service role only.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  animal_slot_start(date, time),
  animal_care_group_of_year(uuid),
  animal_fair_share_figures(uuid),
  animal_notice_facts(uuid, uuid, text),
  animal_fair_share_check(timestamptz),
  animal_empty_slots_check(timestamptz),
  info_text_valid(text),
  info_section_owner_group(uuid),
  info_caller_coordinates(uuid),
  info_make_key(uuid, text),
  info_clean_owner(uuid, text),
  info_clean_months(integer[]),
  info_links_for_duty(uuid, date),
  info_starting_sections_install(uuid),
  animal_calendar_get(uuid),
  animal_calendar_save(text, uuid, time, time, uuid, integer),
  animal_slots_create(text, uuid),
  animal_slots_list(uuid, date, integer),
  slot_give_up(text, uuid, integer),
  animal_fair_share(uuid),
  info_sections_list(),
  info_section_update(text, uuid, text, text, text, integer[], integer, integer),
  info_section_create(text, text, text, text, integer[], integer),
  info_section_set_hidden(text, uuid, boolean, integer)
  from public, anon, authenticated, service_role;

grant execute on function
  animal_calendar_get(uuid),
  animal_calendar_save(text, uuid, time, time, uuid, integer),
  animal_slots_create(text, uuid),
  animal_slots_list(uuid, date, integer),
  slot_give_up(text, uuid, integer),
  animal_fair_share(uuid),
  info_sections_list(),
  info_section_update(text, uuid, text, text, text, integer[], integer, integer),
  info_section_create(text, text, text, text, integer[], integer),
  info_section_set_hidden(text, uuid, boolean, integer)
  to authenticated;

grant execute on function info_starting_sections_install(uuid) to service_role;

commit;
