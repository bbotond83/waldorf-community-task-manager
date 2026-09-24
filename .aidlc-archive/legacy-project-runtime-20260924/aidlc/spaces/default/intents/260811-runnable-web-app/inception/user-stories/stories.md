# User Stories

## Normative Inherited Stories

Approved stories **US-01 through US-14** from `../../../260729-feature/inception/user-stories/stories.md` remain normative. The delta stories below make those product journeys runnable and testable locally; they do not replace them. [requirements] [prior-stories]

## Local Runtime Delivery Stories

### US-LR-01 — Fresh Local Start (Must, Enabler)

As a Developer/Product Owner, I want documented install, configure, develop, build, and start commands, so that I can reproduce the application locally before deployment.

- **Given** a fresh checkout on Node 24.x and npm 11.x, **when** I follow the runbook in synthetic mode, **then** install/dev exit successfully and `GET /` returns HTTP 200 within the documented readiness timeout with the Hungarian `Helyi tesztprofil kiválasztása` marker.
- **Given** the same checkout, **when** I run production build and deterministic start, **then** the build succeeds and the start-smoke check receives a successful application response.
- **Given** an unsupported runtime major or each missing/invalid required environment boundary, **when** setup runs, **then** it exits non-zero with a stable error identifier, names the variable/rule without printing a secret value, performs no staging/production network call, and deploys nowhere.

Dependencies: none. Trace: FR-LR-01/02/11/12, NFR-LR-01. INVEST: independent foundation, observable commands and responses.

### US-LR-02 — Synthetic Identity Boundary (Must)

As a Developer/Product Owner, I want privacy-safe test profiles, so that I can verify every inherited role without production credentials or personal data.

- **Given** explicit synthetic mode, **when** I open local entry, **then** Parent, Staff, Group Admin, Kindergarten Admin, and Super Admin profiles show only synthetic scope summaries.
- **Given** a selected profile, **when** I switch profiles, **then** the prior session clears, navigation is recalculated, and focus moves predictably.
- **Given** production configuration, **when** the application starts, **then** the synthetic selector is absent and the Supabase authentication boundary is used.
- **Given** production configuration, **when** a crafted selector endpoint/action or synthetic-profile request is attempted, **then** it is unavailable/denied and cannot create a synthetic session.
- **Given** profile switching, **when** the new profile is selected, **then** prior cookies/session/grants and transient form state clear, server-side authorization is recalculated, the selected role/scope is announced, and focus lands on the destination H1.

Dependencies: US-LR-01. Trace: FR-LR-04/05/06, NFR-LR-05.

### US-LR-03 — Role-Aware Application Shell (Must)

As every product user, I want a Hungarian, responsive, accessible shell containing only permitted navigation, so that I can reach my work without discovering protected capabilities.

- **Given** any synthetic profile, **when** its home route renders, **then** header, role navigation, main landmark, one H1, skip link, visible focus, and status region are present.
- **Given** Parent, Staff, or each admin scope, **when** navigation renders, **then** permitted destinations match the approved authorization matrix and forbidden destinations are absent.
- **Given** mobile viewport, keyboard-only input, or 200% zoom, **when** the shell is used, **then** reading/focus order and 44×44 touch targets remain usable.
- **Given** collapsed navigation, **when** keyboard interaction opens/closes it, **then** current-page indication is non-color-only, Escape closes where safe, focus returns to the trigger, and ordering matches desktop.
- **Given** a denied deep link, **when** denial renders, **then** generic Hungarian copy exposes no resource existence/field data, focus moves to the denial H1, and a safe permitted destination is available.

Dependencies: US-LR-01/02 and approved FR-LR-14 matrix. Trace: FR-LR-07/14, NFR-LR-03.

### EPIC-LR-04 — Parent Acceptance Journey

As a Parent, I want my inherited responsibility journey runnable locally, so that signup, request, reminder, privacy, and failure behavior can be accepted before deployment.

- **Given** linked-family synthetic duties, **when** I view and act, **then** eligible signup succeeds, full/ineligible status prevents mutation, and unrelated-family data is absent from UI/API responses.
- **Given** my assignment, **when** I request swap/cancellation, **then** pending, approved/rejected, conflict, failure/retry, and invalidated outcomes match US-01 through US-04.
- **Given** reminder/notification states, **when** I open them, **then** Hungarian timing/status is visible and provider effects are clearly simulated locally.

The following delivery-sized stories collectively satisfy FR-LR-08/10a and inherited US-01–US-04.

#### US-LR-04a — Parent Duties and Signup (Must)

As a Parent, I want to view linked-family duties and sign up when eligible, so that I can take responsibility without seeing unrelated-family data.

- **Given** loading, no linked duties, available duty, full duty, or ineligible duty, **when** the route renders, **then** the corresponding Hungarian state and permitted action are explicit.
- **Given** an eligible duty, **when** I submit once or attempt duplicate submission while pending, **then** one assignment is created, duplicate mutation is blocked, success is announced, and current context remains.
- **Given** unrelated family or direct object/API access, **when** requested, **then** generic denial/absence occurs with no protected field, resource-existence oracle, mutation, or unsafe audit/log value.

