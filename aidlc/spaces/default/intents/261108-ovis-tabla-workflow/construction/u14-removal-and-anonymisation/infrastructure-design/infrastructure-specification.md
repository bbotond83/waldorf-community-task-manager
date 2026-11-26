# Infrastructure Specification: u14-removal-and-anonymisation

Sources: the six NFR design files of this Unit (`performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md`, `logical-components.md`), its `functional-spec.md`, `components.md` (Lifecycle) and `contract-summary.md` (C1, C6, C16). Nothing is hosted in the Ovis tábla work: the app runs on the owner's computer against the local database stack (`team.md`). This Unit adds no infrastructure; it adds database functions and changes screens. Contains no names or contact details.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | The existing Next.js app, run locally; no new process, service or scheduler | `logical-components.md`; removal runs in the request (`scalability-design.md`) |
| Networking | Unchanged: app and local database stack on the owner's computer, loopback only | Local stack rule in `project.md` |
| Storage | No new table. One new forward-only migration file (next free number after `20261072`) holds: the new Lifecycle commands and reads, the new duties step, the new WorkingGroups read, new versions of the events, checklists, recurring_duties and dutychanges steps (each starting from its latest migrated body), the changed name helpers, the new bodies of `parent_remove`, `family_archive` and `lifecycle_run_core`, the new audit action values, and the grants | `team.md` Deployment: forward-only migrations by `npm run db:migrate` |
| Environments | Local only; hosting is a separate later piece of work | `team.md` Deployment |
| Infrastructure as code | The migration file is the only definition; deployment workflows stay disabled (`npm run verify:no-deploy`) | `project.md` Forbidden |
| Sizing | None needed (about 20 families; `scalability-design.md`) | NFR5 |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Local Postgres (Supabase CLI stack) | Database | New functions only; every one starts with `revoke all`; the steps and internal reads get no grant | Existing service |
| Sign-in service (Supabase Auth, local) | Ending sessions | The existing server-side session-ending step, called for every returned account id after the commit | Unchanged; already used by U3's parent removal |
| Notices (U5) | Place-removed notice for freed manual places | Unchanged registry | Kept from today's archive (`reliability-design.md`) |
| Cache, queue, search, CDN, load balancer | None | Not needed | `performance-design.md` |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Removal steps (C16) | U3, U4, U5, U6, U7, U9, U10, U11, U12, U13; duties step added here | U14 commands only | No role grant; called inside U14's transaction |
| Name helpers (C6) | U1 (changed here) | Every unit's history reads | Read helpers; no grant change |
| Lock helpers `reminder_lock_family_tasks`, `coordination_lock_assignments` | U4 repairs, kernel | U14 commands | Internal; no grant |
| Audit log | Platform | U14 commands | Append only through `platform_audit_write` |

## Notes for the Code Plan

The NFR design review raised points that the code plan settles (the design files are frozen):

- Run the authorization, subject lookup, self-removal and last-super-admin checks before taking any lock, as today's `family_archive` wrapper does; take the task and place locks only after those checks pass.
- Take the place locks where today's `family_archive_core` takes them (after the version check), not in a new wrapper; the existing lock tests must keep passing unchanged.
- `SELF_REMOVAL` is checked before `last_super_admin`; with super admins unable to remove themselves, `last_super_admin` stays as a defensive check and its test uses another super admin removing a family that holds all other super admins.
- Rows the steps lock (loans, books, to-do tasks, checklist claims) keep each step's own ascending order; add one race test per step against a concurrent command of that step.
- If `reminder_lock_family_tasks` gives up (serialization error), the server shows the general error and the administrator retries with a fresh idempotency key; nothing was written.
- The later delete or anonymise stays manual; the data-lifecycle screen shows families waiting past 30 days.
