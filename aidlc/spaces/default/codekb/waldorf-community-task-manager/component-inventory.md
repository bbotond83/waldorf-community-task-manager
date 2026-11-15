# Component Inventory

## Application Components

### Web Shell and Request Proxy
- **Location**: `proxy.ts`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/api/readiness/`
- **Responsibility**: session cookie renewal, content security policy with nonce, security headers, home redirect, readiness.
- **Depends on**: Identity Library, Runtime Composition.

### Identity Screens
- **Location**: `app/_identity/`, `app/bejelentkezes/`, `app/jelszo-visszaallitas/`, `app/meghivas/[token]/`, `app/hozzaferes-megtagadva/`
- **Responsibility**: sign-in, sign-out, password reset, invitation acceptance, no-access page.
- **Depends on**: Identity Library.

### Parent Screens
- **Location**: `app/szulo/`
- **Responsibility**: notifications, task list and detail, sign-up, swap and cancellation requests, swap inbox, own note.
- **Depends on**: Application Facades, Runtime Composition.
- **Limits**: shows only the family's view of tasks. No directory, profile page, shared overview, or "my tasks" separated from open tasks.

### Teacher Screens
- **Location**: `app/teacher/`, `app/munkatars/beosztas/`
- **Responsibility**: read-only schedule across the teacher's groups, with date and group filters.
- **Depends on**: Application Facades.

### Admin Screens
- **Location**: `app/admin/` (except `import/`)
- **Responsibility**: dashboard, records, tasks and events, approvals, archive, reminders monitor, data lifecycle, settings and role revocation.
- **Depends on**: Application Facades, Runtime Composition.
- **Limits**: tasks are created one at a time; no invitation sending; no role granting (revocation only).

### Import Workflow Screen
- **Location**: `app/admin/import/`, `app/admin/_components/ImportWorkflow.tsx`, `app/admin/_lib/import-messages.ts`
- **Responsibility**: upload, preview, conflict resolution, commit, recovery, cancel.
- **Depends on**: Application Facades, Workbook Parser (through the adapter).

### Access Policy
- **Location**: `src/access/`
- **Responsibility**: the four roles, scope containment, grant rules (`role-policy.ts`). `AccessService` and in-memory adapters are test-only.
- **Depends on**: nothing.

### Application Facades
- **Location**: `src/application/`
- **Responsibility**: parent, admin, teacher facades, the pipeline, the authorization matrix, contracts, status labels, Budapest time, validation.
- **Depends on**: Access Policy.

### Data Adapters
- **Location**: `src/data/`
- **Responsibility**: implements application ports over the database, maps envelopes to outcomes, reads access context.
- **Depends on**: Application Facades (types), Runtime Composition (client), database functions.

### Identity Library
- **Location**: `src/identity/`
- **Responsibility**: sign-in with lockout, sessions and cookies, refresh, password reset, invitations, SMTP mail, operational events.
- **Depends on**: Supabase sign-in service, database functions, nodemailer.
- **Limits**: `createInvitation` is not called by any screen or command.

### Workbook Parser
- **Location**: `src/import-parser/`
- **Responsibility**: reads `.xlsx` bytes safely against the 17-sheet template.
- **Depends on**: `@e965/xlsx`. Server-only entry through `server.ts`.

### Runtime Composition
- **Location**: `src/runtime/`
- **Responsibility**: configuration validation, database client and error mapping, per-request facades, role access resolution, navigation, shell components, status badge.
- **Depends on**: Application Facades, Data Adapters, Workbook Parser.

## Database Components

### Platform Database Layer
- **Location**: `20261012`, `20261013`, `20261044` to `20261046`
- **Responsibility**: audit log, lifecycle holds, idempotency, result envelope, version trigger, audit purge.

### Identity Database Layer
- **Location**: `20260806`, `20261006`, `20261014` to `20261023`, `20261033`, `supabase/templates/`
- **Responsibility**: accounts, grants, authorization versions, active-session check, invitations, lockout, housekeeping, email-change guard.

### Directory Database Layer
- **Location**: `20261024`, `20261025`, `20261035_integrity_directory_reads`
- **Responsibility**: organizations, school years, groups, families, memberships, parents, contacts, children, settings, reach helpers.

### Coordination Database Layer
- **Location**: `20261026` to `20261031`, `20261034`, `20261035_governance_list`
- **Responsibility**: events, tasks, assignments, change requests, notes, sign-up, swaps, cancellations, family archive, dashboard, teacher schedule, governance.

### Lifecycle Database Layer
- **Location**: `20261032`, `20261035_integrity_lifecycle`, wrappers in `20261038`, `20261042`, `20261043`
- **Responsibility**: deletion or anonymization of families that left, 30-day grace, holds.

### Notifications Database Layer
- **Location**: `20261036` to `20261038`, parts of `20261043`
- **Responsibility**: in-app notices, reminder jobs, recipients, simulated attempts, wrappers around kernel functions.

### Import Database Layer
- **Location**: `20261039` to `20261042`, parts of `20261043`
- **Responsibility**: sheet registry, runs, staged rows, matching, conflicts, commit, recovery, expiry.

## Tooling Components

### Database Tooling
- **Location**: `scripts/db/`, `supabase/config.toml`, `supabase/roles.sql`
- **Responsibility**: start, stop, migrate, worker schemas, seed with invented data, reset, first super admin, loopback guards.

### Verification Tooling
- **Location**: `scripts/verification/`, `verification/`, `scripts/start-smoke.mjs`, `scripts/validate-*`
- **Responsibility**: local acceptance run, evidence reports, privacy, secret, SAST and no-deploy scans, manifests.

### Test Suites
- **Location**: `src/**/*.test.ts`, `scripts/**/*.test.ts`, `tests/`
- **Responsibility**: domain, delivery (Vitest), database against the local stack, browser with accessibility checks.

### CI Workflow
- **Location**: `.github/workflows/ci.yml`
- **Responsibility**: full verification on pull requests, weekly and manual runs; SBOM and build evidence on `main`.

## Dependencies Between Components

| Change you plan | Components it touches |
|---|---|
| New role or working-group scope | Access Policy, Application Facades, Runtime Composition, Identity Database Layer, Directory Database Layer, Coordination Database Layer, Verification Tooling, Test Suites |
| Parent directory | Directory Database Layer, Data Adapters, Application Facades, Parent Screens, Teacher Screens, Verification Tooling |
| Rota and calendar | Coordination Database Layer, Directory Database Layer, Admin Screens, Parent Screens, Notifications Database Layer |
| Done marks and to-do items | Coordination Database Layer, Notifications Database Layer, Parent Screens, Admin Screens |
| Real reminders | Notifications Database Layer, Data Adapters, a new scheduler boundary |
| One-off migration script | Database Tooling, Directory Database Layer, Coordination Database Layer; possibly removal of the Workbook Parser, Import Workflow Screen and Import Database Layer |
