# Units of Work: Real backend, sign-in and seed data

Five units, cut by domain blocks in the dependency order of the design, built one at a time. Source: `domain-design/components.md` and `decisions.md`, `requirements.md` (FR1 to FR12) and the confirmed answers in `units-generation-questions.md` (Q1 to Q5). Everything ships in the one existing web application (a modular monolith); the local platform and the seed and test tooling are not deployed.

## Unit Table

| Unit ID | Directory | Name | Kind | Complexity | Building blocks |
|---|---|---|---|---|---|
| U1 | u1-local-platform-and-audit | Local platform and audit | service | L | DevelopmentTooling (stack, migrations, per-worker schema mechanics, privacy scan), ApplicationKernel (runtime configuration, composition, idempotency, result states), PrivacyAudit |
| U2 | u2-identity-and-access | Identity and access | service | XL | Identity, Access, ApplicationKernel (session resolution, the four checks, scope probe), WebApp (sign-in, invitation and password-reset screens), operator command |
| U3 | u3-directory-and-coordination | Directory, settings and coordination | service | XL | Directory, Settings, Coordination (incl. teacher schedule view), ApplicationKernel (sign-up, approval and invitation-acceptance use cases), WebApp (data adapters behind the existing screens) |
| U4 | u4-notifications-and-import | Notifications and Excel import | service | XL | Notifications, Import, ApplicationKernel (notification and import-commit use cases), xlsx library, fictitious workbook |
| U5 | u5-seed-and-test-migration | Seed and test migration | packaging | L | DevelopmentTooling (seed, reset, 30-family set, per-worker setup), tests, CI, documentation, synthetic removal |

## Unit Definitions

### U1 Local platform and audit

- **Description** — The foundation every other unit needs: a local Supabase stack that starts with one command, a migration baseline that applies cleanly, the database runtime in the application, the audit log, and the checks that keep real personal data out of the repository.
- **Boundaries** — Includes the fixed first migration and its pinned-checksum test, the baseline conventions (uuid ids, scope columns on every table, a pinned search path for elevated functions), the audit entity and its write function, idempotency storage, the kernel's result states, runtime configuration that accepts a local database address, per-worker schema creation and reset mechanics, the CI workflow change that starts the database service, and the privacy scan with the untracking of the workbook. Excludes sign-in, people, tasks and anything seeded.
- **Responsibilities** — Start, stop and migrate the stack; apply migrations per schema; audit events written inside the caller's transaction; one runtime in the app (the synthetic composition still exists until U5 removes it); CI that runs database-backed tests; failing the build if a real-data workbook is tracked.
- **Deployment model** — Embedded: the runtime configuration, audit tables and functions ship with the app; the stack scripts, CI file and privacy scan are not deployed.
- **Implementation notes and constraints** — Docker Desktop installation and its licence check are prerequisites (not code). The migration runner must apply the same migrations to the default schema and to worker schemas. The history rewrite of the workbook is a manual owner step reported at the end (U5).

### U2 Identity and access

- **Description** — Real sign-in with real sessions for every role, invitations (state and sending), password reset, grants and the row-level security framework, with the screens they need.
- **Boundaries** — Includes accounts mirroring the sign-in service's users, sign-in and sign-out, the expiring session, invitation create, expire and resend, password reset through the mail catcher, role grants and the authorization version with the stated change window, the policy framework and the per-role policy test list, the kernel's four checks and the scope probe, the sign-in, invitation-acceptance and password-reset screens, and the operator command for the first super admin. Excludes linking a Parent to an account (that needs Directory, in U3).
- **Responsibilities** — Replace the profile picker and the hard-coded profiles for sign-in; keep the existing screens unchanged apart from the three new ones; elevated functions limited to the named list with a test that each checks the caller's grants.
- **Deployment model** — Embedded in the web application.
- **Implementation notes and constraints** — Requires the numbers still open from the requirements review (session lifetime, invitation lifetime, grant-change window); NFR Requirements fixes them. Sign-in screens must meet WCAG 2.2 AA and be Hungarian.

### U3 Directory, settings and coordination

- **Description** — The people, the structure and the working data behind the existing parent, admin and teacher screens, on real records with scoped access.
- **Boundaries** — Includes organizations, school years, groups, families, group memberships, parents, parent contacts, children, settings, events, tasks, assignments, sign-ups, swaps, cancellations, approvals, contribution notes, the teacher schedule read model, the kernel use cases for sign-up, swap and cancellation approval and invitation acceptance (the Parent link and grants), the database adapters behind the parent, admin and teacher ports, and the lifecycle functions. Excludes notification records and reminders and the Excel import.
- **Responsibilities** — Real behaviour for the faked features (assign, save notes, dashboard counts); contact details only through the ParentContact policy; policy tests per role and per read path; the rule-disposition ledger for the rules carried over from the unused modules and the running adapters.
- **Deployment model** — Embedded in the web application.
- **Implementation notes and constraints** — The largest unit; Functional Design splits its rules by owning block. Notifications created by sign-up and approval arrive in U4; until then these use cases run without them and a test marks the hook.

### U4 Notifications and Excel import

- **Description** — Per-parent notification records and reminder jobs, and the Excel import with a real database adapter.
- **Boundaries** — Includes notifications with read state, reminder jobs and attempts following the reminder settings (delivery stays simulated), the kernel use cases that create notifications on sign-up and decisions, the import (xlsx reading, preview, conflicts, atomic commit and recovery), the xlsx library, and a fictitious workbook with the real structure. Excludes any real delivery.
- **Responsibilities** — A parent sees only their own notifications; the import never uses the real workbook; an interrupted commit leaves the data as it was; the import preview's staged data has a defined admin-only policy.
- **Deployment model** — Embedded in the web application.
- **Implementation notes and constraints** — The staged import payload and its policy, open from the design review, are settled in Functional Design.

### U5 Seed and test migration

- **Description** — The seed and reset, the move of all data-exercising tests onto the local database, the removal of synthetic mode, and the documents.
- **Boundaries** — Includes the seed (small set and 30-family set, fictitious only, accounts with known test passwords, local-only guard), reset, per-worker test setup, moving the unit, component, database and browser tests to the local database, removing the synthetic code, fixtures, reset endpoint, per-browser copies and `scenario` hooks, the README and the Hungarian testing guide, and the final report of the open privacy item. Excludes new product behaviour.
- **Responsibilities** — Repeatable seed, clean reset, isolation of parallel workers (three runs in a row without interference), the 80% coverage floor on all production source including the new adapters.
- **Deployment model** — Packaging and tooling: not deployed; the synthetic removal changes the deployed app.
- **Implementation notes and constraints** — Largest blast radius on tests (about 50 non-test files and about 40 test files touch synthetic mode); runs last because everything it removes must have a real replacement.

## Complexity and Kind Rationale

U2, U3 and U4 are XL because each combines schema, policies, use-case functions, adapters and screens with per-role policy tests. U1 and U5 are L: mostly tooling with a smaller code surface. U1 to U4 are `service` (they ship in the deployed app and carry the full design matrix, including NFR and infrastructure design where relevant); U5 is `packaging` (tooling and tests, no new runtime behaviour).
