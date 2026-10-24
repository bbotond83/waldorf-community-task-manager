-- U4 Import: the commit (BR41.6, BR41.10, BR41.9, NFR6.26). One transaction that
--   - checks the run, the presented fingerprint, the open conflicts and the confirmation;
--   - decides every row a second time inside the transaction (import_match) and compares the decision with the
--     one recorded at preview: a record added, changed, archived or whose version moved applies nothing, sends
--     the run back to the preview with the changed units as new conflicts, and returns IMPORT_MATCH_CHANGED;
--   - otherwise applies the units through U3's own save functions (structure_save, directory_save, event_save,
--     task_save and the core of assignment_assign), each with its derived idempotency key (the run id and the
--     source key, hashed) and the recorded expected versions, after locking the families and then the tasks it
--     will touch in ascending id order (U3 NFR3.8: family first, then task, ascending);
--   - records the archive sheets' rows as archived and counts them as skipped (BR41.10), sets every row's
--     outcome, writes ONE `import.commit` audit event with the run id and the counts only, deletes the staged
--     rows and marks the run committed (or recovered, when `import_recover` called it).
-- Any failure raises an exception, and the whole transaction rolls back, run status included (BR41.6).
--
-- Imported assignments write no notification to a parent (NFR6.26): the core of assignment_assign is used, not
-- the wrapper of 20261038 that writes the notice, and the touched tasks are planned with `reminder_plan_tasks`
-- afterwards, so the reminder jobs and recipients exist. `task_save` and `event_save` are the wrappers: they
-- re-plan reminders and write no notice.

-- The decision the commit acts on, kept on the staged row so the loops below read it by index. Deleted with the row.
alter table import_staged_rows
  add column if not exists effective text check (effective is null or effective in ('create', 'update', 'none', 'skip'));

-- The idempotency key of one call to a save function: the run and the purpose, hashed (BR41.6).
create or replace function import_step_key(p_run_id uuid, p_purpose text) returns text
language sql immutable set search_path from current
as $$ select encode(sha256(convert_to(p_run_id::text || '|' || p_purpose, 'UTF8')), 'hex') $$;

-- A save function that did not succeed stops the commit with an error, which rolls everything back. The message
-- names the call and the code, never a value of the workbook.
create or replace function import_require(p_what text, p_result jsonb) returns void
language plpgsql set search_path from current
as $$
begin
  if p_result ->> 'state' is distinct from 'success' then
    raise exception 'import: % was refused (%)', p_what, coalesce(p_result ->> 'code', p_result ->> 'state')
      using errcode = 'U4I02';
  end if;
end $$;

-- The active families of a group with exactly this name.
create or replace function import_find_family(p_organization_id uuid, p_group_id uuid, p_name text) returns uuid[]
language sql stable set search_path from current
as $$
  select coalesce(array_agg(f.id order by f.id), '{}'::uuid[])
    from families f
    join group_memberships m on m.family_id = f.id and m.group_id = p_group_id and m.status = 'active'
   where f.organization_id = p_organization_id and f.status = 'active' and f.display_name = p_name
$$;

-- What a row effectively does at the commit (BR41.5, BR41.6): a clean row does what its class says; a conflict row
-- does nothing unless the admin chose use_import for a unit-level conflict, which updates the matched record or
-- creates one when there is no match. A row-level conflict (the family of a task row) can only be skipped.
create or replace function import_effective(p_run_id uuid) returns table (o_staged_id uuid, o_eff text)
language sql stable set search_path from current
as $$
  select s.id,
         case
           when s.match_class in ('create', 'update', 'none') then s.match_class
           when s.row_conflict then 'skip'
           when c.resolution = 'use_import' then case when s.matched_record_id is not null then 'update' else 'create' end
           else 'skip'
         end
    from import_staged_rows s
    left join import_staged_rows l on l.import_run_id = s.import_run_id and l.unit_ref = s.unit_ref and l.is_leader
    left join import_rows lr on lr.import_run_id = l.import_run_id and lr.source_key = l.source_key
    left join import_conflicts c on c.import_row_id = lr.id
   where s.import_run_id = p_run_id