Dependencies: US-LR-02/03, FR-LR-14. Trace: FR-LR-08, US-01/02.

#### US-LR-04b — Parent Swap and Cancellation (Must)

As a Parent, I want to request swaps and cancellations, so that responsibility changes follow approved atomic and review rules.

- **Given** a valid assignment, **when** I submit, **then** pending state blocks duplicates and detail exposes only permitted reason/status data.
- **Given** qualified auto-swap, admin decision, competing change, capacity conflict, rejection, or invalidation, **when** processed, **then** assignments/reminders change atomically only on success; failure leaves owned state unchanged and emits only redacted audit evidence.
- **Given** retryable dependency failure, **when** I retry, **then** idempotency prevents duplicate request/assignment effects.

Dependencies: US-LR-04a. Trace: FR-LR-08, US-03.

#### US-LR-04c — Parent Notifications and Reminders (Must)

As a Parent, I want upcoming-duty and notification-centre behavior locally visible, so that reminder timing and links can be accepted before provider integration.

- **Given** 7-day, 24-hour, within-threshold, rescheduled, cancelled, stale, retry, and duplicate states, **when** fixtures run, **then** Hungarian notification state and destination link match inherited rules.
- **Given** simulated email/provider effects, **when** delivery status appears, **then** it is labelled synthetic in UI/evidence while in-app workflow semantics remain unchanged.
- **Given** provider evidence is absent, **when** reporting runs, **then** it remains `OUTSTANDING`, not `PASS`.

Dependencies: US-LR-04a. Trace: FR-LR-10a/10b, US-04.

#### US-LR-04d — Parent Accessibility and Recovery (Must)

As a Parent, I want accessible validation and failure recovery, so that I can complete responsibilities using keyboard, zoom, and assistive feedback.

- **Given** multi-field validation, **when** submission fails, **then** labelled field errors and an error summary appear, focus moves to summary/first invalid control, and no color-only indication is used.
- **Given** slow/dependency failure, **when** the normal threshold is exceeded, **then** actionable status replaces indefinite loading and retry preserves safe context.
- **Given** route change or asynchronous pending/success/error, **when** state changes, **then** H1 focus or appropriate live announcement occurs once without keyboard trap.

Dependencies: US-LR-04a/b. Trace: NFR-LR-03/04.

### US-LR-05 — Staff Read-Only Journey (Must)

As Read-only Staff, I want a scoped schedule surface, so that I can see permitted coordination information without contacts, sensitive fields, edits, or unrelated data.

- **Given** an authorized schedule scope, **when** I view/filter/open detail, **then** only approved schedule fields and necessary display names appear.
- **Given** empty or dependency-failure state, **when** I clear filters or retry, **then** the flow returns through loading without exposing protected data.
- **Given** a forbidden mutation, parent, or admin URL/API request, **when** I attempt access, **then** generic denial appears and protected fields/resource existence remain absent.

Dependencies: US-LR-02/03, FR-LR-14 matrix. Trace: FR-LR-09, inherited US-13.

### EPIC-LR-06 — Scoped Administrator Journeys

As an Administrator, I want my inherited operations runnable within my authorized scope, so that records, coordination, approvals, imports, reminders, archive, and recovery can be accepted locally.

- **Given** Group, Kindergarten, or Super Admin, **when** dashboard/navigation/routes load, **then** routes, actions, resources, and fields match the approved matrix and out-of-scope direct UI/API access is denied.
- **Given** records, task/event, assignment, or approval action, **when** validation/mutation executes, **then** pending, success, conflict/invalidated, failure, retry, and redacted audit outcomes are observable without partial success.
- **Given** import/reminder/lifecycle flows, **when** simulated locally, **then** preview, commit/recovery, queue/status, and lifecycle state transitions satisfy NFR-08 while real database/provider evidence remains marked outstanding.

The following workflow stories collectively satisfy FR-LR-10/10a/10b and inherited US-05–US-12. Every scenario names Group, Kindergarten, or Super Administrator scope where relevant.

#### US-LR-06a — Scoped Records and Archive (Superseded Umbrella; Not Delivery-Sized)

As an authorized Administrator, I want scoped records and archive workflows, so that families, children, groups, school years, and historical records remain operable.

- **Given** each admin profile, **when** list/filter/detail/create/edit/archive/restore runs, **then** only matrix-permitted resources/fields/actions appear and out-of-scope UI/API/object access is generically denied with no mutation.
- **Given** loading, empty, validation, pending, success, failure/retry, stale-revocation, or conflict, **when** encountered, **then** deterministic recovery preserves filters and current authorized state where safe.
- **Given** school-year archive, **when** exercised, **then** inherited NFR-08 Pass/Fail evidence is recorded.

