-- U1 of the Ovis tábla work: one community with working groups in place of kindergarten groups (W1 of
-- functional-spec.md; BR1 to BR7; contracts C1, C2 and C6). The file opens and commits its own transaction, as
-- 20261006_current_roles.sql does, because the migration runner adds none: the clean start, the structure change
-- and the rewritten rules succeed or fail together (NFR7.1). Old rules can never run against the new structure.
-- Technical names stay ("Conversion of Existing Code"): a community is `organizations`, a working group is `groups`,
-- a membership is `group_memberships`, and an item with no `group_id` is community-wide.
--
-- The decision point. "May this caller manage this group?" is answered by has_core_scope, which can_manage_group
-- calls: a super admin, or an unrevoked group_admin grant on that group held by an account whose linked parent and
-- family are active. An empty group therefore means super admin only, with no separate branch to forget (BR3.2).
--
-- Refusals. A command looks an item up inside the caller's community only. For a caller who is not a super admin a
-- missing item and an item out of reach give the same denied result (BR3.4, NFR3.3).
begin;

-- ---------------------------------------------------------------------------------------------------
-- 1. The clean start (BR1.4). Every record is test data, so nothing is converted row by row. Communities, school
--    years, accounts, super-admin grants, settings and the audit log stay.
-- ---------------------------------------------------------------------------------------------------
delete from contribution_notes;
delete from change_requests;
delete from assignments;
delete from tasks;
delete from events;
delete from notifications;
delete from reminder_attempts;
delete from reminder_recipients;
delete from reminder_jobs;
delete from group_memberships;
delete from groups;
delete from children;
delete from parent_contacts;
delete from parents;
delete from families;
delete from invitations;
with removed as (
  delete from app_role_grants where role <> 'super_admin' returning subject_id
)
update app_authorization_versions v set authorization_version = v.authorization_version + 1
 where v.subject_id in (select subject_id from removed);

-- ---------------------------------------------------------------------------------------------------
-- 2. The structure change.
-- ---------------------------------------------------------------------------------------------------

-- A working group has a required description (BR2.2).
alter table groups add column description text not null check (char_length(description) between 1 and 1000);

-- Membership is held per parent; a family has no working group (BR1.5, ADR-001). The policy that names the old
-- column goes first.
drop policy group_memberships_read on group_memberships;
alter table group_memberships drop column family_id;
alter table group_memberships add column parent_id uuid not null;
alter table group_memberships add foreign key (parent_id, organization_id) references parents (id, organization_id);
create unique index group_memberships_one_active on group_memberships (parent_id, group_id) where status = 'active';
create index group_memberships_parent on group_memberships (parent_id, status);

-- An event or task with no group is community-wide (BR1.1).
alter table events alter column group_id drop not null;
alter table tasks alter column group_id drop not null;
create index tasks_community_wide on tasks (organization_id, starts_at) where group_id is null;

-- The new role and scope pairs (BR3.1). An invitation no longer carries group_admin (BR3.6).
alter table app_role_grants drop constraint current_role_scope;
alter table app_role_grants add constraint current_role_scope check (
  (role = 'parent' and scope_type = 'family') or
  (role = 'group_admin' and scope_type = 'group') or
  (role in ('kindergarten_teacher', 'super_admin') and scope_type = 'organization' and scope_id = organization_id)
);
alter table invitations drop constraint invitations_role_scope;
alter table invitations add constraint invitations_role_scope check (
  (role = 'parent' and scope_type = 'family') or
  (role in ('kindergarten_teacher', 'super_admin') and scope_type = 'organization' and scope_id = organization_id)
);

-- A place can no longer come from the old import (FR19).
alter table assignments drop constraint assignments_source_check;
alter table assignments add constraint assignments_source_check
  check (source in ('parent_sign_up', 'admin_assign', 'swap'));

-- A task of an event has the event's scope (BR1.3). The composite key of 20261026 is not checked while either
-- value is empty, so the database compares them on every write, including when both are empty.
create or replace function coordination_task_event_scope() returns trigger
language plpgsql set search_path from current
as $$
declare v_event_group uuid;
begin
  if new.event_id is null then
    return new;
  end if;
  select e.group_id into v_event_group from events e where e.id = new.event_id;
  if found and v_event_group is distinct from new.group_id then
    raise exception 'tasks: task % does not have the scope of its event', new.id using errcode = '23514';
  end if;
  return new;
end $$;
create trigger tasks_event_scope before insert or update of event_id, group_id on tasks
  for each row execute function coordination_task_event_scope();

create or replace function coordination_event_tasks_scope() returns trigger
language plpgsql set search_path from current
as $$
begin
  if exists (select 1 from tasks t where t.event_id = new.id and t.group_id is distinct from new.group_id) then
    raise exception 'events: event % has tasks of another scope', new.id using errcode = '23514';
  end if;
  return new;
end $$;
create trigger events_tasks_scope before update of group_id on events
  for each row when (old.group_id is distinct from new.group_id)
  execute function coordination_event_tasks_scope();

-- ---------------------------------------------------------------------------------------------------
-- 3. Removal of the old import (BR7.1). The audit log keeps `import.commit` in its action list, so past events
--    stay valid. The tables go first because a check constraint uses import_payload_valid.
-- ---------------------------------------------------------------------------------------------------
drop table import_conflicts, import_staged_rows, import_rows, import_runs, sheet_registry, app_import_runs;
do $$
declare v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure from pg_proc p
     where p.pronamespace = current_schema()::regnamespace
       and (p.proname like 'import\_%' or p.proname = 'dashboard_import_conflicts')
  loop
    execute format('drop function %s', v_function);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 4. Who is calling, and what they reach (C2).
-- ---------------------------------------------------------------------------------------------------

-- The active parent linked to the signed-in account, whatever grants it holds: the "linked parent active" half of
-- BR3.2. Internal.
create or replace function identity_linked_parent() returns uuid
language sql stable security definer set search_path from current
as $$
  select p.id
    from parents p join families f on f.id = p.family_id
   where p.account_id = auth.uid() and p.status = 'active' and f.status = 'active'
     and current_session_is_active()
$$;

-- The current parent: empty when the parent, the family or the parent grant is no longer active (C2).
create or replace function current_parent_id() returns uuid
language sql stable security definer set search_path from current
as $$
  select p.id
    from parents p join families f on f.id = p.family_id
   where p.account_id = auth.uid() and p.status = 'active' and f.status = 'active'
     and current_session_is_active()
     and exists (select 1 from app_role_grants g
                  where g.subject_id = auth.uid() and g.role = 'parent' and g.scope_type = 'family'
                    and g.scope_id = p.family_id and g.organization_id = p.organization_id and g.revoked_at is null)
$$;

create or replace function current_family_id() returns uuid
language sql stable security definer set search_path from current
as $$ select p.family_id from parents p where p.id = current_parent_id() $$;

-- A grant counts only in its own pair (BR3.1), and a group_admin grant only while the linked parent and family are
-- active (BR3.2).
create or replace function has_current_role_scope(requested_role text, requested_organization_id uuid, requested_scope_type text, requested_scope_id uuid)
returns boolean language sql stable security definer set search_path from current
as $$ select current_session_is_active() and exists(select 1 from app_role_grants g
  where g.subject_id = auth.uid() and g.revoked_at is null and g.role = requested_role
    and g.organization_id = requested_organization_id and g.scope_type = requested_scope_type and g.scope_id = requested_scope_id and (
  (g.role = 'parent' and g.scope_type = 'family') or
  (g.role = 'group_admin' and g.scope_type = 'group' and identity_linked_parent() is not null) or
  (g.role in ('kindergarten_teacher', 'super_admin') and g.scope_type = 'organization' and g.scope_id = g.organization_id)
)) $$;

-- The one decision point (NFR3.1). An empty group is a super admin's only.
create or replace function has_core_scope(requested_organization_id uuid, requested_group_id uuid)
returns boolean language sql stable security definer set search_path from current
as $$ select current_session_is_active() and (has_super_scope(requested_organization_id)
  or (requested_group_id is not null
      and has_current_role_scope('group_admin', requested_organization_id, 'group', requested_group_id))) $$;

create or replace function has_community_admin() returns boolean
language sql stable security definer set search_path from current
as $$ select coalesce(has_super_scope(identity_actor_organization()), false) $$;

