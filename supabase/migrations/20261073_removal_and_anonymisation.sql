begin;

-- ---------------------------------------------------------------------------------------------------
-- U14 Removal and anonymisation. Forward-only: nothing already applied is edited; changed functions are replaced here,
-- each starting from its latest body.
--   Removing a parent or a family now runs the eleven removal steps of C16 in one transaction (BR201.1, BR201.2), with
--   one audit row that holds counts only (BR201.3). A text that cannot be empty becomes "—".
-- ---------------------------------------------------------------------------------------------------

-- ---------------------------------------------------------------------------------------------------
-- 1. The audit action list gains the two removal actions (BR201.3); every earlier action stays valid.
-- ---------------------------------------------------------------------------------------------------
alter table audit_events drop constraint audit_events_action_check;
alter table audit_events add constraint audit_events_action_check check (action in (
  'role.grant', 'role.revoke', 'role.first_super_admin',
  'approval.approve', 'approval.reject',
  'import.commit',
  'lifecycle.anonymize', 'lifecycle.delete', 'lifecycle.hold_place', 'lifecycle.hold_release',
  'lifecycle.parent_removed', 'lifecycle.family_removed',
  'account.deactivate', 'account.reactivate',
  'rota.publish', 'rota.discard',
  'profile.sharing_changed', 'account.password_changed', 'account.email_change_requested',
  'account.email_changed', 'family.added', 'parent.added', 'parent.removed', 'invitation.sent',
  'family.standing_set', 'weekend_pick.assign',
  'event.cancelled', 'event.organiser_marked', 'event.organiser_unmarked', 'event.signup_removed',
  'event.offer_removed', 'event.name_cleared', 'event.removal_applied',
  'library_book_returned_by_admin', 'library_book_changed_by_admin', 'library_book_removed_by_admin',
  'library_owner_changed_by_admin', 'library_removal_applied',
  'swap.reversed', 'duty.reassigned', 'swap.denied', 'cancellation.denied',
  'recurring_schedule_saved', 'recurring_schedule_set_active', 'recurring_occurrence_done',
  'recurring_occurrence_undone', 'recurring_occurrence_skipped', 'recurring_removal_applied',
  'checklist.template_removed', 'checklist.template_restored', 'checklist.claim_removed',
  'checklist.done_undone', 'checklist.removal_applied',
  'animal_calendar.saved', 'animal_slots.created',
  'todo.claim_freed', 'todo.done_undone', 'todo.pulled_to_event', 'todo.removal_applied', 'todo.migration_loaded'
));

-- ---------------------------------------------------------------------------------------------------
-- 2. A repeated click returns the stored removal result, with the ended account ids (NFR5.3). The column holds ids,
--    counts, codes and group names only, and goes with the record when it expires.
-- ---------------------------------------------------------------------------------------------------
alter table idempotency_records add column result_details jsonb;

create or replace function lifecycle_store_result_details(p_operation text, p_key text, p_details jsonb) returns void
language sql security definer set search_path from current
as $$
  update idempotency_records set result_details = p_details
   where account_id = platform_actor_account() and operation = p_operation and idempotency_key = p_key
$$;

create or replace function lifecycle_stored_result_details(p_operation text, p_key text) returns jsonb
language sql stable security definer set search_path from current
as $$
  select coalesce((select r.result_details from idempotency_records r
                    where r.account_id = platform_actor_account() and r.operation = p_operation
                      and r.idempotency_key = p_key), '{}'::jsonb)
$$;

-- ---------------------------------------------------------------------------------------------------
-- 2b. The standing lock: a person's own command and a removal of their family never overlap (BR201.1, NFR1.3,
--     NFR5.1). One advisory lock per family, held to the end of the transaction. Every command of a parent takes it
--     shared, so family members never wait for each other. A removal and the later run take their subject's exclusive.
--     Rule: it is always taken before any row lock. A command that takes two of them (a removal by an administrator
--     who is a parent) takes them in key order, so two administrators removing each other's family cannot deadlock.
-- ---------------------------------------------------------------------------------------------------
create or replace function platform_family_standing_key(p_family_id uuid) returns bigint
language sql stable set search_path from current
as $$ select hashtextextended(current_schema() || '|family-standing|' || p_family_id::text, 0) $$;

-- From 20261013, and now the shared entry of the standing lock: every command with an idempotency key passes here before
-- its first row lock. Each statement of a command reads what is committed by then, and every command asks who the
-- caller is after this call, so a removal that finished while the command waited is seen by the command's own checks,
-- which refuse as they always do. A new command must keep that order. The system caller and an account that is no
-- family's parent take no lock.
-- One operation is left out: answering a swap. It stores nothing about a person, it locks both duties and both places
-- before it writes, which are rows a removal holds, and storing its result fails for an ended session, which undoes
-- all of it. Taking the lock there would turn the existing lock order of exchanges against archives upside down.
create or replace function platform_idempotency_check(p_operation text, p_key text, p_fingerprint text)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_account uuid; v_family uuid; v_row idempotency_records%rowtype;
begin
  v_account := platform_actor_account();
  if not platform_caller_is_system() and p_operation <> 'swap.respond' then
    select p.family_id into v_family from parents p where p.account_id = v_account;
    if v_family is not null then
      perform pg_advisory_xact_lock_shared(platform_family_standing_key(v_family));
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_schema() || '|' || v_account::text || '|' || p_operation || '|' || p_key, 0));
  select * into v_row from idempotency_records
   where account_id = v_account and operation = p_operation and idempotency_key = p_key;
  if not found or v_row.expires_at <= now() then
    return jsonb_build_object('status', 'new');
  end if;
  if v_row.request_fingerprint = p_fingerprint then
    return jsonb_build_object('status', 'replay', 'state', v_row.result_state, 'reference', v_row.result_reference);
  end if;
  return jsonb_build_object('status', 'conflict');
end $$;

