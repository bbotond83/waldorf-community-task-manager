-- U3 of the Ovis tábla work: the community directory with field-level visibility, the sharing choice, a parent's own
-- details, password and email change, adding families and parents, removing a parent, and invitations (W1 to W9 of
-- functional-spec.md; BR30 to BR38; contracts C1, C2, C6, C16 and C17). The file opens and commits its own transaction,
-- as 20261047 does, because the migration runner adds none: the new profile table, the dropped free-text columns and
-- every redefined function succeed or fail together (NFR7.4).
--
-- Technical names stay: a community is `organizations`, a working group is `groups`, a parent's contact and profile
-- record is `parent_profiles` (the successor of `parent_contacts`).
--
-- Lock order (scalability-design.md, NFR5.6): family row, then account rows ascending, then parent rows ascending,
-- then request and invitation rows ascending. One advisory lock per address (the hash of the lower-cased address) is
-- taken before the family lock in every step that sets or checks an address; a step needing several addresses takes
-- them in ascending key order. The idempotency lock of the C1 template (one key, one caller) comes before it and can
-- be held by one caller only, so it cannot be part of a cycle.
--
-- Refusals are raised through U3R00 and rolled back (C1). Email-change request, cancel and confirm are granted to the
-- service role only: the app server checks the password first and passes the account it checked.
begin;

-- ---------------------------------------------------------------------------------------------------
-- 1. The new tables. Every table starts with no right for any application role (NFR3.7).
-- ---------------------------------------------------------------------------------------------------

-- A parent's contact and profile details and their sharing choice (entities.md, ParentProfile). Empty text is stored
-- as absent. Nothing is read by a screen directly except the parent themself and super admins; every other read
-- goes through directory_list (ADR-008).
create table parent_profiles (
  parent_id uuid primary key,
  organization_id uuid not null,
  email_on_record text check (email_on_record is null or (
    email_on_record = lower(email_on_record) and char_length(email_on_record) <= 254
    and email_on_record ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')),
  phone text check (phone is null or phone ~ '^[0-9 +-]{6,20}$'),
  residence text check (residence is null or char_length(residence) between 1 and 100),
  occupation text check (occupation is null or char_length(occupation) between 1 and 100),
  hobby text check (hobby is null or char_length(hobby) between 1 and 200),
  how_i_support text check (how_i_support is null or char_length(how_i_support) between 1 and 500),
  sharing_consent boolean not null default false,
  consent_changed_at timestamptz,
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  foreign key (parent_id, organization_id) references parents (id, organization_id)
);
-- One address on record per parent, across the community: the add and edit steps check it under the address lock,
-- and the index is the last word (NFR5.4). Removal and the lifecycle clear the address.
create unique index parent_profiles_email_unique on parent_profiles (email_on_record)
  where email_on_record is not null;
create trigger parent_profiles_touch_version before update on parent_profiles
  for each row execute function platform_touch_version();

-- A pending change of a sign-in email (entities.md, EmailChangeRequest). Only the hash of the token is stored. A
-- pending request past `expires_at` is read as expired; no job marks it.
create table email_change_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id),
  new_email text not null check (
    new_email = lower(new_email) and char_length(new_email) between 3 and 254
    and new_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'replaced')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  decided_at timestamptz,
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((status = 'pending') = (decided_at is null))
);
-- At most one pending request per account (BR34.3).
create unique index email_change_requests_one_pending on email_change_requests (account_id)
  where status = 'pending';
-- The finish time is decidedAt, or expiresAt for a request that expired while pending (NFR1.5).
create index email_change_requests_finished on email_change_requests ((coalesce(decided_at, expires_at)));
create trigger email_change_requests_touch_version before update on email_change_requests
  for each row execute function platform_touch_version();

-- The resend limit (NFR10.3): one row per accepted send, with the keyed hash of the address, never the address.
create table email_send_attempts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('invitation', 'email_change')),
  email_hash text not null check (email_hash ~ '^[a-f0-9]{64}$'),
  sent_at timestamptz not null default now()
);
create index email_send_attempts_lookup on email_send_attempts (kind, email_hash, sent_at);

-- Which family a one-off load row created, so a second run creates no duplicates (BR38.1, C17).
create table migration_loads (
  source_key text primary key check (char_length(source_key) between 1 and 200),
  organization_id uuid not null,
  family_id uuid not null,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  loaded_at timestamptz not null default now()
);

alter table parent_profiles enable row level security;
alter table email_change_requests enable row level security;
alter table email_send_attempts enable row level security;
alter table migration_loads enable row level security;
revoke all on parent_profiles, email_change_requests, email_send_attempts, migration_loads
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 2. The structure change (NFR7.4). Every parent gets a profile filled from the old contact record; every sharing
--    value is false (BR31.1). The old free-text profile and consent flag are dropped with their rules, and the
--    contact table goes after its rows were copied. A second parent with an address that an earlier one already
--    holds starts without an address, so the unique index can be built over any old data.
-- ---------------------------------------------------------------------------------------------------
insert into parent_profiles (parent_id, organization_id, email_on_record, phone, residence)
select p.id, p.organization_id,
       case when c.contact_email is not null
                 and row_number() over (partition by c.contact_email order by p.created_at, p.id) = 1
            then c.contact_email end,
       c.contact_phone,
       c.locality
  from parents p left join parent_contacts c on c.parent_id = p.id;

drop table parent_contacts;
drop function directory_parent_profile(uuid);
drop function directory_can_read_contact(uuid, uuid);
alter table parents drop column optional_profile;
alter table parents drop column optional_profile_consent;

-- Column rights of the parents table, restated for the removed columns.
revoke all on parents from public, anon, authenticated, service_role;
grant select (id, organization_id, family_id, account_id, display_name, status, version, created_at, updated_at)
  on parents to authenticated;