Dependencies: US-LR-02/03, FR-LR-14. Trace: US-05/06.

#### US-LR-06b — Tasks, Events, Assignments, and Notes (Superseded Umbrella; Not Delivery-Sized)

As an authorized Administrator, I want scoped coordination mutations, so that tasks, events, assignments, contribution/allergen notes, capacity, and conflicts follow domain rules.

- **Given** permitted scope, **when** create/edit/assign/note actions run, **then** existing domain ports decide validation, eligibility, capacity, and field visibility.
- **Given** duplicate pending submission, capacity/eligibility conflict, stale data, denial, or infrastructure failure, **when** processed, **then** no unauthorized/partial mutation occurs and recovery is explicit/idempotent.
- **Given** consequential confirmation, **when** a dialog is used, **then** it names object/consequence, contains focus, supports safe Escape, and returns focus to trigger.

Dependencies: superseded by US-LR-06a1/06a2 and US-LR-06b1/06b2. Trace: US-05/07, FR-LR-03.

#### US-LR-06c — Approval Detail (Must)

As an authorized Administrator, I want approval queues and detail decisions, so that cancellation/non-qualified swap outcomes are controlled and auditable.

- **Given** empty/populated queue, **when** filtered/opened, **then** only in-scope requests and permitted reason fields appear.
- **Given** approve, reject, already-decided, invalidated, denied, or dependency failure, **when** action occurs, **then** one atomic outcome or unchanged state results with redacted audit evidence; retry is absent for success, business conflict, invalidated, already-decided, and denied outcomes, and is present only for the scenario's explicitly retryable dependency failure using the same idempotency key.

Dependencies: US-LR-06a1, US-LR-06b2. Trace: US-03/05.

Outcome contract:

| Outcome | State mutation | Retry control | Idempotency/evidence |
|---|---|---|---|
| Approve | Exactly one approved transition | Absent | Original idempotency key; `PASS` only with one state/audit transition |
| Reject | Exactly one rejected transition | Absent | Original idempotency key; `PASS` only with one state/audit transition |
| Already decided | Unchanged | Absent | Classified `CONFLICT`; evidence references current decision |
| Invalidated | Unchanged | Absent | Classified `INVALIDATED`; evidence references refreshed current state |
| Denied | Unchanged | Absent | Matrix-defined denial; no resource oracle; redacted evidence |
| Retryable dependency failure | Unchanged before retry | Present | Scenario manifest sets `retryable: true`; retry reuses idempotency key and may yield at most one terminal transition |
| Non-retryable dependency failure | Unchanged | Absent | Scenario manifest sets `retryable: false`; terminal error and recovery guidance recorded |

#### US-LR-06d — Import Preview, Commit, and Recovery (Must)

As a Kindergarten or Super Administrator, I want the inherited import workflow runnable, so that all-sheet mapping, conflict resolution, immutable preview, atomic commit, and recovery can be accepted.

- **Given** upload/parsing/mapping/conflict/preview states, **when** hostile or ambiguous input occurs, **then** confirmation remains disabled, row-linked privacy-safe errors guide resolution, and no partial records commit.
- **Given** approved preview hash/version, **when** commit, retry, interruption, rollback, or recovery runs, **then** outcomes are atomic/repeat-safe, duplicates are absent, and service-restoration evidence follows the inherited target.
- **Given** synthetic mode, **when** effects complete, **then** simulated persistence is labelled and real Supabase transaction evidence remains `OUTSTANDING`.

Dependencies: US-LR-06a1, US-LR-06a2, migration register. Trace: US-08–US-10.

#### US-LR-06e — Reminder Monitoring and Retry (Must)

As an authorized Administrator, I want privacy-safe reminder/job monitoring, so that stale, cancelled, failed, retrying, duplicate-suppressed, and successful states are operable.

- **Given** filter/detail/retry, **when** used, **then** no message body/contact/sensitive value appears and duplicate retry is blocked.
- **Given** synthetic provider states, **when** accepted locally, **then** application queue/status behavior passes while provider idempotency/delivery stays `OUTSTANDING` until real target execution.

Dependencies: US-LR-06a1, jobs/notification contracts. Trace: US-04, FR-LR-10a/b.

#### US-LR-06f — Privacy Lifecycle (Must)

As a Kindergarten Administrator, I want annual review and departure lifecycle recovery, so that deletion/anonymization/holds/sibling/re-enrolment rules are visible and safe.

- **Given** eligible departure, sibling, hold, re-enrolment, concurrent change, failure, or retry, **when** lifecycle runs, **then** final eligibility is rechecked, only permitted mutation occurs, and redacted reason/audit evidence is produced.
- **Given** simulated persistence, **when** local recovery runs, **then** state-machine behavior passes and real transaction/lifecycle evidence remains `OUTSTANDING`.

Dependencies: US-LR-06a1, US-LR-06a2, privacy/audit contracts. Trace: US-11.

#### US-LR-06g — Roles, Governance, and Settings (Must)