-- The removal side. Only a super administrator takes the subject's lock exclusive, so a caller who may not remove makes
-- nobody wait; the command's own checks still decide. The caller's own family is taken here too, shared, so that both
-- are taken in one order. Answers whether the session is still active once the locks are held: false means the caller
-- was removed while waiting.
create or replace function lifecycle_lock_standing(p_organization_id uuid, p_subject_kind text, p_subject_id uuid)
returns boolean
language plpgsql set search_path from current
as $$
declare v_subject uuid; v_caller uuid; v_lock record;
begin
  if coalesce(has_super_scope(p_organization_id), false) then
    if p_subject_kind = 'family' then
      select f.id into v_subject from families f
       where f.id = p_subject_id and f.organization_id = p_organization_id;
    else
      select p.family_id into v_subject from parents p
       where p.id = p_subject_id and p.organization_id = p_organization_id;
    end if;
  end if;
  select p.family_id into v_caller from parents p where p.account_id = auth.uid();
  for v_lock in
    select k.lock_key, bool_or(k.exclusive) as exclusive
      from (select platform_family_standing_key(v_subject) as lock_key, true as exclusive
             where v_subject is not null
            union all
            select platform_family_standing_key(v_caller), false where v_caller is not null) k
     group by k.lock_key
     order by k.lock_key
  loop
    if v_lock.exclusive then
      perform pg_advisory_xact_lock(v_lock.lock_key);
    else
      perform pg_advisory_xact_lock_shared(v_lock.lock_key);
    end if;
  end loop;
  return current_session_is_active();
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 3. How a removed person or family is shown (C6, BR204.1, NFR1.1): from the removal on, "korábbi tag" for a parent and
--    "korábbi család" for a family. The super admin's record screens read the stored name directly.
-- ---------------------------------------------------------------------------------------------------
create or replace function parent_display_name(p_parent_id uuid) returns text
language sql stable set search_path from current
as $$
  select case when p.status <> 'active' or f.status <> 'active' or f.anonymized_at is not null
              then 'korábbi tag' else p.display_name end
    from parents p join families f on f.id = p.family_id
   where p.id = p_parent_id
$$;

create or replace function family_display_name(p_family_id uuid) returns text
language sql stable set search_path from current
as $$
  select case when f.status <> 'active' or f.anonymized_at is not null then 'korábbi család' else f.display_name end
    from families f
   where f.id = p_family_id
$$;

-- From 20261069: the teacher schedule read the stored family name directly. It now asks the helper, so a removed family
-- shows as "korábbi család" there too (BR204.1). Otherwise unchanged.
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
      select jsonb_agg(family_display_name(f.id) order by a.created_at, a.id) as names,
             (array_agg(family_display_name(f.id) order by a.created_at, a.id))[1] as owner_name,
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

-- ---------------------------------------------------------------------------------------------------
-- 4. The duties step (C16; BR202.1, BR202.2, NFR11.2). Internal. A removed family's future places on manual duties are
--    freed; its future places on rota-week, weekend-slot and animal-slot duties are kept and show on the flagged-duties
--    list because the family is no longer active. Done marks keep their person. A parent holds no place of their own.
--    The caller (family_archive) plans the reminders again after all steps, as the archive did before.
-- ---------------------------------------------------------------------------------------------------
create or replace function duties_removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language sql stable security definer set search_path from current
as $$
  select jsonb_build_object(
           'to_clear', count(*) filter (where t.origin_kind = 'manual')::integer,
           'to_flag', count(*) filter (where t.origin_kind <> 'manual' and t.status <> 'cancelled')::integer)
    from assignments a join tasks t on t.id = a.task_id
   where p_subject_kind = 'family' and a.family_id = p_subject_id and a.status <> 'removed' and t.starts_at > now()
$$;

create or replace function duties_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_ids uuid[];
  v_freed uuid[];
  v_counts jsonb;
begin
  if p_subject_kind is distinct from 'family' then
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;
  select coalesce(array_agg(a.id order by a.id), '{}'::uuid[]) into v_ids
    from assignments a where a.family_id = p_subject_id and a.status <> 'removed';
  perform coordination_lock_assignments(v_ids);
  v_counts := duties_removal_preview(p_subject_kind, p_subject_id);
  select coalesce(array_agg(a.id order by a.id), '{}'::uuid[]) into v_freed
    from assignments a join tasks t on t.id = a.task_id
   where a.id = any (v_ids) and t.starts_at > now() and t.origin_kind = 'manual';
  update tasks set updated_at = now()
   where id in (select a.task_id from assignments a where a.id = any (v_freed));
  update assignments set status = 'removed' where id = any (v_freed);
  perform coordination_withdraw_requests(v_ids);
  return v_counts;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 5. WorkingGroups: the groups whose only unrevoked coordinator grants belong to the subject (BR203.1). Internal.
-- ---------------------------------------------------------------------------------------------------
create or replace function lifecycle_subject_accounts(p_subject_kind text, p_subject_id uuid) returns uuid[]
language sql stable security definer set search_path from current
as $$
  select coalesce(array_agg(p.account_id order by p.account_id), '{}'::uuid[])
    from parents p
   where p.account_id is not null
     and ((p_subject_kind = 'parent' and p.id = p_subject_id)
       or (p_subject_kind = 'family' and p.family_id = p_subject_id))
$$;

create or replace function working_groups_sole_coordinator_groups(p_subject_kind text, p_subject_id uuid) returns jsonb
language sql stable security definer set search_path from current
as $$
  select coalesce(jsonb_agg(jsonb_build_object('group_id', g.id, 'name', g.name) order by g.name, g.id), '[]'::jsonb)
    from groups g
   where exists (select 1 from app_role_grants r
                  where r.scope_id = g.id and r.role = 'group_admin' and r.scope_type = 'group' and r.revoked_at is null
                    and r.subject_id = any (lifecycle_subject_accounts(p_subject_kind, p_subject_id)))
     and not exists (select 1 from app_role_grants r
                      where r.scope_id = g.id and r.role = 'group_admin' and r.scope_type = 'group'
                        and r.revoked_at is null
                        and r.subject_id <> all (lifecycle_subject_accounts(p_subject_kind, p_subject_id)))
$$;

-- ---------------------------------------------------------------------------------------------------
-- 6. The changed steps of other units: each also empties the removed person's own texts (NFR1.3, BR204.2). A text
--    someone else wrote and the texts of shared work stay.
-- ---------------------------------------------------------------------------------------------------

-- U10, from 20261056: the sign-up note and the food-offer text go with the link. The offer text cannot be empty.
create or replace function events_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parents uuid[];
  v_family uuid;
  v_names text[];
  v_events uuid[];
  v_count integer := 0;
  v_rows integer;
