# Architecture Decisions

Decisions for the components in `components.md`, driven by `requirements.md`, `stories.md`, `architecture.md`, `component-inventory.md` and `team-practices.md`.

## ADR-001: One community with working groups replaces kindergarten groups

- **Context** — Tasks and events must each belong to a kindergarten group, and all access and sign-up checks go through groups (`architecture.md`). The owner decided there is only the community and the working groups (FR1), and the app holds only test data (US1.1).
- **Decision** — Convert the group table into working groups, make an event's or duty's group optional (none means community-wide), move membership from family to parent, and re-scope the group-admin role. Start clean with fresh invented data.
- **Consequences** — Positive: one structure matches the real community; no data conversion. Negative: every access helper and many tests change, so it is the riskiest change and comes first. Security: access rules are rewritten and need the fixed test list.
- **Alternatives Rejected** — A separate working-groups table beside kindergarten groups: leaves a concept nobody needs. One hidden "community" group: keeps checks working but misrepresents the model.

## ADR-002: All duties share one model

- **Context** — Swaps must work between any kinds of duty (FR8.2). Rotas, daily slots, recurring occurrences and event tasks all mean "a family holds this". The existing swap logic already works on tasks and places.
- **Decision** — Each is a Duty with Places. RotaPlanning, AnimalCareSignup, RecurringDuties and Events create duties and keep only their own extra data.
- **Consequences** — Positive: swaps, reminders and the overview work the same everywhere. Negative: about 700 duty rows a year and queries need care; Duties becomes a widely used component. Security: one place to enforce access.
- **Alternatives Rejected** — A separate table per rota: simple per feature, but swaps across kinds need special handling. One generic table with everything as JSON: flexible, but loses database checks.

## ADR-003: Done marks live on each record

- **Context** — Places, checklist tasks and to-do tasks need "done, by whom, when".
- **Decision** — Each record has its own done fields, written through the same function pattern.
- **Consequences** — Positive: simple reads and no cross-component table. Negative: the pattern is repeated. Security: each owner's access rule applies directly.
- **Alternatives Rejected** — A shared completion table: one model, but every component would depend on it and access rules would span features.

## ADR-004: Weekend picks belong to rota planning

- **Context** — Who picks depends on the same week's rota and on break weeks (FR6).
- **Decision** — RotaPlanning owns WeekendPick and creates the opening, closing and cleaning duties.
- **Consequences** — Positive: the linked rules are in one place. Negative: a swap must respect them, which US8.2 defines and ADR-011 arranges.
- **Alternatives Rejected** — Picks inside Duties: makes the general model carry one rota's rule. A separate weekend component: splits rules that always change together.

## ADR-005: Events copy checklists from templates

- **Context** — Editing a template must not change past events (FR12.5).
- **Decision** — Creating an event copies the template's tasks into EventChecklistTask. Removing a template hides it.
- **Consequences** — Positive: history is stable and events can be adjusted. Negative: a template fix doesn't reach existing events.
- **Alternatives Rejected** — Referencing the live template: no copy, but history changes. Version-numbered templates: exact history, but more machinery than needed.

## ADR-006: One daily run decides what is due

- **Context** — Reminders must run without anyone signing in (FR17.3), and the app has no scheduler today (`architecture.md`). Hosting is separate work.
- **Decision** — One TimedChecks component, safe to run twice, runs daily at 07:00 Budapest time, with a Friday-noon run for weekend picks. Locally a command triggers it, and the hosting work attaches a real schedule.
- **Consequences** — Positive: testable without a scheduler; keeps dependencies one-way. Negative: locally reminders run only when triggered, so this must be shown in the owner's check. Security: the trigger must not be callable by users.
- **Alternatives Rejected** — A database scheduling extension: runs by itself, but ties us to it before hosting is chosen. Running on sign-in, as housekeeping does today: fails the requirement.

## ADR-007: Email through the existing mail adapter

- **Context** — Reminders must also reach email (FR17.1), and the identity code already sends mail over SMTP.
- **Decision** — Reuse that adapter; verify against a local test mailbox; connect a real service in the hosting work.
- **Consequences** — Positive: little new code. Negative: real delivery stays unverified until hosting. Security: emails carry no other family's details, and no address is stored in delivery records.
- **Alternatives Rejected** — A third-party email API now: premature before hosting. In-app only: the owner chose email.

