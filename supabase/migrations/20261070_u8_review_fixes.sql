begin;

-- ---------------------------------------------------------------------------------------------------
-- U8 review follow-up. Forward-only: the two functions are replaced, nothing already applied is edited.
--   * animal_calendar_save: two first saves at once now give the loser a version conflict, not a raw unique error.
--   * info_section_update: the caller is checked before the section row is locked; a coordinator cannot reach a
--     hidden section. Rights are restated below.
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
      -- Two first saves at once: the loser waits for the winner, inserts nothing and reads a version conflict.
      insert into animal_calendars (organization_id, school_year_id, morning_start, afternoon_start, care_group_id)
      values (v_org, v_year.id, p_morning_start, p_afternoon_start,
              coalesce(p_care_group_id, animal_care_group_of_year(v_year.id)))
      on conflict do nothing
      returning * into v_cal;
      if v_cal.id is null then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
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
    -- The caller is checked on an unlocked read first, so a stranger never waits on the section lock. A coordinator
    -- never reaches a hidden section (the list does not show it either): it answers like a missing one.
    select * into v_section from info_sections s where s.id = p_section_id and s.organization_id = v_org;
    if not found or not (v_super or (not v_section.hidden and info_caller_coordinates(p_section_id))) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_section from info_sections s where s.id = p_section_id for update;
    if not v_super and v_section.hidden then
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

revoke all on function
  animal_calendar_save(text, uuid, time, time, uuid, integer),
  info_section_update(text, uuid, text, text, text, integer[], integer, integer)
  from public, anon, authenticated, service_role;

grant execute on function
  animal_calendar_save(text, uuid, time, time, uuid, integer),
  info_section_update(text, uuid, text, text, text, integer[], integer, integer)
  to authenticated;

commit;
