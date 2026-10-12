# Requirements: Real backend, real sign-in and real seed data

## Intent Analysis

The app runs only on in-memory fakes with a fixed set of fictitious people, so the interaction between several people and the real database rules cannot be tested. The goal is a local environment that behaves like the final hosted application (Supabase for database and sign-in, Vercel for hosting): real sign-in with real sessions for every role, real records in a real database, a repeatable seed and reset, and the automated tests running against that database. Synthetic mode is removed from the code; there is no mode switch. Screens, Hungarian copy and business rules stay as they are, except the sign-in, invitation and password-reset screens that real accounts require. [desc] [scope] [Q2]

Type: new platform capability on a brownfield app. Scope: runtime configuration and composition, sign-in and sessions, the database schema and policies, database adapters behind the existing application ports, seed and reset, the Excel import, tests, CI and documentation. Depth: Comprehensive. The product requirements document (`source-materials/waldorf-community-app/waldorf-community-task-manager-prd-v1-en.md`) is the authoritative product source. [prd]

## Functional Requirements

### FR1 Local environment

- FR1.1 One documented command starts the local Supabase stack (Postgres, Auth and a local mail catcher) through Docker Desktop, and one command stops it. [Q1] [Q2]
- FR1.2 Every migration applies cleanly on a fresh database, with no manual step. The first existing migration is fixed (its reserved-word alias) and the unit test that pins its checksum is updated with the new value. [Q7]
- FR1.3 The application has one runtime: it talks to the database. The runtime configuration accepts a local database address (`http://127.0.0.1:...`) and a hosted `https://` address; a missing or invalid setting stops startup with a message naming the setting. No synthetic mode and no switch between modes remain. [scope] [desc]
- FR1.4 Secrets are never committed: `.env.example` lists variable names only, the local keys come from the local stack at start-up, the service-role key is never exposed to the browser, and each environment has its own session secret. [desc] [memory:M5]
- FR1.5 The English README documents the prerequisites (Docker Desktop installation and its licence check, Node 24, npm 11) and the start, stop, seed and reset commands. [Q1]

### FR2 Identity and sessions

- FR2.1 A person signs in with email and password. Errors are shown in Hungarian. A deactivated person cannot sign in. [prd:FR-002] [Q3]
- FR2.2 Sessions are real: verified on the server for every request, with an expiry, a sign-out that ends the session, and cookies that are `httpOnly`, `sameSite: lax` and `secure` whenever the site is served over https. Several different people can be signed in at the same time in different browsers. [scope] [desc]
- FR2.3 An admin invites a person by email, role and scope; the invitation has an expiry; an expired invitation can be resent; the invited person opens the link, sets a password and gets an account linked to the invited family or role. Invitation is the only way a normal account is created. [prd:FR-001] [Q3]
- FR2.4 Password reset works through an emailed link; locally the email lands in the mail catcher. [Q4] [prd:FR-002]
- FR2.5 The role set is the four roles the app uses today: parent, teacher, group admin, super admin, each with scopes (family, group, organization) stored as grants in the database. A change of grants takes effect within a stated short window (the authorization version is bumped on every change). [Q5]
- FR2.6 The four-profile picker, the hard-coded profiles, the cookie secret in source, the `parent-local` login and the `/api/synthetic/*` routes are removed. [Q2] [scope]
- FR2.7 The seed creates its people's accounts directly with known test passwords, for development and tests only, and refuses to run against a database that is not local. The production path stays invitation-only. [Q13]
- FR2.8 Parent screens and actions work for any signed-in parent and their own family; no constants such as a fixed family or a fixed parent remain in the code. [desc]

### FR3 Database schema and access rules

- FR3.1 The schema stores everything the app keeps: organizations, school years, groups, families, parents, children, role grants, invitations, events, tasks, assignments, swap and cancellation requests, approvals, contribution notes, notifications, reminder jobs and attempts, settings, import runs with their sheets, rows and conflicts, lifecycle holds and the audit log. [scope] [arch]
- FR3.2 Every primary key is a database-generated uuid; the readable text ids in code, tests and the session are removed. The seed gives its records stable uuids so tests can name them. [Q6]
- FR3.3 Row-level security expresses the existing four-role authorization matrix at the database layer: a parent reads only their own family's data; a group admin only their group; a super admin their organization; a teacher only the schedule of granted groups. [prd:9.3] [Q5]
- FR3.4 Parent contact details (email, phone) are never readable by another parent; this is enforced by the database, not only by the screens. [prd:9.3]
- FR3.5 Role changes, approvals, imports and lifecycle actions write audit events. [prd:FR-003]
- FR3.6 Idempotency keys and version numbers are stored so a repeated submission never creates a duplicate and a stale update is refused with the existing explicit result state. [arch]

