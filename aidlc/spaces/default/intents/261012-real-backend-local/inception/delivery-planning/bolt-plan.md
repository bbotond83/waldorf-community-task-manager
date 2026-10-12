# Bolt Plan: Real backend, sign-in and seed data

A **Bolt** is one build pass over a piece of the work, ending in something that runs. This plan has five Bolts, one per unit of work, in the only order the unit chain allows. The first Bolt is not a walking skeleton (the plan has `skeleton: off`). Source: the confirmed answers in `delivery-planning-questions.md` (Q1 to Q4), `unit-of-work.md` and `unit-of-work-dependency.md`.

## Build Order

| Bolt | Unit | Depends on | Complexity |
|---|---|---|---|
| B1 | U1 u1-local-platform-and-audit | none | L |
| B2 | U2 u2-identity-and-access | B1 | XL |
| B3 | U3 u3-directory-and-coordination | B2 | XL |
| B4 | U4 u4-notifications-and-import | B3 | XL |
| B5 | U5 u5-seed-and-test-migration | B4 | L |

Bolts run one after another (units are built serially in dependency order). Each Bolt goes through the applicable design stages, code generation and build and test for its unit, then a checkpoint approved by the owner.

## B1: Local platform and audit

- **Units** — U1.
- **Definition of Done** — one command starts and stops the local stack; all migrations (including the fixed first migration and its updated checksum test) apply cleanly to the default schema and to a worker schema; the application has a runtime that talks to the database; the audit write function works inside the caller's transaction; CI starts the database service and runs database-backed tests; the privacy scan fails the build when a real-data workbook is tracked; coverage stays at or above 80%.
- **Confidence hypothesis** — a clean machine with Docker Desktop can start the stack and apply the migrations in one pass, and database-backed tests can run in CI.
- **Expected demo** — start the stack, run the migrations, run one database test, show the privacy scan failing on a planted file.
- **Risk note** — risk: Docker or Supabase CLI setup and worker-schema mechanics. Check: a database test in CI and a second worker schema created and reset beside the default one.
- **Test helper** — leaves the first reusable real-database test helper.

## B2: Identity and access

- **Units** — U2.
- **Definition of Done** — email and password sign-in with real sessions (several people signed in at once), invitations, password reset through the mail catcher, four roles with grants, the row-level security framework with the per-role policy test list, the operator command for the first super admin, and the three new screens meeting WCAG 2.2 AA; session, invitation and grant-change numbers are fixed in NFR Requirements.
- **Confidence hypothesis** — different roles see exactly what their grants allow, and policy tests per role prove it before any data screen is built.
- **Expected demo** — create the first super admin with the operator command, invite a parent, accept the invitation, sign in with two browsers as two people.
- **Risk note** — risk: access rules wrong, for example one parent seeing another family's data. Check: per-role policy tests run early in this Bolt, before the screens.
- **Test helper** — extends the database test helper with sign-in per role.

## B3: Directory, settings and coordination

- **Units** — U3.
- **Definition of Done** — organizations, groups, families, parents, parent contacts (admin-only), children, settings, events, tasks, sign-ups, swaps, cancellations and approvals on real records behind the existing parent, admin and teacher ports; invitation acceptance links a Parent and grants; faked behaviour (assign, save notes, dashboard counts) is real; the rule-disposition ledger covers the unused modules; policy tests per role and per read path.
- **Confidence hypothesis** — two parents from different families can sign up, swap and cancel against each other with correct approvals, and no non-admin can read contact details.
- **Expected demo** — two browsers: parent A signs up for a task, parent B takes a swap, the group admin approves; the teacher schedule shows the same data.
- **Risk note** — risk: the largest Bolt and the cross-block database functions. Check: Functional Design splits the rules by owning block; every elevated function has a test that it checks the caller's grants.
- **Test helper** — extends the helper with seeded families, groups and tasks.

## B4: Notifications and Excel import

- **Units** — U4.
- **Definition of Done** — per-parent notification records with read state and reminder jobs (delivery stays simulated); the Excel import with preview, conflicts, atomic commit and recovery, tested only with a fictitious workbook; the staged-import policy is admin-only.
- **Confidence hypothesis** — a parent sees only their own notifications, and an interrupted import leaves the data unchanged.
- **Expected demo** — approve a swap and see the notification in the other parent's session; import the fictitious workbook and show the preview, conflicts and commit.
- **Risk note** — risk: staged personal data and partial commits. Check: a policy test on the staging table and a failure-injection test on the commit.
- **Test helper** — extends the helper with notification and import fixtures.

## B5: Seed and test migration

- **Units** — U5.
- **Definition of Done** — the small seed and the 30-family seed (fictitious only, known test passwords, local only), reset, per-worker test setup, all data-exercising tests on the local database, synthetic mode and its fixtures, reset endpoint, per-browser copies and `scenario` hooks removed, README and the Hungarian testing guide updated, coverage at or above 80% on all production source, three parallel runs in a row without interference, and a final report of the open privacy item (history rewrite by the owner).
- **Confidence hypothesis** — the whole suite runs on the real database with parallel workers, with nothing left of synthetic mode.
- **Expected demo** — seed the 30-family set, run the browser suite three times, sign in as each role, reset.
- **Risk note** — risk: the blast radius on about 40 test files and about 50 source files. Check: each earlier Bolt's test helper, and a full-suite run before and after the removal.
- **Test helper** — consumes the helpers from B1 to B4.

## Construction Settings

Recorded settings for the plan: unit-major order, serial execution, checkpoints enabled, solo ownership unless changed at the gate, walking skeleton off.
