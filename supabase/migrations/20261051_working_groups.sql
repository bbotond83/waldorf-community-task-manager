-- U4 of the Ovis tábla work: joining and leaving working groups, a group's page with its members, super admins
-- appointing and revoking coordinators, the old direct grant path closed, the C7 facts and the C16 removal steps, and
-- the lifecycle fix that ends coordinator rights (W1 to W8 of functional-spec.md; BR40 to BR44; contracts C1, C2, C7,
-- C8 and C16). The file opens and commits its own transaction, as 20261049 and 20261050 do, because the migration
-- runner adds none: the structure change, the registry rows and every redefined function succeed or fail together.
--
-- Technical names stay: a working group is `groups`, a membership is `group_memberships`, the coordinator right is an
-- unrevoked `group_admin` grant in `app_role_grants` (ADR-010: the grant is the single record, no copy on the membership).
--
-- Lock order of every path (scalability-design.md): family, accounts, parents, memberships ascending, grants ascending,
-- then the accounts' authorization-version rows. A path may skip levels, never go back to an earlier one.
--
-- Refusals are raised through U3R00 and rolled back (C1). Only the page read and the four commands are granted to
-- signed-in accounts; everything else here is internal and granted to nobody. `create or replace` keeps a function's
-- old grants, so `revoke all` and the intended grants are restated after every redefined function.
begin;

-- ---------------------------------------------------------------------------------------------------
-- 1. The membership gets a version (the outdated-screen check) and the reason it ended (BR40.4, BR44.2). Rows that
--    ended before this file ended by leaving. created_at serves as the join time.
-- ---------------------------------------------------------------------------------------------------
alter table group_memberships add column version integer not null default 1 check (version >= 1);
alter table group_memberships add column end_reason text check (end_reason in ('left', 'removed'));
update group_memberships set end_reason = 'left' where status = 'ended';
alter table group_memberships add constraint group_memberships_end_reason_shape
  check ((status = 'ended') = (end_reason is not null));

-- ---------------------------------------------------------------------------------------------------
-- 2. The notice registries (C8): the working group is something a notice can point to, and the two coordinator notices.
--    The facts function answers for an archived group too, so a revocation in an archived group can still be sent
--    (NFR10.5). It names the group and the path of its page only, never a person.
-- ---------------------------------------------------------------------------------------------------
create or replace function notice_facts_working_group(p_target_id uuid, p_parent_id uuid, p_kind text)
returns table (item_name text, item_date date, path text, full_title text, detail text)
language sql stable security definer set search_path from current
as $$
  select g.name, null::date, '/szulo/munkacsoportok/' || g.id::text, null::text, null::text
    from groups g
    join parents p on p.id = p_parent_id and p.organization_id = g.organization_id
   where g.id = p_target_id
$$;

insert into notice_targets (target_type, facts_function, added_by) values
  ('working_group', 'notice_facts_working_group', 'u4-working-groups');

insert into notice_kinds (kind, target_type, title_prefix, label, added_by) values
  ('coordinator_appointed', 'working_group', 'Koordinátor lettél:', 'Koordinátori kinevezés', 'u4-working-groups'),
  ('coordinator_revoked', 'working_group', 'Megszűnt a koordinátori jogod:', 'Koordinátori jog visszavonása',
   'u4-working-groups');

-- ---------------------------------------------------------------------------------------------------
-- 3. Identity's end_admin gets an optional reason (BR40.5). The old two-parameter signature is dropped so exactly one
--    end_admin remains. The audit detail names why the grant ended: revoked, left_group or removed. Existing callers
--    keep the default and its refusals as U1 made them.
-- ---------------------------------------------------------------------------------------------------
drop function end_admin(uuid, uuid);
create or replace function end_admin(p_parent_id uuid, p_group_id uuid, p_reason text default 'revoked') returns uuid
language plpgsql security definer set search_path from current
as $$
declare
  v_parent parents%rowtype;
  v_id uuid;
begin
  if p_reason is null or p_reason not in ('revoked', 'left_group', 'removed') then
    perform platform_abort('validation', 'request_invalid');
  end if;
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
                               'success', 'grant:group_admin:' || p_reason);
  return v_id;