-- The caller's own community only: a group of another community is never manageable, not even by a super admin.
create or replace function can_manage_group(p_group_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce(has_core_scope(identity_actor_organization(), p_group_id)
    and (p_group_id is null
         or exists (select 1 from groups g where g.id = p_group_id and g.organization_id = identity_actor_organization())), false)
$$;

-- Every signed-in role in the community (BR2.3). A parent or group-admin grant counts while the linked parent and
-- family are active, so an archived parent reads nothing from the next request (BR3.11).
create or replace function can_read_community() returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce(current_session_is_active() and exists (
    select 1 from app_role_grants g
     where g.subject_id = auth.uid() and g.revoked_at is null and g.organization_id = identity_actor_organization()
       and (g.role in ('kindergarten_teacher', 'super_admin')
            or (g.role in ('parent', 'group_admin') and identity_linked_parent() is not null))), false)
$$;

-- For a caller who is not a super admin, a missing item answers like an item out of reach (NFR3.3). Internal.
create or replace function platform_deny_unless_super(p_organization_id uuid) returns void
language plpgsql set search_path from current
as $$ begin
  if not coalesce(has_super_scope(p_organization_id), false) then
    perform platform_abort('denied', 'authorization_denied');
  end if;
end $$;

-- The family of the signed-in parent. Every family-based command reads it (BR3.13).
create or replace function directory_actor_family() returns uuid
language sql stable security definer set search_path from current
as $$ select current_family_id() $$;

create or replace function directory_is_admin(p_organization_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$ select current_session_is_active() and (
  has_super_scope(p_organization_id)
  or (identity_linked_parent() is not null and exists (
        select 1 from app_role_grants g
         where g.subject_id = auth.uid() and g.revoked_at is null and g.organization_id = p_organization_id
           and g.role = 'group_admin' and g.scope_type = 'group'))) $$;

-- Family records are a super admin's (BR3.9). This one change also closes family_archive, family_restore,
-- directory_can_read_contact, directory_parent_profile and the read policies of the family tables.
create or replace function directory_reaches_family(p_organization_id uuid, p_family_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$ select current_session_is_active() and has_super_scope(p_organization_id) $$;

create or replace function directory_group_visible(p_organization_id uuid, p_group_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$ select can_read_community() and p_organization_id = identity_actor_organization() $$;

create or replace function directory_school_year_visible(p_organization_id uuid, p_school_year_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$ select can_read_community() and p_organization_id = identity_actor_organization() $$;

create policy group_memberships_read on group_memberships for select to authenticated
  using (parent_id = (select current_parent_id()) or has_super_scope(organization_id));

create or replace function coordination_reach_groups() returns uuid[]
language sql stable security definer set search_path from current
as $$
  select case
    when not current_session_is_active() then '{}'::uuid[]
    when has_super_scope(identity_actor_organization()) then
      coalesce((select array_agg(g.id) from groups g where g.organization_id = identity_actor_organization()), '{}'::uuid[])
    when identity_linked_parent() is null then '{}'::uuid[]
    else coalesce((select array_agg(r.scope_id) from app_role_grants r
                    where r.subject_id = auth.uid() and r.role = 'group_admin' and r.scope_type = 'group'
                      and r.revoked_at is null and r.organization_id = identity_actor_organization()), '{}'::uuid[])
  end
$$;

-- The tasks of those groups, and for a super admin the community-wide tasks. Each branch uses its own index.
create or replace function coordination_reach_task_ids() returns uuid[]
language sql stable security definer set search_path from current
as $$
  with actor as materialized (
    select identity_actor_organization() as organization_id,
           coalesce(has_super_scope(identity_actor_organization()), false) as is_super,
           coordination_reach_groups() as group_ids
  ), reached as (
    select t.id from tasks t, actor where t.group_id = any (actor.group_ids)
    union all
    select t.id from tasks t, actor
     where actor.is_super and t.group_id is null and t.organization_id = actor.organization_id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) from reached
$$;

create or replace function identity_can_manage_scope(p_organization_id uuid, p_role text, p_scope_type text, p_scope_id uuid)
returns boolean language sql stable security definer set search_path from current
as $$ select current_session_is_active() and has_super_scope(p_organization_id) $$;

create or replace function identity_scope_group(p_organization_id uuid, p_scope_type text, p_scope_id uuid)
returns uuid language sql stable security definer set search_path from current
as $$ select case p_scope_type when 'group' then p_scope_id else null end $$;

create or replace function identity_account_visible(p_account_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$ select current_session_is_active() and exists (
  select 1 from accounts a
   where a.id = p_account_id and (
     a.id = auth.uid()
     or has_super_scope(a.organization_id)
     or exists (
       select 1 from app_role_grants g
        where g.subject_id = a.id and g.revoked_at is null and g.organization_id = a.organization_id
          and g.scope_type = 'group' and has_current_role_scope('group_admin', g.organization_id, 'group', g.scope_id)))
) $$;

drop policy grants_admin_read on app_role_grants;
create policy grants_admin_read on app_role_grants for select to authenticated using (
  has_super_scope(organization_id)
  or (scope_type = 'group' and has_current_role_scope('group_admin', organization_id, 'group', scope_id))
);

-- Adds a working group's admin right (C2). Internal: U4 calls it in the same transaction as the membership change,
-- and every refusal is raised through U3R00 so that change rolls back with it. Returns the new grant's id.
create or replace function grant_admin(p_parent_id uuid, p_group_id uuid) returns uuid
language plpgsql security definer set search_path from current
as $$
declare
  v_parent parents%rowtype;
  v_id uuid;
begin
  select * into v_parent from parents p
   where p.id = p_parent_id and p.status = 'active' and p.account_id is not null
     and exists (select 1 from families f where f.id = p.family_id and f.status = 'active');
  if not found then
    perform platform_abort('validation', 'parent_required');
  end if;
  if not exists (select 1 from groups g
                  where g.id = p_group_id and g.organization_id = v_parent.organization_id and g.status = 'active') then
    perform platform_abort('validation', 'scope_not_found');
  end if;
  begin
    insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id, granted_by_account_id)
    values (v_parent.account_id, 'group_admin', 'group', p_group_id, v_parent.organization_id, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    perform platform_abort('conflict', 'grant_exists');
  end;
  perform identity_bump_authorization_version(v_parent.account_id);
  perform platform_audit_write('role.grant', 'account', v_parent.account_id, v_parent.organization_id, p_group_id,
                               'success', 'grant:group_admin');
  return v_id;
end $$;

-- Ends a working group's admin right (C2). Internal, like grant_admin.
create or replace function end_admin(p_parent_id uuid, p_group_id uuid) returns uuid
language plpgsql security definer set search_path from current
as $$
declare
  v_parent parents%rowtype;
  v_id uuid;
begin
  select * into v_parent from parents p where p.id = p_parent_id and p.account_id is not null;
  if not found then
    perform platform_abort('validation', 'parent_required');
  end if;
  update app_role_grants set revoked_at = now()
   where subject_id = v_parent.account_id and role = 'group_admin' and scope_type = 'group'
     and scope_id = p_group_id and organization_id = v_parent.organization_id and revoked_at is null
  returning id into v_id;
  if not found then
    perform platform_abort('validation', 'grant_not_found');
  end if;
  perform identity_bump_authorization_version(v_parent.account_id);
  perform platform_audit_write('role.revoke', 'account', v_parent.account_id, v_parent.organization_id, p_group_id,
                               'success', 'grant:group_admin');
  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 5. How a person or family is shown (C6). Internal. Names only, never a child or a contact detail. U14 adds the
--    removed status these read; an anonymised family already shows as removed. An unknown id returns nothing.
-- ---------------------------------------------------------------------------------------------------
create or replace function parent_display_name(p_parent_id uuid) returns text
language sql stable set search_path from current
as $$
  select case when p.status = 'removed' or f.anonymized_at is not null then 'korábbi tag' else p.display_name end
    from parents p join families f on f.id = p.family_id
   where p.id = p_parent_id
$$;

create or replace function family_display_name(p_family_id uuid) returns text
language sql stable set search_path from current
as $$
  select case when f.status = 'removed' or f.anonymized_at is not null then 'korábbi tag' else f.display_name end
    from families f
   where f.id = p_family_id
$$;

-- ---------------------------------------------------------------------------------------------------
-- 6. The two new lists. Both deny rather than return an empty list (C1).
-- ---------------------------------------------------------------------------------------------------

-- Every signed-in role reads the active working groups, newest school year first (BR2.3, W3).
create or replace function working_group_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id, 'name', g.name, 'description', g.description,
           'school_year_id', s.id, 'school_year_name', s.name)
         order by s.starts_on desc, g.name, g.id), '[]'::jsonb)
    into v_items
    from groups g join school_years s on s.id = g.school_year_id
   where g.organization_id = v_org and g.status = 'active';
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- An administrator sees active families by id and name only, where a task needs them (BR3.10, NFR1.3).
create or replace function family_name_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if v_org is null or not directory_is_admin(v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'display_name', family_display_name(f.id))
         order by f.display_name, f.id), '[]'::jsonb)
    into v_items
    from families f
   where f.organization_id = v_org and f.status = 'active';
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 7. Identity commands on the new pairs (BR3.1, BR3.6, BR3.8).
-- ---------------------------------------------------------------------------------------------------
create or replace function invitation_create(
  p_idempotency_key text, p_email text, p_role text, p_scope_type text, p_scope_id uuid,
  p_token_hash text, p_target_id uuid default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'invitation.create';
  v_org uuid;
  v_email text;
  v_fingerprint text;
  v_check jsonb;
  v_id uuid;
  v_family_org uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_email := lower(btrim(coalesce(p_email, '')));
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', v_email, p_role, p_scope_type, p_scope_id::text, p_target_id::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  if v_org is null or p_role is null or p_scope_type is null or p_scope_id is null then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
      'invitation', coalesce(p_scope_id, platform_system_account()), coalesce(v_org, platform_system_account()), null,
      'validation', null, 'invitation_invalid', null);
  end if;
  if not identity_can_manage_scope(v_org, p_role, p_scope_type, p_scope_id) then
    return identity_deny(c_operation, p_idempotency_key, v_fingerprint, 'role.grant', 'invitation',
      p_scope_id, v_org, null, 'invitation_create');
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
     or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
     or not ((p_role = 'parent' and p_scope_type = 'family')
          or (p_role in ('kindergarten_teacher', 'super_admin') and p_scope_type = 'organization' and p_scope_id = v_org)) then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
      'invitation', p_scope_id, v_org, null, 'validation', null, 'invitation_invalid', null);
  end if;
  if p_scope_type = 'family' then
    select f.organization_id into v_family_org from families f where f.id = p_scope_id;
    if v_family_org is distinct from v_org then
      return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
        'invitation', p_scope_id, v_org, null, 'validation', null, 'scope_not_found', null);
    end if;
  end if;
  if p_target_id is not null and not (p_role = 'parent' and exists (
       select 1 from parents p
        where p.id = p_target_id and p.organization_id = v_org and p.family_id = p_scope_id and p.status = 'active')) then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
      'invitation', p_scope_id, v_org, null, 'validation', null, 'target_not_found', null);
  end if;

  perform invitation_release_stale();
  update invitations set status = 'replaced'
   where email = v_email and role = p_role and scope_type = p_scope_type and scope_id = p_scope_id
     and status = 'pending' and expires_at <= now();
  begin
    insert into invitations (email, role, scope_type, scope_id, organization_id, target_id, token_hash, created_by_account_id)
    values (v_email, p_role, p_scope_type, p_scope_id, v_org, p_target_id, p_token_hash, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant',
      'invitation', p_scope_id, v_org, null, 'conflict', null, 'invitation_exists', null);
  end;
  perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
  return platform_result('success', v_id, null);
end $$;

