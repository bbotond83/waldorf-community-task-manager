-- U4 Import: preview, matching, conflict resolution, status, cancel, expiry, interruption and recovery
-- (BR41.1 to BR41.5, BR41.8, BR41.9, BR41.13, BR42.3, BR42.4). The commit itself, which applies the rows, is
-- in 20261041. The functions follow the pattern of the U3 and U4 files: active session, idempotency check,
-- authorization, change in one block that a business refusal rolls back, then the stored result. Only a
-- success is stored under an idempotency key. Business outcomes are result envelopes {state, reference, code}
-- with the screens' state names and the IMPORT_* codes of BR42.3. The only audit event of the import is
-- `import.commit` (U1 BR3.2), written by the commit; nothing here audits.
--
-- The input of `import_preview_create` (the shape the server-only parser of Step 17 produces) is a JSON
-- array with one object per non-empty workbook row:
--   { "sheet": "<one of the 17 registered sheet names>", "row": <row number, 1 or more>,
--     "values": { "<header text of the template>": "<cell text>", ... },     -- interactive sheets only
--     "warnings": <number of dropped phone values and profile texts of the row> }   -- optional
-- The cell values are strings keyed by the template's header texts exactly (rules.md, "Workbook template").
-- Dates and times are the template's `YYYY-MM-DD HH:mm` texts in Budapest time; the consent column holds
-- `igen` or `nem`. A row of an archive sheet has only `sheet` and `row`: its content is not copied. The
-- database drops the optional profile of a directory row whose consent is not `igen`, validates every value
-- again (the parser is not the only guard) and turns a row it cannot use into a conflict with the reason
-- 'Hibás adat a sorban.', so that a commit never fails on data it could have seen at preview.
--
-- Matching. The rows are grouped into units: a family (the directory rows with the same Csoport and Család)
-- or a task (the task-sheet rows with the same Csoport, Feladat and Kezdés). A unit is decided as a whole by
-- the ordered table of BR41.4. A task row that names a family is also decided on its own (the family must exist
-- in the group and the task must have room): that is the only row-level conflict. Contact e-mail addresses
-- are read inside these functions only; the conflict list holds sheet names, row numbers and fixed texts.
--
-- The staged rows carry what the preview decided (match_class, conflict_message, matched record and version).
-- `import_match` computes the decision from the staged rows and the current data; the preview stores it, and
-- the commit computes it a second time and compares (BR41.6).

-- ---------------------------------------------------------------------------------------------------
-- Small helpers. None of them is callable by any application role; the functions below call them as the
-- owner.
-- ---------------------------------------------------------------------------------------------------

