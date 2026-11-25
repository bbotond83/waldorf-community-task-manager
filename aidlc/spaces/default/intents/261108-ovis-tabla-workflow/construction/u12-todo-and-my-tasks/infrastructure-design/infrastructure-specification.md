# Infrastructure Specification: u12-todo-and-my-tasks

Sources: the six NFR design files of this Unit, `functional-spec.md`, `components.md` and `contract-summary.md`. Nothing is hosted in the Ovis tábla work: the app runs on the owner's computer against the local database stack (`team.md`, `technology-stack.md`). This Unit adds no infrastructure; it adds database objects and screens to what exists.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | The existing Next.js app, run locally; no new process, service or scheduler | `tech-stack-decisions.md`: no new package, service or scheduler |
| Networking | Unchanged: app and local database stack stay on the owner's computer, loopback only | Local stack rule in `project.md` |
| Storage | Three new tables (`todo_tasks`, `todo_task_history`, `todo_event_links`) in the existing local database, created by one new forward-only migration file, `supabase/migrations/20261071_todo_and_my_tasks.sql`, which sorts after today's latest file `20261070_u8_review_fixes.sql` (if another migration lands first, the next free number is used). The same file holds the table constraints and the history no-update trigger, the new audit action values, the two notice kinds and the `todo_task` target, the registry row, every command, read and internal function of this Unit, and `checklist_task_done_state` | `team.md` Deployment: forward-only migrations, applied by `npm run db:migrate` |
| Environments | Local only. No staging or production exists; hosting is a separate piece of work | `team.md` Deployment |
| Infrastructure as code | The migration file is the only infrastructure definition. No CDK, Terraform or workflow is added; executable deployment workflows stay disabled (`npm run verify:no-deploy`) | `project.md` Forbidden |
| Sizing | None needed: a few hundred tasks and about a thousand history rows a year (`scalability-design.md`) | NFR5, NFR9 |
| Starting data | None installed by the migration; the existing seed adds invented tasks for demo data. Real tasks arrive through `migration_load_todo`, called by U15's script | C17 |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Local Postgres (Supabase CLI stack) | Database | Indexes of `performance-design.md`; check constraints of `reliability-design.md`; unique source key and unique `(task_id, event_id)`; row-level security on with no policy for signed-in accounts | Existing service, reused |
| Notice registries (U5) | Notices | Kinds `todo_changed` and `todo_due` on a new `todo_task` target with `notice_facts_todo`, registered by migration rows | U5's notice functions are not edited |
| Daily-run registry (U5) | Timed checks | One registry row for `todo_deadline_reminder`, run kind `daily`, active, `lock_step` 4. The function is revoked from every role, the service role included, and runs only through `timed_checks_run_system` | The owner triggers the run by hand with `npm run timed:run`; no new scheduler. A skipped day is caught up by the next run, because the check looks for every task whose window has been reached and not yet sent |
| Local test mailbox | Email in tests | Existing set-up | No new service |
| Cache, queue, search service, CDN, DNS, load balancer | None | Not needed: one document per read, small data that must be live | `performance-design.md` |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Notice kind registry, daily-run registry and run record | u5 | u12 registers its own rows | Rows only; U5's functions are not edited |
| `checklist_add_task` (C15) | u11 | u12 calls it from `todo_pull_to_event` | Owner rights; no new grant |
| Checklist rows | u11 | u12 reads them through the new `checklist_task_done_state` | Read only; added in U12's migration |
| Duty read and `recurring_my_occurrences` | u9 and duties | u12 reads them in `my_tasks_get` | Read only |
| Lock order of C1 | u1 (convention) | u12 adds the to-do task rows after checklist task and before book | Recorded as a note in the contract summary at code generation |
| Removal block (C16) | u14 | u12 delivers `todo_removal_preview` and `todo_removal_apply` | Owner rights only; no signed-in grant |
| Load (C17) | u15 | u12 delivers `migration_load_todo` | Service role only |
| Large seed (`db:seed:large`) | u1 | u12 adds a few hundred invented tasks | Local development only |

## Secrets

No new secret, key or setting. `APP_SESSION_SECRET`, `APP_PUBLIC_URL` and `SMTP_FROM` are unchanged.
