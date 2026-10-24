-- U3 Directory and Settings: the named change functions (BR30.1 to BR30.4, BR30.6, BR30.9, BR30.10, BR32.8).
-- Each function is security definer with a pinned search path, executable by signed-in accounts only, checks
-- its caller and reach itself, and follows the U1 pattern: active session, idempotency check, authorization,
-- change, then the stored result (U1 BR3.6). Ordinary directory edits write no audit event (U1 BR3.2).
-- Business outcomes are result envelopes {state, reference, code} with the screens' state names: success,
-- validation (code field_invalid with the field), denied, conflict and invalidated. Only a success is stored
-- under the idempotency key: every other outcome changes nothing, so a repeat re-evaluates to the same answer
-- and a corrected request with the same key is not stuck on an old refusal.
-- Business refusals inside a change end the function through platform_abort, which raises an exception that
-- the function catches: PL/pgSQL rolls back everything written so far in that block, so a refused save never
-- leaves a half-written family.

-- Small internal helpers (not callable by any application role).
create or replace function platform_try_uuid(p_text text) returns uuid
language plpgsql immutable set search_path from current
as $$ begin return p_text::uuid; exception when others then return null; end $$;

create or replace function platform_try_integer(p_text text) returns integer
language plpgsql immutable set search_path from current
as $$ begin return p_text::integer; exception when others then return null; end $$;

create or replace function platform_try_date(p_text text) returns date
language plpgsql immutable set search_path from current
as $$ begin return p_text::date; exception when others then return null; end $$;

create or replace function platform_try_timestamptz(p_text text) returns timestamptz
language plpgsql stable set search_path from current
as $$ begin return p_text::timestamptz; exception when others then return null; end $$;

-- Ends the running change with a business outcome: the caller's block catches SQLSTATE U3R00 and returns
-- the envelope carried in the exception detail.
create or replace function platform_abort(p_state text, p_code text, p_extra jsonb default '{}'::jsonb) returns void
language plpgsql set search_path from current
as $$ begin
  raise exception 'platform: the operation ended with %', p_code
    using errcode = 'U3R00', detail = (platform_result(p_state, null, p_code) || coalesce(p_extra, '{}'::jsonb))::text;
end $$;

create or replace function platform_field_invalid(p_field text, p_reason text default 'invalid') returns void
language plpgsql set search_path from current
as $$ begin
  perform platform_abort('validation', 'field_invalid', jsonb_build_object('field', p_field, 'reason', p_reason));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- directory_save: a family with its parents (and their contact details), children and memberships, in
