# Infrastructure Specification: u7-swaps-and-duty-changes

Sources: the six NFR design files of this Unit (`performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md`, `logical-components.md`), `functional-spec.md`, `components.md`, and `contract-summary.md`. Nothing is hosted in the Ovis tábla work: the app runs on the owner's computer against the local database stack (`team.md`). This Unit adds no infrastructure; it changes database objects and screens that exist.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | The existing Next.js app, run locally; no new process, service or scheduler | `tech-stack-decisions.md` |
| Networking | Unchanged: app and local database stack on the owner's computer, loopback only | Local stack rule in `project.md` |
| Storage | The existing `change_requests` table, widened by one new forward-only migration file (`20261059_swaps_and_duty_changes.sql`). The same file: adds the columns, statuses and checks; converts open swaps' stored versions; drops the table read policy and revokes `select` from signed-in accounts; rewrites the swap and cancellation functions; adds `duty_reassign`, `swap_reverse`, `swap_list`, `cancellation_list`, `place_add`, the expiry check and the removal pair; changes `coordination_withdraw_requests` and `rota_adjust_picks_after_change`; revokes `swap_decide`; adds the notice kinds, the facts function, the audit action values and the registry row | `team.md` Deployment: forward-only migrations, applied by `npm run db:migrate` |
| Environments | Local only; hosting is a separate piece of work | `team.md` Deployment |
| Infrastructure as code | The migration file is the only infrastructure definition. No CDK, Terraform or workflow is added; executable deployment workflows stay disabled (`npm run verify:no-deploy`) | `project.md` Forbidden |
| Sizing | None needed: a few dozen requests a term (`scalability-design.md`) | NFR5 |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Local Postgres (Supabase CLI stack) | Database | `change_requests` widened, no direct rights for signed-in accounts; existing indexes kept; no new index unless the large-seed timings need one | Existing service, reused |
| Notice registries (U5) | Notices | Five kinds registered by migration rows; facts function `notice_facts_change_request` updated | No change to U5's functions |
| Daily-run registry (U5) | Timed check | One row: check `swap_expiry`, function `dutychanges_swap_expiry_check`, run kind `daily`, active, never granted to a signed-in role | The owner's existing daily-run script calls it |
| Local test mailbox | Email in tests | Existing set-up | No new service |
| Cache, queue, search, CDN, DNS, load balancer | None | Not needed: one read per page | `performance-design.md` |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Place functions (C5) and `coordination_withdraw_requests` | u2 | u7 adds `place_add` and returns both places on withdrawal; u8 later uses `place_release` | Called from the DutyChanges block only; no grant |
| Rota rules and picks (C11) | u6 | u7 adds the no-family change | Called in the same transaction; no grant |
| Notice and daily-run registries | u5 | u7 registers its own rows | Rows only |
| Removal block (C16) | u14 | u7 supplies `dutychanges_removal_preview` and `_apply` | Database owner only |
| Large seed (`db:seed:large`) | u1 | u7 adds a published year of rotas, invented duties and 200 requests | Local development only |

## Secrets

No new secret, key or setting. The existing local settings (`APP_SESSION_SECRET`, `APP_PUBLIC_URL`, `SMTP_FROM`) are unchanged.
