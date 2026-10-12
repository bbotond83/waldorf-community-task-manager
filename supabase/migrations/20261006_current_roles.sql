-- Explicit offline conversion. Never invoke on browser requests.
-- Operators must verify EVERY accepting issuer performs authoritative lookup,
-- missing rows reject, and the baseline default generation is 1 before setting:
-- On the reviewed migration connection, before this file runs:
-- SET waldorf.authoritative_issuer_baseline = 'verified-v1';
-- RESET that setting after execution. A runner-owned transaction may use SET LOCAL.
-- Schema-neutral: names are resolved through the session search path (the migration runner
-- sets it to the target schema), so the same file applies to the default and worker schemas.
begin;
lock table app_role_grants in exclusive mode;
lock table app_authorization_versions in exclusive mode;

-- Locks precede preflight and remain held through constraints/policy replacement.
do $$
declare expected record;
begin
  if current_setting('waldorf.authoritative_issuer_baseline', true) is distinct from 'verified-v1' then
    raise exception 'INCOMPATIBLE_SCHEMA: authoritative issuer baseline not verified';
  end if;
  for expected in select * from (values
    ('app_role_grants','id','uuid'), ('app_role_grants','subject_id','uuid'),
    ('app_role_grants','role','text'), ('app_role_grants','scope_type','text'),
    ('app_role_grants','scope_id','uuid'), ('app_role_grants','organization_id','uuid'),
    ('app_role_grants','revoked_at','timestamp with time zone'),
    ('app_authorization_versions','subject_id','uuid'),
    ('app_authorization_versions','authorization_version','integer'),
    ('app_families','id','uuid'), ('app_families','organization_id','uuid'), ('app_families','scope_id','uuid'),
    ('app_assignments','id','uuid'), ('app_assignments','organization_id','uuid'), ('app_assignments','scope_id','uuid'),
    ('app_import_runs','id','uuid'), ('app_import_runs','organization_id','uuid'), ('app_import_runs','scope_id','uuid'),
    ('app_audit_events','id','uuid'), ('app_audit_events','organization_id','uuid'), ('app_audit_events','scope_id','uuid')
  ) as required(table_name,column_name,data_type) loop
    if not exists (select 1 from information_schema.columns c where c.table_schema=current_schema() and c.table_name=expected.table_name and c.column_name=expected.column_name and c.data_type=expected.data_type) then
      raise exception 'INCOMPATIBLE_SCHEMA: required column type';
    end if;
    if expected.column_name <> 'revoked_at' and not exists (select 1 from information_schema.columns c where c.table_schema=current_schema() and c.table_name=expected.table_name and c.column_name=expected.column_name and c.is_nullable='NO') then
      raise exception 'INCOMPATIBLE_SCHEMA: nullable required column';
    end if;
  end loop;
  if exists (select id from app_role_grants group by id having count(*)<>1) or exists (select subject_id from app_authorization_versions group by subject_id having count(*)<>1) then
    raise exception 'INCOMPATIBLE_SCHEMA: duplicate identity';
  end if;
  if exists (select 1 from pg_trigger where tgrelid in ('app_role_grants'::regclass,'app_authorization_versions'::regclass) and not tgisinternal)
     or not exists (select 1 from information_schema.columns where table_schema=current_schema() and table_name='app_authorization_versions' and column_name='authorization_version' and column_default='1') then
    raise exception 'INCOMPATIBLE_SCHEMA: trigger or version default';
  end if;
  if exists (select 1 from app_role_grants where not coalesce((
    (role='parent' and scope_type='family') or
    (role in ('group_admin','read_only_staff','kindergarten_teacher') and scope_type='group') or
    (role in ('super_admin','kindergarten_admin') and scope_type='organization' and scope_id=organization_id)
  ),false)) then raise exception 'UNSUPPORTED_ROLE_OR_SCOPE'; end if;
  if exists (select 1 from app_authorization_versions where authorization_version is null or authorization_version <= 0)
     or exists (select 1 from app_authorization_versions v join app_role_grants g on g.subject_id=v.subject_id where g.role in ('read_only_staff','kindergarten_admin') and v.authorization_version=2147483647) then
    raise exception 'INCOMPATIBLE_SCHEMA: invalid or overflowing version';
  end if;
end $$;

create table if not exists app_role_conversion_evidence (
  operation_id uuid not null,
  grant_id uuid not null,
  subject_id uuid not null,
  organization_id uuid not null,
  original_role text not null check (original_role in ('read_only_staff','kindergarten_admin')),
  "current_role" text not null check ("current_role" in ('kindergarten_teacher','super_admin')),
  outcome text not null check (outcome='converted'),
  primary key (operation_id,grant_id)
);
-- Snapshot only conversion identity, not contact/display data. No historical deletion.
create temporary table changed_role_grants on commit drop as
select id,subject_id,organization_id,role as original_role,
  case role when 'read_only_staff' then 'kindergarten_teacher' when 'kindergarten_admin' then 'super_admin' end as "current_role"
from app_role_grants where role in ('read_only_staff','kindergarten_admin');
update app_role_grants g set role=c."current_role" from changed_role_grants c where g.id=c.id;
insert into app_authorization_versions(subject_id,authorization_version)
select distinct subject_id,2 from changed_role_grants
on conflict(subject_id) do update set authorization_version=app_authorization_versions.authorization_version+1;
insert into app_role_conversion_evidence
with operation as materialized (select gen_random_uuid() as id)
select operation.id,c.id,c.subject_id,c.organization_id,c.original_role,c."current_role",'converted' from changed_role_grants c cross join operation;