-- one call (W2). The payload is a JSON object:
--   family_id (null or absent creates), expected_version (needed to change), display_name,
--   parents:  [{id, expected_version, display_name, optional_profile, optional_profile_consent,
--               contact: {email, phone, locality}, account_id}]
--   children: [{id, expected_version, display_name}]
--   add_group_ids / end_group_ids: groups whose membership starts or ends.
-- Items that are not listed stay as they are. A parent's account_id is set or cleared by a super admin only
-- (BR30.3); every other link comes from an accepted invitation. A group admin creates a family only with a
-- membership of a group they reach, and adds or ends memberships only in groups they reach (BR30.1, BR30.6).
-- ---------------------------------------------------------------------------------------------------
create or replace function directory_save(p_idempotency_key text, p_family jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'directory.save';
  v_org uuid;
  v_super boolean;
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
  v_add jsonb;
  v_end jsonb;
  v_item jsonb;
  v_contact jsonb;
  v_id uuid;
  v_group uuid;
  v_group_status text;
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
    if p_family is null or jsonb_typeof(p_family) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    v_super := has_super_scope(v_org);
    v_name := btrim(coalesce(p_family->>'display_name', ''));
    v_parents := coalesce(p_family->'parents', '[]'::jsonb);
    v_children := coalesce(p_family->'children', '[]'::jsonb);
    v_add := coalesce(p_family->'add_group_ids', '[]'::jsonb);
    v_end := coalesce(p_family->'end_group_ids', '[]'::jsonb);
    if jsonb_typeof(v_parents) <> 'array' or jsonb_typeof(v_children) <> 'array'
       or jsonb_typeof(v_add) <> 'array' or jsonb_typeof(v_end) <> 'array'
       or jsonb_array_length(v_parents) > 10 or jsonb_array_length(v_children) > 20
       or jsonb_array_length(v_add) > 20 or jsonb_array_length(v_end) > 20 then
      perform platform_abort('validation', 'request_invalid');
    end if;

    -- Which family: a new one, or an existing one of this organization that the actor reaches.
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
      if not directory_reaches_family(v_org, v_family_id) then
        perform platform_abort('denied', 'authorization_denied');
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

    -- Memberships to add: each group is of this organization, active and reached by the actor, and the
    -- family is not an active member of it yet (BR30.6).
    for v_item in select value from jsonb_array_elements(v_add) loop
      v_group := platform_try_uuid(v_item #>> '{}');
      if v_group is null then
        perform platform_field_invalid('add_group_ids');
      end if;
      select g.status into v_group_status from groups g where g.id = v_group and g.organization_id = v_org;
      if not found then
        perform platform_field_invalid('add_group_ids', 'group_not_found');
      end if;
      if not has_core_scope(v_org, v_group) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
      if v_group_status = 'archived' then
        perform platform_field_invalid('add_group_ids', 'archived');
      end if;
      if not v_creating and exists (select 1 from group_memberships m
                                     where m.family_id = v_family_id and m.group_id = v_group and m.status = 'active')
         and not coalesce(v_end @> to_jsonb(v_group::text), false) then
        perform platform_abort('conflict', 'MEMBERSHIP_DUPLICATE');
      end if;
    end loop;
    -- A group admin creates a family only together with a membership of a group they reach.
    if v_creating and not v_super and jsonb_array_length(v_add) = 0 then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    for v_item in select value from jsonb_array_elements(v_end) loop
      v_group := platform_try_uuid(v_item #>> '{}');
      if v_group is null then
        perform platform_field_invalid('end_group_ids');
      end if;
      if v_creating or not exists (select 1 from group_memberships m
                                    where m.family_id = v_family_id and m.group_id = v_group
                                      and m.organization_id = v_org and m.status = 'active') then
        perform platform_field_invalid('end_group_ids', 'membership_not_found');
      end if;
      if not has_core_scope(v_org, v_group) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
    end loop;

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
      -- Linking or unlinking a sign-in account is a super admin correction (BR30.3).
      v_link := v_item->'account_id' is not null;
      v_account := null;
      if v_link then
        if not v_super then
          perform platform_abort('denied', 'authorization_denied');
        end if;
        if jsonb_typeof(v_item->'account_id') <> 'null' then
          v_account := platform_try_uuid(v_item->>'account_id');
          if v_account is null then
            perform platform_field_invalid('parents.account_id');
          end if;
          if not exists (select 1 from accounts a where a.id = v_account and a.organization_id = v_org) then
            perform platform_field_invalid('parents.account_id', 'account_not_found');
          end if;
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

    -- Ending a membership keeps the family's assignments (the admin decides about them, W3).
    for v_item in select value from jsonb_array_elements(v_end) loop
      update group_memberships set status = 'ended', ended_at = now()
       where family_id = v_family_id and group_id = platform_try_uuid(v_item #>> '{}') and status = 'active';
    end loop;
    for v_item in select value from jsonb_array_elements(v_add) loop
      begin
        insert into group_memberships (organization_id, family_id, group_id)
        values (v_org, v_family_id, platform_try_uuid(v_item #>> '{}'));
      exception when unique_violation then
        perform platform_abort('conflict', 'MEMBERSHIP_DUPLICATE');
      end;
    end loop;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_family_id);
    return platform_result('success', v_family_id, null)
      || jsonb_build_object('version', (select f.version from families f where f.id = v_family_id));
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- structure_save: a school year or a group (W1). Super admins only (BR30.9). The payload is
--   school_year: {id, expected_version, name, starts_on, ends_on}
--   group:       {id, expected_version, school_year_id, name}
-- A group needs an active school year of the same organization; names are unique inside their parent;
-- the school year of a group does not change once it is set.
-- ---------------------------------------------------------------------------------------------------
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
    if p_kind is null or p_kind not in ('school_year', 'group')
       or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    if not has_super_scope(v_org) then
      perform platform_abort('denied', 'authorization_denied');
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
        insert into groups (organization_id, school_year_id, name) values (v_org, v_year_id, v_name)
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
        update groups set name = v_name where id = v_id;
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

-- ---------------------------------------------------------------------------------------------------
-- directory_archive_item and directory_restore_item: a group, a school year or a child on its own
-- (BR30.7; a family is archived and restored by the family use cases). Archiving a group or a school year
-- is a super admin action (BR30.9, which is stricter than the "admin in reach" of BR30.7); a child is
-- archived by an admin who reaches its family. Archiving hides the item without touching assignments; a
-- school year can be archived only when all its groups are archived. Restoring an item that is not
-- archived, or one whose parent is archived, gives RESTORE_CONFLICT; a stale version gives VERSION_CONFLICT.
-- ---------------------------------------------------------------------------------------------------
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
  v_family uuid;
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
      if not directory_reaches_family(v_org, v_family) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
    else
      if not has_super_scope(v_org) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
      if p_kind = 'group' then
        select g.version, g.status into v_version, v_status
          from groups g where g.id = p_id and g.organization_id = v_org for update;
      else
        select s.version, s.status into v_version, v_status
          from school_years s where s.id = p_id and s.organization_id = v_org for update;
      end if;
      if not found then
        perform platform_abort('validation', 'item_not_found');
      end if;
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
      if not directory_reaches_family(v_org, v_family) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
      select f.status into v_parent_status from families f where f.id = v_family;
    else
      if not has_super_scope(v_org) then
        perform platform_abort('denied', 'authorization_denied');
      end if;
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

-- ---------------------------------------------------------------------------------------------------
-- Settings (BR30.10): admins read the reminder setting, super admins change it with a version check.
-- settings_get creates the organization's default row on first read, so every admin sees a version.
-- A stale version gives the invalidated result SETTINGS_STALE, a recipient outside the two options the
-- screen offers (duty, group) the conflict SETTINGS_RECIPIENT_INVALID. Settings changes are not audited.
-- ---------------------------------------------------------------------------------------------------
create or replace function settings_get() returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_row reminder_settings%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if not directory_is_admin(v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  insert into reminder_settings (organization_id) values (v_org)
    on conflict (organization_id, threshold) do nothing;
  select * into v_row from reminder_settings where organization_id = v_org and threshold = 'default';
  return platform_result('success', v_row.id, null)
    || jsonb_build_object('enabled', v_row.enabled, 'recipient_scope', v_row.recipient_scope,
                          'threshold', v_row.threshold, 'version', v_row.version);
end $$;

create or replace function settings_save(
  p_idempotency_key text, p_expected_version integer, p_enabled boolean, p_recipient_scope text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'settings.save';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_row reminder_settings%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_expected_version::text, p_enabled::text, p_recipient_scope), 'UTF8')), 'hex');
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
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_enabled is null then
      perform platform_field_invalid('enabled');
    end if;
    insert into reminder_settings (organization_id) values (v_org)
      on conflict (organization_id, threshold) do nothing;
    select * into v_row from reminder_settings
     where organization_id = v_org and threshold = 'default' for update;
    if v_row.version <> p_expected_version then
      perform platform_abort('invalidated', 'SETTINGS_STALE');
    end if;
    if p_recipient_scope is null or p_recipient_scope not in ('duty', 'group') then
      perform platform_abort('conflict', 'SETTINGS_RECIPIENT_INVALID');
    end if;
    update reminder_settings set enabled = p_enabled, recipient_scope = p_recipient_scope where id = v_row.id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_row.id);
    return platform_result('success', v_row.id, null) || jsonb_build_object('version', v_row.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- Function rights. Helpers are internal; the change and settings functions are executable by signed-in
-- accounts and check their caller themselves.
revoke all on function
  platform_try_uuid(text),
  platform_try_integer(text),
  platform_try_date(text),
  platform_try_timestamptz(text),
  platform_abort(text, text, jsonb),
  platform_field_invalid(text, text),
  directory_save(text, jsonb),
  structure_save(text, text, jsonb),
  directory_archive_item(text, text, uuid, integer),
  directory_restore_item(text, text, uuid, integer),
  settings_get(),
  settings_save(text, integer, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function
  directory_save(text, jsonb),
  structure_save(text, text, jsonb),
  directory_archive_item(text, text, uuid, integer),
  directory_restore_item(text, text, uuid, integer),
  settings_get(),
  settings_save(text, integer, boolean, text)
  to authenticated;
