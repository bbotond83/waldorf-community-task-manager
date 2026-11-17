-- 20261054 made a picking week of a family that may not hold the duty (leaving, new, archived) not owed, so that the
-- Wednesday check can tell the weekend family and the administrators. A pick for such a week must still be refused
-- with DUTY_INELIGIBLE and its reason (BR60.4), not as "not needed": weekend_pick_step only reports
-- WEEKEND_PICK_NOT_NEEDED when the week is not owed for another reason than the family's eligibility. The body is
-- the one of 20261053 with that one condition changed. Forward-only: earlier files are not edited.
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
  -- A week that is not owed only because the family may not hold the duty falls through to the eligibility refusal below.
  if not found or (not weekend_pick_owed(v_week.id)
                   and family_hold_reason(v_week.family_id, v_week.week_start) is null) then
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
