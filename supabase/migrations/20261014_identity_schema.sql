-- U2 identity and access: tables, constraints and indexes (BR2.9 to BR2.15).
-- Schema-neutral and pinned like the U1 files: the migration runner sets the session search path to
-- the target schema, and every function pins its own schema with `set search_path from current`.
-- Conventions (U1 BR3.1): uuid keys, timestamps in UTC (timestamptz), integer version on mutable records.
-- Every new table starts with no right for any application role; later files grant exactly what is needed.

-- The app's mirror of one sign-in user. Its id equals the sign-in user's id (the sign-in service owns
-- the id, so there is no default). Credentials, reset tokens and sessions stay in the sign-in service.
create table accounts (
  id uuid primary key,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  organization_id uuid not null,
  status text not null default 'active' check (status in ('active', 'deactivated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1)
);
create unique index accounts_email_unique on accounts (email);
create index accounts_organization on accounts (organization_id);
create trigger accounts_touch_version before update on accounts
  for each row execute function platform_touch_version();
alter table accounts enable row level security;
revoke all on accounts from public, anon, authenticated, service_role;

-- An admin's invitation for one email address, role and scope. Only the hash of the 32-byte token is
-- stored; the token is shown once in the emailed link.
create table invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role text not null check (role in ('parent', 'kindergarten_teacher', 'group_admin', 'super_admin')),
  scope_type text not null check (scope_type in ('family', 'group', 'organization')),
  scope_id uuid not null,
  organization_id uuid not null,
  target_id uuid,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'accepting', 'accepted', 'revoked', 'replaced')),
  reserved_at timestamptz,
  created_by_account_id uuid not null references accounts (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_account_id uuid references accounts (id),
  replaces_invitation_id uuid references invitations (id) on delete set null,
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  constraint invitations_role_scope check (
    (role = 'parent' and scope_type = 'family') or
    (role in ('group_admin', 'kindergarten_teacher') and scope_type = 'group') or
    (role = 'super_admin' and scope_type = 'organization' and scope_id = organization_id)
  ),
  check (expires_at > created_at)
);
-- At most one open (pending or accepting) invitation per email, role and scope. Expiry is not part of
-- an index, so the create function first marks an expired pending invitation for the same key replaced.
create unique index invitations_one_open on invitations (email, role, scope_type, scope_id)
  where status in ('pending', 'accepting');
create index invitations_organization on invitations (organization_id, created_at desc);
create index invitations_status on invitations (status, updated_at);
create trigger invitations_touch_version before update on invitations
  for each row execute function platform_touch_version();
alter table invitations enable row level security;
revoke all on invitations from public, anon, authenticated, service_role;

-- One wrong-password attempt made through the app's sign-in screen, kept to apply the lockout (BR2.3).
-- The hash is a keyed hash (HMAC with the session secret) of the lower-cased email, computed by the server.
create table sign_in_attempts (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null check (email_hash ~ '^[a-f0-9]{64}$'),
  attempted_at timestamptz not null default now()
);
create index sign_in_attempts_hash_time on sign_in_attempts (email_hash, attempted_at desc);
alter table sign_in_attempts enable row level security;
revoke all on sign_in_attempts from public, anon, authenticated, service_role;

-- RoleGrant extends the existing table: a database-generated id, who granted it and when. The partial
-- unique index keeps one active grant per account, role and scope.
alter table app_role_grants alter column id set default gen_random_uuid();
alter table app_role_grants add column if not exists granted_by_account_id uuid;
alter table app_role_grants add column if not exists granted_at timestamptz not null default now();
create unique index if not exists app_role_grants_one_active
  on app_role_grants (subject_id, role, scope_type, scope_id) where revoked_at is null;
create index if not exists app_role_grants_organization_role
  on app_role_grants (organization_id, role) where revoked_at is null;
create index if not exists app_role_grants_scope
  on app_role_grants (scope_type, scope_id) where revoked_at is null;

-- U2 adds two audit actions to U1's fixed list (BR2.14).
alter table audit_events drop constraint audit_events_action_check;
alter table audit_events add constraint audit_events_action_check check (action in (
  'role.grant', 'role.revoke', 'role.first_super_admin',
  'approval.approve', 'approval.reject',
  'import.commit',
  'lifecycle.anonymize', 'lifecycle.delete', 'lifecycle.hold_place', 'lifecycle.hold_release',
  'account.deactivate', 'account.reactivate'
));