$$;

-- The directory_save payload of one family unit: the file's values over the existing family (a column the file
-- leaves empty keeps what is there). The optional profile goes only with the consent mark 'igen'; existing
-- children are not listed (items that are not listed stay as they are); new parents and children have no id.
create or replace function import_family_payload(
  p_run_id uuid, p_unit_ref text, p_family_id uuid, p_organization_id uuid, p_expected_version integer
) returns jsonb
language plpgsql stable set search_path from current
as $$
declare
  v_group uuid;
  v_fam text;
  v_parents jsonb;
  v_children jsonb;
  v_add jsonb := '[]'::jsonb;
begin
  v_fam := import_first(p_run_id, p_unit_ref, 'Család');
  select g.id into v_group from groups g
   where g.organization_id = p_organization_id and g.school_year_id = import_active_year(p_organization_id)
     and lower(g.name) = lower(import_first(p_run_id, p_unit_ref, 'Csoport'));
  if v_group is null then
    raise exception 'import: the group of a family row does not exist' using errcode = 'U4I02';
  end if;
  if p_family_id is null or not exists (
       select 1 from group_memberships m
        where m.family_id = p_family_id and m.group_id = v_group and m.status = 'active') then
    v_add := jsonb_build_array(v_group);
  end if;

  select coalesce(jsonb_agg(x.entry order by x.first_row), '[]'::jsonb) into v_parents
    from (
      select fp.first_row,
             jsonb_strip_nulls(jsonb_build_object(
               'id', ep.id,
               'expected_version', ep.version,
               'display_name', fp.pname,
               'contact', case
                 when coalesce(fp.email, ec.contact_email) is null and coalesce(fp.phone, ec.contact_phone) is null
                      and coalesce(fp.locality, ec.locality) is null then null
                 else jsonb_build_object('email', coalesce(fp.email, ec.contact_email),
                                         'phone', coalesce(fp.phone, ec.contact_phone),
                                         'locality', coalesce(fp.locality, ec.locality)) end,
               'optional_profile', fp.profile,
               'optional_profile_consent', case when fp.profile is not null then true else null end)) as entry
        from (
          select min(r.row_number) as first_row,
                 lower(btrim(s.payload ->> 'Szülő neve')) as lname,
                 (array_agg(btrim(s.payload ->> 'Szülő neve') order by r.row_number))[1] as pname,
                 (array_agg(lower(btrim(s.payload ->> 'E-mail')) order by r.row_number)
                   filter (where nullif(btrim(coalesce(s.payload ->> 'E-mail', '')), '') is not null))[1] as email,
                 (array_agg(btrim(s.payload ->> 'Telefon') order by r.row_number)
                   filter (where nullif(btrim(coalesce(s.payload ->> 'Telefon', '')), '') is not null))[1] as phone,
                 (array_agg(btrim(s.payload ->> 'Helység') order by r.row_number)
                   filter (where nullif(btrim(coalesce(s.payload ->> 'Helység', '')), '') is not null))[1] as locality,
                 (array_agg(btrim(s.payload ->> 'Opcionális profil') order by r.row_number)
                   filter (where nullif(btrim(coalesce(s.payload ->> 'Opcionális profil', '')), '') is not null
                                 and lower(btrim(coalesce(s.payload ->> 'Hozzájárulás', ''))) = 'igen'))[1] as profile
            from import_staged_rows s
            join import_rows r on r.import_run_id = s.import_run_id and r.source_key = s.source_key
           where s.import_run_id = p_run_id and s.unit_ref = p_unit_ref
             and nullif(btrim(coalesce(s.payload ->> 'Szülő neve', '')), '') is not null
           group by lower(btrim(s.payload ->> 'Szülő neve'))) fp
        left join lateral (
          select p.id, p.version from parents p
           where p_family_id is not null and p.family_id = p_family_id and p.status = 'active'
             and lower(p.display_name) = fp.lname
           order by p.created_at, p.id limit 1) ep on true
        left join parent_contacts ec on ec.parent_id = ep.id) x;

  select coalesce(jsonb_agg(jsonb_build_object('display_name', fc.cname) order by fc.first_row), '[]'::jsonb) into v_children
    from (
      select min(r.row_number) as first_row,
             (array_agg(btrim(s.payload ->> 'Gyermek neve') order by r.row_number))[1] as cname
        from import_staged_rows s
        join import_rows r on r.import_run_id = s.import_run_id and r.source_key = s.source_key
       where s.import_run_id = p_run_id and s.unit_ref = p_unit_ref
         and nullif(btrim(coalesce(s.payload ->> 'Szülő neve', '')), '') is null
         and nullif(btrim(coalesce(s.payload ->> 'Gyermek neve', '')), '') is not null
       group by lower(btrim(s.payload ->> 'Gyermek neve'))) fc
   where p_family_id is null or not exists (
     select 1 from children ch
      where ch.family_id = p_family_id and ch.status = 'active' and lower(ch.display_name) = lower(fc.cname));

  return jsonb_strip_nulls(jsonb_build_object(
    'family_id', p_family_id,
    'expected_version', p_expected_version,
    'display_name', v_fam,
    'parents', v_parents,
    'children', v_children,
    'add_group_ids', v_add));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- import_apply: the body of the commit and of the recovery. The caller has checked the caller's rights and