-- Adding group_admin needs an active linked parent and an active group of the community (BR3.6).
create or replace function grant_change(
  p_idempotency_key text, p_change text, p_subject_id uuid, p_role text, p_scope_type text, p_scope_id uuid
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_operation text;
  v_action text;
  v_org uuid;
  v_subject_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_group uuid;
  v_grant app_role_grants%rowtype;
  v_family_org uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
     or p_change is null or p_change not in ('add', 'revoke') then
    return platform_result('validation', null, 'request_invalid');
  end if;
  v_operation := 'grant.' || p_change;
  v_action := case p_change when 'add' then 'role.grant' else 'role.revoke' end;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_change, p_subject_id::text, p_role, p_scope_type, p_scope_id::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(v_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  v_group := identity_scope_group(v_org, p_scope_type, p_scope_id);
  if not identity_can_manage_scope(v_org, p_role, p_scope_type, p_scope_id) then
    return identity_deny(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
      coalesce(p_subject_id, platform_system_account()), v_org, v_group, 'grant_' || p_change);
  end if;
  select a.organization_id into v_subject_org from accounts a where a.id = p_subject_id;
  -- An account of another organization answers exactly like a missing one.
  if p_subject_id is null or v_subject_org is distinct from v_org then
    return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
      coalesce(p_subject_id, platform_system_account()), v_org, null, 'validation', null, 'account_not_found', null);
  end if;
  if p_role is null or p_scope_type is null or p_scope_id is null
     or not ((p_role = 'parent' and p_scope_type = 'family')
          or (p_role = 'group_admin' and p_scope_type = 'group')
          or (p_role in ('kindergarten_teacher', 'super_admin') and p_scope_type = 'organization' and p_scope_id = v_org)) then
    return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
      p_subject_id, v_org, null, 'validation', null, 'grant_invalid', null);
  end if;

  if p_change = 'add' then
    if p_scope_type = 'family' then
      select f.organization_id into v_family_org from families f where f.id = p_scope_id;
      if v_family_org is distinct from v_org then
        return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
          p_subject_id, v_org, null, 'validation', null, 'scope_not_found', null);
      end if;
    end if;
    if p_role = 'group_admin' then
      if not exists (select 1 from groups g where g.id = p_scope_id and g.organization_id = v_org and g.status = 'active') then
        return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
          p_subject_id, v_org, null, 'validation', null, 'scope_not_found', null);
      end if;
      if not exists (select 1 from parents p join families f on f.id = p.family_id
                      where p.account_id = p_subject_id and p.organization_id = v_org
                        and p.status = 'active' and f.status = 'active') then
        return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
          p_subject_id, v_org, v_group, 'validation', null, 'parent_required', null);
      end if;
    end if;
    begin
      insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id, granted_by_account_id)
      values (p_subject_id, p_role, p_scope_type, p_scope_id, v_org, auth.uid());
    exception when unique_violation then
      return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
        p_subject_id, v_org, v_group, 'conflict', null, 'grant_exists', null);
    end;
  else
    if p_role = 'super_admin' then
      -- Under the row lock: the last active super admin of an organization cannot be removed.
      if identity_lock_super_admins(v_org) <= 1 and exists (
           select 1 from app_role_grants g where g.subject_id = p_subject_id and g.role = 'super_admin'
              and g.organization_id = v_org and g.revoked_at is null
              and (select a.status from accounts a where a.id = g.subject_id) = 'active') then
        return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
          p_subject_id, v_org, null, 'conflict', null, 'last_super_admin', null);
      end if;
    end if;
    update app_role_grants set revoked_at = now()
     where subject_id = p_subject_id and role = p_role and scope_type = p_scope_type
       and scope_id = p_scope_id and organization_id = v_org and revoked_at is null
    returning * into v_grant;
    if not found then
      return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
        p_subject_id, v_org, v_group, 'validation', null, 'grant_not_found', null);
    end if;
  end if;

  perform identity_bump_authorization_version(p_subject_id);
  return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
    p_subject_id, v_org, v_group, 'success', p_subject_id, null, 'grant:' || p_role);
end $$;

