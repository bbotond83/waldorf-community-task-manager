# Infrastructure Specification: u11-checklists-and-templates

Sources: the six NFR design files of this Unit (`performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md`, `logical-components.md`), `functional-spec.md`, `components.md` and `contract-summary.md`. Nothing is hosted in the Ovis tábla work: the app runs on the owner's computer against the local database stack (`team.md`, `technology-stack.md`). This Unit adds no infrastructure; it adds database objects and screens to what exists.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | The existing Next.js app, run locally; no new process, service or scheduler | `tech-stack-decisions.md`: no new package, service or scheduler |
| Networking | Unchanged: the app and the local database stack stay on the owner's computer, loopback only | Local stack rule in `project.md` |
| Storage | Seven new tables (template, template section, template task, checklist head, checklist section, checklist task, claim) in the existing local database, created by one new forward-only migration file, `supabase/migrations/20261067_checklists_and_templates.sql`, which sorts after today's latest file `20261066_recurring_overdue_cap.sql` (if another migration lands first, the next free number is used). The same file holds the database checks and the deferred capacity trigger, the new audit action values, the two notice kinds, the two registry rows, the replacements of `task_save_core` and `event_save_core`, every command, read and internal function of this Unit, and the starting-template install function | `team.md` Deployment: forward-only migrations, applied by `npm run db:migrate` |
| Environments | Local only. No staging or production exists; hosting is a separate piece of work after this one | `team.md` Deployment |
| Infrastructure as code | The migration file is the only infrastructure definition. No CDK, Terraform or workflow is added; executable deployment workflows stay disabled (`npm run verify:no-deploy`) | `project.md` Forbidden |
| Sizing | None needed: about ten templates and a few thousand checklist rows a year (`scalability-design.md`) | NFR5 |
| Starting data | The migration holds `checklist_starting_templates_install`; the existing seed script calls it for the local community and adds invented checklists to some demo events. The later hosting work calls the same function once | BR162.1, FR12.8 |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Local Postgres (Supabase CLI stack) | Database | Indexes of `performance-design.md`; unique and deferrable position constraints; unique `(task_id, parent_id)` and `(event_id, source_ref)` where set; deferred capacity trigger; row-level security on with no policy for signed-in accounts | Existing service, reused |
| Notice registries (U5) | Notices | Kinds `event_lead_time` and `checklist_unclaimed` on U10's `event` target, registered by migration rows | No change to U5's or U10's notice functions |
| Daily-run registry (U5) | Timed checks | Two registry rows: `event_lead_notice` (`event_lead_notice_check`) and `checklist_unclaimed_alert` (`checklist_unclaimed_check`), run kind `daily`, active, `lock_step` 4. Both functions are revoked from every role, the service role included, and run only through `timed_checks_run_system` | The owner triggers the run by hand with `npm run timed:run`; no new scheduler. A day with no run sends nothing that day, but nothing is lost: both checks look for every event whose window has been reached and not yet sent (lead-time day or earlier; deadline minus three days up to the deadline), so the next run catches up, apart from an unclaimed-task alert whose deadline has already passed. A missed day leaves no record, because nothing runs; a real schedule and a "no run today" alert come with the hosting work |
| Local test mailbox | Email in tests | Existing set-up for the notice, cancellation and failure tests | No new service |
| Cache, queue, search service, CDN, DNS, load balancer | None | Not needed: two reads per page, small data that must be live | `performance-design.md` |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Notice kind registry, daily-run registry and run record | u5 (notices) | u11 registers its own rows | Rows only; U5's functions are not edited |
| Event row and event facts (C13) | u10 | u11 reads facts and locks the row `for share` | Never written by u11 |
| `event_save_core` | u10 | u11 replaces it to add helper recipients (BR170.6) | Same behaviour otherwise; U10's tests stay green |
| `task_save_core` | u2/u6 (duties) | u11 replaces it to refuse new event links (BR169.1) | Same behaviour otherwise; existing task tests stay green |
| Lock order of C1 | u1 (function convention) | u11 adds event, checklist head, section, checklist task, claim; callers lock a family first | Recorded as an amendment note in the contract summary at code generation |
| `checklist_add_task` (C15) | u11 | u12 | Owner rights only; no signed-in grant |
| Removal block (C16) | u11 | u14 | Owner rights only; no signed-in grant |
| Large seed (`db:seed:large`) | u1 | u11 adds a big-cleaning event with a mostly taken checklist | Local development only |

## Secrets

No new secret, key or setting. The existing local settings (`APP_SESSION_SECRET`, `APP_PUBLIC_URL`, `SMTP_FROM`) are unchanged.