-- locked the run row; this checks the fingerprint again from the staged rows (it also catches rows the lifecycle
-- removed), the open conflicts and the match, and applies. Returns an envelope; a business refusal ends it through
-- platform_abort (the caller catches it), a failure inside a save function raises and rolls everything back.
-- ---------------------------------------------------------------------------------------------------
create or replace function import_apply(p_run_id uuid, p_final_status text) returns jsonb
language plpgsql set search_path from current
as $$
declare
  c_directory constant text := 'Szülők elérhetősége';
  v_run import_runs%rowtype;
  v_org uuid;
  v_year uuid;
  v_open integer;
  v_units text[];
  v_families uuid[];
  v_tasks uuid[];
  v_u record;
  v_r record;
  v_res jsonb;
  v_payload jsonb;
  v_gid uuid;
  v_event uuid;
  v_estart timestamptz;
  v_eend timestamptz;
  v_task_id uuid;
  v_task_version integer;
  v_fids uuid[];
  v_touched uuid[] := '{}'::uuid[];
  v_imported integer;
  v_skipped integer;
  v_created integer;
  v_updated integer;
  v_archived integer;
  v_summary jsonb;
begin
  select * into v_run from import_runs r where r.id = p_run_id for update;
  v_org := v_run.organization_id;
  v_year := import_active_year(v_org);

  if import_fingerprint(p_run_id) <> v_run.workbook_fingerprint then
    perform platform_abort('conflict', 'IMPORT_FINGERPRINT_CHANGED');
  end if;
  select count(*)::integer into v_open from import_conflicts c where c.import_run_id = p_run_id and c.resolution is null;
  if v_open > 0 then
    perform platform_abort('conflict', 'IMPORT_CONFLICT_UNRESOLVED');
  end if;

  update import_staged_rows s set effective = e.o_eff
    from import_effective(p_run_id) e where s.id = e.o_staged_id;

  -- Lock first, in the fixed order (families ascending, then tasks ascending), then look at the data: the
  -- families the units update and the families the task rows assign, and the tasks the units update.
  select coalesce(array_agg(distinct x.fid order by x.fid), '{}'::uuid[]) into v_families
    from (
      select s.matched_record_id as fid from import_staged_rows s
       where s.import_run_id = p_run_id and s.matched_record_type = 'family' and s.effective = 'update'
      union
      select f.id as fid
        from import_staged_rows s
        join import_task_units(p_run_id) tu on tu.o_unit_ref = s.unit_ref
        join groups g on g.organization_id = v_org and g.school_year_id = v_year and g.status = 'active'
                     and lower(g.name) = lower(tu.o_grp)
        join group_memberships m on m.group_id = g.id and m.status = 'active'
        join families f on f.id = m.family_id and f.organization_id = v_org and f.status = 'active'
                       and f.display_name = nullif(btrim(coalesce(s.payload ->> 'Család', '')), '')
       where s.import_run_id = p_run_id and s.effective in ('create', 'update')) x;
  select coalesce(array_agg(distinct s.matched_record_id order by s.matched_record_id), '{}'::uuid[]) into v_tasks
    from import_staged_rows s
   where s.import_run_id = p_run_id and s.matched_record_type = 'task' and s.effective = 'update';
  perform 1 from families f where f.id = any (v_families) order by f.id for update;
  perform 1 from tasks t where t.id = any (v_tasks) order by t.id for update;

  -- The second matching (BR41.6): any unit whose decision differs from the recorded one is sent back to the
  -- preview as a new conflict and nothing is applied.
  select coalesce(array_agg(distinct m.o_unit_ref), '{}'::text[]) into v_units
    from import_match(p_run_id) m
    join import_staged_rows s on s.id = m.o_staged_id
   where case
           -- A unit that already came back once as "changed since the preview" has the record it changed to
           -- recorded; it differs again only if that record moves or the unit becomes another conflict.
           when s.conflict_message = 'Az elem megváltozott.' then
             m.o_class = 'conflict'
             or (s.matched_record_type, s.matched_record_id, s.matched_record_version)
                is distinct from (m.o_type, m.o_id, m.o_version)
           else
             (s.match_class, s.conflict_message, s.row_conflict, s.matched_record_type, s.matched_record_id,
              s.matched_record_version)
             is distinct from (m.o_class, m.o_message, m.o_row_conflict, m.o_type, m.o_id, m.o_version)
         end;
  if cardinality(v_units) > 0 then
    with m as (select * from import_match(p_run_id)),
         mu as (select m2.o_unit_ref, bool_or(m2.o_class = 'conflict' and not m2.o_row_conflict) as unit_conflict
                  from m m2 group by m2.o_unit_ref)
    update import_staged_rows s
       set match_class = case when mu.unit_conflict then m.o_class else 'conflict' end,
           conflict_message = case when mu.unit_conflict then m.o_message else 'Az elem megváltozott.' end,
           row_conflict = case when mu.unit_conflict then m.o_row_conflict else false end,
           matched_record_type = m.o_type, matched_record_id = m.o_id, matched_record_version = m.o_version,
           effective = null
      from m join mu on mu.o_unit_ref = m.o_unit_ref
     where s.id = m.o_staged_id and m.o_unit_ref = any (v_units);
    delete from import_conflicts c
     where c.import_row_id in (
       select r.id from import_rows r
         join import_staged_rows s on s.import_run_id = r.import_run_id and s.source_key = r.source_key
        where r.import_run_id = p_run_id and s.unit_ref = any (v_units));
    insert into import_conflicts (organization_id, import_run_id, import_row_id, row_label, message)
    select v_org, p_run_id, r.id, r.sheet || ' · ' || r.row_number || '. sor', s.conflict_message
      from import_staged_rows s
      join import_rows r on r.import_run_id = s.import_run_id and r.source_key = s.source_key
     where s.import_run_id = p_run_id and s.unit_ref = any (v_units)
       and s.match_class = 'conflict' and (s.row_conflict or s.is_leader);
    update import_rows r set outcome = case when s.match_class = 'conflict' then 'conflict' else 'staged' end
      from import_staged_rows s
     where r.import_run_id = p_run_id and s.import_run_id = r.import_run_id and s.source_key = r.source_key
       and s.unit_ref = any (v_units);
    update import_staged_rows s set effective = null where s.import_run_id = p_run_id;
    select coalesce(jsonb_agg(g.grp || ' csoport: ' || g.n || ' módosítás' order by g.grp), '[]'::jsonb) into v_summary
      from (select btrim(s.payload ->> 'Csoport') as grp, count(*) as n
              from import_staged_rows s
             where s.import_run_id = p_run_id and s.match_class in ('create', 'update')
               and nullif(btrim(coalesce(s.payload ->> 'Csoport', '')), '') is not null
             group by 1) g;
    update import_runs
       set status = 'previewed', step = 4, version = version + 1, changed_summary = v_summary, updated_at = now()
     where id = p_run_id;
    return platform_result('conflict', p_run_id, 'IMPORT_MATCH_CHANGED') || import_run_model(p_run_id);
  end if;

  -- Groups the directory rows name that do not exist yet.
  for v_u in
    select distinct on (lower(x.gname)) x.gname
      from (
        select import_first(p_run_id, s.unit_ref, 'Csoport') as gname
          from import_staged_rows s
          join import_rows r on r.import_run_id = s.import_run_id and r.source_key = s.source_key
         where s.import_run_id = p_run_id and s.is_leader and r.sheet = c_directory
           and s.effective in ('create', 'update')) x
     where not exists (
       select 1 from groups g
        where g.organization_id = v_org and g.school_year_id = v_year and lower(g.name) = lower(x.gname))
     order by lower(x.gname)
  loop
    v_res := structure_save(import_step_key(p_run_id, 'group|' || lower(v_u.gname)), 'group',
                            jsonb_build_object('school_year_id', v_year, 'name', v_u.gname));
    perform import_require('group', v_res);
  end loop;

  -- Families: one directory_save per unit, in file order.
  for v_u in
    select s.unit_ref, s.source_key, s.effective, s.matched_record_id, s.matched_record_version
      from import_staged_rows s
      join import_rows r on r.import_run_id = s.import_run_id and r.source_key = s.source_key
     where s.import_run_id = p_run_id and s.is_leader and r.sheet = c_directory
       and s.effective in ('create', 'update')
     order by r.row_number
  loop
    -- The recorded version is the expected version of the save: the re-match above found the family unchanged, and
    -- directory_save checks it once more under its own lock.
    v_payload := import_family_payload(p_run_id, v_u.unit_ref,
                                       case when v_u.effective = 'update' then v_u.matched_record_id else null end, v_org,
                                       case when v_u.effective = 'update' then v_u.matched_record_version else null end);
    v_res := directory_save(import_step_key(p_run_id, v_u.source_key || '|family'), v_payload);
    perform import_require('family', v_res);
  end loop;

  -- Tasks: the event of a unit (found by group and title, else created once), the task, its assignments.
  for v_u in
    select tu.*,
           (select s.matched_record_id from import_staged_rows s
             where s.import_run_id = p_run_id and s.unit_ref = tu.o_unit_ref and s.is_leader) as task_id,
           (select s.matched_record_version from import_staged_rows s
             where s.import_run_id = p_run_id and s.unit_ref = tu.o_unit_ref and s.is_leader) as task_version,
           (select s.source_key from import_staged_rows s
             where s.import_run_id = p_run_id and s.unit_ref = tu.o_unit_ref and s.is_leader) as leader_key
      from import_task_units(p_run_id) tu
     where exists (select 1 from import_staged_rows s
                    where s.import_run_id = p_run_id and s.unit_ref = tu.o_unit_ref
                      and s.effective in ('create', 'update'))
  loop
    select g.id into v_gid from groups g
     where g.organization_id = v_org and g.school_year_id = v_year and g.status = 'active'
       and lower(g.name) = lower(v_u.o_grp);
    if v_gid is null then
      raise exception 'import: the group of a task row does not exist' using errcode = 'U4I02';
    end if;
    v_event := null;
    if v_u.o_event is not null then
      select e.id into v_event from events e
       where e.organization_id = v_org and e.group_id = v_gid and e.title = v_u.o_event
       order by e.created_at, e.id limit 1;
      if v_event is null then
        select min(x.o_starts), max(x.o_ends) into v_estart, v_eend
          from import_task_units(p_run_id) x
         where x.o_valid and lower(x.o_grp) = lower(v_u.o_grp) and x.o_event = v_u.o_event;
        v_res := event_save(
          import_step_key(p_run_id, 'event|' || lower(v_u.o_grp) || '|' || v_u.o_event),
          jsonb_strip_nulls(jsonb_build_object('group_id', v_gid, 'title', v_u.o_event, 'location', v_u.o_location,
                                               'starts_at', v_estart, 'ends_at', v_eend)));
        perform import_require('event', v_res);
        v_event := (v_res ->> 'reference')::uuid;
      end if;
    end if;

    v_task_id := v_u.task_id;
    if v_task_id is null then
      v_res := task_save(
        import_step_key(p_run_id, v_u.leader_key || '|task'),
        jsonb_strip_nulls(jsonb_build_object('group_id', v_gid, 'event_id', v_event, 'title', v_u.o_title,
                                             'category', v_u.o_category, 'capacity', v_u.o_capacity,
                                             'starts_at', v_u.o_starts, 'ends_at', v_u.o_ends,
                                             'location', v_u.o_location)));
      perform import_require('task', v_res);
      v_task_id := (v_res ->> 'reference')::uuid;
    elsif import_task_changed(v_task_id, v_u.o_capacity, v_u.o_ends, v_u.o_category, v_u.o_location, v_u.o_event) then
      v_res := task_save(
        import_step_key(p_run_id, v_u.leader_key || '|task'),
        jsonb_strip_nulls(jsonb_build_object('id', v_task_id, 'expected_version', v_u.task_version,
                                             'group_id', v_gid, 'event_id', v_event, 'title', v_u.o_title,
                                             'category', v_u.o_category, 'capacity', v_u.o_capacity,
                                             'starts_at', v_u.o_starts, 'ends_at', v_u.o_ends,
                                             'location', v_u.o_location)));
      perform import_require('task', v_res);
    end if;
    v_touched := v_touched || v_task_id;

    for v_r in
      select s.source_key, nullif(btrim(coalesce(s.payload ->> 'Család', '')), '') as fname
        from import_staged_rows s
        join import_rows r on r.import_run_id = s.import_run_id and r.source_key = s.source_key
       where s.import_run_id = p_run_id and s.unit_ref = v_u.o_unit_ref and s.effective in ('create', 'update')
         and nullif(btrim(coalesce(s.payload ->> 'Család', '')), '') is not null
       order by r.sheet, r.row_number
    loop
      v_fids := import_find_family(v_org, v_gid, v_r.fname);
      if cardinality(v_fids) <> 1 then
        raise exception 'import: the family of a task row was not found' using errcode = 'U4I02';
      end if;
      if exists (select 1 from assignments a
                  where a.task_id = v_task_id and a.family_id = v_fids[1] and a.status <> 'removed') then
        continue;
      end if;
      select t.version into v_task_version from tasks t where t.id = v_task_id;
      -- The core, not the wrapper: an imported place writes no notice to a parent (NFR6.26).
      v_res := assignment_assign_core(import_step_key(p_run_id, v_r.source_key || '|assign'), v_task_id,
                                      v_fids[1], v_task_version);
      perform import_require('assignment', v_res);
      update assignments set source = 'import' where id = (v_res ->> 'reference')::uuid;
    end loop;
  end loop;
  perform reminder_plan_tasks(v_touched);

  -- Outcomes: archive rows are archived, applied rows created or updated, everything else skipped.
  update import_rows r set outcome = x.outcome
    from (
      select r2.id,
             case when sr.mode = 'read_only_archive' then 'archived'
                  when s.effective = 'create' then 'created'
                  when s.effective = 'update' then 'updated'
                  else 'skipped' end as outcome
        from import_rows r2
        join sheet_registry sr on sr.sheet = r2.sheet
        left join import_staged_rows s on s.import_run_id = r2.import_run_id and s.source_key = r2.source_key
       where r2.import_run_id = p_run_id) x
   where r.id = x.id;
  select count(*) filter (where i.outcome in ('created', 'updated'))::integer,
         count(*) filter (where i.outcome in ('skipped', 'archived'))::integer,
         count(*) filter (where i.outcome = 'created')::integer,
         count(*) filter (where i.outcome = 'updated')::integer,
         count(*) filter (where i.outcome = 'archived')::integer
    into v_imported, v_skipped, v_created, v_updated, v_archived
    from import_rows i where i.import_run_id = p_run_id;

  -- One audit event, with the run id and the counts only (U1 BR3.2).
  perform platform_audit_write('import.commit', 'import_run', p_run_id, v_org, null, 'success',
                               'imported:' || v_imported || ':skipped:' || v_skipped);
  delete from import_staged_rows where import_run_id = p_run_id;
  update import_runs
     set status = p_final_status, step = 7, imported_rows = v_imported, skipped_rows = v_skipped,
         committed_at = now(), version = version + 1, updated_at = now()
   where id = p_run_id;
  return platform_result('success', p_run_id, null) || import_run_model(p_run_id)
    || jsonb_build_object('created_rows', v_created, 'updated_rows', v_updated, 'archived_rows', v_archived);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- import_commit: the starting super admin confirms the import (W10). The run must be previewed or confirmed,