As a Kindergarten or Super Administrator, I want only permitted role/governance/settings actions, so that scope changes and immediate revocation are testable.

- **Given** Kindergarten Administrator, **when** super-admin governance is attempted, **then** it is denied; **given** Super Administrator, **when** permitted governance runs, **then** it succeeds with redacted audit evidence.
- **Given** a grant removal, **when** the affected user's next UI/API/data request or stale navigation/cache access occurs, **then** access is denied, protected data disappears, and no token-expiry delay is accepted.

Dependencies: FR-LR-14, access-foundation contract. Trace: US-06, NFR-LR-05.

### US-LR-07 — Security and Privacy Evidence (Must, Evidence)

As a Product Owner, I want repeatable negative authorization and redaction evidence, so that synthetic local success cannot hide privacy regressions.

- **Given** the approved matrix, **when** critical UI/API/object tests run, **then** evidence references matrix row IDs and includes Parent→unrelated family, Staff→mutation/contact/profile/reason, Group Admin→ungranted group, Kindergarten Admin→super-admin governance, forbidden object identifiers for every role, and next-request revocation including stale cache/navigation.
- **Given** validation, denial, or infrastructure failure, **when** evidence is captured, **then** status/body is generic, sensitive fields/resource existence are absent, state is unchanged, and responses/logs/audits/fixtures/screenshots contain no secret or real/sensitive personal value.
- **Given** linked targets are absent, **when** the report is produced, **then** Supabase RLS, persistence, scheduler, provider, and Vercel checks remain explicitly outstanding rather than passing by simulation.

Dependencies: US-LR-02–06, FR-LR-14 matrix. Trace: NFR-LR-05 and Acceptance Evidence Matrix.

### US-LR-08 — Quality and Browser Gate (Must, Evidence)

As a Developer/Product Owner, I want one documented verification suite, so that the local application is objectively ready for later target integration.

- **Given** production source, **when** quality commands run, **then** strict type, Prettier, ESLint, tests, ≥80% line/branch/function coverage, build, start smoke, secret, SAST, and dependency gates pass.
- **Given** critical role flows, **when** automated browser tests run, **then** Chromium, Firefox, and mobile-Chrome coverage passes with no serious/critical accessibility violations.
- **Given** Safari desktop/mobile Safari release evidence, **when** recorded smoke checks run, **then** Pass/Fail results cover entry, navigation, parent mutation, staff read/denial, admin approval, validation, keyboard, and accessibility; unavailable evidence blocks release or has a dated explicit exception.
- **Given** the critical-flow manifest, **when** evidence records are written, **then** each contains scenario ID, requirement/story ID, browser/engine/version, viewport/device, result, timestamp, and evidence location; any exception names approver, scope, expiry, and residual risk.
- **Given** the versioned 30-family fixture, **when** critical page/application response performance is measured across documented repetitions, **then** the inherited 2-second boundary is recorded with start/end points and result.
- **Given** architecture/maintainability checks, **when** the gate runs, **then** every route/action maps to an existing public port or approved owning-module contract addition and no framework component owns domain decisions.

Dependencies: US-LR-01–07. Trace: NFR-LR-02/03/04/07.

### US-LR-09 — Local Handoff Without Deployment (Must, Evidence)

As a Product Owner, I want a clear local acceptance handoff, so that I know what works locally and what still requires linked Supabase/Vercel/provider targets.

- **Given** a fresh checkout, **when** an independent developer follows documentation, **then** setup, profiles, role surfaces, and all local quality commands complete without undocumented steps.
- **Given** the acceptance report, **when** I review evidence, **then** every Acceptance Evidence Matrix row is separately `PASS`, `FAIL`, `BLOCKED`, or `OUTSTANDING` for synthetic and linked-target execution.
- **Given** this intent completes, **when** repository automation/network evidence is inspected, **then** no executable deploy workflow, target credentials, or staging/production network invocation occurred; future staging may be automatic only after linkage/gates, and future production promotion remains protected and manual.

Dependencies: US-LR-01–08. Trace: FR-LR-12/13/13a, Q8 deployment precedence.

## Dependency Map

`US-LR-00 → US-LR-01 → US-LR-02 → US-LR-03`

`Parent: US-LR-04a → {US-LR-04b, US-LR-04c, US-LR-04d}; US-LR-04e and US-LR-04f depend on US-LR-02/03 plus named contracts`

`Staff: US-LR-05 depends on US-LR-00/02/03`

`Admin: US-LR-06a1 → {US-LR-06a2, US-LR-06b1}; US-LR-06b1 → US-LR-06b2 → US-LR-06c; import/reminders/lifecycle depend on the active split IDs named in their story; governance and shared validation depend on US-LR-00`

`US-LR-07/08 evidence accumulates alongside every completed role slice → US-LR-09 aggregates final local handoff`

The existing domain/access contracts and the approved FR-LR-14 matrix are prerequisites where named; stories remain vertical acceptance slices rather than framework-layer tasks. [requirements] [components]

