-- U3 repair of two directory reads. The names sort between 20261035_governance_list and
-- 20261035_placeholder_drop, so the placeholder drop stays the last file.

-- 1. directory_parent_profile (BR30.4). The first version (20261024) returned NULL for a parent who gave
-- consent but wrote no text. A NULL answer of the data API is a terminal failure in the app's client, so the
-- family edit page could not be opened for such a family. Now a reader who may see the profile (the parent
-- themself and an admin in reach, only with consent) gets the empty string when there is no text. A reader
-- who may not see it still gets NULL, exactly as before: the privacy rule is unchanged.
create or replace function directory_parent_profile(p_parent_id uuid) returns text
language sql stable security definer set search_path from current
as $$ select coalesce(p.optional_profile, '')
    from parents p
   where p.id = p_parent_id and current_session_is_active() and p.optional_profile_consent
     and (p.account_id = auth.uid() or directory_reaches_family(p.organization_id, p.family_id)) $$;

-- 2. duty_get (BR31.11). The first version (20261028) returned title, place, time and version of any task
-- of the organization by id, including tasks of groups the family is not in, while duty_list hides them. Now
-- the detail follows the same rule as the list: a task of a group the family is an active member of (the
-- group being active), or a task the family holds a place on. Any other task answers duty_not_found, exactly
-- like a task that does not exist. Everything else is the body of 20261028, unchanged.
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
   where t.id = p_task_id and t.organization_id = v_org and t.status <> 'cancelled'
     and (exists (select 1 from assignments a
                   where a.task_id = t.id and a.family_id = v_family and a.status <> 'removed')
          or exists (select 1 from group_memberships m join groups g on g.id = m.group_id
                      where m.family_id = v_family and m.group_id = t.group_id
                        and m.status = 'active' and g.status = 'active'));
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

-- create or replace keeps the grants of the earlier files; stated again so this file stands on its own.
revoke all on function directory_parent_profile(uuid), duty_get(uuid) from public, anon, authenticated, service_role;
grant execute on function directory_parent_profile(uuid), duty_get(uuid) to authenticated;