create or replace function scope_probe(p_record_type text, p_record_id uuid) returns text
language plpgsql stable security definer set search_path from current
as $$
declare v_org uuid; v_group uuid; v_found boolean := false; v_caller_org uuid;
begin
  if not current_session_is_active() then
    return 'denied';
  end if;
  v_caller_org := identity_actor_organization();
  if p_record_type = 'family' then
    select true, f.organization_id into v_found, v_org from families f where f.id = p_record_id;
    if v_found and v_org = v_caller_org then
      return case when has_super_scope(v_org) or has_current_role_scope('parent', v_org, 'family', p_record_id)
        then 'allowed' else 'denied' end;
    end if;
  elsif p_record_type = 'assignment' then
    select true, a.organization_id, t.group_id into v_found, v_org, v_group
      from assignments a join tasks t on t.id = a.task_id where a.id = p_record_id;
    if v_found and v_org = v_caller_org then
      return case when has_core_scope(v_org, v_group) then 'allowed' else 'denied' end;
    end if;
  end if;
  return 'not_found';
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 8. Directory and structure: a super admin's (BR2.2, BR2.5, BR3.9).
-- ---------------------------------------------------------------------------------------------------
create or replace function directory_save(p_idempotency_key text, p_family jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'directory.save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_creating boolean;
  v_family families%rowtype;
  v_family_id uuid;
  v_expected integer;
  v_name text;
  v_parents jsonb;
  v_children jsonb;
  v_item jsonb;
  v_contact jsonb;
  v_id uuid;
  v_parent parents%rowtype;
  v_child children%rowtype;
  v_text text;
  v_profile text;
  v_consent boolean;
  v_email text;
  v_phone text;
  v_locality text;
  v_has_contact boolean;
  v_link boolean;
  v_account uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(coalesce(p_family::text, ''), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not has_super_scope(v_org) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_family is null or jsonb_typeof(p_family) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    v_name := btrim(coalesce(p_family->>'display_name', ''));
    v_parents := coalesce(p_family->'parents', '[]'::jsonb);
    v_children := coalesce(p_family->'children', '[]'::jsonb);
    if jsonb_typeof(v_parents) <> 'array' or jsonb_typeof(v_children) <> 'array'
       or jsonb_array_length(v_parents) > 10 or jsonb_array_length(v_children) > 20 then
      perform platform_abort('validation', 'request_invalid');
    end if;

    v_creating := p_family->'family_id' is null or jsonb_typeof(p_family->'family_id') = 'null';
    if not v_creating then
      v_family_id := platform_try_uuid(p_family->>'family_id');
      if v_family_id is null then
        perform platform_field_invalid('family_id');
      end if;
      -- A family of another organization answers exactly like a missing one.
      select * into v_family from families where id = v_family_id and organization_id = v_org for update;
      if not found then
        perform platform_abort('validation', 'family_not_found');
      end if;
      if v_family.status = 'archived' then
        perform platform_field_invalid('family_id', 'archived');
      end if;
      v_expected := platform_try_integer(p_family->>'expected_version');
      if v_expected is null then
        perform platform_field_invalid('expected_version');
      end if;
      if v_expected <> v_family.version then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
    end if;
    if char_length(v_name) not between 1 and 200 then
      perform platform_field_invalid('display_name');
    end if;

    if v_creating then
      insert into families (organization_id, display_name) values (v_org, v_name) returning id into v_family_id;
    else
      update families set display_name = v_name where id = v_family_id;
    end if;

    for v_item in select value from jsonb_array_elements(v_parents) loop
      if jsonb_typeof(v_item) <> 'object' then
        perform platform_field_invalid('parents');
      end if;
      v_id := null;
      v_parent := null;
      if v_item->'id' is not null and jsonb_typeof(v_item->'id') <> 'null' then
        v_id := platform_try_uuid(v_item->>'id');
        if v_id is null then
          perform platform_field_invalid('parents.id');
        end if;
        select * into v_parent from parents
         where id = v_id and family_id = v_family_id and organization_id = v_org for update;
        if not found then
          perform platform_field_invalid('parents.id', 'parent_not_found');
        end if;
        v_expected := platform_try_integer(v_item->>'expected_version');
        if v_expected is null then
          perform platform_field_invalid('parents.expected_version');
        end if;
        if v_expected <> v_parent.version then
          perform platform_abort('conflict', 'VERSION_CONFLICT');
        end if;
      end if;
      v_text := btrim(coalesce(v_item->>'display_name', ''));
      if char_length(v_text) not between 1 and 200 then
        perform platform_field_invalid('parents.display_name');
      end if;
      -- The optional profile is stored only with consent; text sent without consent is dropped and
      -- withdrawing consent empties the text in the same change (BR30.4).
      if v_item->'optional_profile_consent' is not null then
        if jsonb_typeof(v_item->'optional_profile_consent') <> 'boolean' then
          perform platform_field_invalid('parents.optional_profile_consent');
        end if;
        v_consent := (v_item->>'optional_profile_consent')::boolean;
      else
        v_consent := coalesce(v_parent.optional_profile_consent, false);
      end if;
      if v_item->'optional_profile' is not null then
        v_profile := nullif(btrim(coalesce(v_item->>'optional_profile', '')), '');
      else
        v_profile := v_parent.optional_profile;
      end if;
      if not v_consent then
        v_profile := null;
      elsif v_profile is not null and char_length(v_profile) > 500 then
        perform platform_field_invalid('parents.optional_profile');
      end if;
      v_has_contact := false;
      if v_item->'contact' is not null and jsonb_typeof(v_item->'contact') <> 'null' then
        v_contact := v_item->'contact';
        if jsonb_typeof(v_contact) <> 'object' then
          perform platform_field_invalid('parents.contact');
        end if;
        v_has_contact := true;
        v_email := nullif(lower(btrim(coalesce(v_contact->>'email', ''))), '');
        v_phone := nullif(btrim(coalesce(v_contact->>'phone', '')), '');
        v_locality := nullif(btrim(coalesce(v_contact->>'locality', '')), '');
        if v_email is not null and (char_length(v_email) > 254
           or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') then
          perform platform_field_invalid('parents.contact.email');
        end if;
        if v_phone is not null and v_phone !~ '^[0-9 +-]{6,20}$' then
          perform platform_field_invalid('parents.contact.phone');
        end if;
        if v_locality is not null and char_length(v_locality) > 100 then
          perform platform_field_invalid('parents.contact.locality');
        end if;
      end if;
      -- Linking or unlinking a sign-in account (BR30.3).
      v_link := v_item->'account_id' is not null;
      v_account := null;
      if v_link and jsonb_typeof(v_item->'account_id') <> 'null' then
        v_account := platform_try_uuid(v_item->>'account_id');
        if v_account is null then
          perform platform_field_invalid('parents.account_id');
        end if;
        if not exists (select 1 from accounts a where a.id = v_account and a.organization_id = v_org) then
          perform platform_field_invalid('parents.account_id', 'account_not_found');
        end if;
      end if;
      begin
        if v_id is null then
          insert into parents (organization_id, family_id, display_name, optional_profile, optional_profile_consent, account_id)
          values (v_org, v_family_id, v_text, v_profile, v_consent, v_account)
          returning id into v_id;
        else
          update parents
             set display_name = v_text, optional_profile = v_profile, optional_profile_consent = v_consent,
                 account_id = case when v_link then v_account else account_id end
           where id = v_id;
        end if;
      exception when unique_violation then
        perform platform_abort('conflict', 'ACCOUNT_ALREADY_LINKED');
      end;
      if v_has_contact then
        insert into parent_contacts (parent_id, organization_id, contact_email, contact_phone, locality)
        values (v_id, v_org, v_email, v_phone, v_locality)
        on conflict (parent_id) do update
          set contact_email = excluded.contact_email, contact_phone = excluded.contact_phone,
              locality = excluded.locality, updated_at = now();
      end if;
    end loop;

    for v_item in select value from jsonb_array_elements(v_children) loop
      if jsonb_typeof(v_item) <> 'object' then
        perform platform_field_invalid('children');
      end if;
      v_id := null;
      v_child := null;
      if v_item->'id' is not null and jsonb_typeof(v_item->'id') <> 'null' then
        v_id := platform_try_uuid(v_item->>'id');
        if v_id is null then
          perform platform_field_invalid('children.id');
        end if;
        select * into v_child from children
         where id = v_id and family_id = v_family_id and organization_id = v_org for update;
        if not found then
          perform platform_field_invalid('children.id', 'child_not_found');
        end if;
        v_expected := platform_try_integer(v_item->>'expected_version');
        if v_expected is null then
          perform platform_field_invalid('children.expected_version');
        end if;
        if v_expected <> v_child.version then
          perform platform_abort('conflict', 'VERSION_CONFLICT');
        end if;
        if v_child.status = 'archived' then
          perform platform_field_invalid('children.id', 'archived');
        end if;
      end if;
      v_text := btrim(coalesce(v_item->>'display_name', ''));
      if char_length(v_text) not between 1 and 200 then
        perform platform_field_invalid('children.display_name');
      end if;
      if v_id is null then
        insert into children (organization_id, family_id, display_name) values (v_org, v_family_id, v_text);
      else
        update children set display_name = v_text where id = v_id;
      end if;
    end loop;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_family_id);
    return platform_result('success', v_family_id, null)
      || jsonb_build_object('version', (select f.version from families f where f.id = v_family_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- A school year or a working group (W1). A group needs a description (BR2.2).
create or replace function structure_save(p_idempotency_key text, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'structure.save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_id uuid;
  v_expected integer;
  v_name text;
  v_description text;
  v_starts date;
  v_ends date;
  v_year_id uuid;
  v_year school_years%rowtype;
  v_group groups%rowtype;
  v_creating boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_kind, coalesce(p_payload::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not has_super_scope(v_org) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_kind is null or p_kind not in ('school_year', 'group')
       or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    v_creating := p_payload->'id' is null or jsonb_typeof(p_payload->'id') = 'null';
    if not v_creating then
      v_id := platform_try_uuid(p_payload->>'id');
      if v_id is null then
        perform platform_field_invalid('id');
      end if;
      v_expected := platform_try_integer(p_payload->>'expected_version');
      if v_expected is null then
        perform platform_field_invalid('expected_version');
      end if;
    end if;
    v_name := btrim(coalesce(p_payload->>'name', ''));
    if char_length(v_name) not between 1 and 100 then
      perform platform_field_invalid('name');
    end if;

    if p_kind = 'school_year' then
      v_starts := platform_try_date(p_payload->>'starts_on');
      v_ends := platform_try_date(p_payload->>'ends_on');
      if v_starts is null then
        perform platform_field_invalid('starts_on');
      end if;
      if v_ends is null then
        perform platform_field_invalid('ends_on');
      end if;
      if v_ends < v_starts then
        perform platform_field_invalid('ends_on', 'before_start');
      end if;
      if not exists (select 1 from organizations o where o.id = v_org and o.status = 'active') then
        perform platform_abort('validation', 'organization_not_found');
      end if;
      begin
        if v_creating then
          insert into school_years (organization_id, name, starts_on, ends_on)
          values (v_org, v_name, v_starts, v_ends) returning id into v_id;
        else
          select * into v_year from school_years where id = v_id and organization_id = v_org for update;
          if not found then
            perform platform_field_invalid('id', 'not_found');
          end if;
          if v_year.version <> v_expected then
            perform platform_abort('conflict', 'VERSION_CONFLICT');
          end if;
          if v_year.status = 'archived' then
            perform platform_field_invalid('id', 'archived');
          end if;
          update school_years set name = v_name, starts_on = v_starts, ends_on = v_ends where id = v_id;
        end if;
      exception when unique_violation then
        perform platform_field_invalid('name', 'taken');
      end;
      perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
      return platform_result('success', v_id, null)
        || jsonb_build_object('version', (select s.version from school_years s where s.id = v_id));
    end if;

    -- group
    v_description := btrim(coalesce(p_payload->>'description', ''));
    if char_length(v_description) not between 1 and 1000 then
      perform platform_field_invalid('description');
    end if;
    v_year_id := platform_try_uuid(p_payload->>'school_year_id');
    if v_year_id is null and (v_creating or p_payload->'school_year_id' is not null) then
      perform platform_field_invalid('school_year_id');
    end if;
    begin
      if v_creating then
        select * into v_year from school_years where id = v_year_id and organization_id = v_org;
        if not found then
          perform platform_field_invalid('school_year_id', 'not_found');
        end if;
        if v_year.status = 'archived' then
          perform platform_field_invalid('school_year_id', 'archived');
        end if;
        insert into groups (organization_id, school_year_id, name, description)
        values (v_org, v_year_id, v_name, v_description)
        returning id into v_id;
      else
        select * into v_group from groups where id = v_id and organization_id = v_org for update;
        if not found then
          perform platform_field_invalid('id', 'not_found');
        end if;
        if v_group.version <> v_expected then
          perform platform_abort('conflict', 'VERSION_CONFLICT');
        end if;
        if v_group.status = 'archived' then
          perform platform_field_invalid('id', 'archived');
        end if;
        if v_year_id is not null and v_year_id <> v_group.school_year_id then
          perform platform_field_invalid('school_year_id', 'locked');
        end if;
        update groups set name = v_name, description = v_description where id = v_id;
      end if;
    exception when unique_violation then
      perform platform_field_invalid('name', 'taken');
    end;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null)
      || jsonb_build_object('version', (select g.version from groups g where g.id = v_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function directory_archive_item(
  p_idempotency_key text, p_kind text, p_id uuid, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'directory.archive_item';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_version integer;
  v_status text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_kind, p_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not has_super_scope(v_org) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_kind is null or p_kind not in ('group', 'school_year', 'child') or p_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_kind = 'child' then
      select c.version, c.status into v_version, v_status
        from children c where c.id = p_id and c.organization_id = v_org for update;
    elsif p_kind = 'group' then
      select g.version, g.status into v_version, v_status
        from groups g where g.id = p_id and g.organization_id = v_org for update;
    else
      select s.version, s.status into v_version, v_status
        from school_years s where s.id = p_id and s.organization_id = v_org for update;
    end if;
    if not found then
      perform platform_abort('validation', 'item_not_found');
    end if;
    if v_version <> p_expected_version or v_status = 'archived' then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if p_kind = 'school_year' and exists (select 1 from groups g where g.school_year_id = p_id and g.status = 'active') then
      perform platform_abort('conflict', 'SCHOOL_YEAR_HAS_ACTIVE_GROUPS');
    end if;
    if p_kind = 'child' then
      update children set status = 'archived' where id = p_id;
    elsif p_kind = 'group' then
      update groups set status = 'archived' where id = p_id;
    else
      update school_years set status = 'archived' where id = p_id;
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_id);
    return platform_result('success', p_id, null) || jsonb_build_object('version', v_version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function directory_restore_item(
  p_idempotency_key text, p_kind text, p_id uuid, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'directory.restore_item';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_version integer;
  v_status text;
  v_family uuid;
  v_parent_status text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_kind, p_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not has_super_scope(v_org) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_kind is null or p_kind not in ('group', 'school_year', 'child') or p_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_kind = 'child' then
      select c.version, c.status, c.family_id into v_version, v_status, v_family
        from children c where c.id = p_id and c.organization_id = v_org for update;
      if not found then
        perform platform_abort('validation', 'item_not_found');
      end if;
      select f.status into v_parent_status from families f where f.id = v_family;
    else
      if p_kind = 'group' then
        select g.version, g.status, s.status into v_version, v_status, v_parent_status
          from groups g join school_years s on s.id = g.school_year_id
         where g.id = p_id and g.organization_id = v_org for update of g;
      else
        select s.version, s.status, 'active' into v_version, v_status, v_parent_status
          from school_years s where s.id = p_id and s.organization_id = v_org for update;
      end if;
      if v_version is null then
        perform platform_abort('validation', 'item_not_found');
      end if;
    end if;
    if v_version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_status <> 'archived' or v_parent_status <> 'active' then
      perform platform_abort('conflict', 'RESTORE_CONFLICT');
    end if;
    if p_kind = 'child' then
      update children set status = 'active' where id = p_id;
    elsif p_kind = 'group' then
      update groups set status = 'active' where id = p_id;
    else
      update school_years set status = 'active' where id = p_id;
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_id);
    return platform_result('success', p_id, null) || jsonb_build_object('version', v_version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- A family is archived: only for a super admin (BR3.9), with the family and task locks of 20261043 taken first. The
-- authorization version of each linked account rises, so screens and navigation stop at the next request (NFR3.4).
create or replace function family_archive(p_idempotency_key text, p_family_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_result jsonb;
  v_org uuid;
  v_account uuid;
begin
  v_org := identity_actor_organization();
  if current_session_is_active() and not coalesce(has_super_scope(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_family_id is not null and v_org is not null and directory_reaches_family(v_org, p_family_id) then
    perform 1 from families f where f.id = p_family_id and f.organization_id = v_org for update;
    if found then
      perform reminder_lock_family_tasks(p_family_id);
    end if;
  end if;
  v_result := family_archive_core(p_idempotency_key, p_family_id, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform reminder_plan_tasks(reminder_family_tasks((v_result->>'reference')::uuid));
    for v_account in select p.account_id from parents p where p.family_id = p_family_id and p.account_id is not null loop
      perform identity_bump_authorization_version(v_account);
    end loop;
  end if;
  return v_result;
end $$;

create or replace function family_restore(p_idempotency_key text, p_family_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'family.restore';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_family families%rowtype;
  v_account uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_family_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not has_super_scope(v_org) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_family_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_family from families where id = p_family_id and organization_id = v_org for update;
    if not found then
      perform platform_abort('validation', 'family_not_found');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_family.version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_family.status <> 'archived' or v_family.anonymized_at is not null then
      perform platform_abort('conflict', 'RESTORE_CONFLICT');
    end if;

    update parents set status = 'active' where family_id = p_family_id and status <> 'active';
    update children set status = 'active' where family_id = p_family_id and status <> 'active';
    update families set status = 'active', archived_at = null where id = p_family_id;
    for v_account in select p.account_id from parents p where p.family_id = p_family_id and p.account_id is not null loop
      perform identity_bump_authorization_version(v_account);
    end loop;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_family_id);
    return platform_result('success', p_family_id, null) || jsonb_build_object('version', v_family.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 9. Events and tasks: the group is optional and "empty" is compared as a value (BR1.2, BR1.3, BR3.5).
-- ---------------------------------------------------------------------------------------------------
create or replace function event_save_core(p_idempotency_key text, p_event jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_creating boolean;
  v_id uuid;
  v_event events%rowtype;
  v_expected integer;
  v_group uuid;
  v_group_status text;
  v_title text;
  v_location text;
  v_coordinator text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_status text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(coalesce(p_event::text, ''), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_event is null or jsonb_typeof(p_event) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    -- An absent or empty group means community-wide.
    if nullif(p_event->>'group_id', '') is not null then
      v_group := platform_try_uuid(p_event->>'group_id');
      if v_group is null then
        perform platform_field_invalid('group_id');
      end if;
      -- A group of another organization answers exactly like a missing one.
      select g.status into v_group_status from groups g where g.id = v_group and g.organization_id = v_org;
      if not found then
        perform platform_deny_unless_super(v_org);
        perform platform_field_invalid('group_id', 'not_found');
      end if;
    end if;
    if not has_core_scope(v_org, v_group) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_group_status = 'archived' then
      perform platform_field_invalid('group_id', 'archived');
    end if;

    v_creating := p_event->'id' is null or jsonb_typeof(p_event->'id') = 'null';
    if not v_creating then
      v_id := platform_try_uuid(p_event->>'id');
      if v_id is null then
        perform platform_field_invalid('id');
      end if;
      select * into v_event from events where id = v_id and organization_id = v_org for update;
      if not found then
        perform platform_deny_unless_super(v_org);
        perform platform_field_invalid('id', 'not_found');
      end if;
      if not has_core_scope(v_org, v_event.group_id) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
      v_expected := platform_try_integer(p_event->>'expected_version');
      if v_expected is null then
        perform platform_field_invalid('expected_version');
      end if;
      if v_expected <> v_event.version then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
      if v_group is distinct from v_event.group_id and exists (select 1 from tasks t where t.event_id = v_id) then
        perform platform_field_invalid('group_id', 'locked');
      end if;
    end if;

    v_title := btrim(coalesce(p_event->>'title', ''));
    v_location := nullif(btrim(coalesce(p_event->>'location', '')), '');
    v_coordinator := nullif(btrim(coalesce(p_event->>'coordinator_name', '')), '');
    v_starts := platform_try_timestamptz(p_event->>'starts_at');
    v_ends := platform_try_timestamptz(p_event->>'ends_at');
    v_status := coalesce(p_event->>'status', case when v_creating then 'planned' else v_event.status end);
    if char_length(v_title) not between 1 and 200 then
      perform platform_field_invalid('title');
    end if;
    if v_location is not null and char_length(v_location) > 200 then
      perform platform_field_invalid('location');
    end if;
    if v_coordinator is not null and char_length(v_coordinator) > 200 then
      perform platform_field_invalid('coordinator_name');
    end if;
    if v_starts is null then
      perform platform_field_invalid('starts_at');
    end if;
    if v_ends is null then
      perform platform_field_invalid('ends_at');
    end if;
    if v_ends < v_starts then
      perform platform_field_invalid('ends_at', 'before_start');
    end if;
    if v_status not in ('planned', 'cancelled') then
      perform platform_field_invalid('status');
    end if;

    if v_creating then
      insert into events (organization_id, group_id, title, location, coordinator_name, starts_at, ends_at, status)
      values (v_org, v_group, v_title, v_location, v_coordinator, v_starts, v_ends, v_status)
      returning id into v_id;
    else
      update events
         set group_id = v_group, title = v_title, location = v_location, coordinator_name = v_coordinator,
             starts_at = v_starts, ends_at = v_ends, status = v_status
       where id = v_id;
      -- A cancelled event closes its open tasks for new sign-ups (BR31.1): the tasks are locked in
      -- ascending id order, like every writer that touches several tasks (NFR3.8).
      if v_status = 'cancelled' and v_event.status <> 'cancelled' then
        perform 1 from tasks where event_id = v_id order by id for update;
        update tasks set status = 'closed' where event_id = v_id and status = 'open';
      end if;
    end if;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null)
      || jsonb_build_object('version', (select e.version from events e where e.id = v_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function event_save_notes(
  p_idempotency_key text, p_event_id uuid, p_expected_version integer,
  p_allergen_note text, p_supply_note text, p_food_note text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'event.save_notes';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_event events%rowtype;
  v_allergen text;
  v_supply text;
  v_food text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_event_id::text, p_expected_version::text, p_allergen_note, p_supply_note, p_food_note), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_event_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_event from events where id = p_event_id and organization_id = v_org for update;
    if not found then
      perform platform_deny_unless_super(v_org);
      perform platform_field_invalid('event_id', 'not_found');
    end if;
    if not has_core_scope(v_org, v_event.group_id) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_event.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    v_allergen := nullif(btrim(coalesce(p_allergen_note, '')), '');
    v_supply := nullif(btrim(coalesce(p_supply_note, '')), '');
    v_food := nullif(btrim(coalesce(p_food_note, '')), '');
    if char_length(v_allergen) > 300 then
      perform platform_field_invalid('allergen_note');
    end if;
    if char_length(v_supply) > 300 then
      perform platform_field_invalid('supply_note');
    end if;
    if char_length(v_food) > 300 then
      perform platform_field_invalid('food_note');
    end if;
    update events set allergen_note = v_allergen, supply_note = v_supply, food_note = v_food
     where id = p_event_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_event_id);
    return platform_result('success', p_event_id, null) || jsonb_build_object('version', v_event.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function task_save_core(p_idempotency_key text, p_task jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'task.save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_creating boolean;
  v_id uuid;
  v_task tasks%rowtype;
  v_expected integer;
  v_group uuid;
  v_group_status text;
  v_event_id uuid;
  v_event events%rowtype;
  v_title text;
  v_category text;
  v_capacity integer;
  v_taken integer;
  v_starts timestamptz;
  v_ends timestamptz;
  v_location text;
  v_status text;
  v_ids uuid[];
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(coalesce(p_task::text, ''), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_task is null or jsonb_typeof(p_task) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    -- An absent or empty group means community-wide.
    if nullif(p_task->>'group_id', '') is not null then
      v_group := platform_try_uuid(p_task->>'group_id');
      if v_group is null then
        perform platform_field_invalid('group_id');
      end if;
      select g.status into v_group_status from groups g where g.id = v_group and g.organization_id = v_org;
      if not found then
        perform platform_deny_unless_super(v_org);
        perform platform_field_invalid('group_id', 'not_found');
      end if;
    end if;
    if not has_core_scope(v_org, v_group) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_group_status = 'archived' then
      perform platform_field_invalid('group_id', 'archived');
    end if;

    v_creating := p_task->'id' is null or jsonb_typeof(p_task->'id') = 'null';
    if not v_creating then
      v_id := platform_try_uuid(p_task->>'id');
      if v_id is null then
        perform platform_field_invalid('id');
      end if;
      select * into v_task from tasks where id = v_id and organization_id = v_org for update;
      if not found then
        perform platform_deny_unless_super(v_org);
        perform platform_field_invalid('id', 'not_found');
      end if;
      if not has_core_scope(v_org, v_task.group_id) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
      v_expected := platform_try_integer(p_task->>'expected_version');
      if v_expected is null then
        perform platform_field_invalid('expected_version');
      end if;
      if v_expected <> v_task.version then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
      if v_task.status = 'cancelled' then
        perform platform_field_invalid('id', 'cancelled');
      end if;
      select count(*) into v_taken from assignments a where a.task_id = v_id and a.status <> 'removed';
      if v_group is distinct from v_task.group_id and v_taken > 0 then
        perform platform_field_invalid('group_id', 'locked');
      end if;
    else
      v_taken := 0;
    end if;

    -- The event, when there is one: of this organization, reached by the caller, and of the task's scope.
    if p_task->'event_id' is not null and jsonb_typeof(p_task->'event_id') <> 'null' then
      v_event_id := platform_try_uuid(p_task->>'event_id');
      if v_event_id is null then
        perform platform_field_invalid('event_id');
      end if;
      select * into v_event from events where id = v_event_id and organization_id = v_org;
      if not found then
        perform platform_deny_unless_super(v_org);
        perform platform_field_invalid('event_id', 'not_found');
      end if;
      if not has_core_scope(v_org, v_event.group_id) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
      if v_event.group_id is distinct from v_group then
        perform platform_field_invalid('event_id', 'group_mismatch');
      end if;
    elsif not v_creating and p_task->'event_id' is null then
      v_event_id := v_task.event_id;
      select * into v_event from events where id = v_event_id;
    end if;
    -- A task that keeps its event cannot move to another scope (the event's scope is the task's).
    if v_event_id is not null and v_event.group_id is distinct from v_group then
      perform platform_field_invalid('event_id', 'group_mismatch');
    end if;

    v_title := btrim(coalesce(p_task->>'title', ''));
    if p_task->'category' is not null then
      v_category := btrim(coalesce(p_task->>'category', ''));
    else
      v_category := coalesce(v_task.category, 'general');
    end if;
    v_capacity := platform_try_integer(p_task->>'capacity');
    v_starts := platform_try_timestamptz(p_task->>'starts_at');
    v_ends := platform_try_timestamptz(p_task->>'ends_at');
    if p_task->'location' is not null then
      v_location := nullif(btrim(coalesce(p_task->>'location', '')), '');
    else
      v_location := v_task.location;
    end if;
    v_location := coalesce(v_location, nullif(v_event.location, ''), '-');
    v_status := coalesce(p_task->>'status', case when v_creating then 'open' else v_task.status end);

    if char_length(v_title) not between 1 and 200 then
      perform platform_field_invalid('title');
    end if;
    if char_length(v_category) not between 1 and 100 then
      perform platform_field_invalid('category');
    end if;
    if v_capacity is null or v_capacity not between 1 and 50 then
      perform platform_field_invalid('capacity');
    end if;
    if v_capacity < v_taken then
      perform platform_abort('validation', 'field_invalid',
        jsonb_build_object('field', 'capacity', 'reason', 'below_taken', 'taken', v_taken));
    end if;
    if v_starts is null then
      perform platform_field_invalid('starts_at');
    end if;
    if v_ends is null then
      perform platform_field_invalid('ends_at');
    end if;
    if v_ends < v_starts then
      perform platform_field_invalid('ends_at', 'before_start');
    end if;
    if char_length(v_location) > 200 then
      perform platform_field_invalid('location');
    end if;
    if v_status not in ('open', 'closed', 'cancelled') or (v_creating and v_status = 'cancelled') then
      perform platform_field_invalid('status');
    end if;
    -- A task of a cancelled event is closed for sign-up and stays closed (BR31.1).
    if v_event.status = 'cancelled' and v_status = 'open' then
      if v_creating then
        v_status := 'closed';
      else
        perform platform_field_invalid('status', 'event_cancelled');
      end if;
    end if;

    if v_creating then
      insert into tasks (organization_id, group_id, event_id, title, category, capacity, starts_at, ends_at, location, status)
      values (v_org, v_group, v_event_id, v_title, v_category, v_capacity, v_starts, v_ends, v_location, v_status)
      returning id into v_id;
    else
      update tasks
         set group_id = v_group, event_id = v_event_id, title = v_title, category = v_category,
             capacity = v_capacity, starts_at = v_starts, ends_at = v_ends, location = v_location,
             status = v_status
       where id = v_id;
      -- Cancellation is final: the places are removed and the requests that involve them are withdrawn.
      if v_status = 'cancelled' then
        select coalesce(array_agg(a.id order by a.id), '{}') into v_ids
          from assignments a where a.task_id = v_id and a.status <> 'removed';
        update assignments set status = 'removed' where id = any (v_ids);
        perform coordination_withdraw_requests(v_ids);
      end if;
    end if;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null)
      || jsonb_build_object('version', (select t.version from tasks t where t.id = v_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 10. Today's duties without working-group membership (BR4.1 to BR4.3).
-- ---------------------------------------------------------------------------------------------------
create or replace function coordination_duty_view(p_task_id uuid, p_family_id uuid) returns jsonb
language sql stable security definer set search_path from current
as $$
  select jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'due_at', t.starts_at,
      'location', t.location,
      'version', t.version,
      'signup_open', (t.status = 'open' and t.starts_at > now()),
      'state', case
        when own.id is not null then
          case own.status when 'swap_pending' then 'swap-pending'
                          when 'cancellation_pending' then 'cancellation-pending'
                          else 'assigned' end
        when (select count(*) from assignments a where a.task_id = t.id and a.status <> 'removed') >= t.capacity
          then 'full'
        else 'available' end,
      'assignment_id', own.id,
      'assignment_version', own.version)
    from tasks t
    left join lateral (
      select a.id, a.status, a.version from assignments a
       where a.task_id = t.id and a.family_id = p_family_id and a.status <> 'removed') own on true
   where t.id = p_task_id
$$;

create or replace function duty_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_family uuid;
  v_org uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_family := directory_actor_family();
  if v_family is null then
    return platform_result('denied', null, 'no_family');
  end if;
  select f.organization_id into v_org from families f where f.id = v_family;
  select coalesce(jsonb_agg(coordination_duty_view(visible.id, v_family) order by visible.starts_at, visible.id), '[]'::jsonb)
    into v_items
    from (select t.id, t.starts_at from tasks t
           where t.organization_id = v_org and t.status <> 'cancelled') visible;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

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
   where t.id = p_task_id and t.organization_id = v_org and t.status <> 'cancelled';
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

create or replace function duty_sign_up_core(p_idempotency_key text, p_task_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'duty.sign_up';
  v_family uuid;
  v_org uuid;
  v_parent uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_task tasks%rowtype;
  v_assignment assignments%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_task_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_family := directory_actor_family();
    if v_family is null then
      perform platform_abort('denied', 'no_family');
    end if;
    if p_task_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    -- The family row is held for share while the place is taken, so an archive of the family (which takes
    -- the row for update, family before tasks) either completes first, and the sign-up finds no active
    -- family, or waits for this one. The family comes before the task in the lock order.
    select f.organization_id into v_org from families f
     where f.id = v_family and f.status = 'active' for share;
    if not found then
      perform platform_abort('denied', 'no_family');
    end if;
    select p.id into v_parent from parents p
     where p.account_id = auth.uid() and p.family_id = v_family and p.status = 'active';

    -- The task row first: two parents racing for the last place are serialised here (BR31.3). A task of
    -- another organization answers exactly like a missing one.
    select * into v_task from tasks where id = p_task_id and organization_id = v_org for update;
    if not found then
      perform platform_abort('validation', 'duty_not_found');
    end if;
    if v_task.version <> p_expected_version then
      perform platform_abort('invalidated', 'DUTY_VERSION_STALE');
    end if;
    if v_task.status <> 'open' or v_task.starts_at <= now() then
      perform platform_abort('conflict', 'DUTY_CLOSED');
    end if;
    if exists (select 1 from assignments a where a.task_id = v_task.id and a.family_id = v_family and a.status <> 'removed') then
      perform platform_abort('conflict', 'DUTY_ALREADY_ASSIGNED');
    end if;
    if (select count(*) from assignments a where a.task_id = v_task.id and a.status <> 'removed') >= v_task.capacity then
      perform platform_abort('conflict', 'DUTY_FULL');
    end if;

    insert into assignments (organization_id, task_id, family_id, parent_id, source)
    values (v_org, v_task.id, v_family, v_parent, 'parent_sign_up')
    returning * into v_assignment;
    update tasks set updated_at = now() where id = v_task.id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_assignment.id);
    return platform_result('success', v_assignment.id, null)
      || jsonb_build_object('version', v_assignment.version, 'task_version', v_task.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function assignment_assign_core(
  p_idempotency_key text, p_task_id uuid, p_family_id uuid, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'assignment.assign';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_task tasks%rowtype;
  v_family_status text;
  v_assignment assignments%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_task_id::text, p_family_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_task_id is null or p_family_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    -- The family before the task, held for share (see duty_sign_up). A family of another organization
    -- answers exactly like a missing one; the reach check follows once the task is known.
    select f.status into v_family_status from families f
     where f.id = p_family_id and f.organization_id = v_org for share;
    if not found then
      perform platform_deny_unless_super(v_org);
      perform platform_field_invalid('family_id', 'not_found');
    end if;
    select * into v_task from tasks where id = p_task_id and organization_id = v_org for update;
    if not found then
      perform platform_deny_unless_super(v_org);
      perform platform_field_invalid('task_id', 'not_found');
    end if;
    if not has_core_scope(v_org, v_task.group_id) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_family_status = 'archived' then
      perform platform_field_invalid('family_id', 'archived');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_task.version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_task.status = 'cancelled' then
      perform platform_field_invalid('task_id', 'cancelled');
    end if;
    if exists (select 1 from assignments a where a.task_id = v_task.id and a.family_id = p_family_id and a.status <> 'removed') then
      perform platform_abort('conflict', 'DUTY_ALREADY_ASSIGNED');
    end if;
    if (select count(*) from assignments a where a.task_id = v_task.id and a.status <> 'removed') >= v_task.capacity then
      perform platform_abort('conflict', 'ASSIGNMENT_CAPACITY_FULL');
    end if;

    insert into assignments (organization_id, task_id, family_id, source)
    values (v_org, v_task.id, p_family_id, 'admin_assign')
    returning * into v_assignment;
    update tasks set updated_at = now() where id = v_task.id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_assignment.id);
    return platform_result('success', v_assignment.id, null)
      || jsonb_build_object('version', v_assignment.version, 'task_version', v_task.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function assignment_remove_core(p_idempotency_key text, p_assignment_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'assignment.remove';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_task_id uuid;
  v_task tasks%rowtype;
  v_assignment assignments%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_assignment_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_assignment_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select a.task_id into v_task_id from assignments a where a.id = p_assignment_id and a.organization_id = v_org;
    if not found then
      perform platform_deny_unless_super(v_org);
      perform platform_field_invalid('assignment_id', 'not_found');
    end if;
    select * into v_task from tasks where id = v_task_id for update;
    if not has_core_scope(v_org, v_task.group_id) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_assignment from assignments where id = p_assignment_id for update;
    if v_assignment.task_id <> v_task_id then
      -- The place moved to another task between the first read and the lock (a swap): ask again.
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_assignment.version <> p_expected_version or v_assignment.status = 'removed' then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;

    update assignments set status = 'removed' where id = v_assignment.id;
    perform coordination_withdraw_requests(array[v_assignment.id]);
    update tasks set updated_at = now() where id = v_task.id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_assignment.id);
    return platform_result('success', v_assignment.id, null)
      || jsonb_build_object('version', v_assignment.version + 1, 'task_version', v_task.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- Whether two places can be exchanged now, as the code of the first rule that fails, or null. Working groups play
-- no part (BR4.3).
create or replace function coordination_swap_check(p_source_id uuid, p_target_id uuid) returns text
language plpgsql stable set search_path from current
as $$
declare
  v_src assignments%rowtype;
  v_tgt assignments%rowtype;
  v_src_task tasks%rowtype;
  v_tgt_task tasks%rowtype;
begin
  select * into v_src from assignments where id = p_source_id;
  select * into v_tgt from assignments where id = p_target_id;
  select * into v_src_task from tasks where id = v_src.task_id;
  select * into v_tgt_task from tasks where id = v_tgt.task_id;
  if v_src.family_id = v_tgt.family_id or v_src.task_id = v_tgt.task_id
     or v_src.organization_id <> v_tgt.organization_id
     or exists (select 1 from families f where f.id in (v_src.family_id, v_tgt.family_id) and f.status <> 'active') then
    return 'REQUEST_CONFLICT';
  end if;
  if v_src_task.status = 'cancelled' or v_tgt_task.status <> 'open'
     or v_src_task.starts_at <= now() or v_tgt_task.starts_at <= now() then
    return 'DUTY_CLOSED';
  end if;
  if exists (select 1 from assignments a
              where a.status <> 'removed'
                and ((a.family_id = v_src.family_id and a.task_id = v_tgt.task_id)
                  or (a.family_id = v_tgt.family_id and a.task_id = v_src.task_id))) then
    return 'DUTY_ALREADY_ASSIGNED';
  end if;
  return null;
end $$;

create or replace function swap_candidates(p_assignment_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_family uuid;
  v_org uuid;
  v_src assignments%rowtype;
  v_task tasks%rowtype;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_family := directory_actor_family();
  if v_family is null then
    return platform_result('denied', null, 'no_family');
  end if;
  select f.organization_id into v_org from families f where f.id = v_family;
  select * into v_src from assignments a where a.id = p_assignment_id and a.organization_id = v_org;
  if not found then
    return platform_result('validation', null, 'assignment_not_found');
  end if;
  if v_src.family_id <> v_family then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_task from tasks t where t.id = v_src.task_id;
  if v_src.status <> 'active' then
    return platform_result('conflict', null, 'REQUEST_DUPLICATE');
  end if;
  if v_task.status = 'cancelled' or v_task.starts_at <= now() then
    return platform_result('conflict', null, 'DUTY_CLOSED');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'assignment_id', ta.id, 'assignment_version', ta.version, 'task_id', tt.id,
           'title', tt.title, 'starts_at', tt.starts_at, 'family_display_name', f.display_name)
         order by tt.starts_at, ta.id), '[]'::jsonb)
    into v_items
    from assignments ta
    join tasks tt on tt.id = ta.task_id
    join families f on f.id = ta.family_id
   where ta.organization_id = v_org and ta.status = 'active' and ta.family_id <> v_family and f.status = 'active'
     and tt.id <> v_task.id and tt.status = 'open' and tt.starts_at > now()
     and not exists (select 1 from assignments x
                      where x.family_id = v_family and x.task_id = tt.id and x.status <> 'removed')
     and not exists (select 1 from assignments y
                      where y.family_id = ta.family_id and y.task_id = v_task.id and y.status <> 'removed');
  return platform_result('success', v_src.id, null) || jsonb_build_object('items', v_items);
end $$;

-- An item with no group follows has_core_scope, so it is a super admin's.
create or replace function coordination_decide_core(
  p_kind text, p_idempotency_key text, p_request_id uuid, p_approve boolean, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_operation text := p_kind || '.decide';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_req change_requests%rowtype;
  v_src assignments%rowtype;
  v_tgt assignments%rowtype;
  v_group uuid;
  v_consistent boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_request_id::text, p_approve::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(v_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_request_id is null or p_approve is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_req from change_requests r
     where r.id = p_request_id and r.organization_id = v_org and r.kind = p_kind;
    if not found then
      perform platform_deny_unless_super(v_org);
      perform platform_abort('validation', 'request_not_found');
    end if;
    select t.group_id into v_group
      from assignments a join tasks t on t.id = a.task_id where a.id = v_req.assignment_id;
    if not has_core_scope(v_org, v_group) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform coordination_lock_assignments(
      array_remove(array[v_req.assignment_id, v_req.target_assignment_id], null));
    select * into v_req from change_requests where id = p_request_id for update;
    if v_req.status <> 'open' then
      perform platform_abort('conflict', 'APPROVAL_ALREADY_DECIDED');
    end if;
    if p_expected_version is not null and p_expected_version <> v_req.version then
      perform platform_abort('invalidated', 'APPROVAL_INVALIDATED');
    end if;
    select * into v_src from assignments where id = v_req.assignment_id;
    if p_kind = 'swap' then
      select * into v_tgt from assignments where id = v_req.target_assignment_id;
      v_consistent := v_src.task_id = v_req.source_task_id and v_src.version = v_req.source_assignment_version
        and v_src.status = 'swap_pending' and v_tgt.task_id = v_req.target_task_id
        and v_tgt.version = v_req.target_assignment_version and v_tgt.status = 'active';
    else
      v_consistent := v_src.task_id = v_req.source_task_id and v_src.version = v_req.source_assignment_version
        and v_src.status = 'cancellation_pending';
    end if;
    if not v_consistent then
      perform platform_abort('invalidated', 'APPROVAL_INVALIDATED');
    end if;

    if p_approve then
      if p_kind = 'swap' then
        if coordination_swap_check(v_src.id, v_tgt.id) is not null then
          perform platform_abort('conflict', 'SWAP_CANNOT_BE_APPLIED');
        end if;
        perform coordination_swap_exchange(v_req.id, 'approved', auth.uid());
      else
        update assignments set status = 'removed' where id = v_src.id;
        update change_requests set status = 'approved', decided_by_account_id = auth.uid(), decided_at = now()
         where id = v_req.id;
        perform coordination_withdraw_requests(array[v_src.id]);
        update tasks set updated_at = now() where id = v_src.task_id;
      end if;
      perform platform_audit_write('approval.approve', 'change_request', v_req.id, v_org, v_group, 'success', p_kind);
    else
      update change_requests set status = 'rejected', decided_by_account_id = auth.uid(), decided_at = now()
       where id = v_req.id;
      perform coordination_release_source(v_src.id);
      perform platform_audit_write('approval.reject', 'change_request', v_req.id, v_org, v_group, 'success', p_kind);
    end if;

    perform platform_idempotency_store(v_operation, p_idempotency_key, v_fingerprint, 'success', v_req.id);
    return platform_result('success', v_req.id, null)
      || jsonb_build_object('outcome', case when p_approve then 'approved' else 'rejected' end);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- A super admin counts every item; a group admin the items of their groups.
create or replace function dashboard_get() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_super boolean;
  v_groups uuid[];
  v_approvals integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if not directory_is_admin(v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_super := has_super_scope(v_org);
  v_groups := coordination_reach_groups();
  select count(*)::integer into v_approvals
    from change_requests r
    join assignments a on a.id = r.assignment_id
    join tasks t on t.id = a.task_id
   where r.organization_id = v_org and r.status = 'open' and (v_super or t.group_id = any (v_groups));
  return platform_result('success', null, null) || jsonb_build_object('open_approvals', v_approvals);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 11. The schedule: all, community-wide only, or one group (W6, BR3.7). A teacher and a super admin may read each of
--     them; a group admin reads their own group. The date filter and the entry fields are those of 20261031.
-- ---------------------------------------------------------------------------------------------------
drop function schedule_get(uuid, text, text);
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
   where t.organization_id = v_org
     and (p_scope = 'all' or (p_scope = 'community' and t.group_id is null) or (p_scope = 'group' and t.group_id = p_group_id))
     and (v_from is null or t.starts_at >= (v_from::timestamp at time zone 'UTC'))
     and (v_to is null or t.starts_at < ((v_to + 1)::timestamp at time zone 'UTC'));
  return platform_result('success', p_group_id, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 12. Reminders. A group-wide reminder reaches the group's members' families, or every family for a community-wide
--     task (BR4.4). An item with no group is a super admin's (NFR9.2).
-- ---------------------------------------------------------------------------------------------------
create or replace function reminder_plan(p_task_id uuid) returns void
language plpgsql security definer set search_path from current
as $$
declare
  v_task tasks%rowtype;
  v_setting jsonb;
  v_families uuid[];
  v_threshold text;
  v_hours integer;
  v_scheduled timestamptz;
  v_job reminder_jobs%rowtype;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    return;
  end if;
  v_setting := reminder_setting_for(v_task.organization_id);

  update reminder_jobs set status = 'stale'
   where task_id = v_task.id and status not in ('stale', 'cancelled') and task_starts_at <> v_task.starts_at;

  if not ((v_setting->>'enabled')::boolean and v_task.status = 'open' and v_task.starts_at > now()) then
    update reminder_jobs set status = 'cancelled'
     where task_id = v_task.id and status in ('queued', 'retryable', 'retrying');
    return;
  end if;

  if v_setting->>'scope' = 'group' and v_task.group_id is null then
    select coalesce(array_agg(f.id order by f.id), '{}'::uuid[]) into v_families
      from families f
     where f.organization_id = v_task.organization_id and f.status = 'active';
  elsif v_setting->>'scope' = 'group' then
    select coalesce(array_agg(distinct f.id order by f.id), '{}'::uuid[]) into v_families
      from families f
      join parents p on p.family_id = f.id and p.status = 'active'
      join group_memberships m on m.parent_id = p.id
     where f.organization_id = v_task.organization_id and f.status = 'active'
       and m.group_id = v_task.group_id and m.status = 'active';
  else
    select coalesce(array_agg(distinct a.family_id order by a.family_id), '{}'::uuid[]) into v_families
      from assignments a join families f on f.id = a.family_id
     where a.task_id = v_task.id and a.status <> 'removed' and f.status = 'active';
  end if;

  foreach v_threshold in array array['7d', '24h'] loop
    v_hours := case v_threshold when '7d' then 168 else 24 end;
    select * into v_job from reminder_jobs
     where task_id = v_task.id and threshold = v_threshold and status not in ('stale', 'cancelled');
    if not found then
      if cardinality(v_families) = 0 then
        continue;
      end if;
      v_scheduled := v_task.starts_at - make_interval(hours => v_hours);
      if v_scheduled <= now() then
        v_scheduled := now();
      end if;
      insert into reminder_jobs (organization_id, task_id, threshold, task_starts_at, scheduled_for, correlation_id)
      values (v_task.organization_id, v_task.id, v_threshold, v_task.starts_at, v_scheduled,
              reminder_correlation(v_task.id, v_threshold, v_task.starts_at))
      returning * into v_job;
    end if;

    -- A job that was sent or ended (terminal) never runs again: nobody is added to it (or brought back into it).
    if v_job.status in ('queued', 'retryable', 'retrying') then
      insert into reminder_recipients (organization_id, reminder_job_id, family_id)
      select v_task.organization_id, v_job.id, wanted from unnest(v_families) as wanted
      on conflict (reminder_job_id, family_id) do update set status = 'active', updated_at = now()
        where reminder_recipients.status <> 'active';
    end if;
    update reminder_recipients set status = 'removed', updated_at = now()
     where reminder_job_id = v_job.id and status = 'active' and not (family_id = any (v_families));

    if cardinality(v_families) = 0 and v_job.status in ('queued', 'retryable', 'retrying') then
      update reminder_jobs set status = 'cancelled' where id = v_job.id;
    end if;
  end loop;
end $$;

create or replace function reminder_list(p_status text default null) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_groups uuid[];
  v_super boolean;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if v_org is null or not directory_is_admin(v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_status is not null
     and p_status not in ('queued', 'sent', 'retryable', 'retrying', 'stale', 'cancelled', 'terminal') then
    return platform_result('validation', null, 'status_invalid');
  end if;
  v_groups := coordination_reach_groups();
  v_super := has_super_scope(v_org);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', listed.id,
           'version', listed.version,
           'task_id', listed.task_id,
           'threshold', listed.threshold,
           'title', listed.task_title || ' — ' || case listed.threshold when '7d' then '7 napos' else '24 órás' end
                    || ' emlékeztető',
           'status', listed.status,
           'attempt', listed.attempt,
           'correlation_id', listed.correlation_id,
           'recipient_count', counted.n,
           'recipient_summary', case when counted.n = 0 then 'Nincs aktív címzett' else counted.n || ' kijelölt család' end,
           'provider_label', 'Szimulált kézbesítés',
           'scheduled_for', listed.scheduled_for) order by listed.scheduled_for, listed.id), '[]'::jsonb)
    into v_items
    from (
      select distinct on (j.task_id, j.threshold) j.*, t.title as task_title
        from reminder_jobs j join tasks t on t.id = j.task_id
       where j.organization_id = v_org and (t.group_id = any (v_groups) or (v_super and t.group_id is null))
       order by j.task_id, j.threshold, (j.status in ('stale', 'cancelled')), j.created_at desc, j.id desc
    ) listed
    cross join lateral (
      select count(*)::integer as n from reminder_recipients r
       where r.reminder_job_id = listed.id and r.status = 'active') counted
   where p_status is null or listed.status = p_status;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

create or replace function reminder_retry(p_idempotency_key text, p_job_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'reminder.retry';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_job reminder_jobs%rowtype;
  v_group uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_job_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_job_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_job from reminder_jobs j where j.id = p_job_id and j.organization_id = v_org for update;
    if not found then
      perform platform_deny_unless_super(v_org);
      perform platform_abort('validation', 'reminder_not_found');
    end if;
    select t.group_id into v_group from tasks t where t.id = v_job.task_id;
    if not has_core_scope(v_org, v_group) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_job.status <> 'retryable' then
      perform platform_abort('conflict', 'REMINDER_NOT_RETRYABLE');
    end if;
    if v_job.version <> p_expected_version then
      perform platform_abort('invalidated', 'REMINDER_STALE');
    end if;

    update reminder_jobs set status = 'retrying' where id = v_job.id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_job.id);
    return platform_result('success', v_job.id, null)
      || jsonb_build_object('version', v_job.version + 1, 'status', 'retrying');
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 13. The lifecycle. The memberships of the family's parents go instead of the family's own (NFR11.1); the audit
--     event has no group. The rest is the body of 20261035_integrity_lifecycle, unchanged.
-- ---------------------------------------------------------------------------------------------------
create or replace function lifecycle_run_core(
  p_idempotency_key text, p_family_id uuid, p_expected_version integer, p_confirmed boolean
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'lifecycle.run';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_family families%rowtype;
  v_blockers jsonb;
  v_has_assignments boolean;
  v_account uuid;
  v_result jsonb;
  v_audit uuid;
  v_outcome text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 150 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_family_id::text, p_expected_version::text, p_confirmed::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not has_super_scope(v_org) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_family_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_family from families where id = p_family_id and organization_id = v_org for update;
    if not found then
      perform platform_abort('validation', 'family_not_found');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_family.version <> p_expected_version then
      perform platform_abort('invalidated', 'LIFECYCLE_STALE');
    end if;
    v_blockers := lifecycle_blockers(p_family_id);
    if v_family.status <> 'archived' then
      v_blockers := v_blockers || '["not_archived"]'::jsonb;
    elsif v_family.anonymized_at is not null then
      v_blockers := v_blockers || '["already_anonymized"]'::jsonb;
    end if;
    if jsonb_array_length(v_blockers) > 0 then
      perform platform_abort('conflict', 'LIFECYCLE_BLOCKED',
        jsonb_build_object('deferred', true, 'blockers', v_blockers));
    end if;
    if p_confirmed is distinct from true then
      perform platform_abort('conflict', 'LIFECYCLE_CONFIRMATION_REQUIRED');
    end if;

    v_has_assignments := exists (select 1 from assignments a where a.family_id = p_family_id);

    -- The parents' sign-in accounts are deactivated through U2's function (a super admin action). An
    -- account that is already deactivated is fine; any other refusal stops the whole run.
    for v_account in
      select p.account_id from parents p where p.family_id = p_family_id and p.account_id is not null order by p.account_id
    loop
      v_result := identity_set_account_status(
        left(p_idempotency_key, 100) || ':deactivate:' || v_account::text, v_account, 'deactivated');
      if v_result->>'state' <> 'success' and v_result->>'code' <> 'account_status_unchanged' then
        perform platform_abort('conflict', 'LIFECYCLE_BLOCKED',
          jsonb_build_object('deferred', true, 'blockers', jsonb_build_array('account_' || coalesce(v_result->>'code', 'refused'))));
      end if;
    end loop;

    -- Every invitation of the family goes, whatever its status.
    delete from invitations i
     where (i.scope_type = 'family' and i.scope_id = p_family_id)
        or i.target_id in (select p.id from parents p where p.family_id = p_family_id);

    delete from parent_contacts where parent_id in (select p.id from parents p where p.family_id = p_family_id);
    delete from group_memberships where parent_id in (select p.id from parents p where p.family_id = p_family_id);
    if v_has_assignments then
      update contribution_notes set text = ''
       where assignment_id in (select a.id from assignments a where a.family_id = p_family_id);
      update change_requests set reason = null
       where assignment_id in (select a.id from assignments a where a.family_id = p_family_id);
      update parents set optional_profile = null, optional_profile_consent = false, account_id = null,
                         display_name = 'Anonimizált szülő'
       where family_id = p_family_id;
      update children set display_name = 'Anonimizált gyermek' where family_id = p_family_id;
      update families set display_name = 'Anonimizált család', anonymized_at = now() where id = p_family_id;
      v_outcome := 'anonymized';
      v_audit := platform_audit_write('lifecycle.anonymize', 'family', p_family_id, v_org, null, 'success', 'family');
    else
      delete from parents where family_id = p_family_id;
      delete from children where family_id = p_family_id;
      delete from families where id = p_family_id;
      v_outcome := 'deleted';
      v_audit := platform_audit_write('lifecycle.delete', 'family', p_family_id, v_org, null, 'success', 'family');
    end if;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_family_id);
    return platform_result('success', p_family_id, null)
      || jsonb_build_object('outcome', v_outcome, 'audit_event_id', v_audit);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- The family row first; the notices go after the core. Removal also raises the authorization version of the
-- family's accounts, read before the core clears the links (NFR3.4).
create or replace function lifecycle_run(
  p_idempotency_key text, p_family_id uuid, p_expected_version integer, p_confirmed boolean
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_result jsonb;
  v_org uuid;
  v_parents uuid[] := '{}'::uuid[];
  v_accounts uuid[] := '{}'::uuid[];
  v_account uuid;
begin
  v_org := identity_actor_organization();
  if p_family_id is not null and v_org is not null and current_session_is_active() and has_super_scope(v_org) then
    perform 1 from families f where f.id = p_family_id and f.organization_id = v_org for update;
    if found then
      select coalesce(array_agg(p.id), '{}'::uuid[]),
             coalesce(array_agg(p.account_id) filter (where p.account_id is not null), '{}'::uuid[])
        into v_parents, v_accounts
        from parents p where p.family_id = p_family_id;
    end if;
  end if;
  v_result := lifecycle_run_core(p_idempotency_key, p_family_id, p_expected_version, p_confirmed);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform notification_after_lifecycle(p_family_id, v_parents);
    foreach v_account in array v_accounts loop
      perform identity_bump_authorization_version(v_account);
    end loop;
  end if;
  return v_result;
end $$;

-- Housekeeping without the import's expiry.
create or replace function identity_housekeeping() returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_attempts integer; v_pruned integer; v_users integer; v_invitations integer; v_expired integer;
  v_released integer; v_audit integer := 0; v_audit_failed boolean := false;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  v_released := invitation_release_stale();
  delete from sign_in_attempts where attempted_at <= now() - interval '30 minutes';
  get diagnostics v_attempts = row_count;
  delete from sign_in_attempts
   where id in (select id from (
           select id, row_number() over (partition by email_hash order by attempted_at desc, id) as position
             from sign_in_attempts) ranked where ranked.position > 20);
  get diagnostics v_pruned = row_count;
  delete from auth.users u
   where u.raw_app_meta_data ? 'invitation_id'
     and u.created_at < now() - interval '1 hour'
     and not exists (select 1 from accounts a where a.id = u.id);
  get diagnostics v_users = row_count;
  delete from invitations
   where status in ('accepted', 'revoked', 'replaced') and updated_at < now() - interval '90 days';
  get diagnostics v_invitations = row_count;
  select count(*) into v_expired from invitations where status = 'pending' and expires_at <= now();
  begin
    v_audit := audit_purge();
  exception when others then
    v_audit := 0;
    v_audit_failed := true;
  end;
  return platform_result('success', null, 'done') || jsonb_build_object(
    'attempts_removed', v_attempts + v_pruned, 'users_removed', v_users,
    'invitations_removed', v_invitations, 'invitations_expired', v_expired,
    'reservations_released', v_released,
    'audit_events_purged', v_audit, 'audit_purge_failed', v_audit_failed);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 14. Function rights (C1, NFR3.6). Every new function starts with no rights. `create or replace` keeps the rights of
--     the functions it replaces, so only new ones are listed.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  coordination_task_event_scope(),
  coordination_event_tasks_scope(),
  identity_linked_parent(),
  platform_deny_unless_super(uuid),
  grant_admin(uuid, uuid),
  end_admin(uuid, uuid),
  parent_display_name(uuid),
  family_display_name(uuid),
  current_parent_id(),
  current_family_id(),
  has_community_admin(),
  can_manage_group(uuid),
  can_read_community(),
  working_group_list(),
  family_name_list(),
  schedule_get(text, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function
  current_parent_id(),
  current_family_id(),
  has_community_admin(),
  can_manage_group(uuid),
  can_read_community(),
  working_group_list(),
  family_name_list(),
  schedule_get(text, uuid, text, text)
  to authenticated;

commit;
