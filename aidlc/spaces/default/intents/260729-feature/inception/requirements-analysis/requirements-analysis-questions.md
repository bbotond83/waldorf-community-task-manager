# Requirements Analysis Questions

These decisions refine the approved intent statement, scope definition, and team practices into testable MVP requirements.

## Q1 — Migration Mapping and Identity

How should the team resolve detailed mapping and identity rules for all 17 legacy workbook sheets before import approval?

- A. A named administrator validates deterministic sheet/row mapping and resolves identity conflicts in a preview queue. *(Recommended)*
- B. Import only exact matches and reject ambiguous rows.
- C. Automatically merge likely aliases and spelling variations.
- D. Defer detailed mapping until after launch.
- E. Define another policy.
- X. Other (please specify)

[Answer]: A — A named administrator validates deterministic sheet/row mapping and resolves identity conflicts in a preview queue.

## Q2 — Import Commit and Recovery

What import safety behavior should the MVP require after preview approval?

- A. Use immutable preview binding and atomic commit with rollback/recovery. *(Recommended)*
- B. Allow partial imports and repair failed rows manually.
- C. Commit each sheet independently without rollback.
- D. Require a manual database backup only.
- E. Define another policy.
- X. Other (please specify)

[Answer]: A — Use immutable preview binding and atomic commit with rollback/recovery before production migration.

## Q3 — Privacy Retention and Deletion

Which operating rule should govern annual privacy review and child-leaving deletion?

- A. Name an owner; perform annual review; define a deletion deadline, sibling exception, and audit treatment. *(Recommended)*
- B. Define deletion only when the first child leaves.
- C. Delete every related record immediately regardless of siblings or audit obligations.
- D. Retain records indefinitely.
- E. Define another compliant model.
- X. Other (please specify)

[Answer]: A — Name an owner; perform annual review; define deletion deadline, sibling exception, and audit anonymization/retention before launch.

## Q4 — Notification Queue Rules

What behavior should apply to 7-day and 24-hour reminders when duties change or delivery fails?

- A. Recalculate recipients, suppress duplicates, cancel stale reminders, retry failures, and expose privacy-safe status to authorized admins. *(Recommended)*
- B. Send original reminders after changes.
- C. Retry silently without recording status.
- D. Require manual resend with no automated retry.
- E. Define another policy.
- X. Other (please specify)

[Answer]: A — Recalculate recipients, suppress duplicates, cancel stale reminders, retry failures, and expose privacy-safe status to authorized admins.

## Q5 — Field Visibility and Event Safety

Which baseline should apply to newly imported sensitive fields and event allergen notes?

- A. Define role visibility/edit rights/lawful purpose/deletion for each sensitive field; show allergen notes to authorized event participants. *(Recommended)*
- B. Let all parents see imported profile details and allergen notes.
- C. Defer all permissions until after launch.
- D. Exclude the fields and notes from migration.
- E. Define another baseline.
- X. Other (please specify)

[Answer]: A — Define role visibility/edit rights/lawful purpose/deletion for each sensitive field; make allergen notes visible to authorized event participants.

## Q6 — Locale and Quality Acceptance

What measurable locale and quality baseline should apply before launch?

- A. Use `hu-HU`, `Europe/Budapest`, RFC 3339, UTF-8 normalization, E.164, equivalent validation, WCAG 2.2 AA core flows, and measurable targets. *(Recommended)*
- B. Set quality rules after launch.
- C. Use English-first UI and local formatting later.
- D. Require browser responsiveness only.
- E. Define another baseline.
- X. Other (please specify)

[Answer]: A — `hu-HU`, `Europe/Budapest`, RFC 3339, UTF-8 normalization, E.164 phone storage, equivalent validation across surfaces, WCAG 2.2 AA core flows, and measurable performance/reliability targets.

## Q7 — Family Assignment Representation and Notifications

For a family with multiple linked parents, which parents see and receive assignment notifications?

- A. Show the assignment to every linked parent; notify each active linked parent unless an admin chooses a primary recipient. *(Recommended)*
- B. Require one primary parent for display and reminders.
- C. Let each parent opt in or out without an admin default.
- D. Notify only the most recently active parent.
- E. Define another policy.
- X. Other (please specify)

[Answer]: A — Show the family assignment to every linked parent; send reminders to each active linked parent unless an admin chooses a primary recipient.

## Q8 — Workflow and Event Permissions

Which roles may operate assignment transitions and event contribution/allergen notes?

- A. Kindergarten/group admins manage assignments and approve cancellations; parents sign up, request swaps/cancellations, and edit only their own contribution notes; authorized participants view allergen notes. *(Recommended)*
- B. Any parent may edit assignments and all event notes.
- C. Only kindergarten admins may make all changes and view notes.
- D. Group admins manage tasks but parents cannot request changes.
- E. Define another role matrix.
- X. Other (please specify)

[Answer]: A — Kindergarten/group admins manage assignments and approve cancellations; parents sign up, request swaps/cancellations, and edit only their own contribution notes; authorized event participants view allergen notes.

## Q9 — Privacy Deletion Values

Please name the privacy owner and deletion deadline after a child leaves.