-- A parent reads their own profile row and a super admin every profile of the community; nobody else reads the
-- table (contacts are reached through directory_list only, BR30). The helper keeps the rule in one place.
create or replace function directory_can_read_profile(p_organization_id uuid, p_parent_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$ select current_session_is_active() and (
  has_super_scope(p_organization_id) or p_parent_id = current_parent_id()) $$;
create policy parent_profiles_read on parent_profiles for select to authenticated
  using (directory_can_read_profile(organization_id, parent_id));
grant select on parent_profiles to authenticated;

-- The audit action list keeps every existing action and adds the eight of this unit (NFR4.4).
alter table audit_events drop constraint audit_events_action_check;
alter table audit_events add constraint audit_events_action_check check (action in (
  'role.grant', 'role.revoke', 'role.first_super_admin',
  'approval.approve', 'approval.reject',
  'import.commit',
  'lifecycle.anonymize', 'lifecycle.delete', 'lifecycle.hold_place', 'lifecycle.hold_release',
  'account.deactivate', 'account.reactivate',
  'rota.publish', 'rota.discard',
  'profile.sharing_changed', 'account.password_changed', 'account.email_change_requested',
  'account.email_changed', 'family.added', 'parent.added', 'parent.removed', 'invitation.sent'
));

-- ---------------------------------------------------------------------------------------------------
-- 3. Internal helpers. Granted to nobody.
-- ---------------------------------------------------------------------------------------------------

-- The per-address advisory locks of NFR5.6, taken in ascending key order and before any row lock.
create or replace function directory_lock_addresses(p_addresses text[]) returns void
language plpgsql set search_path from current
as $$
declare v_key bigint;
begin
  for v_key in
    select distinct hashtextextended(current_schema() || '|address|'
             || encode(sha256(convert_to(lower(btrim(a)), 'UTF8')), 'hex'), 0)
      from unnest(p_addresses) as a
     where a is not null and btrim(a) <> ''
     order by 1
  loop
    perform pg_advisory_xact_lock(v_key);
  end loop;
end $$;

-- One check for every "is this address taken" question (NFR1.4): the sign-in email of any other account (or user), the
-- address on record of any other parent, or the address of an open invitation of anyone else. Whichever table
-- matched, the caller gets the same refusal.
create or replace function directory_address_taken(p_email text, p_except_account uuid, p_except_parent uuid)
returns boolean
language sql stable security definer set search_path from current
as $$
  select exists (select 1 from accounts a where a.email = p_email and a.id is distinct from p_except_account)
      or exists (select 1 from auth.users u where lower(u.email) = p_email and u.id is distinct from p_except_account)
      or exists (select 1 from parent_profiles pp
                  where pp.email_on_record = p_email and pp.parent_id is distinct from p_except_parent)
      or exists (select 1 from invitations i
                  where i.email = p_email and i.target_id is distinct from p_except_parent
                    and (i.status = 'accepting' or (i.status = 'pending' and i.expires_at > now())))
$$;

-- The resend limit (NFR10.3): three sends of one kind to one address in an hour. The row is written only when the
-- send is accepted, inside the command's transaction, so a refused try writes nothing and does not extend the
-- window. The caller already holds the address lock.
create or replace function email_send_register(p_kind text, p_email_hash text) returns void
language plpgsql security definer set search_path from current
as $$
begin
  if (select count(*) from email_send_attempts
       where kind = p_kind and email_hash = p_email_hash and sent_at > now() - interval '1 hour') >= 3 then
    perform platform_abort('conflict', 'EMAIL_RATE_LIMITED');
  end if;
  insert into email_send_attempts (kind, email_hash) values (p_kind, p_email_hash);
end $$;

-- An audit row whose actor is an account that a service-role step acts for (the password change, the email change
-- steps). The audit function proper records the database role as the actor; these steps are run by the server on
-- behalf of a signed-in account, so the account is the actor. Success rows only.
create or replace function directory_audit_as(
  p_actor uuid, p_action text, p_target_type text, p_target_id uuid, p_organization_id uuid, p_details text
) returns void
language plpgsql security definer set search_path from current
as $$
declare v_role text;
begin
  select case g.role when 'super_admin' then 'super_admin' when 'group_admin' then 'group_admin'
                     when 'kindergarten_teacher' then 'teacher' else 'parent' end
    into v_role
    from app_role_grants g
   where g.subject_id = p_actor and g.revoked_at is null and g.organization_id = p_organization_id
     and g.role in ('super_admin', 'group_admin', 'kindergarten_teacher', 'parent')
   order by case g.role when 'super_admin' then 1 when 'group_admin' then 2
                        when 'kindergarten_teacher' then 3 else 4 end
   limit 1;
  insert into audit_events (actor_account_id, actor_role, action, target_type, target_id,
                            organization_id, group_id, outcome, details)
  values (p_actor, coalesce(v_role, 'none'), p_action, p_target_type, p_target_id,
          p_organization_id, null, 'success', p_details);
end $$;

-- Makes sure a parent has a profile row (sharing off). Callers hold the parent's locks.
create or replace function directory_ensure_profile(p_parent_id uuid) returns void
language sql security definer set search_path from current
as $$
  insert into parent_profiles (parent_id, organization_id)
  select p.id, p.organization_id from parents p where p.id = p_parent_id
  on conflict (parent_id) do nothing
$$;

-- Sharing goes off (BR31.5) and the time is recorded when it was on. Used when an account is deactivated, when a link
-- starts or ends, and when a parent is removed.
create or replace function directory_unshare(p_parent_id uuid) returns void
language sql security definer set search_path from current
as $$
  update parent_profiles
     set sharing_consent = false, consent_changed_at = now()
   where parent_id = p_parent_id and sharing_consent
$$;

-- Validates and normalises one parent of an add or load payload (BR35.2). Raises through U3R00 naming the field.
create or replace function directory_normalize_parent(p_item jsonb, p_path text, p_allow_residence boolean)
returns jsonb
language plpgsql set search_path from current
as $$
declare
  v_name text;
  v_email text;
  v_phone text;
  v_residence text;
begin
  if p_item is null or jsonb_typeof(p_item) <> 'object' then
    perform platform_field_invalid(p_path);
  end if;
  v_name := btrim(coalesce(p_item->>'display_name', ''));
  if char_length(v_name) not between 1 and 200 then
    perform platform_field_invalid(p_path || '.display_name');
  end if;
  v_email := lower(btrim(coalesce(p_item->>'email', '')));
  if v_email = '' or char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    perform platform_abort('validation', 'EMAIL_INVALID', jsonb_build_object('field', p_path || '.email'));
  end if;
  v_phone := nullif(btrim(coalesce(p_item->>'phone', '')), '');
  if v_phone is not null and v_phone !~ '^[0-9 +-]{6,20}$' then
    perform platform_field_invalid(p_path || '.phone');
  end if;
  v_residence := case when p_allow_residence then nullif(btrim(coalesce(p_item->>'residence', '')), '') end;
  if v_residence is not null and char_length(v_residence) > 100 then
    perform platform_field_invalid(p_path || '.residence');
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'display_name', v_name, 'email', v_email, 'phone', v_phone, 'residence', v_residence));
end $$;

-- Ends a parent's sign-in as a directory removal does (BR36.3, the account half of C16): the account is deactivated,
-- its authorization version rises (so every screen stops at the next request) and the link is cleared. The caller
-- holds the family, the account and the parent row, in that order. Returns the account id, or null without an
-- account, so the server can ban the sign-in user and end its sessions after the commit.
create or replace function identity_end_parent_sign_in(p_parent_id uuid) returns uuid
language plpgsql security definer set search_path from current
as $$
declare
  v_parent parents%rowtype;
begin
  select * into v_parent from parents where id = p_parent_id;
  if v_parent.account_id is null then
    return null;
  end if;
  if identity_lock_super_admins(v_parent.organization_id) <= 1 and exists (
       select 1 from app_role_grants g
        where g.subject_id = v_parent.account_id and g.role = 'super_admin'
          and g.organization_id = v_parent.organization_id and g.revoked_at is null) then
    perform platform_abort('conflict', 'last_super_admin');
  end if;
  update accounts set status = 'deactivated' where id = v_parent.account_id and status = 'active';
  perform identity_bump_authorization_version(v_parent.account_id);
  update parents set account_id = null where id = p_parent_id;
  return v_parent.account_id;
end $$;

-- The removal of one parent's directory record (BR36.3). The caller holds the family, account and parent locks and
-- has checked BR36.2. Returns the account whose sign-in ended.
create or replace function directory_remove_parent_core(p_parent_id uuid) returns uuid
language plpgsql security definer set search_path from current
as $$
declare
  v_account uuid;
  v_parent parents%rowtype;
begin
  select * into v_parent from parents where id = p_parent_id;
  v_account := identity_end_parent_sign_in(p_parent_id);
  update parents set status = 'archived' where id = p_parent_id;
  perform directory_ensure_profile(p_parent_id);
  update parent_profiles
     set email_on_record = null, phone = null, residence = null, occupation = null, hobby = null,
         how_i_support = null, sharing_consent = false,
         consent_changed_at = case when sharing_consent then now() else consent_changed_at end
   where parent_id = p_parent_id;
  update invitations set status = 'revoked' where target_id = p_parent_id and status in ('pending', 'accepting');
  -- The pending address is deleted outright, so it is gone at once (security-design.md, NFR1.5).
  if v_parent.account_id is not null then
    delete from email_change_requests where account_id = v_parent.account_id;
  end if;
  perform platform_audit_write('parent.removed', 'parent', p_parent_id, v_parent.organization_id, null, 'success', null);
  return v_account;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 4. Reading the directory (W1; BR30.1 to BR30.9). One call, one set-based query. A field a viewer may not see is