## INVEST Assessment

Product workflow stories have one persona/value outcome, explicit dependencies, bounded local scope, and Given/When/Then criteria. US-LR-01 and US-LR-07–09 are explicitly enabler/evidence stories rather than product-value slices. Parent and Administrator epics are decomposed before Delivery Planning. [requirements] [practices]

## Story-to-Scenario Preservation Gate

Before implementation acceptance, a versioned manifest shall map every inherited US-01–US-14 acceptance path and every US-LR story to: local route/API entry, synthetic fixture/profile ID, scenario ID, populated/loading/empty/denied/failure-retry/invalidated states as applicable, requirement IDs, automated/manual browser coverage, and synthetic versus linked-target evidence status. An unmapped inherited path is unimplemented even if representative dashboards run. [requirements] [prior-stories]

## Sources

- [requirements] `../requirements-analysis/requirements.md`
- [prior-stories] `../../../260729-feature/inception/user-stories/stories.md`
- [components] `../../../codekb/waldorf-community-task-manager/component-inventory.md`
- [practices] `../practices-discovery/team-practices.md`

## Mob Resolution Addendum

This section is normative and supersedes any broader or ambiguous criterion above. [requirements] [practices]

### US-LR-00 — Authorization Contract Approval (Must, Enabler)

As a Product Owner, I want a versioned authorization and sensitive-field contract approved before role-route acceptance, so that implementation cannot invent access policy.

- **Given** inherited requirements/stories and the access-foundation contract, **when** the matrix is authored, **then** every row has stable ID, role, scope predicate, route, action, resource, field set, allow/deny result, exact application error code and HTTP status where applicable, no-mutation rule, audit/redaction rule, and next-request revocation expectation.
- **Given** sensitive fields, **when** the dictionary is authored, **then** email, phone, locality/residence, optional profile fields, protected reasons, participant display names, and unrelated-family data have stable IDs plus purpose, allowed scope, redaction surfaces, and lifecycle treatment.
- **Given** independent review and Product Owner approval, **when** every inherited authorization/privacy rule maps without contradiction, **then** matrix version/hash and approval receipt unblock dependent stories; otherwise they remain `BLOCKED`.

Dependencies: none. Trace: FR-LR-14, NFR-LR-05.

### US-LR-04e — Invitation and Authentication Entry (Must)

As a Parent, I want invitation expiry/resend and authentication-entry states runnable locally, so that inherited onboarding and upcoming-duty behavior is preserved.

- **Given** valid, expired, used, and resent synthetic invitations, **when** opened, **then** exact state, permitted resend, non-enumerating response, and destination are observable.
- **Given** a synthetic Parent with or without an upcoming duty, **when** entry completes, **then** the approved notice or empty state links to the permitted route.
- **Given** unlinked targets, **when** evidence records, **then** application flow may pass while real Supabase invitation/session behavior remains `OUTSTANDING`.

Dependencies: US-LR-02/03. Trace: FR-LR-10a, NFR-08.

### US-LR-04f — Event Participant Notes (Must)

As an authorized event participant, I want permitted allergen and contribution-note behavior, so that inherited US-07 is preserved.

- **Given** assigned family, confirmed signup, explicit admin participant, unrelated user, and Staff fixtures, **when** event detail opens, **then** allergen visibility follows named matrix rows.
- **Given** Parent, **when** contribution notes change, **then** only that Parent's own note changes; permitted admins may change supply/food/allergen notes; all other attempts return matrix-defined denial, unchanged state, and redacted evidence.

Dependencies: US-LR-00/02/03. Trace: US-07, FR-07.

### US-LR-06a1 — Scoped Core Records (Must)

As an authorized Administrator, I want scoped family, child, group, and school-year records, so that core records remain operable without crossing role scope.

- **Given** each admin profile and each named record family, **when** list/filter/detail/create/edit runs, **then** matrix-row permitted fields/actions appear; denied UI/API/object cases return the row's exact error/status with no mutation.
- **Given** loading, empty, validation, pending, success, dependency failure, or stale revocation, **when** encountered, **then** the evidence ID records exact result; retry exists only for dependency failure and preserves filters.

Dependencies: US-LR-00/02/03. Trace: US-05/06.

### US-LR-06a2 — Archive and Restore (Must)

As an authorized Administrator, I want archive/restore flows, so that historical records remain governed.

- **Given** active, archived, empty, restore-conflict, denied, and dependency-failure fixtures, **when** archive/restore runs, **then** pending blocks duplicates, success moves one record, conflict/failure leaves state unchanged, and retry appears only for dependency failure.
- **Given** the NFR-08 school-year archive scenario, **when** executed, **then** route, matrix row, fixture, browser result, and evidence ID are recorded.

Dependencies: US-LR-06a1. Trace: US-05, NFR-08.

### US-LR-06b1 — Tasks and Events (Must)

