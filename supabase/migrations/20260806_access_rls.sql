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
  select 1 from app_role_grants grant
  where grant.subject_id = auth.uid() and grant.revoked_at is null
    and grant.organization_id = requested_organization_id
    and (grant.scope_type = 'organization' or grant.scope_id = requested_scope_id)
) $$;

create or replace function has_admin_scope(requested_organization_id uuid, requested_scope_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from app_role_grants grant
  where grant.subject_id = auth.uid() and grant.revoked_at is null
    and grant.role in ('super_admin', 'kindergarten_admin', 'group_admin')
    and grant.organization_id = requested_organization_id
    and (grant.scope_type = 'organization' or grant.scope_id = requested_scope_id)
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
