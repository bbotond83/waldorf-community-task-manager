-- Invented supported historical baseline only; never loaded into an existing target.
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
create table if not exists app_role_grants (
  id uuid primary key,
  subject_id uuid not null,
  role text not null,
  scope_type text not null,
  scope_id uuid not null,
  organization_id uuid not null,
  revoked_at timestamptz
);
create table if not exists app_authorization_versions (
  subject_id uuid primary key,
  authorization_version integer not null default 1
);
alter table app_role_grants enable row level security;
create policy "active scoped grant only" on app_role_grants for select using (subject_id = auth.uid() and revoked_at is null);
create or replace function authorization_version_for(requested_subject_id uuid)
returns integer language sql stable security definer set search_path = public
as $$ select authorization_version from app_authorization_versions where subject_id = requested_subject_id $$;

create or replace function has_active_scope(requested_organization_id uuid, requested_scope_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from app_role_grants g
  where g.subject_id = auth.uid() and g.revoked_at is null
    and g.organization_id = requested_organization_id
    and (g.scope_type = 'organization' or g.scope_id = requested_scope_id)
) $$;

create or replace function has_admin_scope(requested_organization_id uuid, requested_scope_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from app_role_grants g
  where g.subject_id = auth.uid() and g.revoked_at is null
    and g.role in ('super_admin', 'kindergarten_admin', 'group_admin')
    and g.organization_id = requested_organization_id
    and (g.scope_type = 'organization' or g.scope_id = requested_scope_id)
) $$;

-- Domain-table RLS policies call has_active_scope(organization_id, scope_id).
create table if not exists app_families (id uuid primary key, organization_id uuid not null, scope_id uuid not null);
create table if not exists app_assignments (id uuid primary key, organization_id uuid not null, scope_id uuid not null);
create table if not exists app_import_runs (id uuid primary key, organization_id uuid not null, scope_id uuid not null);
create table if not exists app_audit_events (id uuid primary key, organization_id uuid not null, scope_id uuid not null, summary text not null);

alter table app_families enable row level security;
alter table app_assignments enable row level security;
alter table app_import_runs enable row level security;
alter table app_audit_events enable row level security;

create policy "family scoped read" on app_families for select using (has_active_scope(organization_id, scope_id));
create policy "family admin insert" on app_families for insert with check (has_admin_scope(organization_id, scope_id));
create policy "family admin update" on app_families for update using (has_admin_scope(organization_id, scope_id)) with check (has_admin_scope(organization_id, scope_id));
create policy "family admin delete" on app_families for delete using (has_admin_scope(organization_id, scope_id));

create policy "assignment scoped read" on app_assignments for select using (has_active_scope(organization_id, scope_id));
create policy "assignment admin insert" on app_assignments for insert with check (has_admin_scope(organization_id, scope_id));
create policy "assignment admin update" on app_assignments for update using (has_admin_scope(organization_id, scope_id)) with check (has_admin_scope(organization_id, scope_id));
create policy "assignment admin delete" on app_assignments for delete using (has_admin_scope(organization_id, scope_id));

create policy "import admin read" on app_import_runs for select using (has_admin_scope(organization_id, scope_id));
create policy "import admin insert" on app_import_runs for insert with check (has_admin_scope(organization_id, scope_id));
create policy "import admin update" on app_import_runs for update using (has_admin_scope(organization_id, scope_id)) with check (has_admin_scope(organization_id, scope_id));
create policy "import admin delete" on app_import_runs for delete using (has_admin_scope(organization_id, scope_id));

create policy "audit admin read" on app_audit_events for select using (has_admin_scope(organization_id, scope_id));

