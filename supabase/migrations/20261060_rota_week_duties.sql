-- U7 (BR74.1): the duty and place version behind each published rota week, so the administrator's rota page can hand a
-- week to another family with duty_reassign. Read only; a super admin only, like rota_plan_get. A week with no family,
-- a break week and a week of a draft plan have no duty and are left out.
begin;

create or replace function rota_week_duties(p_school_year_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_year uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if v_org is null or not coalesce(has_super_scope(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_year := coalesce(p_school_year_id, rota_pick_school_year(v_org));
  select coalesce(jsonb_agg(jsonb_build_object('week_id', rw.id, 'duty_id', t.id, 'place_version', a.version)
                            order by rw.week_start, rw.job), '[]'::jsonb)
    into v_items
    from rota_plans rp
    join rota_weeks rw on rw.plan_id = rp.id
    join tasks t on t.origin_kind = 'rota_week' and t.origin_id = rw.id and t.organization_id = v_org
    join assignments a on a.task_id = t.id and a.status <> 'removed'
    join school_years sy on sy.id = rp.school_year_id and sy.organization_id = v_org
   where rp.school_year_id = v_year and rp.status = 'published';
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end;
$$;

revoke all on function rota_week_duties(uuid) from public, anon, authenticated, service_role;
grant execute on function rota_week_duties(uuid) to authenticated;

commit;