alter table app_role_grants drop constraint if exists current_role_scope;
alter table app_role_grants add constraint current_role_scope check (
  (role='parent' and scope_type='family') or
  (role in ('group_admin','kindergarten_teacher') and scope_type='group') or
  (role='super_admin' and scope_type='organization' and scope_id=organization_id)
);
alter table app_authorization_versions drop constraint if exists positive_authorization_version;
alter table app_authorization_versions add constraint positive_authorization_version check(authorization_version>0);

-- Inventory/remove EVERY existing policy on owned tables: permissive policy union
-- must never retain an older widening clause. Privileged writers need separate review.
do $$ declare policy record; begin
  for policy in select schemaname,tablename,policyname from pg_policies where schemaname=current_schema() and tablename in
    ('app_role_grants','app_authorization_versions','app_families','app_assignments','app_import_runs','app_audit_events','app_role_conversion_evidence')
  loop execute format('drop policy %I on %I.%I',policy.policyname,policy.schemaname,policy.tablename); end loop;
end $$;

drop function if exists has_active_scope(uuid,uuid);
drop function if exists has_admin_scope(uuid,uuid);
create or replace function authorization_version_for(requested_subject_id uuid)
returns integer language sql stable security definer set search_path from current
as $$ select authorization_version from app_authorization_versions where subject_id=requested_subject_id and requested_subject_id=auth.uid() $$;
create or replace function has_current_role_scope(requested_role text,requested_organization_id uuid,requested_scope_type text,requested_scope_id uuid)
returns boolean language sql stable security definer set search_path from current
as $$ select exists(select 1 from app_role_grants g where g.subject_id=auth.uid() and g.revoked_at is null and g.role=requested_role and g.organization_id=requested_organization_id and g.scope_type=requested_scope_type and g.scope_id=requested_scope_id and (
  (g.role='parent' and g.scope_type='family') or
  (g.role in ('group_admin','kindergarten_teacher') and g.scope_type='group') or
  (g.role='super_admin' and g.scope_type='organization' and g.scope_id=g.organization_id)
)) $$;
create or replace function has_super_scope(requested_organization_id uuid)
returns boolean language sql stable security definer set search_path from current
as $$ select has_current_role_scope('super_admin',requested_organization_id,'organization',requested_organization_id) $$;
create or replace function has_core_scope(requested_organization_id uuid,requested_group_id uuid)
returns boolean language sql stable security definer set search_path from current
as $$ select has_super_scope(requested_organization_id) or has_current_role_scope('group_admin',requested_organization_id,'group',requested_group_id) $$;
revoke all on function authorization_version_for(uuid),has_current_role_scope(text,uuid,text,uuid),has_super_scope(uuid),has_core_scope(uuid,uuid) from public;
grant execute on function authorization_version_for(uuid),has_current_role_scope(text,uuid,text,uuid),has_super_scope(uuid),has_core_scope(uuid,uuid) to authenticated;

alter table app_authorization_versions enable row level security;
alter table app_role_conversion_evidence enable row level security;
revoke insert,update,delete on app_role_grants,app_authorization_versions,app_role_conversion_evidence from anon,authenticated;
-- No ordinary client mutation policies; normal grant/version writers must use
-- the Access transaction with active-subject/final-administrator protection.
create policy current_grants_self on app_role_grants for select to authenticated using(subject_id=auth.uid() and revoked_at is null);
create policy current_version_self on app_authorization_versions for select to authenticated using(subject_id=auth.uid());
create policy conversion_governance_read on app_role_conversion_evidence for select to authenticated using(has_super_scope(organization_id));
-- Parent identity is the family row id, NOT the row's group scope_id.
create policy family_current_read on app_families for select to authenticated using(has_core_scope(organization_id,scope_id) or has_current_role_scope('parent',organization_id,'family',id));
create policy family_current_insert on app_families for insert to authenticated with check(has_core_scope(organization_id,scope_id));
create policy family_current_update on app_families for update to authenticated using(has_core_scope(organization_id,scope_id)) with check(has_core_scope(organization_id,scope_id));
create policy family_current_delete on app_families for delete to authenticated using(has_core_scope(organization_id,scope_id));
-- Baseline assignments lack family_id: unsupported parent relationship DENIES.
-- Teachers receive no raw family/assignment table access; U2 projects tracking.
create policy assignment_current_read on app_assignments for select to authenticated using(has_core_scope(organization_id,scope_id));
create policy assignment_current_insert on app_assignments for insert to authenticated with check(has_core_scope(organization_id,scope_id));
create policy assignment_current_update on app_assignments for update to authenticated using(has_core_scope(organization_id,scope_id)) with check(has_core_scope(organization_id,scope_id));
create policy assignment_current_delete on app_assignments for delete to authenticated using(has_core_scope(organization_id,scope_id));
create policy import_current_read on app_import_runs for select to authenticated using(has_super_scope(organization_id));
create policy import_current_insert on app_import_runs for insert to authenticated with check(has_super_scope(organization_id));
create policy import_current_update on app_import_runs for update to authenticated using(has_super_scope(organization_id)) with check(has_super_scope(organization_id));
create policy import_current_delete on app_import_runs for delete to authenticated using(has_super_scope(organization_id));
create policy audit_current_read on app_audit_events for select to authenticated using(has_super_scope(organization_id));
commit;
