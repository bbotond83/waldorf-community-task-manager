begin;

-- ---------------------------------------------------------------------------------------------------
-- U8 follow-up: the teacher schedule leaves out the daily animal-care slots. They number in the hundreds for a year, are
-- read on the animal-care sign-up page, and would bury the tasks and events the schedule is for. Otherwise the body of
-- 20261056, unchanged.
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
     and t.origin_kind <> 'animal_slot'
     and (p_scope = 'all' or (p_scope = 'community' and t.group_id is null) or (p_scope = 'group' and t.group_id = p_group_id))
     and (v_from is null or t.starts_at >= (v_from::timestamp at time zone 'UTC'))
     and (v_to is null or t.starts_at < ((v_to + 1)::timestamp at time zone 'UTC'));
  return platform_result('success', p_group_id, null) || jsonb_build_object('items', v_items);
end $$;


commit;