- A. Kindergarten administrator owns annual review; delete or anonymize child-linked data within 30 days after the last enrolled child leaves; retain only legally required redacted audit records. *(Recommended)*
- B. Delete data within 90 days regardless of siblings.
- C. Retain family data for one school year.
- D. Use an external privacy officer and set the deadline later.
- E. Specify another model.
- X. Other (please specify)

[Answer]: A — Kindergarten administrator owns the annual review; delete or anonymize child-linked personal data within 30 days after the last enrolled child leaves; retain only legally required, redacted audit records.

## Q10 — Measurable Quality Targets

Which MVP acceptance thresholds should apply to core flows and migration?

- A. Support up to 30 families; complete core pages/API responses within 2 seconds; recover imports within 1 hour; target 99.5% monthly availability; test current major browsers. *(Recommended)*
- B. Set targets after launch.
- C. Require sub-second pages, 99.9% availability, and 15-minute recovery.
- D. Require a performance test without numerical targets.
- E. Define another target set.
- X. Other (please specify)

[Answer]: A — Support current expected scale (up to 30 families); core pages/API responses complete within 2 seconds at normal load; import recovery completes within 1 hour; monthly availability target is 99.5%; test current Chrome, Safari, Firefox, and mobile Safari/Chrome.

## Q11 — Workbook and Task Detail Scope

Which detail baseline should migration and design preserve for the supported workbook?

- A. Support the current `Ovis tábla v2.xlsx` structure; map every sheet/row and preserve task sub-shifts, procedures, safety warnings, materials, dependencies, priorities, and organizer notes as structured fields or documented notes. *(Recommended)*
- B. Preserve only task title, date, and assignee.
- C. Preserve all detail as opaque sheet attachments.
- D. Support only a new export template.
- E. Define another policy.
- X. Other (please specify)

[Answer]: A — Support the current `Ovis tábla v2.xlsx` structure; map every sheet/row and preserve task sub-shifts, procedures, safety warnings, materials, dependencies, priorities, and organizer notes as structured fields or explicitly documented notes.

## Consolidated Summary Confirmation

- All 17 workbook sheets use deterministic admin-validated mapping, an identity-conflict queue, immutable preview binding, atomic commit, rollback, and recovery.
- All linked parents see family duties and receive reminders by default; authorized admins may select a primary recipient.
- Kindergarten/group admins manage assignments and approvals; parents manage their own signup, requests, and contribution notes.
- The kindergarten administrator owns annual privacy review; data is deleted or anonymized within 30 days after the last enrolled child leaves, with only legally required redacted audit records retained.
- Sensitive fields have explicit purpose, visibility, edit, and deletion rules; authorized event participants see allergen notes.
- The product uses `hu-HU`, `Europe/Budapest`, RFC 3339, UTF-8 normalization, E.164, equivalent validation, WCAG 2.2 AA, up to 30-family scale, ≤2-second core pages/API responses, ≤1-hour import recovery, 99.5% availability, and current major-browser coverage.
- `Ovis tábla v2.xlsx` is supported, with every sheet/row mapped and task details preserved as structured fields or documented notes.

Does this all look correct before I generate the requirements artifact?

- Looks correct — Generate the requirements artifact from these answers.
- Request changes — Revise one or more answers before generation.

[Answer]: Looks correct

## Q18 — Permission Matrix and Revocation

Adopt the PRD’s explicit permission matrix (super admin/full scope; kindergarten admin/organization scope; group admin/own group; parent/own family and assignments; read-only staff/schedules and coordination display names only), with server-side immediate revocation of UI/API/data access after role or scope removal?

- A. Adopt this matrix and immediate revocation. *(Recommended)*
- B. Retain the stricter no-display-name policy for read-only staff.
- C. Define another matrix.
- X. Other (please specify)

[Answer]: A — Adopt the PRD matrix and immediate server-side revocation.

## Q19 — Swap Policy

Which swap policy resolves the conflict between the approved auto-approval assumption and the PRD’s admin-approval workflow?

- A. Require authorized admin approval for every swap; notify affected families and atomically update the assignment. *(Recommended: matches PRD)*
- B. Auto-approve only a two-family confirmed swap with no conflict; require admin approval otherwise.
- C. Auto-approve every eligible swap.
- X. Other (please specify)

[Answer]: B — Auto-approve only a two-family confirmed swap with no conflict; require admin approval otherwise.

## Q20 — Deterministic Migration Mapping

The `Ovis tábla v2.xlsx` workbook itself is not available in this workspace. How should the required all-sheet, row-type mapping be supplied before requirements approval?

- A. Attach the workbook and have the team produce an approved mapping register before this stage is approved. *(Recommended)*
- B. Provide a complete sheet/column inventory and example rows instead.
- C. Explicitly remove full migration from the MVP.
- X. Other (please specify)

[Answer]: A — The workbook was attached and is mapped in `migration-mapping-register.md`.

## Q12 — Core Record Lifecycle

How should the MVP cover the approved child, school-year, group, task, event, dashboard, and archive records?