-- The payload check of 20261039, stated with a CASE so that it never asks for the keys of a value that is not
-- an object, whatever order the planner evaluates the conditions in (the check constraint keeps calling it by name).
create or replace function import_payload_valid(p_payload jsonb) returns boolean
language sql immutable set search_path from current
as $$
  select case when jsonb_typeof(p_payload) = 'object' then
           (select count(*) from jsonb_object_keys(p_payload)) <= 20
           and not exists (
             select 1 from jsonb_each(p_payload) e
              where jsonb_typeof(e.value) <> 'string' or char_length(e.value #>> '{}') > 10000)
         else false end
$$;

-- A template date and time (YYYY-MM-DD HH:mm, Budapest time) as an instant, or null when it is not one.
create or replace function import_time(p_text text) returns timestamptz
language plpgsql stable set search_path from current
as $$
begin
  if p_text is null or p_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$' then
    return null;
  end if;
  return (p_text::timestamp) at time zone 'Europe/Budapest';
exception when others then
  return null;
end $$;

-- The reference of a staged row's unit: a hash of the key that makes rows one family or one task. A hash, so a
-- long cell can never reach an index.
create or replace function import_unit_ref(p_sheet text, p_payload jsonb) returns text
language sql immutable set search_path from current
as $$
  select encode(sha256(convert_to(case
    when p_sheet = 'Szülők elérhetősége'
      then 'f|' || lower(btrim(coalesce(p_payload ->> 'Csoport', ''))) || '|' || btrim(coalesce(p_payload ->> 'Család', ''))
    else 't|' || lower(btrim(coalesce(p_payload ->> 'Csoport', ''))) || '|' || btrim(coalesce(p_payload ->> 'Feladat', ''))
         || '|' || btrim(coalesce(p_payload ->> 'Kezdés', ''))
  end, 'UTF8')), 'hex')
$$;

-- Conflicts the admin can only skip: there is nothing to import into (BR41.5). A family-level 'several matches'
-- on a task row cannot be resolved by choosing a family either.
create or replace function import_conflict_skip_only(p_message text, p_sheet text) returns boolean
language sql immutable set search_path from current
as $$
  select p_message in ('Ismeretlen csoport.', 'Ismeretlen család.', 'Hibás adat a sorban.', 'Több egyező feladat.')
      or (p_message in ('Több egyező család.', 'Az elem megváltozott.') and p_sheet <> 'Szülők elérhetősége')
$$;

-- The first non-empty value of a column among the rows of a unit, in file order.
create or replace function import_first(p_run_id uuid, p_unit_ref text, p_key text) returns text
language sql stable set search_path from current
as $$
  select nullif(btrim(s.payload ->> p_key), '')
    from import_staged_rows s join import_rows r on r.import_run_id = s.import_run_id and r.source_key = s.source_key
   where s.import_run_id = p_run_id and s.unit_ref = p_unit_ref
     and nullif(btrim(coalesce(s.payload ->> p_key, '')), '') is not null
   order by r.sheet, r.row_number
   limit 1
$$;

-- The organization's active school year: the one that covers today if there is one, else the latest.
create or replace function import_active_year(p_organization_id uuid) returns uuid
language sql stable set search_path from current
as $$
  select y.id from school_years y
   where y.organization_id = p_organization_id and y.status = 'active'
   order by (current_date between y.starts_on and y.ends_on) desc, y.starts_on desc, y.id
   limit 1
$$;

-- SHA-256 of the run's rows in a fixed order (sheet, row): source key and staged payload, so the fingerprint
-- changes when any staged value changes or goes (BR41.3, BR41.6).
create or replace function import_fingerprint(p_run_id uuid) returns text
language sql stable set search_path from current
as $$
  select encode(sha256(convert_to(coalesce(string_agg(
    r.source_key || '|' || coalesce(s.payload::text, ''), E'\n' order by r.sheet, r.row_number), ''), 'UTF8')), 'hex')
    from import_rows r
    left join import_staged_rows s on s.import_run_id = r.import_run_id and s.source_key = r.source_key
   where r.import_run_id = p_run_id
$$;

-- The task units of a run with their parsed values (the first non-empty value of each column in file order),
-- and whether they are usable: a group name, a title, two readable times in order, a capacity of 1 to 50 and
-- texts within the limits of the task table.
create or replace function import_task_units(p_run_id uuid) returns table (
  o_unit_ref text, o_grp text, o_event text, o_title text, o_category text, o_location text,
  o_starts timestamptz, o_ends timestamptz, o_capacity integer, o_valid boolean)
language sql stable set search_path from current
as $$
  select u.unit_ref, f.grp, f.event, f.title, f.category, f.location, f.starts, f.ends, f.capacity,
         coalesce(f.grp is not null and char_length(f.grp) <= 100
                  and f.title is not null and char_length(f.title) <= 200
                  and f.starts is not null and f.ends is not null and f.ends >= f.starts
                  and f.capacity between 1 and 50
                  and coalesce(char_length(f.location), 0) <= 200
                  and coalesce(char_length(f.category), 0) <= 100
                  and coalesce(char_length(f.event), 0) <= 200, false)
    from (
      select s.unit_ref, min(r.sheet || lpad(r.row_number::text, 9, '0')) as ord
        from import_staged_rows s join import_rows r on r.import_run_id = s.import_run_id and r.source_key = s.source_key
       where s.import_run_id = p_run_id and r.sheet <> 'Szülők elérhetősége'
       group by s.unit_ref) u
    cross join lateral (
      select import_first(p_run_id, u.unit_ref, 'Csoport') as grp,
             import_first(p_run_id, u.unit_ref, 'Esemény') as event,
             import_first(p_run_id, u.unit_ref, 'Feladat') as title,
             import_first(p_run_id, u.unit_ref, 'Kategória') as category,
             import_first(p_run_id, u.unit_ref, 'Helyszín') as location,
             import_time(import_first(p_run_id, u.unit_ref, 'Kezdés')) as starts,
             import_time(import_first(p_run_id, u.unit_ref, 'Befejezés')) as ends,
             platform_try_integer(import_first(p_run_id, u.unit_ref, 'Létszám')) as capacity) f
   order by u.ord
$$;

-- Whether importing a family unit would change the existing family: its name, its membership of the group, a
-- parent or a parent's contact details or profile it does not have, a child it does not have. An unchanged
-- unit is an update that does nothing, and counts as skipped (entities, skipped_rows).
create or replace function import_family_changed(
  p_run_id uuid, p_unit_ref text, p_family_id uuid, p_group_id uuid, p_name text
) returns boolean
language plpgsql stable set search_path from current
as $$
begin
  if p_group_id is null then
    return true;
  end if;
  if exists (select 1 from families f where f.id = p_family_id and f.display_name <> p_name) then
    return true;
  end if;
  if not exists (select 1 from group_memberships m
                  where m.family_id = p_family_id and m.group_id = p_group_id and m.status = 'active') then
    return true;
  end if;
  if exists (
    select 1 from import_staged_rows s
     where s.import_run_id = p_run_id and s.unit_ref = p_unit_ref
       and nullif(btrim(coalesce(s.payload ->> 'Szülő neve', '')), '') is not null
       and not exists (
         select 1 from parents p left join parent_contacts c on c.parent_id = p.id
          where p.family_id = p_family_id and p.status = 'active'
            and lower(p.display_name) = lower(btrim(s.payload ->> 'Szülő neve'))
            and (nullif(btrim(coalesce(s.payload ->> 'E-mail', '')), '') is null
                 or c.contact_email is not distinct from lower(btrim(s.payload ->> 'E-mail')))
            and (nullif(btrim(coalesce(s.payload ->> 'Telefon', '')), '') is null
                 or c.contact_phone is not distinct from btrim(s.payload ->> 'Telefon'))
            and (nullif(btrim(coalesce(s.payload ->> 'Helység', '')), '') is null
                 or c.locality is not distinct from btrim(s.payload ->> 'Helység'))
            and (not (lower(btrim(coalesce(s.payload ->> 'Hozzájárulás', ''))) = 'igen'
                      and nullif(btrim(coalesce(s.payload ->> 'Opcionális profil', '')), '') is not null)
                 or (p.optional_profile_consent
                     and p.optional_profile is not distinct from btrim(s.payload ->> 'Opcionális profil'))))) then
    return true;
  end if;
  if exists (
    select 1 from import_staged_rows s
     where s.import_run_id = p_run_id and s.unit_ref = p_unit_ref
       and nullif(btrim(coalesce(s.payload ->> 'Szülő neve', '')), '') is null
       and nullif(btrim(coalesce(s.payload ->> 'Gyermek neve', '')), '') is not null
       and not exists (
         select 1 from children ch
          where ch.family_id = p_family_id and ch.status = 'active'
            and lower(ch.display_name) = lower(btrim(s.payload ->> 'Gyermek neve')))) then
    return true;
  end if;
  return false;
end $$;

-- Whether the file's values differ from the existing task's. A column the file leaves empty keeps the task's value.
create or replace function import_task_changed(
  p_task_id uuid, p_capacity integer, p_ends timestamptz, p_category text, p_location text, p_event text
) returns boolean
language sql stable set search_path from current
as $$
  select exists (
    select 1 from tasks t left join events e on e.id = t.event_id
     where t.id = p_task_id
       and (t.capacity <> p_capacity or t.ends_at <> p_ends
            or (p_category is not null and t.category <> p_category)
            or (p_location is not null and t.location <> p_location)
            or (p_event is not null and e.title is distinct from p_event)))
$$;

-- ---------------------------------------------------------------------------------------------------
-- import_match: what each staged row of a run is, now (BR41.4). One output row per staged row:
--   o_class    create (a new record), update (an existing one changes), none (nothing to do), conflict;
--   o_message  the reason of a conflict, from the closed list;
--   o_row_conflict  true when the conflict is the row's alone (the family of a task row), false when it belongs
--              to the whole unit (the unit's first row carries the conflict record);
--   o_type, o_id, o_version  the family or task the unit was matched to and its version, or null.
-- ---------------------------------------------------------------------------------------------------
create or replace function import_match(p_run_id uuid) returns table (
  o_staged_id uuid, o_unit_ref text, o_class text, o_message text, o_row_conflict boolean,
  o_type text, o_id uuid, o_version integer)
language plpgsql set search_path from current
as $$
declare
  c_directory constant text := 'Szülők elérhetősége';
  v_org uuid;
  v_year uuid;
  u record;
  q record;
  v_grp text;
  v_fam text;
  v_gid uuid;
  v_gstatus text;
  v_bad boolean;
  v_emails text[];
  v_fids uuid[];
  v_class text;
  v_msg text;
  v_type text;
  v_id uuid;
  v_ver integer;
  v_claimed uuid[] := '{}'::uuid[];
  v_task_ids uuid[];
  v_task tasks%rowtype;
  v_taken integer;
  v_changed boolean;
  v_seen uuid[];
  v_seen_names text[];
  v_dir_groups text[] := '{}'::text[];
  v_dir_families text[] := '{}'::text[];
  v_adds integer;
  v_fname text;
  v_fid uuid;
  v_row_class text;
  v_row_msg text;
  v_ids uuid[];
  v_classes text[];
  v_msgs text[];
  v_rowconf boolean[];
  v_first boolean;
  v_carried boolean;
  i integer;
begin
  select r.organization_id into v_org from import_runs r where r.id = p_run_id;
  if v_org is null then
    return;
  end if;
  v_year := import_active_year(v_org);

  -- Directory units: one family per Csoport and Család.
  for u in
    select s.unit_ref
      from import_staged_rows s join import_rows r on r.import_run_id = s.import_run_id and r.source_key = s.source_key
     where s.import_run_id = p_run_id and r.sheet = c_directory
     group by s.unit_ref
     order by min(r.row_number)
  loop
    v_class := 'create'; v_msg := null; v_type := null; v_id := null; v_ver := null; v_gid := null;
    v_grp := import_first(p_run_id, u.unit_ref, 'Csoport');
    v_fam := import_first(p_run_id, u.unit_ref, 'Család');

    select coalesce(bool_or(
             char_length(btrim(coalesce(s.payload ->> 'Csoport', ''))) not between 1 and 100
          or char_length(btrim(coalesce(s.payload ->> 'Család', ''))) not between 1 and 200
          or (nullif(btrim(coalesce(s.payload ->> 'E-mail', '')), '') is not null
              and (char_length(btrim(s.payload ->> 'E-mail')) > 254
                   or lower(btrim(s.payload ->> 'E-mail')) !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'))
          or (nullif(btrim(coalesce(s.payload ->> 'Telefon', '')), '') is not null
              and btrim(s.payload ->> 'Telefon') !~ '^[0-9 +-]{6,20}$')
          or char_length(btrim(coalesce(s.payload ->> 'Helység', ''))) > 100
          or char_length(btrim(coalesce(s.payload ->> 'Szülő neve', ''))) > 200
          or char_length(btrim(coalesce(s.payload ->> 'Gyermek neve', ''))) > 200
          or char_length(btrim(coalesce(s.payload ->> 'Opcionális profil', ''))) > 500), false)
      into v_bad
      from import_staged_rows s where s.import_run_id = p_run_id and s.unit_ref = u.unit_ref;
    if not v_bad then
      -- directory_save takes at most 10 parents and 20 children per family.
      select coalesce(
               count(distinct lower(btrim(s.payload ->> 'Szülő neve')))
                 filter (where nullif(btrim(coalesce(s.payload ->> 'Szülő neve', '')), '') is not null) > 10
            or count(distinct lower(btrim(s.payload ->> 'Gyermek neve')))
                 filter (where nullif(btrim(coalesce(s.payload ->> 'Szülő neve', '')), '') is null
                           and nullif(btrim(coalesce(s.payload ->> 'Gyermek neve', '')), '') is not null) > 20, false)
        into v_bad
        from import_staged_rows s where s.import_run_id = p_run_id and s.unit_ref = u.unit_ref;
    end if;

    if v_bad then
      v_class := 'conflict'; v_msg := 'Hibás adat a sorban.';
    else
      select g.id, g.status into v_gid, v_gstatus
        from groups g
       where g.organization_id = v_org and g.school_year_id = v_year and lower(g.name) = lower(v_grp);
      if v_year is null or (v_gid is not null and v_gstatus <> 'active') then
        v_class := 'conflict'; v_msg := 'Ismeretlen csoport.'; v_gid := null;
      else
        select coalesce(array_agg(distinct lower(btrim(s.payload ->> 'E-mail'))), '{}'::text[]) into v_emails
          from import_staged_rows s
         where s.import_run_id = p_run_id and s.unit_ref = u.unit_ref
           and nullif(btrim(coalesce(s.payload ->> 'E-mail', '')), '') is not null;
        -- Step 1: the e-mail addresses of the group's rows against the contacts of existing parents.
        select coalesce(array_agg(distinct f.id order by f.id), '{}'::uuid[]) into v_fids
          from parent_contacts c
          join parents p on p.id = c.parent_id and p.status = 'active'
          join families f on f.id = p.family_id and f.status = 'active'
         where c.organization_id = v_org and f.organization_id = v_org
           and cardinality(v_emails) > 0 and c.contact_email = any (v_emails);
        if cardinality(v_fids) = 1 then
          v_class := 'update'; v_id := v_fids[1];
        elsif cardinality(v_fids) >= 2 then
          v_class := 'conflict'; v_msg := 'Több egyező család.';
        else
          -- Step 2: the family name in the group.
          if v_gid is not null then
            select coalesce(array_agg(f.id order by f.id), '{}'::uuid[]) into v_fids
              from families f
              join group_memberships m on m.family_id = f.id and m.group_id = v_gid and m.status = 'active'
             where f.organization_id = v_org and f.status = 'active' and f.display_name = v_fam;
          else
            v_fids := '{}'::uuid[];
          end if;
          if cardinality(v_fids) = 1 then
            v_id := v_fids[1];
            if cardinality(v_emails) > 0 and exists (
                 select 1 from parents p join parent_contacts c on c.parent_id = p.id
                  where p.family_id = v_id and p.status = 'active' and c.contact_email is not null) then
              v_class := 'conflict'; v_msg := 'Az elem már létezik.';
            else
              v_class := 'update';
            end if;
          elsif cardinality(v_fids) >= 2 then
            v_class := 'conflict'; v_msg := 'Több egyező család.';
          end if;
        end if;
        -- A second workbook group that resolves to a family an earlier one already claimed.
        if v_id is not null then
          if v_id = any (v_claimed) then
            v_class := 'conflict'; v_msg := 'Ismétlődő sor a fájlban.';
          else
            v_claimed := v_claimed || v_id;
          end if;
          select f.version into v_ver from families f where f.id = v_id;
          v_type := 'family';
          if v_class = 'update' and not import_family_changed(p_run_id, u.unit_ref, v_id, v_gid, v_fam) then
            v_class := 'none';
          end if;
        end if;
      end if;
    end if;
    -- What a clean unit makes available to the task sheets of the same workbook: its group and its family.
    if v_class in ('create', 'update') then
      v_dir_groups := v_dir_groups || lower(v_grp);
      v_dir_families := v_dir_families || (lower(v_grp) || '|' || v_fam);
    end if;
    return query
      select s.id, s.unit_ref, v_class, v_msg, false, v_type, v_id, v_ver
        from import_staged_rows s where s.import_run_id = p_run_id and s.unit_ref = u.unit_ref;
  end loop;

  -- Task units: one task per Csoport, Feladat and Kezdés, with the assigned families decided row by row.
  for u in select * from import_task_units(p_run_id)
  loop
    v_class := 'create'; v_msg := null; v_type := null; v_id := null; v_ver := null; v_gid := null;
    v_changed := false; v_taken := 0;
    if not u.o_valid then
      v_class := 'conflict'; v_msg := 'Hibás adat a sorban.';
    else
      select g.id into v_gid from groups g
       where g.organization_id = v_org and g.school_year_id = v_year and g.status = 'active'
         and lower(g.name) = lower(u.o_grp);
      -- A group that does not exist yet but that the same workbook creates on its directory sheet is a valid
      -- reference (the commit applies the directory units first). A group nobody creates is unknown.
      if v_gid is null and not (lower(u.o_grp) = any (v_dir_groups)) then
        v_class := 'conflict'; v_msg := 'Ismeretlen csoport.';
      else
        if v_gid is null then
          v_task_ids := '{}'::uuid[];
        else
          select coalesce(array_agg(t.id order by t.id), '{}'::uuid[]) into v_task_ids
            from tasks t
           where t.organization_id = v_org and t.group_id = v_gid and t.title = u.o_title and t.starts_at = u.o_starts;
        end if;
        if cardinality(v_task_ids) >= 2 then
          v_class := 'conflict'; v_msg := 'Több egyező feladat.';
        elsif cardinality(v_task_ids) = 1 then
          select * into v_task from tasks t where t.id = v_task_ids[1];
          v_type := 'task'; v_id := v_task.id; v_ver := v_task.version;
          select count(*)::integer into v_taken from assignments a where a.task_id = v_task.id and a.status <> 'removed';
          if v_task.status = 'cancelled' or u.o_capacity < v_taken then
            v_class := 'conflict'; v_msg := 'Hibás adat a sorban.';
          else
            v_class := 'update';
            v_changed := import_task_changed(v_task.id, u.o_capacity, u.o_ends, u.o_category, u.o_location, u.o_event);
          end if;
        end if;
      end if;
    end if;

    v_ids := '{}'::uuid[]; v_classes := '{}'::text[]; v_msgs := '{}'::text[]; v_rowconf := '{}'::boolean[];
    v_seen := '{}'::uuid[]; v_seen_names := '{}'::text[]; v_adds := 0; v_first := true; v_carried := false;
    for q in
      select s.id, s.payload
        from import_staged_rows s join import_rows r on r.import_run_id = s.import_run_id and r.source_key = s.source_key
       where s.import_run_id = p_run_id and s.unit_ref = u.o_unit_ref
       order by r.sheet, r.row_number
    loop
      v_row_class := null; v_row_msg := null;
      if v_class = 'conflict' then
        v_row_class := 'conflict'; v_row_msg := v_msg;
        v_ids := v_ids || q.id; v_classes := v_classes || v_row_class; v_msgs := v_msgs || v_row_msg;
        v_rowconf := v_rowconf || false;
      else
        v_fname := nullif(btrim(coalesce(q.payload ->> 'Család', '')), '');
        if v_fname is null then
          v_row_class := case when v_class = 'create' then 'create' else 'none' end;
        else
          select coalesce(array_agg(f.id order by f.id), '{}'::uuid[]) into v_fids
            from families f
            join group_memberships m on m.family_id = f.id and m.group_id = v_gid and m.status = 'active'
           where f.organization_id = v_org and f.status = 'active' and f.display_name = v_fname;
          if cardinality(v_fids) = 0 and (lower(u.o_grp) || '|' || v_fname) = any (v_dir_families) then
            -- A family the same workbook creates or changes in this group on its directory sheet.
            if (lower(u.o_grp) || '|' || v_fname) = any (v_seen_names) then
              v_row_class := 'none';
            else
              v_seen_names := v_seen_names || (lower(u.o_grp) || '|' || v_fname);
              v_adds := v_adds + 1;
              if v_taken + v_adds > u.o_capacity then
                v_row_class := 'conflict'; v_row_msg := 'Hibás adat a sorban.';
              else
                v_row_class := case when v_class = 'create' then 'create' else 'update' end;
              end if;
            end if;
          elsif cardinality(v_fids) = 0 then
            v_row_class := 'conflict'; v_row_msg := 'Ismeretlen család.';
          elsif cardinality(v_fids) >= 2 then
            v_row_class := 'conflict'; v_row_msg := 'Több egyező család.';
          else
            v_fid := v_fids[1];
            if v_fid = any (v_seen) then
              v_row_class := 'none';
            else
              v_seen := v_seen || v_fid;
              if v_type is not null and exists (
                   select 1 from assignments a
                    where a.task_id = v_id and a.family_id = v_fid and a.status <> 'removed') then
                v_row_class := case when v_class = 'create' then 'create' else 'none' end;
              else
                v_adds := v_adds + 1;
                if v_taken + v_adds > u.o_capacity then
                  v_row_class := 'conflict'; v_row_msg := 'Hibás adat a sorban.';
                else
                  v_row_class := case when v_class = 'create' then 'create' else 'update' end;
                end if;
              end if;
            end if;
          end if;
        end if;
        v_ids := v_ids || q.id; v_classes := v_classes || v_row_class;
        v_msgs := v_msgs || coalesce(v_row_msg, '');
        v_rowconf := v_rowconf || (v_row_class = 'conflict');
        if v_row_class in ('create', 'update') then
          v_carried := true;
        end if;
      end if;
      v_first := false;
    end loop;

    -- A changed task must be carried by a row that applies: the first row that is not a conflict.
    if v_class = 'update' and v_changed and not v_carried then
      for i in 1 .. coalesce(cardinality(v_ids), 0) loop
        if v_classes[i] <> 'conflict' then
          v_classes[i] := 'update';
          exit;
        end if;
      end loop;
    end if;

    for i in 1 .. coalesce(cardinality(v_ids), 0) loop
      o_staged_id := v_ids[i];
      o_unit_ref := u.o_unit_ref;
      o_class := v_classes[i];
      o_message := case when v_classes[i] = 'conflict' then v_msgs[i] else null end;
      o_row_conflict := v_rowconf[i];
      o_type := v_type;
      o_id := v_id;
      o_version := v_ver;
      return next;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- import_run_model: a run as the import screen needs it (BR41.3, BR41.13). The model state follows the
-- mapping of BR41.13: previewed with open conflicts is 'conflicts', previewed without is 'preview', and the
-- other states are their own names. The run's own status is in `run_status`.
-- ---------------------------------------------------------------------------------------------------
create or replace function import_run_model(p_run_id uuid) returns jsonb
language plpgsql stable set search_path from current
as $$
declare
  r import_runs%rowtype;
  v_open integer;
  v_state text;
  v_conflicts jsonb;
  v_warnings integer;
begin
  select * into r from import_runs where id = p_run_id;
  if not found then
    return null;
  end if;
  select count(*)::integer into v_open from import_conflicts c where c.import_run_id = r.id and c.resolution is null;
  v_state := case r.status
    when 'previewed' then case when v_open > 0 then 'conflicts' else 'preview' end
    else r.status end;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'row_label', c.row_label, 'message', c.message, 'resolution', c.resolution,
           'skip_only', import_conflict_skip_only(c.message, i.sheet))
           order by sr.sort_order, i.row_number), '[]'::jsonb)
    into v_conflicts
    from import_conflicts c
    join import_rows i on i.id = c.import_row_id
    join sheet_registry sr on sr.sheet = i.sheet
   where c.import_run_id = r.id;
  select coalesce(sum(i.warning_count), 0)::integer into v_warnings from import_rows i where i.import_run_id = r.id;
  return jsonb_build_object(
    'run_id', r.id, 'version', r.version, 'workbook_name', r.workbook_name, 'fingerprint', r.workbook_fingerprint,
    'step', r.step, 'model_state', v_state, 'run_status', r.status, 'total_rows', r.total_rows,
    'imported_rows', r.imported_rows, 'skipped_rows', r.skipped_rows, 'warning_count', v_warnings,
    'changed_rows', r.changed_summary, 'conflicts', v_conflicts, 'open_conflicts', v_open,
    'expires_at', r.expires_at);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- import_expire_org: marks the organization's previewed, confirmed and interrupted runs whose time (seven days
-- after the upload) has passed as expired and deletes their staged rows (BR41.8). Returns the number of runs.
-- ---------------------------------------------------------------------------------------------------
create or replace function import_expire_org(p_organization_id uuid) returns integer
language plpgsql set search_path from current
as $$
declare v_ids uuid[];
begin
  with expired as (
    update import_runs set status = 'expired', version = version + 1, updated_at = now()
     where organization_id = p_organization_id and status in ('previewed', 'confirmed', 'interrupted')
       and expires_at <= now()
    returning id)
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from expired;
  delete from import_staged_rows where import_run_id = any (v_ids);
  return cardinality(v_ids);
end $$;

-- The super admin check shared by the import functions below: the organization of the signed-in account when
-- it is a super admin, else null.
create or replace function import_super_organization() returns uuid
language sql stable set search_path from current
as $$
  select o from (select identity_actor_organization() as o) x where o is not null and has_super_scope(o)
$$;

-- ---------------------------------------------------------------------------------------------------
-- import_preview_create: a super admin sends the parsed workbook rows; the function stages them, decides what
-- each is (import_match), records the matched record and its version, builds the fingerprint and returns the
-- run with the preview model (BR41.3). A second preview by the same super admin cancels their earlier open
-- run first; the two previews of a double click or of two tabs are serialized, so exactly one run stays open.
-- Validation: an array of 1 to 100000 rows, each with a registered sheet, a row number of 1 or more and
-- (interactive sheets) an object of string values; a file name of 1 to 200 characters without a path.
-- ---------------------------------------------------------------------------------------------------
create or replace function import_preview_create(p_idempotency_key text, p_workbook_name text, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'import.preview';
  c_directory constant text := 'Szülők elérhetősége';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_name text;
  v_run import_runs%rowtype;
  v_total integer;
  v_hash text;
  v_open integer;
  v_summary jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', coalesce(p_workbook_name, ''), coalesce(p_rows::text, '')), 'UTF8')), 'hex');
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
    v_name := btrim(coalesce(p_workbook_name, ''));
    if char_length(v_name) not between 1 and 200 or v_name ~ '[/\\]' then
      perform platform_field_invalid('workbook_name');
    end if;
    if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
      perform platform_abort('validation', 'request_invalid');
    end if;
    v_total := jsonb_array_length(p_rows);
    if v_total not between 1 and 100000 then
      perform platform_abort('validation', 'request_invalid');
    end if;
    -- Every element: an object with a registered sheet and a row number; an interactive sheet needs its
    -- values (an object of string values), an archive sheet's values are never read.
    if exists (
      select 1 from jsonb_array_elements(p_rows) e
       where jsonb_typeof(e) <> 'object'
          or jsonb_typeof(e -> 'sheet') is distinct from 'string'
          or jsonb_typeof(e -> 'row') is distinct from 'number'
          or coalesce(platform_try_integer(e ->> 'row'), 0) < 1
          or not exists (select 1 from sheet_registry sr
                          where sr.sheet = e ->> 'sheet'
                            and (sr.mode = 'read_only_archive'
                                 or (jsonb_typeof(e -> 'values') = 'object' and import_payload_valid(e -> 'values'))))
          or (e ? 'warnings' and coalesce(platform_try_integer(e ->> 'warnings'), -1) < 0)) then
      perform platform_abort('validation', 'request_invalid');
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_rows) e group by e ->> 'sheet', e ->> 'row' having count(*) > 1) then
      perform platform_abort('validation', 'request_invalid');
    end if;

    -- One open run per super admin and organization: serialize the previews of this account, then cancel the
    -- earlier run and delete its staged rows.
    perform pg_advisory_xact_lock(hashtextextended(
      'import.preview|' || current_schema() || '|' || v_org::text || '|' || auth.uid()::text, 0));
    with cancelled as (
      update import_runs set status = 'cancelled', version = version + 1, updated_at = now()
       where organization_id = v_org and started_by_account_id = auth.uid()
         and status in ('previewed', 'confirmed', 'interrupted')
      returning id)
    delete from import_staged_rows where import_run_id in (select id from cancelled);

    insert into import_runs (organization_id, workbook_name, workbook_fingerprint, status, step, total_rows,
                             started_by_account_id, expires_at)
    values (v_org, v_name, repeat('0', 64), 'previewed', 4, v_total, auth.uid(), now() + interval '7 days')
    returning * into v_run;

    insert into import_rows (organization_id, import_run_id, sheet, row_number, source_key, warning_count)
    select v_org, v_run.id, e ->> 'sheet', (e ->> 'row')::integer, (e ->> 'sheet') || ':' || (e ->> 'row'),
           coalesce(platform_try_integer(e ->> 'warnings'), 0)
      from jsonb_array_elements(p_rows) e;

    -- The optional profile is staged only with the consent mark 'igen' (BR41.2); the parser drops it too.
    insert into import_staged_rows (organization_id, import_run_id, source_key, payload, unit_ref)
    select v_org, v_run.id, (e ->> 'sheet') || ':' || (e ->> 'row'),
           case when (e ->> 'sheet') = c_directory
                 and lower(btrim(coalesce(e -> 'values' ->> 'Hozzájárulás', ''))) <> 'igen'
                then (e -> 'values') - 'Opcionális profil'
                else e -> 'values' end,
           import_unit_ref(e ->> 'sheet', e -> 'values')
      from jsonb_array_elements(p_rows) e
      join sheet_registry sr on sr.sheet = e ->> 'sheet' and sr.mode = 'interactive';

    update import_staged_rows s set is_leader = true
      from (select distinct on (s2.unit_ref) s2.id
              from import_staged_rows s2
              join import_rows r on r.import_run_id = s2.import_run_id and r.source_key = s2.source_key
             where s2.import_run_id = v_run.id
             order by s2.unit_ref, r.sheet, r.row_number) l
     where s.id = l.id;

    update import_staged_rows s
       set match_class = m.o_class, conflict_message = m.o_message, row_conflict = m.o_row_conflict,
           matched_record_type = m.o_type, matched_record_id = m.o_id,
           matched_record_version = case when m.o_type is null then null else m.o_version end
      from import_match(v_run.id) m
     where s.id = m.o_staged_id;

    -- A conflict record per unit (on its first row) and per row-level conflict; those rows show as conflicts.
    insert into import_conflicts (organization_id, import_run_id, import_row_id, row_label, message)
    select v_org, v_run.id, r.id, r.sheet || ' · ' || r.row_number || '. sor', s.conflict_message
      from import_staged_rows s
      join import_rows r on r.import_run_id = s.import_run_id and r.source_key = s.source_key
     where s.import_run_id = v_run.id and s.match_class = 'conflict' and (s.row_conflict or s.is_leader);
    update import_rows r set outcome = 'conflict'
      from import_staged_rows s
     where s.import_run_id = v_run.id and r.import_run_id = s.import_run_id and r.source_key = s.source_key
       and s.match_class = 'conflict';

    select count(*)::integer into v_open from import_conflicts c where c.import_run_id = v_run.id;
    select coalesce(jsonb_agg(g.grp || ' csoport: ' || g.n || ' módosítás' order by g.grp), '[]'::jsonb) into v_summary
      from (select btrim(s.payload ->> 'Csoport') as grp, count(*) as n
              from import_staged_rows s
             where s.import_run_id = v_run.id and s.match_class in ('create', 'update')
               and nullif(btrim(coalesce(s.payload ->> 'Csoport', '')), '') is not null
             group by 1) g;
    v_hash := import_fingerprint(v_run.id);
    update import_runs
       set workbook_fingerprint = v_hash, step = case when v_open > 0 then 4 else 5 end,
           changed_summary = v_summary, updated_at = now()
     where id = v_run.id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_run.id);
    return platform_result('success', v_run.id, null) || import_run_model(v_run.id);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- import_conflict_resolve: the starting super admin decides one conflict: keep the existing record
