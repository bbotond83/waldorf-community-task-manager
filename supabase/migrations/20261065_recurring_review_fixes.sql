-- U9 review fixes (forward-only: 20261064 has been applied, so it is not edited).
--
-- 1. recurring_lock_holder now locks the rota-week row, as the lock order of 20261064 says (family, then rota week). The real
--    swap and republish path (rota_adjust_picks_after_change) writes rota_weeks.family_id under the rota-week lock and takes
--    no family lock, so without this a mark that had read the old holder could still land after the swap committed.
-- 2. can_undo no longer shows an Undo button to a marker who has left the family: the undo command also needs the right to
--    mark (the same rule as recurring_occurrence_undo).
-- Both are create or replace, so the existing grants stay.

create or replace function recurring_lock_holder(p_access jsonb, p_depends boolean) returns void
language plpgsql security definer set search_path from current
as $$
begin
  if p_access->>'holder_family' is null then
    return;
  end if;
  perform 1 from families f where f.id = (p_access->>'holder_family')::uuid for update;
  if p_access->>'owner_kind' = 'rota_week' then
    perform 1 from rota_weeks w join rota_plans p on p.id = w.plan_id and p.status = 'published'
     where w.job = p_access->>'rota_job' and w.week_start = (p_access->>'due_date')::date
       and w.organization_id = identity_actor_organization()
     for update of w;
  end if;
  if p_depends and p_access->>'owner_kind' = 'rota_week'
     and rota_family_for(p_access->>'rota_job', (p_access->>'due_date')::date)
         is distinct from (p_access->>'holder_family')::uuid then
    perform platform_abort('conflict', 'VERSION_CONFLICT');
  end if;
end $$;

create or replace function recurring_item_json(
  o recurring_occurrences, s recurring_schedules, p_mark boolean, p_manage boolean, p_parent uuid
) returns jsonb
language sql stable security definer set search_path from current
as $$
  select jsonb_build_object(
    'id', o.id, 'schedule_id', s.id, 'title', s.title, 'category', s.category, 'owner_kind', s.owner_kind,
    'working_group_id', s.working_group_id, 'due_date', o.due_date, 'status', o.status,
    'is_overdue', o.status = 'open' and o.due_date < school_today(),
    'version', o.version,
    'done_by_display_name', case when o.status = 'done' then
        case when o.done_by_removed then 'korábbi tag'
             else coalesce(parent_display_name(o.done_by_parent_id), 'korábbi tag') end end,
    'done_at', o.done_at,
    'skipped_reason', o.skipped_reason,
    'skipped_by_display_name', case when o.status = 'skipped' then
        case when o.skipped_by_removed then 'korábbi tag'
             when o.skipped_by_parent_id is not null then coalesce(parent_display_name(o.skipped_by_parent_id), 'korábbi tag')
             else 'adminisztrátor' end end,
    'can_mark_done', o.status = 'open' and p_mark,
    'can_undo', o.status = 'done' and now() < o.done_at + interval '24 hours'
                and (p_manage or (p_mark and p_parent is not null and o.done_by_parent_id = p_parent)),
    'can_skip', o.status = 'open' and p_manage)
$$;
