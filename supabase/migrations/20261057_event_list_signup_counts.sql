-- U10 follow-up: each row of the event lists also says how many sign-ups the event has and whether the calling parent
-- has signed up for it, so the list and the group page can show "N jelentkező" and "Jelentkeztél" (BR104.2, BR108.3).
-- The count is the number of sign-up rows of the event, the same number the event page lists; a withdrawn sign-up is
-- a deleted row and is not counted. The flag is false for a caller with no parent record. Nothing else is added: no
-- name, family or note. Forward-only: 20261056 is not edited; the two functions are redefined with the same
-- signatures, the same reach and the same envelope, and their grants are stated again.
begin;

create or replace function event_list(p_past boolean default false) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parent uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  v_parent := current_parent_id();
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'title', e.title, 'location', e.location, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
           'status', e.status, 'is_finished', e.ends_at <= now(), 'group_id', e.group_id, 'group_name', g.name,
           'signup_count', (select count(*) from event_signups s where s.event_id = e.id),
           'is_signed_up', v_parent is not null
                           and exists (select 1 from event_signups s where s.event_id = e.id and s.parent_id = v_parent))
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

create or replace function event_list_for_group(p_group_id uuid, p_past boolean default false) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parent uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  v_parent := current_parent_id();
  if p_group_id is null or not exists (select 1 from groups g where g.id = p_group_id and g.organization_id = v_org) then
    return platform_result('denied', null, 'GROUP_UNAVAILABLE');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'title', e.title, 'location', e.location, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
           'status', e.status, 'is_finished', e.ends_at <= now(), 'group_id', e.group_id, 'group_name', g.name,
           'signup_count', (select count(*) from event_signups s where s.event_id = e.id),
           'is_signed_up', v_parent is not null
                           and exists (select 1 from event_signups s where s.event_id = e.id and s.parent_id = v_parent))
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

revoke all on function event_list(boolean), event_list_for_group(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function event_list(boolean), event_list_for_group(uuid, boolean) to authenticated;

commit;