- A. Authorized admins create, view, edit, archive, and restore these records; parents view only records relevant to their linked children/groups and may use approved self-service actions. *(Recommended)*
- B. Implement only tasks and events in the MVP.
- C. Make all records editable by every parent.
- D. Keep records read-only after import.
- E. Define another lifecycle policy.
- X. Other (please specify)

[Answer]: A — Authorized admins create, view, edit, archive, and restore these records; parents view only records relevant to their linked children/groups and may use approved self-service actions.

## Q13 — Swap Execution Rule

How should a parent-to-parent swap complete when both eligible linked families agree?

- A. Auto-approve only when both families confirm an eligible open assignment; atomically exchange assignees, recalculate reminders, and reject conflicts/capacity violations. *(Recommended)*
- B. Require administrator approval for every swap.
- C. Allow either parent to complete a swap without counterpart confirmation.
- D. Disable swaps in the MVP.
- E. Define another swap policy.
- X. Other (please specify)

[Answer]: Superseded by Q19 — A two-family confirmed, conflict-free swap atomically exchanges two existing assignments; other swaps require authorized admin approval.

## Q14 — Minimum Role and Field Permissions

Which explicit visibility baseline should be adopted?

- A. Parents see only their linked-family data, relevant group/task/event details, and assignment display names; read-only staff see schedules only and never parent display names/contact or sensitive profile data; admins receive only the access required by their scope. *(Recommended)*
- B. Let read-only staff view participant names and contact data.
- C. Allow every parent to view all family profiles.
- D. Defer the matrix until after launch.
- E. Define another baseline.
- X. Other (please specify)

[Answer]: Superseded by Q18 — Read-only staff may see coordination display names, but never contact or sensitive profile data; all other access follows the PRD role matrix.

## Q15 — Migration Completion Definition

What must be defined before the one-time workbook import is accepted?

- A. A versioned mapping register for every sheet/row, stable identity keys, validation/error rules, hostile-file safeguards, preview conflict actions, cutover checklist, rollback trigger, and recovery runbook. *(Recommended)*
- B. Only a high-level import demonstration.
- C. Mapping for tasks and families only.
- D. A manual cleanup process after production import.
- E. Define another completion definition.
- X. Other (please specify)

[Answer]: A — A versioned mapping register for every sheet/row, stable identity keys, validation/error rules, hostile-file safeguards, preview conflict actions, cutover checklist, rollback trigger, and recovery runbook.

## Q16 — Privacy Operating Model

Which retention rule should apply to deletion and audit data?

- A. The kindergarten administrator is the operating owner; define a data-category retention schedule and legal basis before launch; delete eligible personal data after 30 days from the last enrolled child, anonymize permitted operational history, and retain only a documented, redacted audit minimum. *(Recommended)*
- B. Retain all data indefinitely for administration.
- C. Delete all records immediately, including audit history.
- D. Decide the model after launch.
- E. Define another model.
- X. Other (please specify)

[Answer]: A — The kindergarten administrator is the operating owner; define a data-category retention schedule and legal basis before launch; delete eligible personal data after 30 days from the last enrolled child, anonymize permitted operational history, and retain only a documented, redacted audit minimum.

## Q17 — Release Acceptance Detail

Which additional acceptance detail should be mandatory for launch?

- A. Define core-flow inventory, 30-family normal-load test profile, 1-hour recovery start/end criteria, 99.5% monthly-availability calculation, supported current browser/device matrix, mobile responsive acceptance, WCAG test scope, and CI security/quality gates. *(Recommended)*
- B. Keep high-level targets only.
- C. Test desktop Chrome only.
- D. Measure quality after launch.
- E. Define another acceptance model.
- X. Other (please specify)

[Answer]: A — Define core-flow inventory, 30-family normal-load test profile, 1-hour recovery start/end criteria, 99.5% monthly-availability calculation, supported current browser/device matrix, mobile responsive acceptance, WCAG test scope, and CI security/quality gates.

## Consolidated Summary Confirmation (Revised)

- Authorized administrators manage the lifecycle of children, school years, groups, tasks, events, dashboards, and archives; parents receive relevant read access and approved self-service only. Read-only staff may see coordination display names only, never contact or sensitive profile data.
- A two-family confirmed, conflict-free swap auto-approves atomically and recalculates reminders; every other swap requires authorized-admin approval.
- Parents see linked-family and relevant coordination data; read-only staff may see coordination display names only and never contact details or sensitive profile data.
- Import acceptance requires a versioned all-sheet mapping register, stable keys, validation/error behavior, hostile-file safeguards, conflict actions, cutover, rollback, and recovery runbook.
- The kindergarten administrator owns privacy operations; category retention/legal basis is defined before launch, eligible data is deleted after 30 days from the last enrolled child, operational history is anonymized where permitted, and only a documented redacted audit minimum is retained.
- Launch acceptance defines the core-flow inventory, 30-family load profile, 2-second response target, 1-hour recovery criterion, availability calculation, browser/device matrix, mobile responsiveness, WCAG scope, and CI quality/security gates.

Does this revised summary look correct before I regenerate the requirements artifact?

- Looks correct — Regenerate the requirements artifact from these answers.
- Request changes — Revise one or more answers before generation.

[Answer]: Looks correct