begin
  if p_subject_kind = 'parent' then
    select p.organization_id into v_org from parents p where p.id = p_subject_id;
    if not found then
      return jsonb_build_object('to_clear', 0, 'to_flag', 0);
    end if;
    v_parents := array[p_subject_id];
  elsif p_subject_kind = 'family' then
    select f.organization_id into v_org from families f where f.id = p_subject_id;
    if not found then
      return jsonb_build_object('to_clear', 0, 'to_flag', 0);
    end if;
    v_family := p_subject_id;
    select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_parents from parents p where p.family_id = p_subject_id;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;
  select coalesce(array_agg(p.display_name), '{}'::text[]) into v_names from parents p where p.id = any (v_parents);

  -- The events touched, locked ascending; then their roles, sign-ups and offers, each by ascending id (BR122.1).
  select coalesce(array_agg(x.event_id order by x.event_id), '{}'::uuid[]) into v_events
    from (
      select s.event_id from event_signups s
       where s.parent_id = any (v_parents) or (v_family is not null and s.family_id = v_family)
      union
      select o.event_id from food_offers o where o.parent_id = any (v_parents)
      union
      select r.event_id from event_roles r where r.parent_id = any (v_parents) or r.person_name = any (v_names)
    ) x;
  perform 1 from events e where e.id = any (v_events) order by e.id for update;
  perform 1 from event_roles r
   where r.event_id = any (v_events) and (r.parent_id = any (v_parents) or r.person_name = any (v_names))
   order by r.id for update;
  perform 1 from event_signups s
   where s.event_id = any (v_events)
     and (s.parent_id = any (v_parents) or (v_family is not null and s.family_id = v_family))
   order by s.id for update;
  perform 1 from food_offers o where o.event_id = any (v_events) and o.parent_id = any (v_parents) order by o.id for update;

  update event_roles
     set parent_id = null, is_organiser = false,
         person_name = case when person_name = any (v_names) then null else person_name end
   where parent_id = any (v_parents) or person_name = any (v_names);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;
  update event_signups set parent_id = null, family_id = null, note = null
   where parent_id = any (v_parents) or (v_family is not null and family_id = v_family);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;
  update food_offers set parent_id = null, text = '—' where parent_id = any (v_parents);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  perform platform_audit_write('event.removal_applied', p_subject_kind, p_subject_id, v_org, null, 'success', null);
  return jsonb_build_object('to_clear', v_count, 'to_flag', 0);
end $$;

-- U11, from 20261067: the claim note goes with the link.
create or replace function checklists_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parents uuid[];
  v_family uuid;
  v_tasks uuid[];
  v_count integer := 0;
  v_rows integer;
begin
  if p_subject_kind = 'parent' then
    select p.organization_id into v_org from parents p where p.id = p_subject_id;
    if not found then
      return jsonb_build_object('to_clear', 0, 'to_flag', 0);
    end if;
    v_parents := array[p_subject_id];
  elsif p_subject_kind = 'family' then
    select f.organization_id into v_org from families f where f.id = p_subject_id;
    if not found then
      return jsonb_build_object('to_clear', 0, 'to_flag', 0);
    end if;
    v_family := p_subject_id;
    select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_parents from parents p where p.family_id = p_subject_id;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;

  select coalesce(array_agg(x.id order by x.id), '{}'::uuid[]) into v_tasks
    from (select c.task_id as id from checklist_claims c
           where c.parent_id = any (v_parents) or (v_family is not null and c.family_id = v_family)
          union
          select t.id from event_checklist_tasks t where t.done_by_parent_id = any (v_parents)) x;
  perform 1 from event_checklist_tasks t where t.id = any (v_tasks) order by t.id for update;
  perform 1 from checklist_claims c
   where c.parent_id = any (v_parents) or (v_family is not null and c.family_id = v_family)
   order by c.id for update;

  -- Open claims free their place; the rest are anonymised.
  delete from checklist_claims c
   using event_checklist_tasks t, events e
   where t.id = c.task_id and e.id = c.event_id
     and (c.parent_id = any (v_parents) or (v_family is not null and c.family_id = v_family))
     and t.done_at is null and e.ends_at > now();
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;
  update checklist_claims set parent_id = null, family_id = null, note = null
   where parent_id = any (v_parents) or (v_family is not null and family_id = v_family);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;
  update event_checklist_tasks set done_by_parent_id = null where done_by_parent_id = any (v_parents);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  perform platform_audit_write('checklist.removal_applied', p_subject_kind, p_subject_id, v_org, null, 'success', null);
  return jsonb_build_object('to_clear', v_count, 'to_flag', 0);
end $$;

-- U9, from 20261064: the reason the removed person gave for a skip becomes "—" (a skipped occurrence needs a reason).
-- The fixed reason "kikapcsolva", written when a schedule is switched off, is not a person's text and stays. A removed
-- family keeps its marks, as before; the reasons its parents gave are emptied and counted.
create or replace function recurring_duties_removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_clear integer := 0;
  v_flag integer := 0;
begin
  if p_subject_kind = 'parent' then
    select count(*)::integer into v_clear from recurring_occurrences o
     where o.done_by_parent_id = p_subject_id or o.skipped_by_parent_id = p_subject_id;
  elsif p_subject_kind = 'family' then
    select count(*)::integer into v_flag from recurring_schedules s
     where s.owner_kind = 'family' and s.family_id = p_subject_id;
    select count(*)::integer into v_clear from recurring_occurrences o
     where o.skipped_by_parent_id in (select p.id from parents p where p.family_id = p_subject_id)
       and o.skipped_reason not in ('kikapcsolva', '—');
  end if;
  return jsonb_build_object('to_clear', v_clear, 'to_flag', v_flag);
end $$;

create or replace function recurring_duties_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_family uuid;
  v_parents uuid[];
  v_clear integer := 0;
  v_flag integer := 0;
begin
  if p_subject_kind = 'parent' then
    select p.organization_id, p.family_id into v_org, v_family from parents p where p.id = p_subject_id;
    if not found then
      return jsonb_build_object('to_clear', 0, 'to_flag', 0);
    end if;
    perform 1 from families f where f.id = v_family for update;
    perform 1 from recurring_schedules s
     where s.id in (select o.schedule_id from recurring_occurrences o
                     where o.done_by_parent_id = p_subject_id or o.skipped_by_parent_id = p_subject_id)
     order by s.id for update;
    perform 1 from recurring_occurrences o
     where o.done_by_parent_id = p_subject_id or o.skipped_by_parent_id = p_subject_id
     order by o.id for update;
    update recurring_occurrences set
      done_by_parent_id = case when done_by_parent_id = p_subject_id then null else done_by_parent_id end,
      done_by_removed = done_by_removed or coalesce(done_by_parent_id = p_subject_id, false),
      skipped_reason = case when skipped_by_parent_id = p_subject_id and skipped_reason <> 'kikapcsolva' then '—'
                            else skipped_reason end,
      skipped_by_parent_id = case when skipped_by_parent_id = p_subject_id then null else skipped_by_parent_id end,
      skipped_by_removed = skipped_by_removed or coalesce(skipped_by_parent_id = p_subject_id, false)
     where done_by_parent_id = p_subject_id or skipped_by_parent_id = p_subject_id;
    get diagnostics v_clear = row_count;
  elsif p_subject_kind = 'family' then
    select f.organization_id into v_org from families f where f.id = p_subject_id;
    if not found then
      return jsonb_build_object('to_clear', 0, 'to_flag', 0);
    end if;
    perform 1 from families f where f.id = p_subject_id for update;
    select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_parents
      from parents p where p.family_id = p_subject_id;
    perform 1 from recurring_schedules s
     where (s.owner_kind = 'family' and s.family_id = p_subject_id)
        or s.id in (select o.schedule_id from recurring_occurrences o where o.skipped_by_parent_id = any (v_parents))
     order by s.id for update;
    perform 1 from recurring_occurrences o where o.skipped_by_parent_id = any (v_parents) order by o.id for update;
    update recurring_occurrences set skipped_reason = '—'
     where skipped_by_parent_id = any (v_parents) and skipped_reason not in ('kikapcsolva', '—');
    get diagnostics v_clear = row_count;
    select count(*)::integer into v_flag from recurring_schedules s
     where s.owner_kind = 'family' and s.family_id = p_subject_id;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;
  perform platform_audit_write('recurring_removal_applied', p_subject_kind, p_subject_id, v_org, null, 'success',
                               'cleared:' || v_clear::text || ':flagged:' || v_flag::text);
  return jsonb_build_object('to_clear', v_clear, 'to_flag', v_flag);