end $$;
revoke all on function end_admin(uuid, uuid, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 4. The general role-change function no longer gives or takes the group-admin right (BR41.7). It keeps its order:
--    session, the caller's authorization, then this refusal before any change, so a caller who is not allowed still
--    gets the denied result first. Everything else is the body of 20261047.
-- ---------------------------------------------------------------------------------------------------
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
  -- BR41.7: the group-admin right is given and taken only by the coordinator actions of U4.
  if p_role = 'group_admin' then
    return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
      coalesce(p_subject_id, platform_system_account()), v_org, v_group, 'validation', null,
      'GRANT_USE_COORDINATOR_ACTION', null);
  end if;
  select a.organization_id into v_subject_org from accounts a where a.id = p_subject_id;
  -- An account of another organization answers exactly like a missing one.
  if p_subject_id is null or v_subject_org is distinct from v_org then
    return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
      coalesce(p_subject_id, platform_system_account()), v_org, null, 'validation', null, 'account_not_found', null);
  end if;
  if p_role is null or p_scope_type is null or p_scope_id is null
     or not ((p_role = 'parent' and p_scope_type = 'family')
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
revoke all on function grant_change(text, text, uuid, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function grant_change(text, text, uuid, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 5. The two contact helpers moved out of directory_list (BR42.2, NFR1.9). Internal. "Shared" is U3's BR31.5: the box
--    is ticked and the parent has an active account. The email is U3's BR30.6: the sign-in email once the account is
--    active, else the email on record. directory_list and working_group_detail both call them, so the two screens
--    cannot disagree about a viewer and a member.
-- ---------------------------------------------------------------------------------------------------
create or replace function directory_parent_shares(p_parent_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce((select pp.sharing_consent and a.status = 'active'
                     from parents p
                     left join parent_profiles pp on pp.parent_id = p.id
                     left join accounts a on a.id = p.account_id
                    where p.id = p_parent_id), false)
$$;

create or replace function directory_parent_email(p_parent_id uuid) returns text
language sql stable security definer set search_path from current
as $$
  select case when a.status = 'active' then a.email else pp.email_on_record end
    from parents p
    left join parent_profiles pp on pp.parent_id = p.id
    left join accounts a on a.id = p.account_id
   where p.id = p_parent_id
$$;
revoke all on function directory_parent_shares(uuid), directory_parent_email(uuid)
  from public, anon, authenticated, service_role;

-- directory_list as 20261049 defined it, with "counts as shared" and "the email shown" taken from the helpers.
create or replace function directory_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_super boolean;
  v_teacher boolean;
  v_me uuid;
  v_my_family uuid;
  v_items jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  v_super := coalesce(has_super_scope(v_org), false);
  v_teacher := coalesce(has_current_role_scope('kindergarten_teacher', v_org, 'organization', v_org), false);
  v_me := identity_linked_parent();
  select p.family_id into v_my_family from parents p where p.id = v_me;

  with parent_rows as materialized (
    select p.id, p.family_id, p.display_name, p.account_id,
           coalesce(p.id = v_me, false) as is_self,
           -- BR31.5, through the helper.
           directory_parent_shares(p.id) as shared,
           coalesce(pp.sharing_consent, false) as consent,
           -- BR30.6, through the helper.
           directory_parent_email(p.id) as shown_email,
           pp.phone, pp.residence, pp.occupation, pp.hobby, pp.how_i_support
      from parents p
      join families f on f.id = p.family_id and f.organization_id = v_org and f.status = 'active'
      left join parent_profiles pp on pp.parent_id = p.id
     where p.organization_id = v_org and p.status = 'active'
  ), entries as (
    select r.family_id, r.display_name, r.id,
           jsonb_build_object('id', r.id, 'full_name', r.display_name)
           || case when r.is_self or v_super or v_teacher or r.shared
                   then jsonb_strip_nulls(jsonb_build_object('email', r.shown_email, 'phone', r.phone))
                   else '{}'::jsonb end
           || case when r.is_self or v_super or r.shared
                   then jsonb_strip_nulls(jsonb_build_object(
                          'residence', r.residence, 'occupation', r.occupation,
                          'hobby', r.hobby, 'how_i_support', r.how_i_support))
                   else '{}'::jsonb end
           || case when r.is_self or v_super
                   then jsonb_build_object('sharing_consent', r.consent) else '{}'::jsonb end
           || case when r.is_self then jsonb_build_object('is_self', true) else '{}'::jsonb end
           || case when v_super then jsonb_build_object('has_account', r.account_id is not null)
                   else '{}'::jsonb end as entry
      from parent_rows r
  ), family_sharing as (
    select r.family_id, bool_and(r.shared) as all_shared from parent_rows r group by r.family_id
  )
  select coalesce(jsonb_agg(card.value order by card.family_name, card.family_id), '[]'::jsonb)
    into v_items
    from (
      select f.id as family_id, f.display_name as family_name,
             jsonb_build_object(
               'family_id', f.id, 'family_name', f.display_name,
               'is_own_family', coalesce(f.id = v_my_family, false),
               'parents', coalesce((select jsonb_agg(e.entry order by e.display_name, e.id)
                                      from entries e where e.family_id = f.id), '[]'::jsonb))
             -- BR30.4: the children are present only when allowed, and not at all for a family without any.
             || case when (v_super or f.id = v_my_family or coalesce(fs.all_shared, false))
                          and exists (select 1 from children c where c.family_id = f.id and c.status = 'active')
                     then jsonb_build_object('children',
                            (select jsonb_agg(jsonb_build_object('name', c.display_name) order by c.display_name, c.id)
                               from children c where c.family_id = f.id and c.status = 'active'))
                     else '{}'::jsonb end as value
        from families f
        left join family_sharing fs on fs.family_id = f.id
       where f.organization_id = v_org and f.status = 'active'
    ) card;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;
revoke all on function directory_list() from public, anon, authenticated, service_role;
grant execute on function directory_list() to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 6. Reading a group (W1; BR42.1 to BR42.5). One call, one set-based read of the page: the group, whether it has a
--    coordinator, the member rows and the caller's own membership. A caller without access gets a denied refusal,
--    never an empty page. A missing, archived or other-community group gives one answer. A field the viewer may not
--    see is never selected into the result (ADR-008). The row is built from a fixed column list: no profile field and
--    no child (NFR1.10).
-- ---------------------------------------------------------------------------------------------------
create or replace function working_group_detail(p_group_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_super boolean;
  v_teacher boolean;
  v_me uuid;
  v_group record;
  v_members jsonb;
  v_has_coordinator boolean;
  v_own jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select g.id, g.name, g.description, s.id as school_year_id, s.name as school_year_name
    into v_group
    from groups g join school_years s on s.id = g.school_year_id
   where g.id = p_group_id and g.organization_id = v_org and g.status = 'active';
  if not found then
    return platform_result('denied', null, 'GROUP_UNAVAILABLE');
  end if;
  v_super := coalesce(has_super_scope(v_org), false);
  v_teacher := coalesce(has_current_role_scope('kindergarten_teacher', v_org, 'organization', v_org), false);
  v_me := identity_linked_parent();

  with member_rows as materialized (
    select ms.id as membership_id, p.id as parent_id, ms.version,
           parent_display_name(p.id) as full_name,
           coalesce(p.id = v_me, false) as is_self,
           exists (select 1 from app_role_grants g
                    where g.subject_id = p.account_id and g.role = 'group_admin' and g.scope_type = 'group'
                      and g.scope_id = p_group_id and g.revoked_at is null) as is_coordinator,
           pp.phone
      from group_memberships ms
      join parents p on p.id = ms.parent_id and p.status = 'active'
      join families f on f.id = p.family_id and f.status = 'active'
      left join parent_profiles pp on pp.parent_id = p.id
     where ms.group_id = p_group_id and ms.organization_id = v_org and ms.status = 'active'
  ), entries as (
    select r.full_name, r.parent_id, r.is_coordinator,
           jsonb_build_object('membership_id', r.membership_id, 'parent_id', r.parent_id, 'full_name', r.full_name,
                              'is_coordinator', r.is_coordinator, 'is_self', r.is_self)
           -- BR42.2: phone and email only where the directory would show them.
           || case when r.is_self or v_super or v_teacher or directory_parent_shares(r.parent_id)
                   then jsonb_strip_nulls(jsonb_build_object(
                          'email', directory_parent_email(r.parent_id), 'phone', r.phone))
                   else '{}'::jsonb end
           || case when v_super then jsonb_build_object('version', r.version) else '{}'::jsonb end as entry
      from member_rows r
  )
  select coalesce(jsonb_agg(e.entry order by e.full_name, e.parent_id), '[]'::jsonb),
         coalesce(bool_or(e.is_coordinator), false)
    into v_members, v_has_coordinator
    from entries e;

  select jsonb_build_object('id', ms.id, 'version', ms.version) into v_own
    from group_memberships ms
   where ms.parent_id = v_me and ms.group_id = p_group_id and ms.status = 'active';

  return platform_result('success', p_group_id, null) || jsonb_build_object(
    'group', jsonb_build_object('id', v_group.id, 'name', v_group.name, 'description', v_group.description,
                                'school_year_id', v_group.school_year_id, 'school_year_name', v_group.school_year_name),
    'has_coordinator', v_has_coordinator,
    'caller_is_parent', current_parent_id() is not null,
    'own_membership', v_own,
    'members', v_members);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 7. Join (W2; BR40.1 to BR40.3). The command names no parent: it acts for the caller's own current parent. The
--    caller's family row and then parent row are locked for share, so a removal running at the same time either
--    finishes first or waits. A repeated key returns the stored result; a parent who is already a member gets success
--    with ALREADY_MEMBER and the existing membership, also when two joins race past the check and the unique index
--    refuses the second insert.
-- ---------------------------------------------------------------------------------------------------
create or replace function working_group_join(p_idempotency_key text, p_group_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'working_group.join';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_family uuid;
  v_id uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(coalesce(p_group_id::text, ''), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := current_parent_id();
    -- A teacher, or a super admin without a parent record, has no current parent.
    if v_parent is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_group_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select p.family_id into v_family from parents p where p.id = v_parent;
    perform 1 from families f where f.id = v_family for share;
    perform 1 from parents p where p.id = v_parent for share;
    -- Recheck under the locks: a removal may have finished first.
    if current_parent_id() is distinct from v_parent then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if not exists (select 1 from groups g
                    where g.id = p_group_id and g.organization_id = v_org and g.status = 'active') then
      perform platform_abort('denied', 'GROUP_UNAVAILABLE');
    end if;

    select m.id into v_id from group_memberships m
     where m.parent_id = v_parent and m.group_id = p_group_id and m.status = 'active';
    if found then
      perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
      return platform_result('success', v_id, 'ALREADY_MEMBER');
    end if;
    begin
      insert into group_memberships (organization_id, group_id, parent_id)
      values (v_org, p_group_id, v_parent)
      returning id into v_id;
    exception when unique_violation then
      select m.id into v_id from group_memberships m
       where m.parent_id = v_parent and m.group_id = p_group_id and m.status = 'active';
      perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
      return platform_result('success', v_id, 'ALREADY_MEMBER');
    end;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object('version', 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 8. Leave (W3; BR40.4 to BR40.6). Names the caller's own membership and its version. Someone else's membership and a
--    missing one give the same denied result, before any test of whether it is active. A coordinator who leaves loses
--    the group's admin right in the same transaction, audited with the reason left_group; end_admin is called only
--    when the grant exists, read under the membership lock. A membership of an archived group can still be ended.
-- ---------------------------------------------------------------------------------------------------
create or replace function working_group_leave(p_idempotency_key text, p_membership_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'working_group.leave';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_membership group_memberships%rowtype;
  v_account uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_membership_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := current_parent_id();
    if v_parent is null or p_membership_id is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    -- The owner of a membership never changes, so the check can come before the lock; a missing row and someone
    -- else's row answer alike.
    if not exists (select 1 from group_memberships m
                    where m.id = p_membership_id and m.organization_id = v_org and m.parent_id = v_parent) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select * into v_membership from group_memberships m where m.id = p_membership_id for update;
    if not found then
      -- Deleted while we waited (the family's lifecycle step).
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_membership.status <> 'active' then
      perform platform_abort('conflict', 'NOT_A_MEMBER');
    end if;
    if v_membership.version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    select p.account_id into v_account from parents p where p.id = v_membership.parent_id;
    if exists (select 1 from app_role_grants g
                where g.subject_id = v_account and g.role = 'group_admin' and g.scope_type = 'group'
                  and g.scope_id = v_membership.group_id and g.revoked_at is null) then
      perform end_admin(v_membership.parent_id, v_membership.group_id, 'left_group');
    end if;
    update group_memberships
       set status = 'ended', ended_at = now(), end_reason = 'left', version = version + 1
     where id = v_membership.id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_membership.id);
    return platform_result('success', v_membership.id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 9. Appoint and revoke a coordinator (W4, W5; BR41.1 to BR41.6). A super admin only: the decision point comes right
--    after the session check and before any lookup, and the denial is audited like today's denials. Each command names
--    a membership and its version, so the group is the membership's own. The membership's version goes up on every
--    appointment and revocation, which is what the outdated-screen check looks at. The person gets the notice and
--    its email in the same transaction, with the once key <kind>:<grant id>.
-- ---------------------------------------------------------------------------------------------------
create or replace function coordinator_appoint(p_idempotency_key text, p_membership_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'coordinator.appoint';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_membership group_memberships%rowtype;
  v_group_status text;
  v_account uuid;
  v_grant uuid;
  v_code text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_membership_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  -- BR41.1: a parent, a teacher or a coordinator of the same group is denied whatever they send.
  if not coalesce(has_super_scope(v_org), false) then
    return identity_deny(c_operation, p_idempotency_key, v_fingerprint, 'role.grant', 'membership',
      coalesce(p_membership_id, platform_system_account()), v_org, null, 'coordinator_appoint');
  end if;

  begin
    if p_membership_id is null or p_expected_version is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    -- BR41.2: a missing or other-community membership is an unavailable group.
    select * into v_membership from group_memberships m
     where m.id = p_membership_id and m.organization_id = v_org for update;
    if not found then
      perform platform_abort('denied', 'GROUP_UNAVAILABLE');
    end if;
    select g.status into v_group_status from groups g where g.id = v_membership.group_id;
    if v_group_status is distinct from 'active' then
      perform platform_abort('denied', 'GROUP_UNAVAILABLE');
    end if;
    if v_membership.status <> 'active' then
      perform platform_abort('validation', 'NOT_A_MEMBER');
    end if;
    select p.account_id into v_account from parents p where p.id = v_membership.parent_id;
    -- BR41.4: before the version check, so the second of two simultaneous appointments always says this.
    if exists (select 1 from app_role_grants g
                where g.subject_id = v_account and g.role = 'group_admin' and g.scope_type = 'group'
                  and g.scope_id = v_membership.group_id and g.revoked_at is null) then
      perform platform_abort('conflict', 'ALREADY_COORDINATOR');
    end if;
    if v_membership.version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    begin
      v_grant := grant_admin(v_membership.parent_id, v_membership.group_id);
    exception when sqlstate 'U3R00' then
      get stacked diagnostics v_detail = pg_exception_detail;
      v_code := (v_detail::jsonb)->>'code';
      if v_code = 'parent_required' then
        perform platform_abort('validation', 'ACCOUNT_REQUIRED');
      elsif v_code = 'scope_not_found' then
        perform platform_abort('denied', 'GROUP_UNAVAILABLE');
      end if;
      perform platform_abort('conflict', 'ALREADY_COORDINATOR');
    end;
    update group_memberships set version = version + 1 where id = v_membership.id;
    perform notice_send(array[v_membership.parent_id], 'coordinator_appointed', 'working_group',
                        v_membership.group_id, 'coordinator_appointed:' || v_grant::text);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_membership.id);
    return platform_result('success', v_membership.id, null) || jsonb_build_object('version', v_membership.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function coordinator_revoke(p_idempotency_key text, p_membership_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'coordinator.revoke';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_membership group_memberships%rowtype;
  v_account uuid;
  v_grant uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_membership_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  if not coalesce(has_super_scope(v_org), false) then
    return identity_deny(c_operation, p_idempotency_key, v_fingerprint, 'role.revoke', 'membership',
      coalesce(p_membership_id, platform_system_account()), v_org, null, 'coordinator_revoke');
  end if;

  begin
    if p_membership_id is null or p_expected_version is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_membership from group_memberships m
     where m.id = p_membership_id and m.organization_id = v_org for update;
    if not found then
      perform platform_abort('denied', 'GROUP_UNAVAILABLE');
    end if;
    -- An archived group is allowed here, as leaving is (BR40.6, BR41.5).
    if v_membership.status <> 'active' then
      perform platform_abort('conflict', 'NOT_A_MEMBER');
    end if;
    select p.account_id into v_account from parents p where p.id = v_membership.parent_id;
    select g.id into v_grant from app_role_grants g
     where g.subject_id = v_account and g.role = 'group_admin' and g.scope_type = 'group'
       and g.scope_id = v_membership.group_id and g.revoked_at is null;
    if not found then
      perform platform_abort('conflict', 'NOT_COORDINATOR');
    end if;
    if v_membership.version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    perform end_admin(v_membership.parent_id, v_membership.group_id, 'revoked');
    update group_memberships set version = version + 1 where id = v_membership.id;
    perform notice_send(array[v_membership.parent_id], 'coordinator_revoked', 'working_group',
                        v_membership.group_id, 'coordinator_revoked:' || v_grant::text);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_membership.id);
    return platform_result('success', v_membership.id, null) || jsonb_build_object('version', v_membership.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 10. Facts for other units (C7; BR43.1). Internal, ids only, ordered by id, nothing for an unknown group. A member
--     counts while the parent and the family are active; a coordinator is such a member whose account holds an
--     unrevoked group-admin grant on the group.
-- ---------------------------------------------------------------------------------------------------
create or replace function group_members(p_group_id uuid) returns uuid[]
language sql stable security definer set search_path from current
as $$
  select coalesce(array_agg(m.parent_id order by m.parent_id), '{}'::uuid[])
    from group_memberships m
    join parents p on p.id = m.parent_id and p.status = 'active'
    join families f on f.id = p.family_id and f.status = 'active'
   where m.group_id = p_group_id and m.status = 'active'
$$;

create or replace function group_coordinators(p_group_id uuid) returns uuid[]
language sql stable security definer set search_path from current
as $$
  select coalesce(array_agg(m.parent_id order by m.parent_id), '{}'::uuid[])
    from group_memberships m
    join parents p on p.id = m.parent_id and p.status = 'active'
    join families f on f.id = p.family_id and f.status = 'active'
   where m.group_id = p_group_id and m.status = 'active'
     and exists (select 1 from app_role_grants g
                  where g.subject_id = p.account_id and g.role = 'group_admin' and g.scope_type = 'group'
                    and g.scope_id = m.group_id and g.revoked_at is null)
$$;

-- ---------------------------------------------------------------------------------------------------
-- 11. The removal steps (C16; BR44.1, BR44.2). Internal. U14 calls U4's block before U3's directory block, because
--     U3's block clears the parent's account link and the grants could then no longer be found.
--     The preview counts a parent's active memberships plus their unrevoked group-admin grants; for a family the same
--     summed over its parents. The apply takes its own family, account and parent locks (taking a row this
--     transaction already holds is harmless), then the subject's active memberships ascending, ends each with reason
--     removed, and ends the grant on the same group only where one exists. No notice is sent.
-- ---------------------------------------------------------------------------------------------------
create or replace function working_groups_removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_parents uuid[];
  v_count integer := 0;
begin
  if p_subject_kind = 'parent' then
    v_parents := array[p_subject_id];
  elsif p_subject_kind = 'family' then
    select coalesce(array_agg(p.id), '{}'::uuid[]) into v_parents from parents p where p.family_id = p_subject_id;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;
  select (select count(*) from group_memberships m
           where m.parent_id = any (v_parents) and m.status = 'active')
       + (select count(*) from app_role_grants g
           where g.subject_id in (select p.account_id from parents p where p.id = any (v_parents))
             and g.role = 'group_admin' and g.scope_type = 'group' and g.revoked_at is null)
    into v_count;
  return jsonb_build_object('to_clear', v_count, 'to_flag', 0);
end $$;

create or replace function working_groups_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_family uuid;
  v_parents uuid[];
  v_accounts uuid[];
  v_membership group_memberships%rowtype;
  v_account uuid;
  v_count integer := 0;
begin
  if p_subject_kind = 'parent' then
    select p.family_id into v_family from parents p where p.id = p_subject_id;
    v_parents := array[p_subject_id];
  elsif p_subject_kind = 'family' then
    v_family := p_subject_id;
    select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_parents from parents p where p.family_id = p_subject_id;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;
  if v_family is null then
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;

  -- Family row, then the accounts ascending, then the parents ascending.
  perform 1 from families f where f.id = v_family for update;
  select coalesce(array_agg(p.account_id order by p.account_id) filter (where p.account_id is not null), '{}'::uuid[])
    into v_accounts from parents p where p.id = any (v_parents);
  perform 1 from accounts a where a.id = any (v_accounts) order by a.id for update;
  perform 1 from parents p where p.id = any (v_parents) order by p.id for update;

  for v_membership in
    select * from group_memberships m
     where m.parent_id = any (v_parents) and m.status = 'active'
     order by m.id
     for update
  loop
    select p.account_id into v_account from parents p where p.id = v_membership.parent_id;
    if exists (select 1 from app_role_grants g
                where g.subject_id = v_account and g.role = 'group_admin' and g.scope_type = 'group'
                  and g.scope_id = v_membership.group_id and g.revoked_at is null) then
      perform end_admin(v_membership.parent_id, v_membership.group_id, 'removed');
      v_count := v_count + 1;
    end if;
    update group_memberships
       set status = 'ended', ended_at = now(), end_reason = 'removed', version = version + 1
     where id = v_membership.id;
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('to_clear', v_count, 'to_flag', 0);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 12. The family lifecycle (BR41.8, NFR11.4): the body of 20261049 with U4's step after the family lock and before the
--     account-deactivation loop. The step locks the family's linked accounts, parents and memberships by ascending id
--     and then ends every unrevoked group-admin grant of the family's parents with reason removed, before the memberships
--     are deleted and the account links cleared. No notice is sent.
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
  v_grant record;
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

    -- U4's step (BR41.8): the accounts, the parents and the memberships of the family are locked by ascending id,
    -- then each unrevoked group-admin grant of the family's parents ends with the reason removed, in ascending grant
    -- order, before the deactivation loop below bumps the same version rows.
    perform 1 from accounts a
     where a.id in (select p.account_id from parents p where p.family_id = p_family_id and p.account_id is not null)
     order by a.id for update;
    perform 1 from parents p where p.family_id = p_family_id order by p.id for update;
    perform 1 from group_memberships m
     where m.parent_id in (select p.id from parents p where p.family_id = p_family_id)
     order by m.id for update;
    for v_grant in
      select g.id, g.scope_id as group_id, p.id as parent_id
        from app_role_grants g join parents p on p.account_id = g.subject_id
       where p.family_id = p_family_id and g.role = 'group_admin' and g.scope_type = 'group' and g.revoked_at is null
       order by g.id
    loop
      perform end_admin(v_grant.parent_id, v_grant.group_id, 'removed');
    end loop;

    -- The parents' sign-in accounts are deactivated through the account-status step (a super admin action). An
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

    delete from email_change_requests
     where account_id in (select p.account_id from parents p where p.family_id = p_family_id and p.account_id is not null);
    delete from parent_profiles where parent_id in (select p.id from parents p where p.family_id = p_family_id);
    delete from group_memberships where parent_id in (select p.id from parents p where p.family_id = p_family_id);
    if v_has_assignments then
      update contribution_notes set text = ''
       where assignment_id in (select a.id from assignments a where a.family_id = p_family_id);
      update change_requests set reason = null
       where assignment_id in (select a.id from assignments a where a.family_id = p_family_id);
      update parents set account_id = null, display_name = 'Anonimizált szülő'
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
revoke all on function lifecycle_run_core(text, uuid, integer, boolean) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 13. Function rights (C1, NFR3.15). Every new function starts with no rights. Only the page read and the four
--     commands go to signed-in accounts; each checks its caller itself (BR40.1, BR40.4, BR41.1, BR42.1). The facts
--     functions, the removal steps, the contact helpers, the notice facts function, end_admin and lifecycle_run_core
--     stay with nobody.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  notice_facts_working_group(uuid, uuid, text),
  working_group_detail(uuid),
  working_group_join(text, uuid),
  working_group_leave(text, uuid, integer),
  coordinator_appoint(text, uuid, integer),
  coordinator_revoke(text, uuid, integer),
  group_members(uuid),
  group_coordinators(uuid),
  working_groups_removal_preview(text, uuid),
  working_groups_removal_apply(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  working_group_detail(uuid),
  working_group_join(text, uuid),
  working_group_leave(text, uuid, integer),
  coordinator_appoint(text, uuid, integer),
  coordinator_revoke(text, uuid, integer)
  to authenticated;

commit;
