# Infrastructure Specification: u8-animal-care-and-information

Sources: the six NFR design files of this Unit (`performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md`, `logical-components.md`), `functional-spec.md`, `components.md`, and `contract-summary.md`. Nothing is hosted in the Ovis tábla work: the app runs on the owner's computer against the local database stack (`team.md`). This Unit adds database objects and screens inside what exists; it adds no service.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | The existing Next.js app, run locally; no new process, service or scheduler. The two daily checks run inside the existing daily run (`npm run timed:run`) | `tech-stack-decisions.md`; C9 |
| Networking | Unchanged: app and local database stack on the owner's computer, loopback only | Local stack rule in `project.md` |
| Storage | Three new forward-only migration files. `20261069_schedule_leaves_out_animal_slots.sql` replaces `schedule_get` to add `and t.origin_kind <> 'animal_slot'`. `20261070_u8_review_fixes.sql` replaces `animal_calendar_save` (a first-save race now gives `VERSION_CONFLICT`) and `info_section_update` (checks the caller before locking, and a coordinator cannot reach a hidden section), each with `revoke all` and explicit grants restated; it leaves `20261068` unedited. `20261068_animal_care_and_information.sql` does the following: re-creates the duty origin check with `animal_slot`; creates the slot calendar, slot, fair-share round and information section tables with their checks, unique keys and the slot date index, row-level security on and no right for `authenticated`; adds the commands and reads of `functional-spec.md`, `slot_give_up`, `info_section_owner_group`, `info_links_for_duty` and the two daily checks, each with `revoke all` and explicit grants; replaces `rota_duty_card` to add `info_links`; registers four notice kinds, the target type `animal_signup` and their fact functions; re-creates the audit action check with the complete current list plus two actions; inserts the two daily-run registry rows; inserts the six starting sections with their owner names | `team.md` Deployment: forward-only migrations, applied by `npm run db:migrate` |
| Environments | Local only; hosting is a separate piece of work | `team.md` Deployment |
| Infrastructure as code | The migration files are the only infrastructure definition. No CDK, Terraform or workflow is added; executable deployment workflows stay disabled (`npm run verify:no-deploy`) | `project.md` Forbidden |
| Sizing | None needed: about 400 slots a year and a dozen sections (`scalability-design.md`) | NFR5, NFR9 |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Local Postgres (Supabase CLI stack) | Database | Four new tables read only through functions; unique slot per calendar, date and part; slot date index; existing duty origin and place indexes reused | Existing service, reused |
| Notice registries (U5) | Notices | Kinds `animal_empty_slots`, `animal_empty_slots_alert`, `animal_fair_share`, `animal_slot_time_changed` and target type `animal_signup` registered by migration rows, with this Unit's fact functions | No change to U5's functions |
| Daily-run registry (U5) | Timed checks | Two rows: `animal_empty_slots` → `animal_empty_slots_check` and `animal_fair_share` → `animal_fair_share_check`, run kind `daily`, active, `lock_step` 4, `added_by` `u8-animal-care`; never granted to a signed-in role. Lock step 4 ("jobs, deliveries and other rows") because neither check locks a family, task or assignment row: the empty-slot check only reads slots and standings and sends notices, and the fair-share check inserts its round row and sends notices. The run calls them after any step 1 to 3 checks, beside U9's and U11's step-4 checks, in name order | The owner's existing daily-run command calls them. A database test reads the registry order and finds both rows at step 4 in the expected place |
| Local test mailbox | Email in tests | Existing set-up | No new service |
| Cache, queue, search, CDN, DNS, load balancer | None | Not needed: fixed small reads per page | `performance-design.md` |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Duty and place functions (C4 `duty_create`, C5 `place_release`, C18 `duty_sign_up`) | u2 | u8 creates slot duties, signs up and releases slot places | Internal functions called from u8's functions; `duty_sign_up` keeps its existing grant |
| DutyChanges block | u7 | u8 adds `slot_give_up` beside it (C19) | Signed-in command with its own holder check |
| Teacher schedule read `schedule_get` | other unit | u8 replaces it in `20261069` to leave out animal slots only; the teacher sees them on the read-only page `/teacher/allatok` | Same grant as today. `animal-slot-races`/`animal-calendar-slots` carry a regression test that the schedule omits animal slots |
| Duty card read `rota_duty_card` | u6 | u8 replaces it to add `info_links` only, starting from the latest applied definition (in `20261053_full_rotas_and_weekend_picks.sql`) and changing nothing else | Same grant as today; links come from the internal `info_links_for_duty`. A test reads a card before and after the migration and finds the same fields apart from `info_links` |
| Family standing (C20) and changeover rule (C10) | u6 | u8 reads standings and checks eligibility | Internal, read-only |
| Working-group facts (C7) | u4 | u8 finds the alert group's and owning group's coordinators | Internal, read-only |
| Notice and daily-run registries | u5 | u8 registers its own rows | Rows only |
| Audit action check | u1, re-created by later units | u8 re-creates it with the complete list plus two actions | Database owner only |
| Large seed (`db:seed:large`) | u1 | u8 adds a year's slot calendar and slots and sample section text | Local development only |

## Secrets

No new secret, key or setting. The existing local settings (`APP_SESSION_SECRET`, `APP_PUBLIC_URL`, `SMTP_FROM`) are unchanged.