end $$;

-- U7, from 20261059 (preview) and 20261062 (apply): the reasons on the removed parent's own requests are emptied before
-- the requester is cleared. A removed family's requests lose their reasons as before.
create or replace function dutychanges_removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_parents uuid[];
  v_accounts uuid[];
  v_family uuid;
  v_clear integer;
  v_flag integer := 0;
begin
  if p_subject_kind = 'family' then
    v_family := p_subject_id;
    select coalesce(array_agg(p.id), '{}'::uuid[]), coalesce(array_agg(p.account_id) filter (where p.account_id is not null), '{}'::uuid[])
      into v_parents, v_accounts from parents p where p.family_id = p_subject_id;
    select count(*) into v_flag from change_requests r
     where r.status = 'open' and (r.source_family_id = p_subject_id or r.target_family_id = p_subject_id);
  elsif p_subject_kind = 'parent' then
    select coalesce(array_agg(p.id), '{}'::uuid[]), coalesce(array_agg(p.account_id) filter (where p.account_id is not null), '{}'::uuid[])
      into v_parents, v_accounts from parents p where p.id = p_subject_id;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;
  select count(*) into v_clear from change_requests r
   where (v_family is not null and (r.source_family_id = v_family or r.target_family_id = v_family) and r.reason is not null)
      or (r.requested_by_parent_id = any (v_parents) and r.reason is not null)
      or (r.status <> 'open' and r.requested_by_parent_id = any (v_parents))
      or r.decided_by_account_id = any (v_accounts);
  return jsonb_build_object('to_clear', v_clear, 'to_flag', v_flag);
end $$;

create or replace function dutychanges_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_preview jsonb := dutychanges_removal_preview(p_subject_kind, p_subject_id);
  v_parents uuid[];
  v_accounts uuid[];
  v_family uuid;
  v_row record;
  v_req change_requests%rowtype;
  v_tasks uuid[];
  v_places uuid[];
begin
  if p_subject_kind = 'family' then
    v_family := p_subject_id;
    select coalesce(array_agg(p.id), '{}'::uuid[]), coalesce(array_agg(p.account_id) filter (where p.account_id is not null), '{}'::uuid[])
      into v_parents, v_accounts from parents p where p.family_id = p_subject_id;
  elsif p_subject_kind = 'parent' then
    select coalesce(array_agg(p.id), '{}'::uuid[]), coalesce(array_agg(p.account_id) filter (where p.account_id is not null), '{}'::uuid[])
      into v_parents, v_accounts from parents p where p.id = p_subject_id;
  else
    return v_preview;
  end if;

  if v_family is not null then
    select coalesce(array_agg(distinct s.t) filter (where s.t is not null), '{}'::uuid[]),
           coalesce(array_agg(distinct s.p) filter (where s.p is not null), '{}'::uuid[])
      into v_tasks, v_places
      from (select unnest(array[r.source_task_id, r.target_task_id]) as t,
                   unnest(array[r.assignment_id, r.target_assignment_id]) as p
              from change_requests r
             where r.status = 'open' and (r.source_family_id = v_family or r.target_family_id = v_family)) s;
    perform dutychanges_lock(v_tasks, v_places);
    for v_row in
      select r.id, r.assignment_id, r.target_assignment_id, r.source_task_id, r.target_task_id
        from change_requests r
       where r.status = 'open' and (r.source_family_id = v_family or r.target_family_id = v_family)
       order by r.id
    loop
      perform dutychanges_lock(array_remove(array[v_row.source_task_id, v_row.target_task_id], null),
                               array_remove(array[v_row.assignment_id, v_row.target_assignment_id], null));
      select * into v_req from change_requests where id = v_row.id for update;
      if v_req.status <> 'open' then
        continue;
      end if;
      perform dutychanges_end_request(v_req.id, 'cancelled', 'family_removed');
      if v_req.kind = 'swap' then
        perform dutychanges_notify(case when v_req.source_family_id = v_family then v_req.target_family_id
                                        else v_req.source_family_id end, 'swap_cancelled', v_req.id);
      end if;
    end loop;
    update change_requests set reason = null
     where (source_family_id = v_family or target_family_id = v_family) and reason is not null;
  end if;
  update change_requests set reason = null where requested_by_parent_id = any (v_parents) and reason is not null;
  update change_requests set requested_by_parent_id = null
   where status <> 'open' and requested_by_parent_id = any (v_parents);
  update change_requests set decided_by_account_id = null where decided_by_account_id = any (v_accounts);
  return v_preview;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 7. Lifecycle: the eleven steps in the fixed order of C16 (BR201.2), the refusals that come before any lock, and the
--    audit details (counts only; the audit log accepts lower-case codes, digits and . : - _). All internal.
-- ---------------------------------------------------------------------------------------------------
create or replace function lifecycle_removal_step(p_block text, p_counts jsonb) returns jsonb
language sql immutable set search_path from current
as $$
  select jsonb_build_object('block', p_block, 'to_clear', (p_counts->>'to_clear')::integer,
                            'to_flag', (p_counts->>'to_flag')::integer)
$$;

-- One statement per step, so the order is the order written here. working_groups runs before directory, because the
-- directory step clears the account link that the coordinator grants are found by.
create or replace function lifecycle_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_steps jsonb := '[]'::jsonb;
begin
  v_steps := v_steps || lifecycle_removal_step('rota_planning', rota_planning_removal_apply(p_subject_kind, p_subject_id));
  v_steps := v_steps || lifecycle_removal_step('dutychanges', dutychanges_removal_apply(p_subject_kind, p_subject_id));
  v_steps := v_steps || lifecycle_removal_step('duties', duties_removal_apply(p_subject_kind, p_subject_id));
  v_steps := v_steps || lifecycle_removal_step('checklists', checklists_removal_apply(p_subject_kind, p_subject_id));
  v_steps := v_steps || lifecycle_removal_step('todo', todo_removal_apply(p_subject_kind, p_subject_id));
  v_steps := v_steps || lifecycle_removal_step('library', library_removal_apply(p_subject_kind, p_subject_id));
  v_steps := v_steps || lifecycle_removal_step('events', events_removal_apply(p_subject_kind, p_subject_id));
  v_steps := v_steps || lifecycle_removal_step('recurring_duties', recurring_duties_removal_apply(p_subject_kind, p_subject_id));
  v_steps := v_steps || lifecycle_removal_step('notifications', notifications_removal_apply(p_subject_kind, p_subject_id));
  v_steps := v_steps || lifecycle_removal_step('working_groups', working_groups_removal_apply(p_subject_kind, p_subject_id));
  v_steps := v_steps || lifecycle_removal_step('directory', directory_removal_apply(p_subject_kind, p_subject_id));
  return v_steps;
