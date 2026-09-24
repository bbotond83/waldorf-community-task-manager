**Collaborator:** aidlc-developer-agent

## Contribution

### Implementation and sizing review

The draft covers the required MVP workflows and traces to the requirements, but it is presently an epic-level backlog rather than the planned set of small, independently implementable stories. Several stories combine distinct permissions, state transitions, data models, integrations, and failure paths; they cannot reasonably be delivered or accepted as one slice.

Recommended implementation-oriented decomposition before construction:

- Split **US-01** into family-assignment visibility and reminder-recipient selection/delivery. The former depends on family links and server-side access policy; the latter depends on the notification queue and recipient rules.
- Split **US-02** into self-signup, cancellation request, auto-approved qualified swap, and administrator-approved swap. The two swap paths require explicit assignment state transitions, capacity/conflict validation, an atomic persistence transaction, audit evidence, and reminder recalculation.
- Break **US-04** into separately deliverable, role-scoped record-management slices, at least family/child, group/school-year, task/assignment, and event records. Archive/restore should be an explicit behavior on each applicable record type, not an implied blanket operation.
- Split **US-05** into role/scope management and immediate access revocation. Revocation needs server/data-access enforcement and tests that prove an already-authenticated user loses API and data access.
- Treat **US-06** as an import epic: workbook validation and staging, deterministic preview/conflict resolution, immutable-preview approval and atomic commit, and repeat/recovery reporting. The 17-sheet mapping register is a shared contract and should be represented by fixtures across these slices, rather than one untestably broad acceptance claim.
- Split **US-07** into annual privacy review, last-child-leaves retention/deletion treatment, and redacted audit access/retention. Each has different scheduled processing, authorization, and data-handling concerns.
- Treat **US-09** as a cross-cutting quality constraint mapped to every core-flow story, rather than a standalone user story. Its responsive, browser, authorization, accessibility, and performance criteria belong in explicit, measurable acceptance checks for the affected slices.

### Acceptance-criteria minimums

Replace the current compressed “Acceptance:” prose with Given/When/Then scenarios. For each story, name the acting role and scope, preconditions, server-side authorization result, observable state change, audit/redaction behavior where privileged or personal data is involved, and error outcome. In particular, the stories must make the following implementation contracts testable:

- an unrelated parent and an out-of-scope group administrator receive no record or sensitive-field data, even through direct API access;
- a qualified swap either commits both assignment changes and its reminder updates together, or changes neither; a competing/capacity-conflicting swap is rejected;
- an import commit is bound to the reviewed workbook hash and mapping-register version, and reprocessing it creates no duplicate canonical records;
- reminder scheduling uses `Europe/Budapest`, produces 7-day and 24-hour timestamps, cancels stale jobs after changes, suppresses duplicates, and makes only privacy-safe status available to authorized administrators;
- deletion/anonymization preserves only the documented redacted audit minimum and retains family data when another child remains enrolled.

### Dependencies and delivery order

All parent and read-only-staff stories depend on the permission/field-visibility matrix, family links, and scoped data-access boundary. Assignment workflows then depend on that foundation; notification behavior depends on persisted assignment state and recipient rules. Import should not enter acceptance until the approved migration-mapping register, identity strategy, validation rules, and rollback/recovery runbook are available. Privacy lifecycle work depends on the data dictionary and retention rules.

No repository implementation exists yet, so the concrete Next.js/Supabase schema, transaction primitive, job scheduler, email provider, test tooling, and API surface remain design decisions. The stories should state behavior and invariants, not presume those mechanisms.

## Positions

- AGREE: Persona/workflow grouping is appropriate for this multi-role, privacy-sensitive MVP and the listed personas cover the requirements’ principal actors.
- AGREE: Prioritizing family-owned assignments, scoped administration, migration, privacy, and reminders as Must Have work correctly reflects the MVP boundary.
- OBJECT: US-01, US-02, and US-04 through US-07 are not small or independently estimable stories; each contains multiple deployable workflows and must be decomposed before unit generation and delivery sizing.
- OBJECT: The single-line acceptance statements do not satisfy the inception Given/When/Then requirement or provide sufficient test contracts for authorization, atomic swaps, repeat-safe imports, reminder recovery, or lifecycle deletion.
- OBJECT: US-09 is an NFR aggregation, not a user-valued vertical slice; map its measurable quality criteria to core-flow stories and later test plans instead.