### FR4 Database adapters

- FR4.1 Database adapters implement the application ports the app already calls (parent, admin, teacher schedule and session gateway), replacing the four in-memory adapters, and the screens do not change. [Q8] [scope]
- FR4.2 Every operation returns the same explicit result states as today (success, validation, denied, conflict, retryable and terminal failures); unexpected infrastructure errors are mapped at the application boundary. [memory:M6]
- FR4.3 The rules in the nine unused domain modules are carried over into the database adapters or consciously dropped (the decision recorded), and the modules are then removed. [Q8]
- FR4.4 Behaviour that is faked today becomes real: the admin assign and save-notes actions persist; the dashboard counts real open import conflicts; notifications and reminders are real records. [arch] [scope]

### FR5 Multi-person flows (each verified with several people signed in)

- FR5.1 Two parents signed in at the same time in separate browsers can each sign up for tasks; capacity is shared, so the second parent sees the first parent's sign-up reflected. [desc]
- FR5.2 A parent can request a swap or a cancellation for their own assignment; the group admin (or super admin) in scope approves or rejects it; each parent sees only their own notifications about it. [desc] [prd]
- FR5.3 A group admin sees and changes only records of their own group; a super admin works across the organization; a teacher sees only the schedule of the groups granted to them. [desc] [Q5]
- FR5.4 An invited new parent joins through the invitation link, sets a password, signs in and sees their own family's tasks. [desc] [Q3]
- FR5.5 The admin lists, forms, approvals, archive and settings work on real records with the same behaviour as today. [desc]

### FR6 Teacher schedule

- FR6.1 The teacher schedule reads real data and honours the filter behaviour of the current screens, for the groups granted to the signed-in teacher. [scope] [desc]

### FR7 Excel import

- FR7.1 An authorized admin can upload an `.xlsx` workbook; the import shows a preview with the row counts and conflicts, lets the admin resolve each conflict, confirms, and commits all changes atomically. [scope] [prd]
- FR7.2 The import is tested only with a fictitious workbook of the same structure as the real one; the real workbook is never a source for the seed or for tests. [Q12]
- FR7.3 An interrupted or failed commit leaves the data as it was, and the recovery step of the screen works. [arch]

### FR8 Notifications and reminders records

- FR8.1 Notification records are stored per parent; a parent sees and marks only their own. Reminder jobs and their attempts are stored with their status. Delivery of email or SMS is not performed; statuses stay simulated and labelled as such. [scope] [Q7-intent]

### FR9 Seed and reset

- FR9.1 One command seeds the local database with the small fixed set (2 groups, about 6 families with parents and children, a group admin, a super admin, a teacher, and a few events and tasks); another selects the 30-family set for demonstrations. All data is fictitious. [Q11]
- FR9.2 One command resets the local database to a clean state; seeding twice gives the same result (repeatable). A failed seed leaves no half-written data. [desc] [Q11]
- FR9.3 The seed and reset refuse to run against a database that is not local. [Q13]

### FR10 Tests and CI

- FR10.1 Synthetic code, fixtures, the reset endpoint, the per-browser test copies and the `scenario` hooks are removed; the tests that exercise data run against the local database. [scope] [Q2]
- FR10.2 Each test worker or browser project has its own database or schema, reset between test files, so tests do not interfere. [Q9]
- FR10.3 The CI workflow starts the database service and runs the database-backed tests; deployment workflows stay disabled. [Q10] [memory:M1]

### FR11 Real personal data in the repository

- FR11.1 The committed workbook `source-materials/waldorf-community-app/Ovis tábla v2.xlsx` holds real personal data. It is no longer tracked, it is listed in the ignore file, and the privacy scan fails if a workbook or other file with such data is committed. [Q12] [Q14]
- FR11.2 The workbook is removed from the repository's whole history; the owner performs the history rewrite and the replacement of the remote copy. Until then, the fact is reported as an open privacy item. [Q14]

### FR12 Documentation

- FR12.1 The Hungarian testing guide (`HASZNALATI_UTMUTATO_HU.md`) is updated for real sign-in, invitations, password reset and testing with several people at once. [memory:M2] [desc]

## Non-Functional Requirements