end $$;

-- Why this caller may not remove this subject, or null (NFR3.3). Removing yourself is refused first; the last super
-- admin check stays as a second guard, because the caller is a super admin outside the subject.
create or replace function lifecycle_removal_refusal(p_subject_kind text, p_subject_id uuid, p_organization_id uuid)
returns text
language sql stable security definer set search_path from current
as $$
  select case
    when platform_actor_account() = any (lifecycle_subject_accounts(p_subject_kind, p_subject_id)) then 'SELF_REMOVAL'
    when exists (select 1 from app_role_grants g
                  where g.organization_id = p_organization_id and g.role = 'super_admin' and g.revoked_at is null
                    and g.subject_id = any (lifecycle_subject_accounts(p_subject_kind, p_subject_id)))
     and not exists (select 1 from app_role_grants g join accounts a on a.id = g.subject_id
                      where g.organization_id = p_organization_id and g.role = 'super_admin' and g.revoked_at is null
                        and a.status = 'active'
                        and g.subject_id <> all (lifecycle_subject_accounts(p_subject_kind, p_subject_id)))
      then 'last_super_admin'
  end
$$;

create or replace function lifecycle_audit_details(p_steps jsonb, p_ended_accounts integer) returns text
language sql immutable set search_path from current
as $$
  select string_agg((s.step->>'block') || ':' || (s.step->>'to_clear') || ':' || (s.step->>'to_flag'), '.' order by s.n)
         || '.ended_accounts:' || p_ended_accounts::text
    from jsonb_array_elements(p_steps) with ordinality as s(step, n)
$$;

