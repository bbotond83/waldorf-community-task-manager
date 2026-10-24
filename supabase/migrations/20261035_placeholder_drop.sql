-- U3 removal of the placeholder family and assignment tables of the first migration (NFR6.14, entities.md,
-- "Placeholder tables"). This file sorts last on purpose: the function rewrite of the file before it has
-- moved every user of the tables to the Directory and Coordination tables. A table is dropped only when the
-- catalogue shows nothing that still names it: no function body, no policy of another table, no view and no
-- foreign key. When something does, the table is kept and a warning names every user, so the next person
-- knows what to move first. `app_import_runs` stays for U4.
do $$
declare
  v_table text;
  v_users text[];
begin
  foreach v_table in array array['app_families', 'app_assignments'] loop
    if to_regclass(v_table) is null then
      continue;
    end if;
    select coalesce(array_agg(found.user_name order by found.user_name), '{}') into v_users
      from (
        select 'function ' || p.proname as user_name
          from pg_proc p
         where p.pronamespace = current_schema()::regnamespace and position(v_table in p.prosrc) > 0
        union all
        select 'policy ' || pol.tablename || '.' || pol.policyname
          from pg_policies pol
         where pol.schemaname = current_schema() and pol.tablename <> v_table
           and (position(v_table in coalesce(pol.qual, '')) > 0 or position(v_table in coalesce(pol.with_check, '')) > 0)
        union all
        select 'view ' || v.viewname
          from pg_views v
         where v.schemaname = current_schema() and position(v_table in v.definition) > 0
        union all
        select 'foreign key ' || c.conname
          from pg_constraint c where c.confrelid = to_regclass(v_table)
      ) found;
    if cardinality(v_users) = 0 then
      execute format('drop table %I', v_table);
    else
      raise warning 'placeholder table % kept: still named by %', v_table, array_to_string(v_users, ', ');
    end if;
  end loop;
end $$;