As an authorized Administrator, I want scoped task/event mutations, so that scheduling remains domain-owned.

- **Given** permitted scope, **when** create/edit/archive runs, **then** the scenario names the owning public port/approved contract addition and maps its exact result to UI/API state.
- **Given** duplicate pending, stale data, denial, or dependency failure, **when** processed, **then** no partial mutation occurs; only dependency failure is retryable and idempotency produces one mutation.

Dependencies: US-LR-06a1. Trace: US-05, FR-LR-03.

### US-LR-06b2 — Assignments and Capacity (Must)

As an authorized Administrator, I want scoped assignment actions, so that eligibility, capacity, and family ownership are atomic.

- **Given** eligible, ineligible, full, conflicting, stale, denied, and dependency-failure fixtures, **when** submitted, **then** one exact domain/UI/API result occurs and every failed/denied attempt leaves assignments unchanged.
- **Given** pending duplicate submit, **when** repeated, **then** one operation yields at most one assignment and one redacted audit outcome.

Dependencies: US-LR-06a1/b1. Trace: US-05, FR-05/05a.

### US-LR-06h — Shared Validation Across Entry Points (Must)

As a Kindergarten Administrator, I want identical UI, API, invitation, profile, and import validation, so that inherited US-12 is preserved.

- **Given** a versioned table of UTF-8 normalization, Hungarian search/collation, RFC-3339 timestamp, E.164 phone, field, and identity-match cases, **when** submitted through every seam, **then** normalized value or stable error ID is identical.
- **Given** a rejected case, **when** evidence is captured, **then** no seam mutates state or logs/reports the raw sensitive value.

Dependencies: US-LR-00/01 and owning validation ports. Trace: US-12, FR-12.

### Exact Acceptance Contracts

- Synthetic production-adapter selection proves configuration/composition only; selector markup/actions are absent and crafted synthetic-session requests are denied. Actual Supabase authentication/RLS remains `OUTSTANDING` until linked execution.
- A denied response uses the exact error code/status defined by its US-LR-00 matrix row, exposes no protected field/resource-existence signal, changes no state, and emits only dictionary-compliant redacted evidence.
- The inherited response target is 2 seconds. Beyond it, `Betöltés folyamatban` is announced; terminal failure focuses `Hiba történt`; retry is present only for a scenario marked retryable and preserves named safe state.
- Route completion focuses the H1; pending/success produces one polite announcement without focus movement; validation/terminal error focuses its summary/state heading and produces one assertive announcement.
- At 200% zoom/320 CSS-px equivalent, all content/actions remain without two-dimensional scrolling; focus follows DOM order; no keyboard trap occurs; interactive targets compute to at least 44×44 CSS px.

### Authorization and Accessibility Evidence

The table-driven authorization suite covers every role with at least one allow and deny for route, action, resource, and field at UI/API/object level, plus Parent→unrelated family, Staff→mutation/contact/profile/reason, Group Admin→ungranted group, Kindergarten Admin→super-admin governance, forbidden identifiers for every role, and next-request revocation including stale cache/navigation. Evidence references matrix/sensitive-field IDs and asserts exact response, unchanged state, absence/redaction across UI/API/log/audit/fixture/screenshot/report, and no real data.

Every critical Parent, Staff, and Administrator scenario records: one `main`/H1, skip link where shell applies, logical keyboard order, no trap, route focus, validation/denial/failure focus, single live announcement, dialog containment/Escape/focus return, zoom/reflow, 44×44 targets, non-color status, and reduced-motion treatment. Automated scans do not replace these recorded assertions.

### Story-to-Scenario Preservation Gate

Before Delivery Planning approval, a versioned manifest maps every inherited US-01–US-14 path and every US-LR story to an owning delivery story, route/API/invitation/profile/import entry, stable synthetic fixture/profile ID, scenario/evidence ID, exact state/result, `retryable: true|false` classification for every dependency-failure scenario, matrix/field IDs, requirement IDs, browser coverage, and synthetic/linked-target status. Invitation expiry/resend, authentication/upcoming duty, notification centre, queues/filters, school-year archive, API parity, import, reminders, lifecycle, event notes, and shared validation require explicit rows. Any unmapped path blocks Delivery Planning.

### Aggregation Classification

US-LR-08 is a quality/browser **aggregation gate**, not an INVEST story. Its checks are implemented alongside owning stories. US-LR-01, US-LR-07, and US-LR-09 are enabler/evidence stories. The smaller stories in this addendum supersede the sizing of US-LR-06a/06b above.

US-LR-06a and US-LR-06b are traceability umbrellas only: they are excluded from the 24-story delivery inventory, estimation, implementation assignment, and acceptance counting. Their split replacements US-LR-06a1/06a2 and US-LR-06b1/06b2 are the only active delivery stories for those outcomes.

## Prior Review Findings

**Reviewer:** aidlc-product-lead-agent

**Verdict:** NOT-READY