-- ---------------------------------------------------------------------------------------------------
-- 8. Removing a parent (W1; from 20261049). Order: session, key, super admin, subject, SELF_REMOVAL, last_super_admin,
--    and only then the locks: the family row, the family's tasks, the account and the parent row; after the version and
--    last-parent checks the family's places. The account ids are read before any step. A parent removed on their own
--    has the stored name replaced in the same transaction (NFR1.4).
-- ---------------------------------------------------------------------------------------------------
create or replace function parent_remove(p_idempotency_key text, p_parent_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'parent.remove';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent parents%rowtype;
  v_refusal text;
  v_places uuid[];
  v_accounts uuid[];
  v_groups jsonb;
  v_steps jsonb;
  v_audit uuid;
  v_result jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  if not lifecycle_lock_standing(v_org, 'parent', p_parent_id) then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_parent_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || lifecycle_stored_result_details(c_operation, p_idempotency_key);
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not coalesce(has_super_scope(v_org), false) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_parent_id is null or p_expected_version is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_parent from parents where id = p_parent_id and organization_id = v_org;
    if not found then
      perform platform_abort('validation', 'parent_not_found');
    end if;
    v_refusal := lifecycle_removal_refusal('parent', p_parent_id, v_org);
    if v_refusal is not null then
      perform platform_abort('conflict', v_refusal);
    end if;

    perform 1 from families f where f.id = v_parent.family_id for update;
    perform reminder_lock_family_tasks(v_parent.family_id);
    -- Read again under the family lock: a removal that committed while this one waited has cleared the link.
    select * into v_parent from parents where id = p_parent_id;
    if v_parent.account_id is not null then
      perform 1 from accounts a where a.id = v_parent.account_id for update;
    end if;
    select * into v_parent from parents where id = p_parent_id for update;
    if not found or v_parent.version <> p_expected_version or v_parent.status <> 'active' then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if (select count(*) from parents p where p.family_id = v_parent.family_id and p.status = 'active') <= 1 then
      perform platform_abort('conflict', 'PARENT_LAST_IN_FAMILY');
    end if;
    select coalesce(array_agg(a.id order by a.id), '{}'::uuid[]) into v_places
      from assignments a where a.family_id = v_parent.family_id and a.status <> 'removed';
    perform coordination_lock_assignments(v_places);

    v_accounts := lifecycle_subject_accounts('parent', p_parent_id);
    v_groups := working_groups_sole_coordinator_groups('parent', p_parent_id);
    v_steps := lifecycle_removal_apply('parent', p_parent_id);
    -- After the steps: the events step finds typed role names by the stored name.
    update parents set display_name = 'Anonimizált szülő' where id = p_parent_id;
    v_audit := platform_audit_write('lifecycle.parent_removed', 'parent', p_parent_id, v_org, null, 'success',
                                    lifecycle_audit_details(v_steps, cardinality(v_accounts)));

    v_result := jsonb_build_object(
      'account_id', v_accounts[1], 'ended_account_ids', to_jsonb(v_accounts), 'steps', v_steps,
      'groups_left_without_coordinator', v_groups, 'audit_event_id', v_audit);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_parent_id);
    perform lifecycle_store_result_details(c_operation, p_idempotency_key, v_result);
    return platform_result('success', p_parent_id, null) || v_result;
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 9. Removing a family (W2; the body from 20261030, which family_archive calls). The same order of checks; the family
--    row and its tasks are locked after them, and the places after the version check, where they always were. The
--    DUTY_ROTA_MANAGED refusal is gone: rota, weekend and animal-slot places are kept and flagged (BR202.1).
-- ---------------------------------------------------------------------------------------------------
create or replace function family_archive_core(p_idempotency_key text, p_family_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'family.archive';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_family families%rowtype;
  v_refusal text;
  v_ids uuid[];
  v_locked uuid[];
  v_tries integer := 0;
  v_accounts uuid[];
  v_groups jsonb;
  v_steps jsonb;
  v_audit uuid;
  v_result jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  if not lifecycle_lock_standing(v_org, 'family', p_family_id) then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_family_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || lifecycle_stored_result_details(c_operation, p_idempotency_key);
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_family_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    -- A family of another organization answers exactly like a missing one.
    perform 1 from families where id = p_family_id and organization_id = v_org;
    if not found then
      perform platform_abort('validation', 'family_not_found');
    end if;
    if not directory_reaches_family(v_org, p_family_id) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    v_refusal := lifecycle_removal_refusal('family', p_family_id, v_org);
    if v_refusal is not null then
      perform platform_abort('conflict', v_refusal);
    end if;

    select * into v_family from families where id = p_family_id for update;
    if not found then
      perform platform_abort('validation', 'family_not_found');
    end if;
    perform reminder_lock_family_tasks(p_family_id);
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if v_family.version <> p_expected_version or v_family.status = 'archived' then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;

    -- Tasks and places of the family, in the fixed order, until the set that was locked is the set there is.
    loop
      v_tries := v_tries + 1;
      select coalesce(array_agg(a.id order by a.id), '{}') into v_ids
        from assignments a where a.family_id = p_family_id and a.status <> 'removed';
      perform coordination_lock_assignments(v_ids);
      select coalesce(array_agg(a.id order by a.id), '{}') into v_locked
        from assignments a where a.family_id = p_family_id and a.status <> 'removed';
      exit when v_ids = v_locked;
      if v_tries >= 5 then
        perform platform_abort('conflict', 'VERSION_CONFLICT');
      end if;
    end loop;

    v_accounts := lifecycle_subject_accounts('family', p_family_id);
    v_groups := working_groups_sole_coordinator_groups('family', p_family_id);
    v_steps := lifecycle_removal_apply('family', p_family_id);
    v_audit := platform_audit_write('lifecycle.family_removed', 'family', p_family_id, v_org, null, 'success',
                                    lifecycle_audit_details(v_steps, cardinality(v_accounts)));

    v_result := jsonb_build_object(
      'version', (select f.version from families f where f.id = p_family_id),
      'removed_places', (select (s->>'to_clear')::integer from jsonb_array_elements(v_steps) s
                          where s->>'block' = 'duties'),
      'ended_account_ids', to_jsonb(v_accounts), 'steps', v_steps,
      'groups_left_without_coordinator', v_groups, 'audit_event_id', v_audit);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_family_id);
    perform lifecycle_store_result_details(c_operation, p_idempotency_key, v_result);
    return platform_result('success', p_family_id, null) || v_result;
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- From 20261048. A caller who is not a super admin is refused before anything is locked. The wrapper takes no lock of
-- its own any more: the core locks after its checks. The directory step raises the authorization versions of the ended
-- accounts (NFR3.6); the reminders are planned again for the family's tasks, as before.
create or replace function family_archive(p_idempotency_key text, p_family_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_result jsonb;
  v_org uuid;
begin
  v_org := identity_actor_organization();
  if current_session_is_active() and not coalesce(has_super_scope(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_result := family_archive_core(p_idempotency_key, p_family_id, p_expected_version);
  if v_result->>'state' = 'success' and v_result->>'code' is distinct from 'replayed' then
    perform reminder_plan_tasks(reminder_family_tasks((v_result->>'reference')::uuid));
  end if;
  return v_result;
end $$;

-- From 20261047. One change: a parent who was removed on their own stays removed when the family is restored (BR207.1).
-- Such a parent is recognised by the replaced name; a family removal keeps the stored names (NFR1.4).
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

    update parents set status = 'active'
     where family_id = p_family_id and status <> 'active' and display_name <> 'Anonimizált szülő';
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
-- 10. The two reads of a removal (W6, W7). Neither writes or locks anything.
--     removal_preview counts with the eleven step previews in the C16 order, and says which refusal the command would
--     answer with.
-- ---------------------------------------------------------------------------------------------------
create or replace function removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parent parents%rowtype;
  v_family families%rowtype;
  v_refusal text;
  v_version integer;
  v_steps jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if not coalesce(has_super_scope(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_subject_id is null or p_subject_kind is null or p_subject_kind not in ('parent', 'family') then
    return platform_result('validation', null, 'request_invalid');
  end if;
  if p_subject_kind = 'parent' then
    select * into v_parent from parents where id = p_subject_id and organization_id = v_org;
    if not found then
      return platform_result('validation', null, 'parent_not_found');
    end if;
    v_version := v_parent.version;
  else
    select * into v_family from families where id = p_subject_id and organization_id = v_org;
    if not found then
      return platform_result('validation', null, 'family_not_found');
    end if;
    v_version := v_family.version;
  end if;
  -- The refusal the command would answer with, in the command's order. The counts come with it (W6, BR200.2).
  v_refusal := lifecycle_removal_refusal(p_subject_kind, p_subject_id, v_org);
  if v_refusal is null then
    if (p_subject_kind = 'parent' and v_parent.status <> 'active')
       or (p_subject_kind = 'family' and v_family.status = 'archived') then
      v_refusal := 'VERSION_CONFLICT';
    elsif p_subject_kind = 'parent'
          and (select count(*) from parents p where p.family_id = v_parent.family_id and p.status = 'active') <= 1 then
      v_refusal := 'PARENT_LAST_IN_FAMILY';
    end if;
  end if;

  v_steps := jsonb_build_array(
    lifecycle_removal_step('rota_planning', rota_planning_removal_preview(p_subject_kind, p_subject_id)),
    lifecycle_removal_step('dutychanges', dutychanges_removal_preview(p_subject_kind, p_subject_id)),
    lifecycle_removal_step('duties', duties_removal_preview(p_subject_kind, p_subject_id)),
    lifecycle_removal_step('checklists', checklists_removal_preview(p_subject_kind, p_subject_id)),
    lifecycle_removal_step('todo', todo_removal_preview(p_subject_kind, p_subject_id)),
    lifecycle_removal_step('library', library_removal_preview(p_subject_kind, p_subject_id)),
    lifecycle_removal_step('events', events_removal_preview(p_subject_kind, p_subject_id)),
    lifecycle_removal_step('recurring_duties', recurring_duties_removal_preview(p_subject_kind, p_subject_id)),
    lifecycle_removal_step('notifications', notifications_removal_preview(p_subject_kind, p_subject_id)),
    lifecycle_removal_step('working_groups', working_groups_removal_preview(p_subject_kind, p_subject_id)),
    lifecycle_removal_step('directory', directory_removal_preview(p_subject_kind, p_subject_id)));

  return platform_result('success', p_subject_id, null) || jsonb_build_object(
    'subject', jsonb_build_object('kind', p_subject_kind, 'id', p_subject_id),
    'version', v_version,
    'steps', v_steps,
    'totals', (select jsonb_build_object('to_clear', sum((s->>'to_clear')::integer),
                                         'to_flag', sum((s->>'to_flag')::integer))
                 from jsonb_array_elements(v_steps) s),
    'groups_left_without_coordinator', working_groups_sole_coordinator_groups(p_subject_kind, p_subject_id),
    'refusal', v_refusal);
end $$;

-- U9's own list of a family's schedules that are still switched on; a null family has none. Internal.
create or replace function recurring_duties_family_schedules(p_family_id uuid)
returns table (schedule_id uuid, title text)
language sql stable security definer set search_path from current
as $$
  select s.id, s.title from recurring_schedules s
   where s.owner_kind = 'family' and s.family_id = p_family_id and s.is_active
$$;

-- Only the items that are flagged because of this removal and are still open (observability-design.md): titles, dates
-- and links, no person's name. A released claim is found by the history row the to-do step wrote in the removal's own
-- transaction, which carries the same time as the removal's audit row. A subject that was not removed has none.
create or replace function removal_flagged_items(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_status text;
  v_family uuid;
  v_parents uuid[];
  v_removed_at timestamptz;
  v_items jsonb := '[]'::jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if not coalesce(has_super_scope(v_org), false) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_subject_id is null or p_subject_kind is null or p_subject_kind not in ('parent', 'family') then
    return platform_result('validation', null, 'request_invalid');
  end if;
  if p_subject_kind = 'parent' then
    select p.status, array[p.id] into v_status, v_parents
      from parents p where p.id = p_subject_id and p.organization_id = v_org;
    if not found then
      return platform_result('validation', null, 'parent_not_found');
    end if;
  else
    select f.status into v_status from families f where f.id = p_subject_id and f.organization_id = v_org;
    if not found then
      return platform_result('validation', null, 'family_not_found');
    end if;
    v_family := p_subject_id;
    select coalesce(array_agg(p.id), '{}'::uuid[]) into v_parents from parents p where p.family_id = v_family;
  end if;
  select max(a.occurred_at) into v_removed_at from audit_events a
   where a.organization_id = v_org and a.target_id = p_subject_id and a.outcome = 'success'
     and a.action = case p_subject_kind when 'parent' then 'lifecycle.parent_removed' else 'lifecycle.family_removed' end;

  if v_status <> 'active' and v_removed_at is not null then
    select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'item_id', x.item_id, 'label', x.label,
                                                 'on_date', x.on_date, 'link', x.link)
                              order by x.kind_order, x.on_date nulls last, x.label, x.item_id), '[]'::jsonb)
      into v_items
      from (
        select 1 as kind_order, 'future_place' as kind, coalesce(d.duty_id, d.week_id) as item_id,
               coalesce(d.title, 'Tervezett beosztási hét') as label, d.on_date, '/admin/tanev' as link
          from rota_flagged_duties(v_org) d
         where v_family is not null and d.family_id = v_family and d.reason = 'family_inactive'
           -- A draft plan's weeks come back whole, past ones too; only this week onward is ahead, as the preview counts.
           and (d.source <> 'draft_week' or d.on_date >= date_trunc('week', school_today()::timestamp)::date)
        union all
        select 2, 'held_book', b.id, b.title, l.until, '/admin/konyvtar/' || b.id::text
          from loans l join books b on b.id = l.book_id
         where l.returned_at is null
           and (l.borrower_parent_id = any (v_parents) or (v_family is not null and l.borrower_family_id = v_family))
        union all
        select 3, 'claimed_task', t.id, t.topic, t.deadline, '/admin/teendok/' || t.id::text
          from todo_tasks t
         where t.status <> 'done' and t.claimant_parent_id is null and t.needs_attention
           and (v_family is null or t.owner_family_id is distinct from v_family)
           and exists (select 1 from todo_task_history h
                        where h.task_id = t.id and h.change = 'claimant_removed' and h.changed_at = v_removed_at)
        union all
        select 4, 'family_task', t.id, t.topic, t.deadline, '/admin/teendok/' || t.id::text
          from todo_tasks t
         where v_family is not null and t.owner_family_id = v_family and t.status <> 'done' and t.needs_attention
        union all
        select 5, 'family_schedule', s.schedule_id, s.title, null::date, '/admin/ismetlodo/' || s.schedule_id::text
          from recurring_duties_family_schedules(v_family) s
      ) x;
  end if;
  return platform_result('success', p_subject_id, null) || jsonb_build_object(
    'subject', jsonb_build_object('kind', p_subject_kind, 'id', p_subject_id), 'items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 11. Delete or anonymise (W4, BR206.1 to BR206.4, NFR11.3, NFR11.4).
-- ---------------------------------------------------------------------------------------------------
-- U9's own answer to the same question for its tables: only the recurring duties area names them (NFR11.2). Internal.
create or replace function recurring_duties_family_referenced(p_family_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$
  select exists (select 1 from recurring_schedules s where s.family_id = p_family_id)
      or exists (select 1 from recurring_occurrences o join parents p
                    on p.id = o.done_by_parent_id or p.id = o.skipped_by_parent_id
                  where p.family_id = p_family_id)
$$;

-- True while any record of history still points at the family or one of its parents. Every column that holds a family
-- or parent id is either here or is removed by the run itself: standings, memberships, contacts and children go with
-- the family, and the notices, e-mail deliveries, return watches and reminder recipients by the notification and
-- library steps. Internal.
create or replace function lifecycle_family_still_referenced(p_family_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$
  with people as (select p.id from parents p where p.family_id = p_family_id)
  select exists (select 1 from assignments a
                  where a.family_id = p_family_id or a.parent_id in (select id from people)
                     or a.done_by in (select id from people))
      or exists (select 1 from rota_weeks w where w.family_id = p_family_id)
      or exists (select 1 from change_requests r
                  where r.source_family_id = p_family_id or r.target_family_id = p_family_id
                     or r.requested_by_parent_id in (select id from people))
      or recurring_duties_family_referenced(p_family_id)
      or exists (select 1 from todo_tasks t
                  where t.owner_family_id = p_family_id or t.claimant_parent_id in (select id from people)
                     or t.done_by_parent_id in (select id from people))
      or exists (select 1 from todo_task_history h where h.changed_by_parent_id in (select id from people))
      or exists (select 1 from event_signups s
                  where s.family_id = p_family_id or s.parent_id in (select id from people))
      or exists (select 1 from food_offers o where o.parent_id in (select id from people))
      or exists (select 1 from event_roles r where r.parent_id in (select id from people))
      or exists (select 1 from loans l
                  where l.borrower_family_id = p_family_id or l.borrower_parent_id in (select id from people))
      or exists (select 1 from books b where b.owner_parent_id in (select id from people))
      or exists (select 1 from checklist_claims c
                  where c.family_id = p_family_id or c.parent_id in (select id from people))
      or exists (select 1 from event_checklist_tasks t where t.done_by_parent_id in (select id from people))
$$;

-- From 20261051. Unchanged: who may run it, the checks and their order, the confirmation, the sign-in accounts and the
-- invitations. Changed: the family's tasks and places are locked in the fixed order; the eleven steps run again, so
-- whatever came to point at the family since the removal is cleared (BR206.2); the family is deleted only when nothing
-- still points at it, otherwise anonymised (BR206.3, BR206.4); the leaving and new standings go either way; the audit
-- row holds the counts; a repeated click returns the same outcome.
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
  v_places uuid[];
  v_accounts uuid[];
  v_steps jsonb;
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
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || lifecycle_stored_result_details(c_operation, p_idempotency_key);
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

    perform reminder_lock_family_tasks(p_family_id);
    select coalesce(array_agg(a.id order by a.id), '{}'::uuid[]) into v_places
      from assignments a where a.family_id = p_family_id and a.status <> 'removed';
    perform coordination_lock_assignments(v_places);

    -- U4's step (BR41.8): the accounts, the parents and the memberships of the family are locked by ascending id.
    perform 1 from accounts a
     where a.id in (select p.account_id from parents p where p.family_id = p_family_id and p.account_id is not null)
     order by a.id for update;
    perform 1 from parents p where p.family_id = p_family_id order by p.id for update;
    perform 1 from group_memberships m
     where m.parent_id in (select p.id from parents p where p.family_id = p_family_id)
     order by m.id for update;

    v_accounts := lifecycle_subject_accounts('family', p_family_id);
    v_steps := lifecycle_removal_apply('family', p_family_id);

    -- A grant the steps left, if any, ends with the reason removed before the account links are cleared (BR41.8).
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
    delete from family_year_standings where family_id = p_family_id;

    if lifecycle_family_still_referenced(p_family_id) then
      update contribution_notes set text = ''
       where assignment_id in (select a.id from assignments a where a.family_id = p_family_id);
      update change_requests set reason = null
       where assignment_id in (select a.id from assignments a where a.family_id = p_family_id) and reason is not null;
      update parents set account_id = null, display_name = 'Anonimizált szülő'
       where family_id = p_family_id;
      update children set display_name = 'Anonimizált gyermek' where family_id = p_family_id;
      update families set display_name = 'Anonimizált család', anonymized_at = now() where id = p_family_id;
      v_outcome := 'anonymized';
      v_audit := platform_audit_write('lifecycle.anonymize', 'family', p_family_id, v_org, null, 'success',
                                      lifecycle_audit_details(v_steps, cardinality(v_accounts)));
    else
      -- Nothing of history points here, so nothing may be left pointing at an id that is gone (NFR11.4): the rights
      -- scoped to the family and the record of its one-off load go too.
      delete from app_role_grants where scope_type = 'family' and scope_id = p_family_id;
      delete from migration_loads where family_id = p_family_id;
      delete from parents where family_id = p_family_id;
      delete from children where family_id = p_family_id;
      delete from families where id = p_family_id;
      v_outcome := 'deleted';
      v_audit := platform_audit_write('lifecycle.delete', 'family', p_family_id, v_org, null, 'success',
                                      lifecycle_audit_details(v_steps, cardinality(v_accounts)));
    end if;

    v_result := jsonb_build_object('outcome', v_outcome, 'audit_event_id', v_audit, 'steps', v_steps);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_family_id);
    perform lifecycle_store_result_details(c_operation, p_idempotency_key, v_result);
    return platform_result('success', p_family_id, null) || v_result;
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- From 20261047. This wrapper locks the family row before the core, so the standing locks are taken here, first. A
-- caller who was removed while waiting gets the same answer as one whose session had already ended.
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
    if not lifecycle_lock_standing(v_org, 'family', p_family_id) then
      return platform_result('denied', null, 'session_inactive');
    end if;
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

-- From 20261032. One change: delete or anonymise is told by the same check the run uses, so the screen and the run
-- agree. The run first clears what the steps clear, which can only turn "anonymise" into "delete".
create or replace function lifecycle_list(p_state text default null) returns jsonb
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
  if not has_super_scope(v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_state is not null and p_state not in ('eligible-delete', 'eligible-anonymize', 'blocked') then
    return platform_result('validation', null, 'filter_invalid');
  end if;
  select coalesce(jsonb_agg(candidate.item order by candidate.left_at, candidate.id), '[]'::jsonb) into v_items
    from (
      select f.id, f.archived_at as left_at,
             jsonb_build_object('family_id', f.id, 'version', f.version, 'display_name', f.display_name,
                                'archived_at', f.archived_at, 'state', c.state, 'blockers', c.blockers) as item,
             c.state
        from families f
        cross join lateral (
          select lifecycle_blockers(f.id) as blockers,
                 case
                   when jsonb_array_length(lifecycle_blockers(f.id)) > 0 then 'blocked'
                   when lifecycle_family_still_referenced(f.id) then 'eligible-anonymize'
                   else 'eligible-delete' end as state) c
       where f.organization_id = v_org and f.status = 'archived' and f.anonymized_at is null
    ) candidate
   where p_state is null or candidate.state = p_state;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 12. Function rights (C1, NFR3.5). Every new or changed function starts with no rights. The steps and the helpers stay
--     with nobody; the recurring pair keeps the service-role right U9 gave it; the two commands go to signed-in accounts
--     and check their caller themselves.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  platform_family_standing_key(uuid),
  platform_idempotency_check(text, text, text),
  lifecycle_lock_standing(uuid, text, uuid),
  lifecycle_run(text, uuid, integer, boolean),
  lifecycle_store_result_details(text, text, jsonb),
  lifecycle_stored_result_details(text, text),
  parent_display_name(uuid),
  family_display_name(uuid),
  duties_removal_preview(text, uuid),
  duties_removal_apply(text, uuid),
  lifecycle_subject_accounts(text, uuid),
  working_groups_sole_coordinator_groups(text, uuid),
  events_removal_apply(text, uuid),
  checklists_removal_apply(text, uuid),
  recurring_duties_removal_preview(text, uuid),
  recurring_duties_removal_apply(text, uuid),
  dutychanges_removal_preview(text, uuid),
  dutychanges_removal_apply(text, uuid),
  lifecycle_removal_step(text, jsonb),
  lifecycle_removal_apply(text, uuid),
  lifecycle_removal_refusal(text, uuid, uuid),
  lifecycle_audit_details(jsonb, integer),
  parent_remove(text, uuid, integer),
  family_archive_core(text, uuid, integer),
  family_archive(text, uuid, integer),
  family_restore(text, uuid, integer),
  schedule_get(text, uuid, text, text),
  removal_preview(text, uuid),
  removal_flagged_items(text, uuid),
  lifecycle_family_still_referenced(uuid),
  recurring_duties_family_referenced(uuid),
  recurring_duties_family_schedules(uuid),
  lifecycle_run_core(text, uuid, integer, boolean),
  lifecycle_list(text)
  from public, anon, authenticated, service_role;
grant execute on function
  recurring_duties_removal_preview(text, uuid),
  recurring_duties_removal_apply(text, uuid)
  to service_role;
grant execute on function
  parent_remove(text, uuid, integer),
  family_archive(text, uuid, integer),
  family_restore(text, uuid, integer),
  lifecycle_run(text, uuid, integer, boolean),
  schedule_get(text, uuid, text, text),
  removal_preview(text, uuid),
  removal_flagged_items(text, uuid),
  lifecycle_list(text)
  to authenticated;

commit;
