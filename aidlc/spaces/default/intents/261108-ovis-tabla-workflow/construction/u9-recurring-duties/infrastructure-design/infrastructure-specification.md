# Infrastructure Specification: u9-recurring-duties

Sources: the six NFR design files of this Unit, `functional-spec.md`, `components.md` and `contract-summary.md`. Nothing is hosted in the Ovis tábla work: the app runs on the owner's computer against the local database stack (`team.md`, `technology-stack.md`). This Unit adds no infrastructure; it adds database objects and screens to what exists.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | The existing Next.js app, run locally; no new process, service or scheduler | `tech-stack-decisions.md`: no new package, service or scheduler |
| Networking | Unchanged: the app and the local database stack stay on the owner's computer, loopback only | Local stack rule in `project.md` |
| Storage | Two new tables (recurring schedules, recurring occurrences) in the existing local database, created by one new forward-only migration file, named at code generation to sort after the latest existing file. The same file holds: the database checks (one occurrence per schedule and due date; exactly one owner of the right kind; season and interval limits; done and skipped states with the removed flags; title, category and reason length limits), the new audit action values, the notice kinds and target type, the registry rows, the five commands, three reads and four internal functions, and no change to an existing row (checked by a row-count test over a seeded database) | `team.md` Deployment: forward-only migrations, applied by `npm run db:migrate` |
| Environments | Local only. No staging or production exists; hosting is a separate piece of work after this one | `team.md` Deployment |
| Infrastructure as code | The migration file is the only infrastructure definition. No CDK, Terraform or workflow is added; executable deployment workflows stay disabled (`npm run verify:no-deploy`) | `project.md` Forbidden |
| Sizing | None needed: about 20 schedules and a few hundred occurrences (`scalability-design.md`) | NFR5 |
| Starting data | The existing seed script gains the invented Hungarian starting list (animal care, playground and maintenance rounds, three seasonal jobs, bottle cleaning); the owner replaces the titles in the app | FR9.4 to FR9.6 |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Local Postgres (Supabase CLI stack) | Database | Unique key on schedule and due date; index on due date for open occurrences; index on owner kind and owner id for schedules; no direct table rights for signed-in accounts | Existing service, reused |
| Notice registries (U5) | Notices | Kinds `recurring_due` and `recurring_overdue` and target type `recurring_duty` registered by migration rows | No change to U5's functions |
| Daily-run registry (U5) | Timed check | One registry row: function `recurring_due_check`, run kind `daily`, active, with a `lock_step` that runs it after the existing checks; the service-role entry point of U5 gets an explicit `grant execute` on it, and no signed-in role does | The owner's existing daily-run script calls it; no new scheduler |
| Local test mailbox | Email in tests | Existing set-up for the notice and failure tests | No new service |
| Cache, queue, search service, CDN, DNS, load balancer | None | Not needed: one read per page, data is small and must be live | `performance-design.md` |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Notice kind and target registries, daily-run registry | u5 (notices) | u9 registers its own rows | Rows only; U5's functions are not edited |
| Lock order of C1 | u1 (function convention) | u9 adds schedule and occurrence at the end | Recorded as an amendment note in the contract summary at code generation, so U14 and later units see it |
| Removal block (C16) | the removal owner | u9 supplies `recurring_removal_preview` and `_apply` | Service role and database owner only |
| Rota reads | u7 | u9 reads `rota_family_for` and the published water weeks | Read only; no write to U7's rows |
| Large seed (`db:seed:large`) | u1 | u9 adds a school year of schedules and occurrences | Local development only |
| Daily check `recurring_due_check` | u9 | u5's daily run, through the registry row | Service role and database owner only |

## Settled for Code Generation

The NFR Design review (advisory, READY) left points that the frozen design files do not state. They are decided here so code generation builds one reading, and each gets a test.

| Point | Decision |
|---|---|
| Lock list per command | Save and switch on or off: family or rota week if needed, then schedule row, then occurrence rows ascending. Mark done, undo and skip: the family and rota week if the owner needs them, then the schedule row, then the occurrence row; no command locks an occurrence before its schedule. The occurrence is read without a lock first to find its schedule and owner |
| Rota-week numbering after a republish | Weeks are numbered from the first published water week on or after the schedule's start date (BR143.2) of the plan of its school year, so the count restarts with the next year's plan (owner-confirmed 2026-11-22). A republish that adds or removes a water week recalculates future unnoticed occurrences the way a schedule save does (BR144.1); occurrences with a notice, a done mark or a skip stay |
| One failing schedule in the daily check | Each schedule runs in its own sub-transaction; a failure is recorded in the run record with the schedule id and the rest continue |
| Who is skipped by the check | Removed or anonymised families and archived groups create nothing more (BR143.4); a group with no coordinator notifies its members (BR151.2) |
| Execute right | `grant execute` on `recurring_due_check` to U5's service-role entry point only |

## Secrets

No new secret, key or setting. The existing local settings (`APP_SESSION_SECRET`, `APP_PUBLIC_URL`, `SMTP_FROM`) are unchanged.