-- (keep_existing) or use the file's row (use_import) (BR41.5). The run must be previewed or confirmed and the
-- sent run version the stored one; the response carries the new version for the next decision, and when no
-- conflict is open the run becomes confirmed (step 5). A stale or missing run gives the invalidated result
-- IMPORT_PREVIEW_STALE; an unknown conflict or resolution, or use_import where there is nothing to import into,
-- gives the conflict IMPORT_CONFLICT_UNRESOLVED.
-- ---------------------------------------------------------------------------------------------------
create or replace function import_conflict_resolve(
  p_idempotency_key text, p_run_id uuid, p_expected_run_version integer, p_conflict_id uuid, p_resolution text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'import.resolve';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_run import_runs%rowtype;
  v_conflict import_conflicts%rowtype;
  v_sheet text;
  v_resolution text;
  v_open integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_run_id::text, p_expected_run_version::text,
    p_conflict_id::text, p_resolution), 'UTF8')), 'hex');
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
    if not found or v_run.status not in ('previewed', 'confirmed') or v_run.version is distinct from p_expected_run_version then
      perform platform_abort('invalidated', 'IMPORT_PREVIEW_STALE');
    end if;
    v_resolution := replace(lower(btrim(coalesce(p_resolution, ''))), '-', '_');
    select c.* into v_conflict from import_conflicts c where c.id = p_conflict_id and c.import_run_id = v_run.id;
    if not found or v_resolution not in ('keep_existing', 'use_import') then
      perform platform_abort('conflict', 'IMPORT_CONFLICT_UNRESOLVED');
    end if;
    select i.sheet into v_sheet from import_rows i where i.id = v_conflict.import_row_id;
    if v_resolution = 'use_import' and import_conflict_skip_only(v_conflict.message, v_sheet) then
      perform platform_abort('conflict', 'IMPORT_CONFLICT_UNRESOLVED');
    end if;

    update import_conflicts set resolution = v_resolution where id = v_conflict.id;
    select count(*)::integer into v_open from import_conflicts c where c.import_run_id = v_run.id and c.resolution is null;
    update import_runs
       set version = version + 1, updated_at = now(),
           status = case when v_open = 0 then 'confirmed' else 'previewed' end,
           step = case when v_open = 0 then 5 else 4 end
     where id = v_run.id;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_run.id);
    return platform_result('success', v_run.id, null) || import_run_model(v_run.id);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- import_status: the starting super admin's latest run that is previewed, confirmed, interrupted, committed or
