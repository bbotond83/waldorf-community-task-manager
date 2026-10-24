-- U3 Coordination: the teacher schedule (BR33.1 to BR33.3, NFR1.30). A function that joins tasks, events,
-- assignments and family display names and returns rows, not a table or a view (NFR2.13): always current, no
-- refresh. It is an elevated function because it shows the names of several families to a teacher, who
-- reads none of those tables. It returns no contact details, no notes and no ids of people.

-- schedule_get(group, from, to): the tasks of one group in a date range, ordered by start time.
--   * Reach: a teacher or a group admin of the group, or a super admin; anyone else, an unknown group and a
--     group of another organization are all "denied" (no oracle across groups or organizations).
--   * Filter (the rule of the teacher facade, repeated here): both dates given means two real calendar
--     dates (YYYY-MM-DD; 31 February is refused), the start not after the end and at most 31 days between
--     them; one date alone is a one-sided limit; no date means no limit. The limits are UTC days of the
--     task's start. An invalid filter is a validation result with the code VAL-DATE-RANGE.
--   * Each entry: id (the task's), group_id, starts_at, ends_at, title, location, coordination display name
--     (the event's coordinator, absent without an event), owner display name (the family with the earliest
--     non-removed assignment), assignee display names (all families with non-removed assignments, in
--     creation order) and the status label: cancelled when the task or its event is cancelled, full when the
--     places are taken, else open. An empty list is the empty state.
create or replace function schedule_get(p_group_id uuid, p_from text default null, p_to text default null)
returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_from date;
  v_to date;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if p_group_id is null
     or not exists (select 1 from groups g where g.id = p_group_id and g.organization_id = v_org)
     or not (has_core_scope(v_org, p_group_id)
             or has_current_role_scope('kindergarten_teacher', v_org, 'group', p_group_id)) then
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
           'coordination_display_name', e.coordinator_name,
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
   where t.group_id = p_group_id and t.organization_id = v_org
     and (v_from is null or t.starts_at >= (v_from::timestamp at time zone 'UTC'))
     and (v_to is null or t.starts_at < ((v_to + 1)::timestamp at time zone 'UTC'));
  return platform_result('success', p_group_id, null) || jsonb_build_object('items', v_items);
end $$;

revoke all on function schedule_get(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function schedule_get(uuid, text, text) to authenticated;