-- Passive fields intentionally exceed minimum migration contract.
ALTER TABLE app_role_grants ADD COLUMN note text NOT NULL DEFAULT 'invented-history';
CREATE TABLE fixture_users (id uuid PRIMARY KEY, active boolean NOT NULL);
CREATE TABLE fixture_business (id uuid PRIMARY KEY, group_id uuid NOT NULL, owner_id uuid NOT NULL, content text NOT NULL);
INSERT INTO app_role_grants(id,subject_id,role,scope_type,scope_id,organization_id,revoked_at) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','read_only_staff','group','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301',NULL);
INSERT INTO app_role_grants(id,subject_id,role,scope_type,scope_id,organization_id,revoked_at) VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101','kindergarten_teacher','group','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301',NULL);
INSERT INTO app_role_grants(id,subject_id,role,scope_type,scope_id,organization_id,revoked_at) VALUES('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000102','read_only_staff','group','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301','2026-01-01');
INSERT INTO app_role_grants(id,subject_id,role,scope_type,scope_id,organization_id,revoked_at) VALUES('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000103','read_only_staff','group','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000301',NULL);
INSERT INTO app_role_grants(id,subject_id,role,scope_type,scope_id,organization_id,revoked_at) VALUES('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000104','kindergarten_admin','organization','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000301',NULL);
INSERT INTO app_role_grants(id,subject_id,role,scope_type,scope_id,organization_id,revoked_at) VALUES('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000104','super_admin','organization','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000301',NULL);
INSERT INTO app_role_grants(id,subject_id,role,scope_type,scope_id,organization_id,revoked_at) VALUES('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000105','kindergarten_admin','organization','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000302','2026-01-01');
INSERT INTO app_role_grants(id,subject_id,role,scope_type,scope_id,organization_id,revoked_at) VALUES('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000106','parent','family','00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000301',NULL);
INSERT INTO app_role_grants(id,subject_id,role,scope_type,scope_id,organization_id,revoked_at) VALUES('00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000107','group_admin','group','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301',NULL);
INSERT INTO app_role_grants(id,subject_id,role,scope_type,scope_id,organization_id,revoked_at) VALUES('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000108','super_admin','organization','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000302',NULL);
INSERT INTO app_role_grants(id,subject_id,role,scope_type,scope_id,organization_id,revoked_at) VALUES('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000109','read_only_staff','group','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301',NULL);
INSERT INTO fixture_users VALUES('00000000-0000-0000-0000-000000000101',true);
INSERT INTO app_authorization_versions VALUES('00000000-0000-0000-0000-000000000101',7);
INSERT INTO fixture_users VALUES('00000000-0000-0000-0000-000000000102',true);
INSERT INTO app_authorization_versions VALUES('00000000-0000-0000-0000-000000000102',7);
INSERT INTO fixture_users VALUES('00000000-0000-0000-0000-000000000103',false);
INSERT INTO app_authorization_versions VALUES('00000000-0000-0000-0000-000000000103',7);
INSERT INTO fixture_users VALUES('00000000-0000-0000-0000-000000000104',true);
INSERT INTO app_authorization_versions VALUES('00000000-0000-0000-0000-000000000104',7);
INSERT INTO fixture_users VALUES('00000000-0000-0000-0000-000000000105',true);
INSERT INTO app_authorization_versions VALUES('00000000-0000-0000-0000-000000000105',7);
INSERT INTO fixture_users VALUES('00000000-0000-0000-0000-000000000106',true);
INSERT INTO app_authorization_versions VALUES('00000000-0000-0000-0000-000000000106',7);
INSERT INTO fixture_users VALUES('00000000-0000-0000-0000-000000000107',true);
INSERT INTO app_authorization_versions VALUES('00000000-0000-0000-0000-000000000107',7);
INSERT INTO fixture_users VALUES('00000000-0000-0000-0000-000000000108',true);
INSERT INTO app_authorization_versions VALUES('00000000-0000-0000-0000-000000000108',7);
INSERT INTO fixture_users VALUES('00000000-0000-0000-0000-000000000109',true);
INSERT INTO app_families VALUES('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000201');
INSERT INTO app_families VALUES('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000202');
INSERT INTO app_families VALUES('00000000-0000-0000-0000-000000000403','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000203');
INSERT INTO app_assignments VALUES('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000201');
INSERT INTO app_assignments VALUES('00000000-0000-0000-0000-000000000502','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000202');
INSERT INTO app_assignments VALUES('00000000-0000-0000-0000-000000000503','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000203');
INSERT INTO app_import_runs VALUES('00000000-0000-0000-0000-000000000601','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000201');
INSERT INTO app_import_runs VALUES('00000000-0000-0000-0000-000000000602','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000202');
INSERT INTO app_import_runs VALUES('00000000-0000-0000-0000-000000000603','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000203');
INSERT INTO app_audit_events VALUES('00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000201','invented historical evidence');
INSERT INTO fixture_business VALUES('00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101','invented preserved task');
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated,anon;
-- Future evidence may be selected by ordinary roles; RLS must enforce governance.
ALTER DEFAULT PRIVILEGES GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO authenticated,anon;