The synthetic-versus-real evidence boundary is substantially clearer than the original draft, and the Parent and Administrator umbrellas have been decomposed. Engineering still cannot start without resolving the following blockers.

### Blocking findings

1. **FR-LR-14 is an unowned prerequisite.** Requirements require a versioned and approved role × scope × route × action × resource × field matrix plus a sensitive-field dictionary, and still list its completion as an open design question. `US-LR-03`, `US-LR-05`, `US-LR-06a`, `US-LR-06g`, and `US-LR-07` depend on an *approved* matrix, but no story owns producing, reviewing, or approving it. A dependency cannot substitute for a deliverable. Good looks like a bounded story with an accountable persona, artifact contents, source/precedence rules, approval evidence, and pass/fail criteria before dependent route stories begin.

2. **The claimed preservation of inherited US-01–US-14 is not demonstrated and has concrete gaps.** The inherited `US-07` requires event-participant allergen visibility and parent editing of their own contribution notes; `US-LR-06b` recasts this as an authorized-administrator workflow and does not preserve either participant or parent behavior. Inherited `US-12` requires identical UI/API/invitation/profile/import normalization and identity-matching outcomes, but no delta story owns that cross-entry-point validation. FR-LR-10a's invitation expiry/resend and authentication-entry/upcoming-duty behavior likewise have no explicit delivery story. The future “Story-to-Scenario Preservation Gate” merely defers discovery of these omissions until implementation acceptance. Good looks like the preservation mapping completed now, with every inherited acceptance path assigned to a delivery-sized story and scenario.

3. **The INVEST/sizing claim is contradicted by the stories.** `US-LR-06a` combines multiple record families, CRUD, archive/restore, authorization, revocation, conflict, and recovery; `US-LR-06b` combines tasks, events, assignments, notes, capacity, conflicts, denial, idempotency, and dialog behavior; `US-LR-08` combines code quality, security scans, five browser boundaries, accessibility, performance, evidence metadata, and architecture conformance. These are independently failing work families, not Small or independently Estimable stories. Good looks like further splits with one bounded user outcome and finite scenario set per story, while keeping `US-LR-08` explicitly as an aggregation gate rather than claiming it is a vertical story.

4. **Several acceptance criteria remain interpretive rather than testable.** Examples include `US-LR-03` “remain usable,” `US-LR-04d` “normal threshold,” “actionable status,” and “appropriate live announcement,” `US-LR-06a` “deterministic recovery ... where safe,” and `US-LR-06c` “safe retry where applicable.” QA cannot derive expected timing, focus target/live-region behavior, preserved state, retry eligibility, or terminal result from those phrases. Good looks like named thresholds or referenced standards, explicit preconditions, exact observable result, unchanged-state invariant, and evidence ID for each variant.

5. **Authorization and privacy coverage cannot be executed from the current criteria.** `US-LR-07` names useful minimum denials, but NFR-LR-05 requires each role to have permitted and forbidden route, action, resource, and field evidence. The stories neither enumerate those cases nor provide the required matrix row IDs because FR-LR-14 is absent. “Generic denial/absence” also does not define the expected status/body contract. Good looks like table-driven allow/deny cases for every role and dimension, exact non-enumerating response expectations, no-mutation assertions, sensitive-field dictionary references, revocation timing, and redaction checks across UI, API, logs, audit, fixtures, screenshots, and reports.

6. **Accessibility evidence is incomplete for the required critical role flows.** `US-LR-03` covers the shell and `US-LR-04d` covers Parent recovery, but `US-LR-05` and the administrator stories do not specify the inherited keyboard, focus, form-error, zoom/reflow, touch-target, and announcement outcomes for their critical flows. `US-LR-08` requires automated violations and broad Safari smoke, which cannot substitute for those story-level manual/recorded assertions. Good looks like explicit accessibility scenarios for critical Staff and Administrator filters, forms, mutations, denial, dialogs, and asynchronous recovery, with measurable expected results and evidence records.

7. **The production-auth criterion blurs the otherwise sound synthetic/real boundary.** `US-LR-02` says production configuration “uses” the Supabase authentication boundary, while `US-LR-07` and `US-LR-09` correctly require real Supabase verification to remain `OUTSTANDING` until targets are linked. Good looks like distinguishing a locally testable adapter-selection/configuration assertion from actual Supabase authentication/RLS evidence, which cannot be marked passed in this intent.

## Review

**Reviewer:** aidlc-product-lead-agent

**Verdict:** NOT-READY

The normative Mob Resolution Addendum resolves five prior blockers cleanly: `US-LR-00` owns and gates the FR-LR-14 contract; `US-LR-04e`, `US-LR-04f`, and `US-LR-06h` cover invitation/authentication entry, inherited US-07, and inherited US-12; the authorization suite is table-driven against matrix and sensitive-field IDs; Staff and Administrator critical flows inherit explicit recorded accessibility assertions; and the Exact Acceptance Contracts separate local adapter-selection proof from actual Supabase authentication/RLS evidence, which remains `OUTSTANDING` until linked execution. The inherited two-second, focus, announcement, zoom/reflow, touch-target, and denial contracts also replace most previously interpretive language.