-- recovered, as the model of BR41.13; cancelled and expired runs are not returned, so the screen shows the
-- upload form. Runs past their seven days are expired first.
-- ---------------------------------------------------------------------------------------------------
create or replace function import_status() returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_run uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := import_super_organization();
  if v_org is null then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  perform import_expire_org(v_org);
  select r.id into v_run from import_runs r
   where r.organization_id = v_org and r.started_by_account_id = auth.uid()
     and r.status in ('previewed', 'confirmed', 'interrupted', 'committed', 'recovered')
   order by r.created_at desc, r.id desc
   limit 1;
  return platform_result('success', v_run, null) || jsonb_build_object('run', import_run_model(v_run));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- import_cancel: the starting super admin ends their open run; its staged rows are deleted (BR41.8). A run that
-- is already cancelled answers success again; a finished, expired or unknown run gives IMPORT_PREVIEW_STALE.
-- ---------------------------------------------------------------------------------------------------
create or replace function import_cancel(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_run import_runs%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := import_super_organization();
  if v_org is null then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_run from import_runs r
   where r.id = p_run_id and r.organization_id = v_org and r.started_by_account_id = auth.uid() for update;
  if not found or v_run.status in ('committed', 'recovered', 'expired') then
    return platform_result('invalidated', null, 'IMPORT_PREVIEW_STALE');
  end if;
  if v_run.status <> 'cancelled' then
    update import_runs set status = 'cancelled', version = version + 1, updated_at = now() where id = v_run.id;
    delete from import_staged_rows where import_run_id = v_run.id;
  end if;
  return platform_result('success', v_run.id, null) || import_run_model(v_run.id);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- import_mark_interrupted: after a commit failed with a retryable failure (the database rolled back, so the
-- run is exactly as before), the adapter marks the run interrupted in a small transaction of its own
-- (BR41.9): status interrupted, step 6. Only the starter, only a previewed or confirmed run; an interrupted run
-- answers success again; if this call fails too, the run stays as it was and the commit can be repeated.
-- ---------------------------------------------------------------------------------------------------
create or replace function import_mark_interrupted(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_run import_runs%rowtype;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := import_super_organization();
  if v_org is null then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_run from import_runs r
   where r.id = p_run_id and r.organization_id = v_org and r.started_by_account_id = auth.uid() for update;
  if not found or v_run.status not in ('previewed', 'confirmed', 'interrupted') then
    return platform_result('invalidated', null, 'IMPORT_PREVIEW_STALE');
  end if;
  if v_run.status <> 'interrupted' then
    update import_runs set status = 'interrupted', step = 6, version = version + 1, updated_at = now()
     where id = v_run.id;
  end if;
  return platform_result('success', v_run.id, null) || import_run_model(v_run.id);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- import_expire: a super admin of the organization sweeps the runs older than seven days (BR41.8); the import
-- screen calls it when it opens. import_expire_system is the same sweep for the system caller (housekeeping,
-- seed, reset), through the service-role key. Both return the number of runs that expired.
-- ---------------------------------------------------------------------------------------------------
create or replace function import_expire(p_organization_id uuid default null) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_org uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := import_super_organization();
  if v_org is null or (p_organization_id is not null and p_organization_id <> v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  return platform_result('success', null, null) || jsonb_build_object('expired', import_expire_org(v_org));
end $$;

create or replace function import_expire_system(p_organization_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_organization_id is null or not exists (select 1 from organizations o where o.id = p_organization_id) then
    return platform_result('validation', null, 'organization_not_found');
  end if;
  return platform_result('success', null, null) || jsonb_build_object('expired', import_expire_org(p_organization_id));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- import_recover: the starting super admin resumes an interrupted run with the action 'resume': the commit is
-- run again from the still-staged rows with the same fingerprint, and the result is recovered (step 7)
-- (BR41.9). Any other action gives IMPORT_RECOVERY_ACTION_INVALID; a run that is not interrupted, or whose
-- seven days have passed, gives IMPORT_RECOVERY_NOT_AVAILABLE. The application of the rows is `import_apply`
-- of 20261041, shared with the commit.
-- ---------------------------------------------------------------------------------------------------
create or replace function import_recover(p_idempotency_key text, p_run_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'import.recover';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_run import_runs%rowtype;
  v_result jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_run_id::text, p_action), 'UTF8')), 'hex');
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
    if p_action is distinct from 'resume' then
      perform platform_abort('conflict', 'IMPORT_RECOVERY_ACTION_INVALID');
    end if;
    select * into v_run from import_runs r
     where r.id = p_run_id and r.organization_id = v_org and r.started_by_account_id = auth.uid() for update;
    if not found or v_run.status <> 'interrupted' or v_run.expires_at <= now() then
      perform platform_abort('conflict', 'IMPORT_RECOVERY_NOT_AVAILABLE');
    end if;

    v_result := import_apply(v_run.id, 'recovered');
    if v_result->>'state' = 'success' then
      perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_run.id);
    end if;
    return v_result;
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Function rights. The helpers are internal (nobody executes them directly); the use cases are executable by
-- signed-in accounts and check their caller themselves; the system sweep is executable by the service-role
-- key only.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  import_time(text),
  import_unit_ref(text, jsonb),
  import_conflict_skip_only(text, text),
  import_first(uuid, text, text),
  import_active_year(uuid),
  import_fingerprint(uuid),
  import_task_units(uuid),
  import_family_changed(uuid, text, uuid, uuid, text),
  import_task_changed(uuid, integer, timestamptz, text, text, text),
  import_match(uuid),
  import_run_model(uuid),
  import_expire_org(uuid),
  import_super_organization(),
  import_preview_create(text, text, jsonb),
  import_conflict_resolve(text, uuid, integer, uuid, text),
  import_status(),
  import_cancel(uuid),
  import_mark_interrupted(uuid),
  import_expire(uuid),
  import_expire_system(uuid),
  import_recover(text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function
  import_preview_create(text, text, jsonb),
  import_conflict_resolve(text, uuid, integer, uuid, text),
  import_status(),
  import_cancel(uuid),
  import_mark_interrupted(uuid),
  import_expire(uuid),
  import_recover(text, uuid, text)
  to authenticated;
grant execute on function import_expire_system(uuid) to service_role;
