-- A picking week whose family may no longer hold a duty on the week's Monday (leaving, new or archived) owes no pick.
-- weekend_pick_step refuses such a family with DUTY_INELIGIBLE, administrators included, so the pick could never be made
-- and no notice went out. From now on the week is not owed, and the Wednesday check treats it like a week with no
-- family: the weekend family and the administrators are told (BR64.3). Forward-only: 20261053 is not edited.

-- Does this picking week owe a pick? As before, and the week's family must be allowed to hold a duty that week.
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
       and family_hold_reason(w.family_id, w.week_start) is null
       and p.published_at < (select t.saturday from rota_week_times(w.week_start) t))
$$;

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
  -- (BR64.3), or the week's family may not hold a duty that week (leaving, new or archived), so it cannot pick. The
  -- weekend family and the administrators are told once for each week and job.
  for v_row in
    select ww.id as weekend_id, ww.organization_id, ww.family_id as weekend_family, w.job,
           weekend_shelter_duty(ww.id) as duty_id
      from rota_weeks ww
      join rota_plans p on p.id = ww.plan_id and p.status = 'published'
      join rota_weeks w on w.plan_id = ww.plan_id and w.week_start = ww.week_start
                       and w.job in ('indoor_cleaning', 'front_garden')
                       and (w.family_id is null
                            or (w.family_id <> ww.family_id
                                and family_hold_reason(w.family_id, w.week_start) is not null))
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
