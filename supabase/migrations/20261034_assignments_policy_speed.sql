-- U3 performance of the assignment read policy (NFR4.6, NFR3.5). The policy of 20261026 called the group
-- reach and the family lookup once per row, each with its own session check, and listing the 1500
-- assignments of the 150-family data set took about 0.9 s for a group admin. The same rule is computed once
-- per statement here: the groups the caller administers, the tasks of those groups and the caller's family
-- are looked up one time (an initplan) and each row is compared with them. The rule is unchanged:
-- assignments are read by an admin who reaches the task's group and by the parents of the assignment's
-- family.

-- The groups the signed-in account administers: every group of the organization for a super admin, the
-- granted groups for a group admin, none without an active session.
create or replace function coordination_reach_groups() returns uuid[]
language sql stable security definer set search_path from current
as $$
  select case
    when not current_session_is_active() then '{}'::uuid[]
    when has_super_scope(identity_actor_organization()) then
      coalesce((select array_agg(g.id) from groups g where g.organization_id = identity_actor_organization()), '{}'::uuid[])
    else coalesce((select array_agg(r.scope_id) from app_role_grants r
                    where r.subject_id = auth.uid() and r.role = 'group_admin' and r.scope_type = 'group'
                      and r.revoked_at is null and r.organization_id = identity_actor_organization()), '{}'::uuid[])
  end
$$;

-- The tasks of those groups.
create or replace function coordination_reach_task_ids() returns uuid[]
language sql stable security definer set search_path from current
as $$
  select coalesce(array_agg(t.id), '{}'::uuid[]) from tasks t where t.group_id = any (coordination_reach_groups())
$$;

-- The signed-in parent's family (the internal lookup of Directory, made callable for the policy).
create or replace function coordination_my_family() returns uuid
language sql stable security definer set search_path from current
as $$ select directory_actor_family() $$;

drop policy assignments_read on assignments;
create policy assignments_read on assignments for select to authenticated
  using ((select coordination_reach_task_ids()) @> array[task_id]
         or family_id = (select coordination_my_family()));

revoke all on function coordination_reach_groups(), coordination_reach_task_ids(), coordination_my_family()
  from public, anon, authenticated, service_role;
grant execute on function coordination_reach_groups(), coordination_reach_task_ids(), coordination_my_family()
  to authenticated;