### Blocking findings

1. **The administrator split leaves two competing sets of Must stories.** `US-LR-06a` and `US-LR-06b` remain labelled `(Must)` with their original broad acceptance criteria, while `US-LR-06a1`, `US-LR-06a2`, `US-LR-06b1`, and `US-LR-06b2` are also labelled `(Must)`. The Aggregation Classification says only that the smaller stories “supersede the sizing” of `US-LR-06a/06b`; it does not say the original stories are retired, converted to epics/aggregation headings, or replaced for scope and acceptance. This yields 26 non-epic `US-LR-*` headings, while the Q&A plan says 24 local-runtime delivery stories, and leaves Delivery Planning unable to determine whether the broad and split items are both backlog commitments. Good looks like explicitly marking `US-LR-06a/06b` as non-delivery umbrella items or deleting/replacing them, then reconciling the authoritative story count and dependency map.

2. **`US-LR-06c` retains an undefined retry decision despite the exact-contract addendum.** Its second criterion promises “safe retry where applicable.” The Exact Acceptance Contracts say retry exists only for a scenario marked retryable, but neither `US-LR-06c` nor the preservation-manifest schema contains a retryable marker or states which of `already-decided`, `invalidated`, `denied`, and `dependency failure` may retry. QA therefore cannot derive the expected control/state for each outcome. Good looks like an explicit outcome table or criteria that mark retry eligibility per outcome, identify preserved state and idempotency behavior, and require the scenario/evidence record to carry that classification.

## Review

**Reviewer:** aidlc-product-lead-agent

**Verdict:** NOT-READY

The inventory labels now clearly mark `US-LR-06a` and `US-LR-06b` as superseded, non-delivery umbrellas, and the Aggregation Classification explicitly excludes them from estimation, implementation assignment, acceptance counting, and the 24-story inventory. Excluding those two headings leaves exactly 24 `US-LR-*` items, and `US-LR-06a1`/`06a2` plus `US-LR-06b1`/`06b2` are explicitly named as the only active delivery stories for those outcomes.

### Blocking findings

1. **The dependency model still treats the retired umbrellas as executable prerequisites.** `US-LR-06c` depends on `US-LR-06a/b`; `US-LR-06d`, `US-LR-06e`, and `US-LR-06f` depend on `US-LR-06a`; and the authoritative Dependency Map still routes the administrator branch through `US-LR-06a..g`. This contradicts the statement that `US-LR-06a/06b` are excluded from implementation assignment and leaves Delivery Planning unable to determine which active split stories unblock approvals, import, reminders, and lifecycle work. Good looks like replacing every retired-umbrella dependency and the map with the applicable active split IDs.

2. **`US-LR-06c` still does not define retry behavior exactly for every listed outcome.** The criterion lists approve, reject, already-decided, invalidated, denied, and dependency failure, but describes retry absence using the different terms `success` and `business conflict`; QA must infer that approve/reject map to success, while business conflict is not a listed outcome. Dependency failure remains conditional on being “explicitly retryable,” yet neither this story nor the Story-to-Scenario Preservation Gate defines where that classification is recorded or what distinguishes retryable from non-retryable dependency failure. Good looks like a one-to-one outcome table covering approve, reject, already-decided, invalidated, denied, retryable dependency failure, and non-retryable dependency failure, with exact mutation/unchanged-state, retry-control, idempotency-key, and evidence-classification expectations for each row.

## Review

**Reviewer:** aidlc-product-lead-agent

**Verdict:** READY

The two targeted blockers are resolved. No active story dependency names the retired `US-LR-06a` or `US-LR-06b` umbrellas: `US-LR-06c` now depends on `US-LR-06a1` and `US-LR-06b2`; import, reminder, and lifecycle stories name the applicable `US-LR-06a1`/`US-LR-06a2` split stories; and the authoritative Dependency Map routes only through `US-LR-06a1`, `US-LR-06a2`, `US-LR-06b1`, and `US-LR-06b2`. Remaining references to `US-LR-06a/06b` are explicitly historical findings or traceability-umbrella classification, not executable prerequisites.

`US-LR-06c` now has a one-to-one outcome contract for approve, reject, already-decided, invalidated, denied, retryable dependency failure, and non-retryable dependency failure. Every row fixes the mutation or unchanged-state invariant, retry-control presence, idempotency/evidence expectation, and terminal classification; the preservation manifest also requires `retryable: true|false` for every dependency-failure scenario.

The assessment still supports execution, the 24-story active delivery inventory remains reconciled after excluding the two umbrellas, the requirements preserve the same authorization, privacy, synthetic-versus-linked-target, and no-deployment boundaries, and the stage-required story, persona, assessment, dependency, priority, INVEST, and testability content remains present. No new contradiction or testability blocker was found in the targeted spot-check.