- NFR1 Security and privacy: other parents' contact details are unreadable by database rules; passwords are never logged or shown; the service-role key never reaches the browser; the seed and its test passwords exist only in local and test environments; no real personal data is committed. [prd:9.3] [desc] [Q12]
- NFR2 Verification: type check, lint, format, unit, component, database and browser tests and the production build pass; line, branch and function coverage stay at or above 80% for all production source, including the new adapters and the seed code; the browser flow has no serious or critical axe violations. Checks that need a hosted target stay reported as outstanding evidence until they are exercised against one. [memory:M3] [memory:M4] [memory:M7]
- NFR3 Determinism and isolation: tests are independent of each other and of run order; the seed is deterministic. [Q9] [Q11]
- NFR4 Performance (local): the small seed completes within 60 seconds and a reset within 30 seconds on the owner's machine; a sign-in completes within the existing 5000 ms login-time budget. [arch] [desc]
- NFR5 Accessibility: the sign-in, invitation and password-reset screens meet WCAG 2.2 AA (text contrast 4.5:1, controls 3:1, keyboard operable, errors announced) and are Hungarian. [memory:M2] [desc]
- NFR6 Reliability: migrations are repeatable on a fresh database; a failed import or seed leaves no partial data. [FR7.3] [FR9.2]
- NFR7 No regression of the screens: the pages other than sign-in, invitation and password reset keep their markup, copy, test ids and behaviour. [desc]
- NFR8 Copy and naming: all user-facing words are Hungarian; code, schema, tests and technical documentation use English. [memory:M2] [prd]

## Constraints

- Hungarian user-facing copy and English identifiers. [memory:M2]
- No deployment workflows until a deployable application and a linked target project exist. [memory:M1]
- Trunk-based development with short-lived branches; green checks before merge. [memory:M3]
- Docker Desktop is required for the local stack and is not installed yet; its installation and licence check are prerequisites. [Q1]
- Node 24 and npm 11 are required. [arch]
- Never commit secrets or real personal data. [desc]

## Assumptions & Open Questions

- [assumption] The local stack is the Supabase command-line stack; its version is pinned at infrastructure design, and it is started by a script in the repository.
- [assumption] The session uses the sign-in component's own session cookies, read on the server for every request; the exact cookie handling is a design decision.
- [assumption] "As close to hosted as possible" means the same schema, the same policies and the same sign-in settings in both places; the hosted project itself is not created in this work.
- [assumption] The nine unused modules' rules are reviewed one by one at domain design; each is carried over or dropped with a recorded reason.
- [assumption] The Excel import reads `.xlsx` with a library chosen at design time; no library is installed today.
- Open: the real-target (hosted Supabase) verification stays outstanding until a hosted project exists.
- Open: the history rewrite for the workbook is a manual owner step; this work only prepares it and reports its state.

## Out of Scope

- Real email or SMS delivery (notifications and reminders stay simulated, with real records). [Q7-intent] [scope]
- Any deployment, hosting pipeline or linked production project. [scope] [memory:M1]
- Creating a hosted Supabase project or promoting data to it.
- New screens, new roles (the five-role set of the product requirements is not adopted), or changes to who may see which page. [Q5]
- Replacing the product's screens or Hungarian copy beyond sign-in, invitation and password reset.

## Sources

- [desc]: initial description (see `ideation/intent-capture/intent-capture-questions.md`).
- [scope]: `ideation/scope-definition/scope-document.md` and `intent-backlog.md`.
- [Q1] to [Q14]: confirmed answers in `inception/requirements-analysis/requirements-analysis-questions.md` (container tool; hosted stack; account creation; password reset; roles; ids; first migration; domain layer; test isolation; CI; seed; workbook privacy; seed accounts; workbook history). [Q7-intent] is the intent-capture answer Q7 (reminders and notifications stay simulated).
- [prd]: `source-materials/waldorf-community-app/waldorf-community-task-manager-prd-v1-en.md` (FR-001, FR-002, FR-003, section 9.3).
- [arch]: code knowledge base `aidlc/spaces/default/codekb/waldorf-community-task-manager/` and `inception/reverse-engineering/developer-scan.md`.
- [memory:M1] project.md: no executable deployment workflows before a deployable application and linked project; [memory:M2] Hungarian user-facing copy and English identifiers; [memory:M3] green automated checks before merge; [memory:M4] 80% coverage; [memory:M5] never commit secrets (team Code Style and Mandated rules); [memory:M6] explicit result states for expected failures; [memory:M7] provisioned integrations are outstanding evidence until exercised against real targets.