--    never selected into the result. A caller without access gets a denied refusal, never an empty list (C1).
-- ---------------------------------------------------------------------------------------------------
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
           -- BR31.5: shared means ticked, active, and an account that is active.
           coalesce(pp.sharing_consent and a.status = 'active', false) as shared,
           coalesce(pp.sharing_consent, false) as consent,
           -- BR30.6: the sign-in email once the parent has an active account, else the email on record.
           case when a.status = 'active' then a.email else pp.email_on_record end as shown_email,
           pp.phone, pp.residence, pp.occupation, pp.hobby, pp.how_i_support
      from parents p
      join families f on f.id = p.family_id and f.organization_id = v_org and f.status = 'active'
      left join parent_profiles pp on pp.parent_id = p.id
      left join accounts a on a.id = p.account_id
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

-- ---------------------------------------------------------------------------------------------------
-- 5. The sharing choice and a parent's own details (W2, W3; BR31, BR32). Only the parent themself, with an active
--    account. The command names the parent, so a super admin or a co-parent who names another is refused.
-- ---------------------------------------------------------------------------------------------------
create or replace function profile_set_sharing(
  p_idempotency_key text, p_parent_id uuid, p_expected_version integer, p_sharing boolean
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'profile.set_sharing';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_family uuid;
  v_profile parent_profiles%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_parent_id::text, p_expected_version::text, p_sharing::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    -- BR31.2: only the parent themself. No current parent (a super admin who is no parent, a teacher) is refused too.
    if p_parent_id is null or current_parent_id() is distinct from p_parent_id then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null or p_sharing is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select p.family_id into v_family from parents p where p.id = p_parent_id and p.organization_id = v_org;
    perform 1 from families f where f.id = v_family for update;
    perform 1 from parents p where p.id = p_parent_id for update;
    -- Recheck under the locks: the parent may have been removed or deactivated meanwhile.
    if current_parent_id() is distinct from p_parent_id then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform directory_ensure_profile(p_parent_id);
    select * into v_profile from parent_profiles where parent_id = p_parent_id for update;
    if v_profile.version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    -- BR31.3: an unchanged value succeeds with no new audit row and no new version.
    if v_profile.sharing_consent is distinct from p_sharing then
      update parent_profiles set sharing_consent = p_sharing, consent_changed_at = now()
       where parent_id = p_parent_id;
      perform platform_audit_write('profile.sharing_changed', 'parent', p_parent_id, v_org, null,
                                   'success', p_sharing::text);
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_parent_id);
    return platform_result('success', p_parent_id, null)
      || jsonb_build_object('version', (select pp.version from parent_profiles pp where pp.parent_id = p_parent_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- Five fields, all optional in the payload (an absent key stays, an empty text clears). Every failing field is named
-- (BR32.2); nothing is stored when any fails.
create or replace function profile_update_own(
  p_idempotency_key text, p_parent_id uuid, p_expected_version integer, p_fields jsonb
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'profile.update_own';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_family uuid;
  v_profile parent_profiles%rowtype;
  v_bad text[] := '{}';
  v_phone text;
  v_residence text;
  v_occupation text;
  v_hobby text;
  v_support text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_parent_id::text, p_expected_version::text, coalesce(p_fields::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if p_parent_id is null or current_parent_id() is distinct from p_parent_id then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected_version is null or p_fields is null or jsonb_typeof(p_fields) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select p.family_id into v_family from parents p where p.id = p_parent_id and p.organization_id = v_org;
    perform 1 from families f where f.id = v_family for update;
    perform 1 from parents p where p.id = p_parent_id for update;
    if current_parent_id() is distinct from p_parent_id then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform directory_ensure_profile(p_parent_id);
    select * into v_profile from parent_profiles where parent_id = p_parent_id for update;
    if v_profile.version <> p_expected_version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;

    v_phone := v_profile.phone;
    v_residence := v_profile.residence;
    v_occupation := v_profile.occupation;
    v_hobby := v_profile.hobby;
    v_support := v_profile.how_i_support;
    if p_fields ? 'phone' then
      v_phone := nullif(btrim(coalesce(p_fields->>'phone', '')), '');
      if v_phone is not null and v_phone !~ '^[0-9 +-]{6,20}$' then v_bad := array_append(v_bad, 'phone'); end if;
    end if;
    if p_fields ? 'residence' then
      v_residence := nullif(btrim(coalesce(p_fields->>'residence', '')), '');
      if v_residence is not null and char_length(v_residence) > 100 then v_bad := array_append(v_bad, 'residence'); end if;
    end if;
    if p_fields ? 'occupation' then
      v_occupation := nullif(btrim(coalesce(p_fields->>'occupation', '')), '');
      if v_occupation is not null and char_length(v_occupation) > 100 then v_bad := array_append(v_bad, 'occupation'); end if;
    end if;
    if p_fields ? 'hobby' then
      v_hobby := nullif(btrim(coalesce(p_fields->>'hobby', '')), '');
      if v_hobby is not null and char_length(v_hobby) > 200 then v_bad := array_append(v_bad, 'hobby'); end if;
    end if;
    if p_fields ? 'how_i_support' then
      v_support := nullif(btrim(coalesce(p_fields->>'how_i_support', '')), '');
      if v_support is not null and char_length(v_support) > 500 then v_bad := array_append(v_bad, 'how_i_support'); end if;
    end if;
    if cardinality(v_bad) > 0 then
      perform platform_abort('validation', 'PROFILE_FIELD_INVALID', jsonb_build_object('fields', to_jsonb(v_bad)));
    end if;

    update parent_profiles
       set phone = v_phone, residence = v_residence, occupation = v_occupation, hobby = v_hobby,
           how_i_support = v_support
     where parent_id = p_parent_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_parent_id);
    return platform_result('success', p_parent_id, null)
      || jsonb_build_object('version', (select pp.version from parent_profiles pp where pp.parent_id = p_parent_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 6. Password and email change (W4, W5; BR33, BR34). The app server checks the password first and then calls these
--    steps for the account it checked; they are granted to the service role only (NFR3.5, NFR3.6). Each checks that
--    the account it is given is active and linked to a current parent.
-- ---------------------------------------------------------------------------------------------------

-- The audit row of a password change, written by the server after the sign-in service confirmed the change
-- (security-design.md, Audit Design).
create or replace function account_password_changed(p_account_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_account accounts%rowtype;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  select * into v_account from accounts where id = p_account_id;
  if not found then
    return platform_result('validation', null, 'account_not_found');
  end if;
  perform directory_audit_as(v_account.id, 'account.password_changed', 'account', v_account.id,
                             v_account.organization_id, null);
  return platform_result('success', v_account.id, null);
end $$;

-- The pending request of an account, for the panel "Bejelentkezés" (the one place the pending address is shown, to
-- the account it belongs to, through the server).
create or replace function email_change_pending(p_account_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_request email_change_requests%rowtype;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  select * into v_request from email_change_requests
   where account_id = p_account_id and status = 'pending' and expires_at > now();
  if not found then
    return platform_result('success', null, 'none');
  end if;
  return platform_result('success', v_request.id, 'pending')
    || jsonb_build_object('new_email', v_request.new_email, 'expires_at', v_request.expires_at);
end $$;

-- Asks for a change (BR34.1 to BR34.3). A null address means "Új levél": a new link for the pending request's
-- address. Any pending request becomes replaced and a new one is made, in one transaction.
create or replace function email_change_request(
  p_idempotency_key text, p_account_id uuid, p_new_email text, p_token_hash text, p_email_hash text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'email_change.request';
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_account accounts%rowtype;
  v_family uuid;
  v_parent uuid;
  v_email text;
  v_id uuid;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
     or p_account_id is null or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
     or p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' then
    return platform_result('validation', null, 'request_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_account_id::text, lower(btrim(coalesce(p_new_email, '')))), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    select * into v_account from accounts where id = p_account_id;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select p.family_id, p.id into v_family, v_parent
      from parents p join families f on f.id = p.family_id
     where p.account_id = p_account_id and p.status = 'active' and f.status = 'active';
    if v_account.status <> 'active' or v_family is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_new_email is null then
      select r.new_email into v_email from email_change_requests r
       where r.account_id = p_account_id and r.status = 'pending';
      if v_email is null then
        perform platform_abort('conflict', 'EMAIL_REQUEST_NOT_PENDING');
      end if;
    else
      v_email := lower(btrim(p_new_email));
      if char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
         or v_email = v_account.email then
        perform platform_abort('validation', 'EMAIL_INVALID');
      end if;
    end if;

    -- The address lock first, then the family, account and parent rows, then the request rows.
    perform directory_lock_addresses(array[v_email]);
    perform 1 from families f where f.id = v_family for update;
    select * into v_account from accounts where id = p_account_id for update;
    perform 1 from parents p where p.id = v_parent for update;
    if v_account.status <> 'active' or not exists (
         select 1 from parents p join families f on f.id = p.family_id
          where p.id = v_parent and p.account_id = p_account_id and p.status = 'active' and f.status = 'active') then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform 1 from email_change_requests r where r.account_id = p_account_id and r.status = 'pending'
      order by r.id for update;

    if directory_address_taken(v_email, p_account_id, v_parent) then
      perform platform_abort('validation', 'EMAIL_UNAVAILABLE');
    end if;
    perform email_send_register('email_change', p_email_hash);

    update email_change_requests set status = 'replaced', decided_at = now()
     where account_id = p_account_id and status = 'pending';
    insert into email_change_requests (account_id, new_email, token_hash)
    values (p_account_id, v_email, p_token_hash) returning id into v_id;
    perform directory_audit_as(p_account_id, 'account.email_change_requested', 'account', p_account_id,
                               v_account.organization_id, null);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- "Mégse": the pending request becomes cancelled (BR34.3).
create or replace function email_change_cancel(p_idempotency_key text, p_account_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'email_change.cancel';
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_account accounts%rowtype;
  v_family uuid;
  v_parent uuid;
  v_id uuid;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 or p_account_id is null then
    return platform_result('validation', null, 'request_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(p_account_id::text, 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    select * into v_account from accounts where id = p_account_id;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select p.family_id, p.id into v_family, v_parent
      from parents p join families f on f.id = p.family_id
     where p.account_id = p_account_id and p.status = 'active' and f.status = 'active';
    if v_account.status <> 'active' or v_family is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform 1 from families f where f.id = v_family for update;
    select * into v_account from accounts where id = p_account_id for update;
    perform 1 from parents p where p.id = v_parent for update;
    if v_account.status <> 'active' or not exists (
         select 1 from parents p join families f on f.id = p.family_id
          where p.id = v_parent and p.account_id = p_account_id and p.status = 'active' and f.status = 'active') then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    select r.id into v_id from email_change_requests r
     where r.account_id = p_account_id and r.status = 'pending' order by r.id for update;
    if v_id is null then
      perform platform_abort('conflict', 'EMAIL_REQUEST_NOT_PENDING');
    end if;
    update email_change_requests set status = 'cancelled', decided_at = now() where id = v_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- Opening the link (BR34.4, BR34.6). Not a signed-in command: the server calls it with the token, for whoever opened
-- the link. In one transaction it rechecks the address, lifts the sign-in email guard for this transaction only, and
-- changes the sign-in email, the account email and the email on record together. Every other route that changes a
-- sign-in email stays refused. A repeated call finds the request no longer pending.
create or replace function email_change_confirm(p_token_hash text) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_request email_change_requests%rowtype;
  v_account accounts%rowtype;
  v_family uuid;
  v_parent uuid;
  v_old text;
  v_detail text;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return platform_result('terminal', null, 'EMAIL_LINK_INVALID');
  end if;

  begin
    select * into v_request from email_change_requests where token_hash = p_token_hash;
    if not found then
      perform platform_abort('terminal', 'EMAIL_LINK_INVALID');
    end if;
    select p.family_id, p.id into v_family, v_parent
      from parents p join families f on f.id = p.family_id
     where p.account_id = v_request.account_id and p.status = 'active' and f.status = 'active';
    if v_family is null then
      perform platform_abort('terminal', 'EMAIL_LINK_INVALID');
    end if;

    perform directory_lock_addresses(array[v_request.new_email]);
    perform 1 from families f where f.id = v_family for update;
    select * into v_account from accounts where id = v_request.account_id for update;
    perform 1 from parents p where p.id = v_parent for update;
    select * into v_request from email_change_requests where id = v_request.id for update;
    if v_request.status <> 'pending' or v_request.expires_at <= now() or v_account.status <> 'active'
       or not exists (select 1 from parents p join families f on f.id = p.family_id
                       where p.id = v_parent and p.account_id = v_account.id
                         and p.status = 'active' and f.status = 'active') then
      perform platform_abort('terminal', 'EMAIL_LINK_INVALID');
    end if;

    -- BR34.2 again: if the address was taken between the request and the link, the request is cancelled and the same
    -- fixed refusal is shown. The cancellation must commit, so this is a normal return and not an abort.
    if directory_address_taken(v_request.new_email, v_account.id, v_parent) then
      update email_change_requests set status = 'cancelled', decided_at = now() where id = v_request.id;
      return platform_result('validation', null, 'EMAIL_UNAVAILABLE');
    end if;

    v_old := v_account.email;
    perform set_config('app.identity_email_change', 'allowed', true);
    update auth.users set email = v_request.new_email where id = v_account.id;
    update auth.identities set identity_data = identity_data || jsonb_build_object('email', v_request.new_email)
     where user_id = v_account.id;
    perform set_config('app.identity_email_change', '', true);
    update accounts set email = v_request.new_email where id = v_account.id;
    perform directory_ensure_profile(v_parent);
    update parent_profiles set email_on_record = v_request.new_email where parent_id = v_parent;
    update email_change_requests set status = 'confirmed', decided_at = now() where id = v_request.id;
    perform directory_audit_as(v_account.id, 'account.email_changed', 'account', v_account.id,
                               v_account.organization_id, null);
    return platform_result('success', v_account.id, null) || jsonb_build_object('previous_email', v_old);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 7. Adding and editing records, removing a parent, and invitations (W6 to W8; BR35 to BR37). A super admin only
--    (BR35.1); a parent, teacher or group administrator gets the same denied result whatever they send.
-- ---------------------------------------------------------------------------------------------------
create or replace function family_add(p_idempotency_key text, p_family jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'family.add';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_name text;
  v_parents jsonb;
  v_children jsonb;
  v_item jsonb;
  v_norm jsonb;
  v_list jsonb[] := '{}';
  v_emails text[] := '{}';
  v_email text;
  v_family uuid;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_index integer := 0;
  v_child text;
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
    if not coalesce(has_super_scope(v_org), false) then
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
    if char_length(v_name) not between 1 and 200 then
      perform platform_field_invalid('display_name');
    end if;
    if jsonb_array_length(v_parents) = 0 then
      perform platform_field_invalid('parents', 'required');
    end if;
    for v_item in select value from jsonb_array_elements(v_parents) loop
      v_norm := directory_normalize_parent(v_item, 'parents', false);
      v_list := v_list || v_norm;
      v_emails := v_emails || (v_norm->>'email');
    end loop;
    for v_item in select value from jsonb_array_elements(v_children) loop
      if jsonb_typeof(v_item) <> 'object' or char_length(btrim(coalesce(v_item->>'display_name', ''))) not between 1 and 200 then
        perform platform_field_invalid('children.display_name');
      end if;
    end loop;

    -- The address locks come before any row lock; two equal addresses in one payload are one taken address.
    perform directory_lock_addresses(v_emails);
    if (select count(distinct e) from unnest(v_emails) as e) <> cardinality(v_emails) then
      perform platform_abort('validation', 'EMAIL_UNAVAILABLE', jsonb_build_object('field', 'parents.email'));
    end if;
    foreach v_email in array v_emails loop
      if directory_address_taken(v_email, null, null) then
        perform platform_abort('validation', 'EMAIL_UNAVAILABLE', jsonb_build_object('field', 'parents.email'));
      end if;
    end loop;

    insert into families (organization_id, display_name) values (v_org, v_name) returning id into v_family;
    foreach v_norm in array v_list loop
      insert into parents (organization_id, family_id, display_name)
      values (v_org, v_family, v_norm->>'display_name') returning id into v_id;
      insert into parent_profiles (parent_id, organization_id, email_on_record, phone)
      values (v_id, v_org, v_norm->>'email', v_norm->>'phone');
      v_ids := v_ids || v_id;
      perform platform_audit_write('parent.added', 'parent', v_id, v_org, null, 'success', null);
    end loop;
    for v_item in select value from jsonb_array_elements(v_children) loop
      insert into children (organization_id, family_id, display_name)
      values (v_org, v_family, btrim(v_item->>'display_name'));
    end loop;
    perform platform_audit_write('family.added', 'family', v_family, v_org, null, 'success', null);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_family);
    return platform_result('success', v_family, null) || jsonb_build_object('parent_ids', to_jsonb(v_ids));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- One more parent for an existing family. The family's version is the screen's version: an outdated page is refused.
create or replace function parent_add(p_idempotency_key text, p_family_id uuid, p_expected_version integer, p_parent jsonb)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'parent.add';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_norm jsonb;
  v_family families%rowtype;
  v_id uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_family_id::text, p_expected_version::text, coalesce(p_parent::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not coalesce(has_super_scope(v_org), false) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_family_id is null or p_expected_version is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    v_norm := directory_normalize_parent(p_parent, 'parent', false);
    perform directory_lock_addresses(array[v_norm->>'email']);
    -- A family of another community answers like a missing one.
    select * into v_family from families where id = p_family_id and organization_id = v_org for update;
    if not found then
      perform platform_abort('validation', 'family_not_found');
    end if;
    if v_family.version <> p_expected_version or v_family.status <> 'active' then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if (select count(*) from parents p where p.family_id = p_family_id and p.status = 'active') >= 10 then
      perform platform_abort('validation', 'request_invalid');
    end if;
    if directory_address_taken(v_norm->>'email', null, null) then
      perform platform_abort('validation', 'EMAIL_UNAVAILABLE', jsonb_build_object('field', 'parent.email'));
    end if;
    insert into parents (organization_id, family_id, display_name)
    values (v_org, p_family_id, v_norm->>'display_name') returning id into v_id;
    insert into parent_profiles (parent_id, organization_id, email_on_record, phone)
    values (v_id, v_org, v_norm->>'email', v_norm->>'phone');
    update families set updated_at = now() where id = p_family_id;
    perform platform_audit_write('parent.added', 'parent', v_id, v_org, null, 'success', null);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null)
      || jsonb_build_object('family_version', (select f.version from families f where f.id = p_family_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- Editing a parent (BR35.4): the full name, the phone and, while there is no account, the email on record. The
-- profile fields and the sharing choice are the parent's own and are not editable here. Absent keys stay.
create or replace function parent_edit(p_idempotency_key text, p_parent_id uuid, p_expected_version integer, p_fields jsonb)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'parent.edit';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent parents%rowtype;
  v_profile parent_profiles%rowtype;
  v_new_email text;
  v_name text;
  v_phone text;
  v_email text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_parent_id::text, p_expected_version::text, coalesce(p_fields::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not coalesce(has_super_scope(v_org), false) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_parent_id is null or p_expected_version is null or p_fields is null or jsonb_typeof(p_fields) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_parent from parents where id = p_parent_id and organization_id = v_org;
    if not found then
      perform platform_abort('validation', 'parent_not_found');
    end if;
    if p_fields ? 'email' then
      v_new_email := lower(btrim(coalesce(p_fields->>'email', '')));
      if v_new_email = '' or char_length(v_new_email) > 254
         or v_new_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
        perform platform_abort('validation', 'EMAIL_INVALID', jsonb_build_object('field', 'email'));
      end if;
    end if;
    perform directory_lock_addresses(array[v_new_email]);
    perform 1 from families f where f.id = v_parent.family_id for update;
    if v_parent.account_id is not null then
      perform 1 from accounts a where a.id = v_parent.account_id for update;
    end if;
    select * into v_parent from parents where id = p_parent_id for update;
    if v_parent.version <> p_expected_version or v_parent.status <> 'active' then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    perform directory_ensure_profile(p_parent_id);
    select * into v_profile from parent_profiles where parent_id = p_parent_id for update;

    v_name := v_parent.display_name;
    if p_fields ? 'display_name' then
      v_name := btrim(coalesce(p_fields->>'display_name', ''));
      if char_length(v_name) not between 1 and 200 then
        perform platform_field_invalid('display_name');
      end if;
    end if;
    v_phone := v_profile.phone;
    if p_fields ? 'phone' then
      v_phone := nullif(btrim(coalesce(p_fields->>'phone', '')), '');
      if v_phone is not null and v_phone !~ '^[0-9 +-]{6,20}$' then
        perform platform_field_invalid('phone');
      end if;
    end if;
    v_email := v_profile.email_on_record;
    if v_new_email is not null and v_new_email is distinct from v_profile.email_on_record then
      -- Once an account is linked, the email changes only through the parent's own request (BR35.4).
      if v_parent.account_id is not null then
        perform platform_abort('denied', 'authorization_denied', jsonb_build_object('field', 'email'));
      end if;
      if directory_address_taken(v_new_email, null, p_parent_id) then
        perform platform_abort('validation', 'EMAIL_UNAVAILABLE', jsonb_build_object('field', 'email'));
      end if;
      v_email := v_new_email;
    end if;

    update parents set display_name = v_name where id = p_parent_id;
    update parent_profiles set email_on_record = v_email, phone = v_phone where parent_id = p_parent_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_parent_id);
    return platform_result('success', p_parent_id, null)
      || jsonb_build_object('version', (select p.version from parents p where p.id = p_parent_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- Removing a parent (W7; BR36.1 to BR36.3). The family row first, then the account, then the parent (NFR5.6). The
-- result names the account whose sign-in ended, so the server can ban the sign-in user and end its sessions.
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
  v_account uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_parent_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
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
    perform 1 from families f where f.id = v_parent.family_id for update;
    if v_parent.account_id is not null then
      perform 1 from accounts a where a.id = v_parent.account_id for update;
    end if;
    select * into v_parent from parents where id = p_parent_id for update;
    if v_parent.version <> p_expected_version or v_parent.status <> 'active' then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if (select count(*) from parents p where p.family_id = v_parent.family_id and p.status = 'active') <= 1 then
      perform platform_abort('conflict', 'PARENT_LAST_IN_FAMILY');
    end if;
    v_account := directory_remove_parent_core(p_parent_id);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_parent_id);
    return platform_result('success', p_parent_id, null) || jsonb_build_object('account_id', v_account);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- Sends an invitation to a parent without an account (W8; BR37.1). The server makes the token and its hash and sends
-- the mail after the commit; an open invitation of the parent is replaced.
create or replace function invitation_send(
  p_idempotency_key text, p_parent_id uuid, p_token_hash text, p_email_hash text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'invitation.send';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent parents%rowtype;
  v_email text;
  v_family_status text;
  v_old uuid;
  v_id uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(p_parent_id::text, 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if not coalesce(has_super_scope(v_org), false) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_parent_id is null or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
       or p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_parent from parents where id = p_parent_id and organization_id = v_org;
    if not found then
      perform platform_abort('validation', 'parent_not_found');
    end if;
    select pp.email_on_record into v_email from parent_profiles pp where pp.parent_id = p_parent_id;
    if v_email is null then
      perform platform_abort('validation', 'EMAIL_INVALID', jsonb_build_object('field', 'email'));
    end if;

    perform directory_lock_addresses(array[v_email]);
    perform 1 from families f where f.id = v_parent.family_id for update;
    select * into v_parent from parents where id = p_parent_id for update;
    select f.status into v_family_status from families f where f.id = v_parent.family_id;
    if v_parent.status <> 'active' or v_family_status <> 'active' then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    if v_parent.account_id is not null then
      perform platform_abort('conflict', 'PARENT_HAS_ACCOUNT');
    end if;
    select pp.email_on_record into v_email from parent_profiles pp where pp.parent_id = p_parent_id;
    if v_email is null then
      perform platform_abort('validation', 'EMAIL_INVALID', jsonb_build_object('field', 'email'));
    end if;
    if directory_address_taken(v_email, null, p_parent_id) then
      perform platform_abort('validation', 'EMAIL_UNAVAILABLE', jsonb_build_object('field', 'email'));
    end if;

    perform invitation_release_stale();
    perform 1 from invitations i where i.target_id = p_parent_id order by i.id for update;
    if exists (select 1 from invitations i where i.target_id = p_parent_id and i.status = 'accepting') then
      perform platform_abort('conflict', 'INVITATION_BUSY');
    end if;
    select i.id into v_old from invitations i where i.target_id = p_parent_id and i.status = 'pending';
    perform email_send_register('invitation', p_email_hash);
    update invitations set status = 'replaced' where target_id = p_parent_id and status = 'pending';
    insert into invitations (email, role, scope_type, scope_id, organization_id, target_id, token_hash,
                             created_by_account_id, replaces_invitation_id)
    values (v_email, 'parent', 'family', v_parent.family_id, v_org, p_parent_id, p_token_hash,
            platform_actor_account(), v_old)
    returning id into v_id;
    perform platform_audit_write('invitation.sent', 'invitation', v_id, v_org, null, 'success', null);
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 8. The removal steps of C16 (BR36.4). Internal: called from the lifecycle functions only, which lock the family row
--    first. Each returns { to_clear, to_flag }; the directory flags nothing.
-- ---------------------------------------------------------------------------------------------------
create or replace function directory_removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare v_count integer := 0;
begin
  if p_subject_kind = 'parent' then
    select count(*) into v_count from parents p where p.id = p_subject_id and p.status = 'active';
  elsif p_subject_kind = 'family' then
    select count(*) into v_count from parents p where p.family_id = p_subject_id and p.status = 'active';
  end if;
  return jsonb_build_object('to_clear', v_count, 'to_flag', 0);
end $$;

create or replace function directory_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_parent parents%rowtype;
  v_family uuid;
  v_ids uuid[];
  v_accounts uuid[];
  v_id uuid;
  v_account uuid;
  v_count integer := 0;
begin
  if p_subject_kind = 'parent' then
    select * into v_parent from parents where id = p_subject_id;
    if not found or v_parent.status <> 'active' then
      return jsonb_build_object('to_clear', 0, 'to_flag', 0);
    end if;
    v_family := v_parent.family_id;
  elsif p_subject_kind = 'family' then
    v_family := p_subject_id;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0);
  end if;

  -- Family row first, then the accounts ascending, then the parents ascending.
  perform 1 from families f where f.id = v_family for update;
  if p_subject_kind = 'parent' then
    select array_agg(p.account_id order by p.account_id) filter (where p.account_id is not null), array[p.id]
      into v_accounts, v_ids from parents p where p.id = p_subject_id group by p.id;
    if (select count(*) from parents p where p.family_id = v_family and p.status = 'active') <= 1 then
      perform platform_abort('conflict', 'PARENT_LAST_IN_FAMILY');
    end if;
  else
    select coalesce(array_agg(p.account_id order by p.account_id) filter (where p.account_id is not null), '{}'),
           coalesce(array_agg(p.id order by p.id), '{}')
      into v_accounts, v_ids from parents p where p.family_id = v_family and p.status = 'active';
  end if;
  perform 1 from accounts a where a.id = any (coalesce(v_accounts, '{}')) order by a.id for update;
  perform 1 from parents p where p.id = any (coalesce(v_ids, '{}')) order by p.id for update;

  foreach v_id in array coalesce(v_ids, '{}') loop
    perform directory_remove_parent_core(v_id);
    v_count := v_count + 1;
  end loop;
  if p_subject_kind = 'family' then
    update children set status = 'archived' where family_id = v_family and status <> 'archived';
    update families set status = 'archived', archived_at = now() where id = v_family and status <> 'archived';
  end if;
  return jsonb_build_object('to_clear', v_count, 'to_flag', 0);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 9. The one-off load (C17, BR38.1). Service role only; one family per call; a second call with the same source key
--    creates nothing and returns the stored result. Residence is loaded; occupation, hobby, how I support and the
--    sharing choice are not, so every parent starts unshared. No invitation is sent. A bad payload names the field,
--    never a value.
-- ---------------------------------------------------------------------------------------------------
create or replace function migration_load_family(p_source_key text, p_organization_id uuid, p_family jsonb)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_hash text;
  v_detail text;
  v_load migration_loads%rowtype;
  v_name text;
  v_parents jsonb;
  v_children jsonb;
  v_item jsonb;
  v_norm jsonb;
  v_list jsonb[] := '{}';
  v_emails text[] := '{}';
  v_email text;
  v_family uuid;
  v_id uuid;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_source_key is null or char_length(p_source_key) not between 1 and 200
     or p_organization_id is null or p_family is null or jsonb_typeof(p_family) <> 'object'
     or not exists (select 1 from organizations o where o.id = p_organization_id) then
    return platform_result('validation', null, 'request_invalid');
  end if;
  v_hash := encode(sha256(convert_to(p_family::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(current_schema() || '|load|' || p_source_key, 0));
  select * into v_load from migration_loads where source_key = p_source_key;
  if found then
    if v_load.payload_hash = v_hash and v_load.organization_id = p_organization_id then
      return platform_result('success', v_load.family_id, 'replayed');
    end if;
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_name := btrim(coalesce(p_family->>'display_name', ''));
    v_parents := coalesce(p_family->'parents', '[]'::jsonb);
    v_children := coalesce(p_family->'children', '[]'::jsonb);
    if jsonb_typeof(v_parents) <> 'array' or jsonb_typeof(v_children) <> 'array'
       or jsonb_array_length(v_parents) > 10 or jsonb_array_length(v_children) > 20 then
      perform platform_abort('validation', 'request_invalid');
    end if;
    if char_length(v_name) not between 1 and 200 then
      perform platform_field_invalid('display_name');
    end if;
    if jsonb_array_length(v_parents) = 0 then
      perform platform_field_invalid('parents', 'required');
    end if;
    for v_item in select value from jsonb_array_elements(v_parents) loop
      v_norm := directory_normalize_parent(v_item, 'parents', true);
      v_list := v_list || v_norm;
      v_emails := v_emails || (v_norm->>'email');
    end loop;
    for v_item in select value from jsonb_array_elements(v_children) loop
      if jsonb_typeof(v_item) <> 'object' or char_length(btrim(coalesce(v_item->>'display_name', ''))) not between 1 and 200 then
        perform platform_field_invalid('children.display_name');
      end if;
    end loop;

    perform directory_lock_addresses(v_emails);
    if (select count(distinct e) from unnest(v_emails) as e) <> cardinality(v_emails) then
      perform platform_abort('validation', 'EMAIL_UNAVAILABLE', jsonb_build_object('field', 'parents.email'));
    end if;
    foreach v_email in array v_emails loop
      if directory_address_taken(v_email, null, null) then
        perform platform_abort('validation', 'EMAIL_UNAVAILABLE', jsonb_build_object('field', 'parents.email'));
      end if;
    end loop;

    insert into families (organization_id, display_name) values (p_organization_id, v_name) returning id into v_family;
    foreach v_norm in array v_list loop
      insert into parents (organization_id, family_id, display_name)
      values (p_organization_id, v_family, v_norm->>'display_name') returning id into v_id;
      insert into parent_profiles (parent_id, organization_id, email_on_record, phone, residence)
      values (v_id, p_organization_id, v_norm->>'email', v_norm->>'phone', v_norm->>'residence');
    end loop;
    for v_item in select value from jsonb_array_elements(v_children) loop
      insert into children (organization_id, family_id, display_name)
      values (p_organization_id, v_family, btrim(v_item->>'display_name'));
    end loop;
    insert into migration_loads (source_key, organization_id, family_id, payload_hash)
    values (p_source_key, p_organization_id, v_family, v_hash);
    perform platform_audit_write('family.added', 'family', v_family, p_organization_id, null, 'success', 'migration');
    return platform_result('success', v_family, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 10. Live functions redefined for the new structure (functional-spec.md, "Existing Code That Changes"). Each body
--     starts from its latest definition.
-- ---------------------------------------------------------------------------------------------------

-- The account-status step: deactivation sets the sharing choice to false (BR31.5), and the locks follow the order of
-- NFR5.6 (the family row of the linked parent first, then the account, then the parent; 20261018 locked the account
-- first). Otherwise the body of 20261018.
create or replace function identity_set_account_status(p_idempotency_key text, p_account_id uuid, p_status text)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_operation text;
  v_action text;
  v_org uuid;
  v_account accounts%rowtype;
  v_fingerprint text;
  v_check jsonb;
  v_family uuid;
  v_parent uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_operation := case p_status when 'deactivated' then 'account.deactivate' else 'account.reactivate' end;
  v_action := v_operation;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(coalesce(p_account_id::text, ''), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(v_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  -- The family of the linked parent is read without a lock, then locked first.
  select p.family_id, p.id into v_family, v_parent from parents p where p.account_id = p_account_id;
  if v_family is not null then
    perform 1 from families f where f.id = v_family for update;
  end if;
  select * into v_account from accounts where id = p_account_id for update;
  if v_parent is not null then
    perform 1 from parents p where p.id = v_parent for update;
  end if;
  if not found or v_account.organization_id is distinct from v_org then
    return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
      coalesce(p_account_id, platform_system_account()), coalesce(v_org, platform_system_account()), null,
      'validation', null, 'account_not_found', null);
  end if;
  if not has_super_scope(v_account.organization_id) then
    return identity_deny(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account', v_account.id,
      v_account.organization_id, null, v_operation);
  end if;
  if v_account.status = p_status then
    return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
      v_account.id, v_account.organization_id, null, 'conflict', null, 'account_status_unchanged', null);
  end if;
  if p_status = 'deactivated' and identity_lock_super_admins(v_account.organization_id) <= 1 and exists (
       select 1 from app_role_grants g where g.subject_id = v_account.id and g.role = 'super_admin'
          and g.organization_id = v_account.organization_id and g.revoked_at is null) then
    return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
      v_account.id, v_account.organization_id, null, 'conflict', null, 'last_super_admin', null);
  end if;

  update accounts set status = p_status where id = v_account.id;
  if p_status = 'deactivated' and v_parent is not null then
    perform directory_unshare(v_parent);
  end if;
  perform identity_bump_authorization_version(v_account.id);
  return platform_finish_operation(v_operation, p_idempotency_key, v_fingerprint, v_action, 'account',
    v_account.id, v_account.organization_id, null, 'success', v_account.id, null, p_status);
end $$;

-- The link of an accepted invitation to its target parent (BR37.3): the family row first, then the parent (the account
-- does not exist yet), and the sharing choice stays off. Otherwise the body of 20261030.
create or replace function invitation_accept_parent(p_invitation_id uuid, p_account_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_inv invitations%rowtype;
  v_parent parents%rowtype;
  v_family_status text;
begin
  select * into v_inv from invitations where id = p_invitation_id;
  if not found or v_inv.role <> 'parent' or v_inv.target_id is null then
    return platform_result('success', null, 'no_target');
  end if;
  select p.family_id into v_parent.family_id from parents p where p.id = v_inv.target_id;
  perform 1 from families f where f.id = v_parent.family_id for update;
  select * into v_parent from parents
   where id = v_inv.target_id and organization_id = v_inv.organization_id for update;
  if not found or v_parent.family_id <> v_inv.scope_id or v_parent.status <> 'active' then
    return platform_result('conflict', null, 'TARGET_INVALID');
  end if;
  select f.status into v_family_status from families f where f.id = v_parent.family_id;
  if v_family_status is distinct from 'active' then
    return platform_result('conflict', null, 'TARGET_INVALID');
  end if;
  if v_parent.account_id is not null then
    return platform_result('conflict', null, 'PARENT_ALREADY_LINKED');
  end if;
  if exists (select 1 from parents p where p.account_id = p_account_id) then
    return platform_result('conflict', null, 'ACCOUNT_ALREADY_LINKED');
  end if;
  update parents set account_id = p_account_id where id = v_parent.id;
  perform directory_ensure_profile(v_parent.id);
  perform directory_unshare(v_parent.id);
  return platform_result('success', v_parent.id, 'linked');
exception when unique_violation then
  return platform_result('conflict', null, 'ACCOUNT_ALREADY_LINKED');
end $$;

-- The acceptance of an invitation, with the locks in the order of NFR5.6: the target's family, the parent, then the
-- invitation row (20261030 locked the invitation first). Otherwise the body of 20261030.
create or replace function invitation_accept(p_idempotency_key text, p_invitation_id uuid, p_account_id uuid)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'invitation.accept';
  v_inv invitations%rowtype;
  v_fingerprint text;
  v_link jsonb;
  v_family uuid;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
     or p_invitation_id is null or p_account_id is null then
    return platform_result('validation', null, 'request_invalid');
  end if;
  select * into v_inv from invitations where id = p_invitation_id;
  if found and v_inv.target_id is not null then
    select p.family_id into v_family from parents p where p.id = v_inv.target_id;
    perform 1 from families f where f.id = v_family for update;
    perform 1 from parents p where p.id = v_inv.target_id for update;
  end if;
  select * into v_inv from invitations where id = p_invitation_id for update;
  if not found then
    return platform_result('validation', null, 'invitation_not_valid');
  end if;
  v_fingerprint := encode(sha256(convert_to(v_inv.token_hash, 'UTF8')), 'hex');
  if v_inv.status <> 'accepting' or v_inv.reserved_at is null or v_inv.reserved_at <= now() - interval '2 minutes' then
    return platform_result('validation', null, 'invitation_not_reserved');
  end if;
  if not exists (select 1 from auth.users u where u.id = p_account_id and lower(u.email) = v_inv.email) then
    return platform_result('validation', null, 'sign_in_user_missing');
  end if;
  if exists (select 1 from accounts a where a.id = p_account_id or a.email = v_inv.email) then
    return platform_result('conflict', null, 'account_exists');
  end if;

  v_link := invitation_accept_parent(v_inv.id, p_account_id);
  if v_link->>'state' <> 'success' then
    update invitations set status = 'pending', reserved_at = null where id = v_inv.id and status = 'accepting';
    return v_link;
  end if;

  insert into accounts (id, email, organization_id) values (p_account_id, v_inv.email, v_inv.organization_id);
  insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id, granted_by_account_id)
  values (p_account_id, v_inv.role, v_inv.scope_type, v_inv.scope_id, v_inv.organization_id, v_inv.created_by_account_id);
  insert into app_authorization_versions (subject_id, authorization_version) values (p_account_id, 1)
  on conflict (subject_id) do update set authorization_version = app_authorization_versions.authorization_version + 1;
  update invitations
     set status = 'accepted', accepted_at = now(), accepted_account_id = p_account_id, reserved_at = null
   where id = v_inv.id;
  return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'role.grant', 'invitation',
    v_inv.id, v_inv.organization_id, identity_scope_group(v_inv.organization_id, v_inv.scope_type, v_inv.scope_id),
    'success', p_account_id, null, 'invitation:' || v_inv.id::text);
end $$;

-- The records save function (BR35.2 to BR35.4): the body of 20261047 without the profile text, the consent flag and
-- the locality. A parent sends `contact: {email, phone}`; the email is the email on record and is checked under the
-- address lock. Once an account is linked the email on record changes only through the parent's own request. Linking
-- or unlinking an account sets the sharing choice to false (BR31.5).
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
  v_email text;
  v_phone text;
  v_has_contact boolean;
  v_link boolean;
  v_account uuid;
  v_addresses text[];
  v_stored_email text;
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
    if not coalesce(has_super_scope(v_org), false) then
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

    -- Every address of the payload is locked first, in ascending key order (NFR5.6).
    select coalesce(array_agg(lower(btrim(x->'contact'->>'email'))), '{}') into v_addresses
      from jsonb_array_elements(v_parents) as x
     where jsonb_typeof(x) = 'object' and jsonb_typeof(x->'contact') = 'object';
    perform directory_lock_addresses(v_addresses);

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
      v_has_contact := false;
      if v_item->'contact' is not null and jsonb_typeof(v_item->'contact') <> 'null' then
        v_contact := v_item->'contact';
        if jsonb_typeof(v_contact) <> 'object' then
          perform platform_field_invalid('parents.contact');
        end if;
        v_has_contact := true;
        v_email := nullif(lower(btrim(coalesce(v_contact->>'email', ''))), '');
        v_phone := nullif(btrim(coalesce(v_contact->>'phone', '')), '');
        if v_email is not null and (char_length(v_email) > 254
           or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') then
          perform platform_field_invalid('parents.contact.email');
        end if;
        if v_phone is not null and v_phone !~ '^[0-9 +-]{6,20}$' then
          perform platform_field_invalid('parents.contact.phone');
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
      -- The email on record: free, and not changed behind an account's back (BR35.3, BR35.4).
      if v_has_contact and v_email is not null then
        v_stored_email := null;
        if v_id is not null then
          select pp.email_on_record into v_stored_email from parent_profiles pp where pp.parent_id = v_id;
        end if;
        if v_email is distinct from v_stored_email then
          if v_parent.account_id is not null then
            perform platform_abort('denied', 'authorization_denied', jsonb_build_object('field', 'parents.contact.email'));
          end if;
          if directory_address_taken(v_email, null, v_id) then
            perform platform_abort('validation', 'EMAIL_UNAVAILABLE', jsonb_build_object('field', 'parents.contact.email'));
          end if;
        end if;
      end if;
      begin
        if v_id is null then
          insert into parents (organization_id, family_id, display_name, account_id)
          values (v_org, v_family_id, v_text, v_account)
          returning id into v_id;
        else
          update parents
             set display_name = v_text,
                 account_id = case when v_link then v_account else account_id end
           where id = v_id;
        end if;
      exception when unique_violation then
        perform platform_abort('conflict', 'ACCOUNT_ALREADY_LINKED');
      end;
      perform directory_ensure_profile(v_id);
      if v_has_contact then
        update parent_profiles set email_on_record = v_email, phone = v_phone where parent_id = v_id;
      end if;
      if v_link and v_account is distinct from v_parent.account_id then
        perform directory_unshare(v_id);
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

-- The lifecycle (BR36.3, NFR11.1): the body of 20261047 with the profile cleared as a removal clears it. The
-- profiles and the pending email requests of the family's parents go in both outcomes.
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

-- Housekeeping: the version of 20261047 (every existing deletion kept) with two more: finished email-change requests
-- more than 30 days after their finish time (decidedAt, or expiresAt for one that expired pending), and resend rows
-- older than 24 hours (NFR1.5, NFR10.3).
create or replace function identity_housekeeping() returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_attempts integer; v_pruned integer; v_users integer; v_invitations integer; v_expired integer;
  v_released integer; v_audit integer := 0; v_audit_failed boolean := false;
  v_requests integer; v_sends integer;
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
  delete from email_change_requests where coalesce(decided_at, expires_at) < now() - interval '30 days';
  get diagnostics v_requests = row_count;
  delete from email_send_attempts where sent_at < now() - interval '24 hours';
  get diagnostics v_sends = row_count;
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
    'email_requests_removed', v_requests, 'send_attempts_removed', v_sends,
    'audit_events_purged', v_audit, 'audit_purge_failed', v_audit_failed);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 11. Function rights (C1, NFR3.6). Every new function starts with no rights. `create or replace` keeps the rights of
--     the functions it replaces (the account-status step, the invitation steps, the records save, the lifecycle
--     core and the housekeeping), so only new ones are listed.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  directory_can_read_profile(uuid, uuid),
  directory_lock_addresses(text[]),
  directory_address_taken(text, uuid, uuid),
  email_send_register(text, text),
  directory_audit_as(uuid, text, text, uuid, uuid, text),
  directory_ensure_profile(uuid),
  directory_unshare(uuid),
  directory_normalize_parent(jsonb, text, boolean),
  identity_end_parent_sign_in(uuid),
  directory_remove_parent_core(uuid),
  directory_removal_preview(text, uuid),
  directory_removal_apply(text, uuid),
  directory_list(),
  profile_set_sharing(text, uuid, integer, boolean),
  profile_update_own(text, uuid, integer, jsonb),
  account_password_changed(uuid),
  email_change_pending(uuid),
  email_change_request(text, uuid, text, text, text),
  email_change_cancel(text, uuid),
  email_change_confirm(text),
  family_add(text, jsonb),
  parent_add(text, uuid, integer, jsonb),
  parent_edit(text, uuid, integer, jsonb),
  parent_remove(text, uuid, integer),
  invitation_send(text, uuid, text, text),
  migration_load_family(text, uuid, jsonb)
  from public, anon, authenticated, service_role;

-- The reach helper of the profile policy is called by the policy as the signed-in role.
grant execute on function directory_can_read_profile(uuid, uuid) to authenticated;

-- Signed-in commands and reads check their caller themselves (BR30.1, BR31.2, BR32.1, BR35.1, BR36.1, BR37.1).
grant execute on function
  directory_list(),
  profile_set_sharing(text, uuid, integer, boolean),
  profile_update_own(text, uuid, integer, jsonb),
  family_add(text, jsonb),
  parent_add(text, uuid, integer, jsonb),
  parent_edit(text, uuid, integer, jsonb),
  parent_remove(text, uuid, integer),
  invitation_send(text, uuid, text, text)
  to authenticated;

-- The server's steps: the password check comes first, so a signed-in session cannot call them (NFR3.5, NFR3.6). The
-- one-off load is the migration script's (C17).
grant execute on function
  account_password_changed(uuid),
  email_change_pending(uuid),
  email_change_request(text, uuid, text, text, text),
  email_change_cancel(text, uuid),
  email_change_confirm(text),
  migration_load_family(text, uuid, jsonb)
  to service_role;

commit;