-- the presented fingerprint the stored one (IMPORT_FINGERPRINT_CHANGED), no conflict open
-- (IMPORT_CONFLICT_UNRESOLVED) and the confirmation 'yes' present (IMPORT_CONFIRMATION_REQUIRED); a missing run,
-- another admin's run and a run that is already committed, recovered, interrupted, cancelled or expired give
-- the invalidated result IMPORT_PREVIEW_STALE. The same idempotency key returns the stored result (a double click
-- commits once); a second click with another key finds the run committed.
-- ---------------------------------------------------------------------------------------------------
create or replace function import_commit(
  p_idempotency_key text, p_run_id uuid, p_fingerprint text, p_confirmation text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'import.commit';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_run import_runs%rowtype;
  v_open integer;
  v_result jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_run_id::text, p_fingerprint, p_confirmation), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed')
      || coalesce(import_run_model((v_check->>'reference')::uuid), '{}'::jsonb);
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if v_org is null or not has_super_scope(v_org) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_run_id is null then
      perform platform_abort('invalidated', 'IMPORT_PREVIEW_STALE');
    end if;
    select * into v_run from import_runs r
     where r.id = p_run_id and r.organization_id = v_org and r.started_by_account_id = auth.uid() for update;
    if not found or v_run.status not in ('previewed', 'confirmed') or v_run.expires_at <= now() then
      perform platform_abort('invalidated', 'IMPORT_PREVIEW_STALE');
    end if;
    if p_fingerprint is distinct from v_run.workbook_fingerprint then
      perform platform_abort('conflict', 'IMPORT_FINGERPRINT_CHANGED');
    end if;
    select count(*)::integer into v_open from import_conflicts c where c.import_run_id = v_run.id and c.resolution is null;
    if v_open > 0 then
      perform platform_abort('conflict', 'IMPORT_CONFLICT_UNRESOLVED');
    end if;
    if p_confirmation is distinct from 'yes' then
      perform platform_abort('conflict', 'IMPORT_CONFIRMATION_REQUIRED');
    end if;

    v_result := import_apply(v_run.id, 'committed');
    if v_result->>'state' = 'success' then
      perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_run.id);
    end if;
    return v_result;
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

revoke all on function
  import_step_key(uuid, text),
  import_require(text, jsonb),
  import_find_family(uuid, uuid, text),
  import_effective(uuid),
  import_family_payload(uuid, text, uuid, uuid, integer),
  import_apply(uuid, text),
  import_commit(text, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function import_commit(text, uuid, text, text) to authenticated;