## ADR-008: Who may see what is decided in the database

- **Context** — The directory holds personal data about parents and children (FR3, NFR1, NFR3).
- **Decision** — Directory reads go through database functions that return only permitted fields, per the viewer and every parent's sharing choice.
- **Consequences** — Positive: a screen bug cannot leak hidden fields. Negative: more logic in SQL, covered by the fixed test list. Security: this is the main privacy control.
- **Alternatives Rejected** — Filtering in application code: easier to write, but a bypass exposes data. Row-level rules alone: they work on rows, not on fields.

## ADR-009: The migration script is outside the running app, and the old import goes

- **Context** — The owner chose a one-off migration and to remove the import screen (FR18, FR19).
- **Decision** — A script under `scripts/` calls named functions. It prints counts only and is tested with an invented workbook. The import screen, parser and functions are removed once the new structure replaces them.
- **Consequences** — Positive: nothing to maintain after go-live and a smaller app. Negative: the real layout is proven only by the owner's trial runs. Security: real data stays on the owner's computer until the hosting work.
- **Alternatives Rejected** — Keeping the import screen for the migration: the template doesn't match. A manual load: slow and error-prone.

## ADR-010: References against the call direction are ids only

- **Context** — Identity's records must point to a Parent and a WorkingGroup, and a Duty to whatever created it, while calls run the other way. The existing app already links its database blocks by typed ids with no foreign key, checked inside functions (`architecture.md`).
- **Decision** — Keep calls one-way and hold these references as ids, checked inside the functions that write them. When a membership ends, WorkingGroups asks Identity to end the admin grant. Lifecycle ends a removed parent's sign-in and clears the link.
- **Consequences** — Positive: no circular calls, and one existing pattern. Negative: the database can't enforce those links by itself, so the functions and their tests must. Security: a stale link must never grant access, so Identity's access helpers check that the parent and grant are still active.
- **Alternatives Rejected** — Making Identity call Community and WorkingGroups: creates real call cycles. Moving the role grants into WorkingGroups: splits the single place that decides what a person may do.

## ADR-011: Swaps and reassignment sit above duties and rotas

- **Context** — A swap must refuse a same-week indoor-cleaning and front-garden clash and must move or reopen a weekend pick (US8.2, US5.4). Those rules belong to RotaPlanning, which depends on Duties, so Duties cannot call it without a cycle.
- **Decision** — A separate DutyChanges component owns swaps, cancellations and reassignment. It depends on Duties and RotaPlanning: before applying a change it asks RotaPlanning whether the rules allow it, and afterwards tells RotaPlanning to adjust the pick, all in one database transaction.
- **Consequences** — Positive: one-way calls, one transaction, and rota rules stay with rotas. Negative: one more component, and existing swap functions move into it. Security: the same access checks apply; a reversal or reassignment is audited.
- **Alternatives Rejected** — A hook that RotaPlanning registers with Duties: keeps Duties unaware, but indirect logic is hard to follow and test in SQL. Putting rota rules into Duties: makes the general model carry one feature's rules.

## ADR-012: Giving up an animal-care slot is a direct release

- **Context** — The owner chose that a family can give up a slot itself until 24 hours before (Q5 of `refined-mockups-questions.md`). Assumption A6 in `requirements.md` says an administrator decides cancellations of assigned duties. The rule isn't yet in `requirements.md` or `stories.md`.
- **Decision** — It is a direct release owned by DutyChanges, because a sign-up slot is voluntary. It is separate from cancelling an assigned duty, which still needs an administrator. Functional Design adds its acceptance criteria.
- **Consequences** — Positive: one owner for every change of who holds a place, and no administrator work for slots. Negative: a family can release late-ish slots, covered by empty-slot warnings. Security: only the holding family may release, and the 24-hour limit is enforced in the database.
- **Alternatives Rejected** — Administrator decides: extra work for a voluntary slot, and the owner chose otherwise. Inside AnimalCareSignup: splits the rules about who holds a place.
