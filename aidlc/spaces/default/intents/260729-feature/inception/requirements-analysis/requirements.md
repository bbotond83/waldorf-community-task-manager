# Requirements

## Intent Analysis

Create a Hungarian, mobile-friendly kindergarten coordination MVP that replaces an error-prone Excel workflow with role-bounded, family-owned responsibility management. The product must preserve the operational meaning of all 17 legacy workbook sheets while protecting child and family data, coordinating reminders, and supporting administrators' daily work.

Sources: [intent] `../../ideation/intent-capture/intent-statement.md`; [scope] `../../ideation/scope-definition/scope-document.md`; [practices] `../practices-discovery/team-practices.md`; [PRD-27] `source-materials/waldorf-community-app/waldorf-community-task-manager-prd-v1-en.md` §27.

## Functional Requirements

### Roles, families, and privacy

- **FR-01** The system shall enforce the PRD role matrix server-side across UI and REST API: super admins have full scope; kindergarten admins have organization scope; group admins have only their group scope; parents have only their family and assignment scope; and read-only staff have schedule and coordination display-name access only. Role or scope removal shall immediately revoke UI, API, and data access. Verification: automated positive and negative authorization tests cover each role/resource combination and revocation.
- **FR-02** The system shall assign responsibilities to a Family, show each assignment to every active linked parent, and send reminders to each active linked parent unless an authorized administrator selects a primary recipient. Verification: linked-parent, primary-recipient, and unrelated-parent tests assert display, action, and delivery behavior.
- **FR-03** Parents shall see only their linked-family data, relevant group/task/event details, and assignment display names. Read-only staff may see participant display names where task or event coordination requires them, but shall not see contact details or sensitive profile data; administrators receive only access required by their configured scope. Verification: a role/resource/field matrix and positive/negative access tests prove allowed and denied visibility.
- **FR-04** The system shall define and enforce edit rights, lawful purpose, and deletion treatment for all imported personal-data fields. Verification: the data dictionary and authorization/deletion tests cover every imported sensitive field.

### Coordination workflows

- **FR-05** Kindergarten and group admins shall manage assignments and approve or reject cancellation requests; parents shall sign up, request swaps/cancellations, and edit only their own contribution notes. A two-family confirmed, conflict-free swap shall auto-approve and atomically exchange the two existing assignments; all other swaps require authorized admin approval. Every approved swap recalculates reminders and rejects conflicts or capacity violations. Verification: role/transition/conflict acceptance tests cover allowed, denied, competing, auto-approved, and admin-approved swaps.
- **FR-05a** Authorized administrators shall create, view, edit, archive, and restore child, school-year, group, task, event, dashboard, and archive records. Parents shall view only records relevant to their linked children and groups and may perform only approved self-service actions. Verification: CRUD, archive/restore, relevance-filter, and denied-action tests cover each record type and role.
- **FR-06** The system shall preserve imported status, progress, and completion values from maintenance and large-cleaning sheets. New ongoing completion tracking is not in MVP scope. Verification: migration fixtures retain the source values and no new completion workflow is introduced.
- **FR-07** Parents may edit only their own event contribution notes; kindergarten/group admins may manage event supply, food, and allergen notes; authorized event participants may view allergen text. An authorized participant is an assigned family, a confirmed event signup, or an administrator explicitly granted event participation. Verification: role-scoped edit/view tests cover every note type and deny unauthorized access.

### Migration

- **FR-08** The system shall support the current `domain/Ovis tábla v2.xlsx` structure, migrating all 17 sheets without silently dropping a sheet and preserving operational meaning, including task sub-shifts, procedures, safety warnings, materials, dependencies, priorities, and organizer notes as structured fields or explicitly documented notes. Verification: a mapping register and migration fixture account for every sheet and row type.
- **FR-09** Before commit, an authorized administrator shall review a deterministic sheet/row mapping and resolve identity conflicts, including aliases, spelling differences, multi-person cells, and family membership. Verification: ambiguous rows enter a review queue and cannot be silently auto-merged.
- **FR-10** The import shall bind approval to an immutable preview, commit atomically, avoid duplicates on reprocessing, and provide rollback/recovery behavior. Verification: repeated and interrupted import tests produce no duplicate people, families, tasks, events, assignments, or records.
- **FR-11** The import shall report already-imported and changed rows and use a defined stable identity/key strategy. Verification: controlled duplicate and changed-row fixtures yield deterministic outcomes.
- **FR-12** Import validation, identity matching, and normalization rules shall be equivalent to the UI, REST API, invitations, and profiles. Verification: shared validation test cases pass identically across all surfaces.
- **FR-12a** Before import acceptance, the team shall approve and implement `migration-mapping-register.md`, covering every supported sheet/row mapping, stable identity keys, validation and error behavior, hostile-file safeguards, preview conflict actions, cutover checklist, rollback trigger, and recovery runbook. Verification: acceptance review confirms every register section, and failure drills execute the rollback/recovery runbook.

### Notifications and lifecycle

- **FR-13** The system shall schedule upcoming-duty reminders at 7 days and 24 hours before the duty. Verification: timezone-aware tests assert each scheduled timestamp.
- **FR-14** When a duty or recipient changes, the system shall recalculate recipients, suppress duplicates, cancel stale queued reminders, retry delivery failures, and expose privacy-safe delivery status to authorized administrators. Verification: change, cancellation, retry, and duplicate-suppression tests assert the resulting queue and status.
- **FR-15** The kindergarten administrator shall perform an annual personal-data review and own the operating process. Before launch, the team shall define a data-category retention schedule and legal basis; within 30 days after a family's last enrolled child leaves, the system shall delete eligible personal data, anonymize permitted operational history, and retain only a documented redacted audit minimum. Family data remains while another child is enrolled. Verification: lifecycle scenarios cover departure with and without enrolled siblings and assert category action, deadline, and retained audit shape.

## Non-Functional Requirements

### Privacy policy baseline

- **NFR-02a Data controller:** The final controller is TBD before production: the kindergarten, its operating legal entity, or a formally authorized parent/community entity. Personal developer operation is prohibited in production until controller responsibility is explicitly assigned.
- **NFR-02b Lawful basis:** Core coordination, contact email, and audit data use legitimate interest subject to controller confirmation; optional occupation, hobbies, skills, and community-support preferences use consent and are never required; future compliance records use legal obligation where applicable.
- **NFR-02c Field access:** Email and phone are visible only to super admins, kindergarten admins, and in-scope authorized group admins; parents may update their own phone and email only through approved account flows. Optional profile fields are visible to those same admins only when coordination requires them, parents may edit/delete their own values, and normal parents/read-only staff never see them. Swap/cancellation reasons are limited to the requester and in-scope admins.
- **NFR-02d Deletion:** After the last child leaves, start a 30-day grace period, then delete contact and optional profile fields and non-required private notes; anonymize historical assignments, swaps, cancellations, and archived family/child history. Recorded legal or operational holds may defer deletion.
- **NFR-02e Audit:** Retain redacted audit events for one year, then delete or anonymize them unless an investigation requires retention. Audit events include account/role/contact/task/event/signup/assignment/swap/cancellation/import/notification-failure changes and exclude raw phone numbers, full email content, optional free text, and sensitive reason text.
- **NFR-02f Processing:** Production data processing is EU-only: Supabase database region and email processing must be EU or approved compliant; Vercel may host the frontend only under the approved processing setup. Controller identity, DPAs, and provider configuration are release gates.
- **NFR-02g Relationship and location data:** Child/family relationships use legitimate interest, are visible only to in-scope admins and the linked family, and are archived in minimally identifying form after the last child leaves. Private home addresses are out of scope. Task/event locations use legitimate interest, are visible to eligible task/event users, editable by in-scope admins, and deleted or anonymized with the related record.
- **NFR-02h Residence import:** Import workbook residence only as a restricted municipality/locality field. Preview must redact or reject street-address content; the value is never visible to parents or read-only staff and is deleted after the 30-day lifecycle rule.

- **NFR-01 Security:** Authorization is enforced at server/data-access boundaries; UI hiding alone is insufficient. Sensitive data must not appear in unauthorized responses, logs, notifications, fixtures, or screenshots.
- **NFR-02 Privacy:** Before production, define and approve the legal basis, data controller/owner, data-category retention schedule, deletion procedure, redacted-audit minimum, provider data processing, and EU-region configuration.
- **NFR-03 Locale and data standards:** Use `hu-HU` formatting and Hungarian-aware search/sorting; use `Europe/Budapest` as the operating timezone; serialize REST timestamps as RFC 3339 with offset or `Z`; use UTF-8 with consistent normalization; store phones canonically as E.164.
- **NFR-04 Accessibility:** Core Hungarian parent and administrator flows shall meet WCAG 2.2 AA-aligned keyboard, contrast, semantic, screen-reader, and form-validation expectations. Verification: automated and manual accessibility checks cover core flows.
- **NFR-05 Quality:** Tests accompany code, maintain at least 80% line coverage, and pass in CI before merge. CI shall include selected formatter, linter, type-check, test, and coverage commands.
- **NFR-06 Reliability and performance:** Define a core-flow inventory and 30-family normal-load test profile; complete those parent/admin pages and API responses within 2 seconds; complete import recovery within 1 hour measured from declared recovery start to verified service restoration; target 99.5% monthly availability using a documented calculation; and test a documented current browser/device matrix for Chrome, Safari, Firefox, mobile Safari, and mobile Chrome. Verification: performance, recovery, availability, browser/device compatibility, and mobile-responsive checks assert these thresholds.
- **NFR-06a Release quality:** Define the WCAG 2.2 AA core-flow test scope and require CI formatter, linter, type-check, automated test, coverage, and security gates before deployment. Verification: CI evidence and manual accessibility results cover the approved scope.
- **NFR-07 Auditability:** Privileged workflow actions, migration outcomes, notification status, privacy review, and deletion events require redacted, access-controlled audit evidence.

## Constraints

- Build a Vercel-hosted Next.js application with Supabase for backend, authentication, and database.
- Keep native apps, SMS/WhatsApp, payments, automatic rotation, new ongoing completion tracking, live Excel synchronization, and unapproved integrations out of scope.
- Use trunk-based development, short-lived branches, squash merges, and continuous production deployment only after automated gates pass.
- Support one-time Excel import and transactional email as the MVP’s external integration boundary.

## Assumptions

- A qualified kindergarten administrator can validate mapping previews and resolve migration conflicts.
- Vercel, Supabase, and the selected email provider can be configured to meet agreed EU data-processing requirements.
- Detailed sheet/row mapping will be completed and approved through the versioned migration register before import acceptance.

## Out of Scope

- Native mobile applications, SMS/WhatsApp notifications, payments, automatic rotation, live Excel synchronization, and new ongoing task-completion workflows.
- Generic volunteer-management capability beyond the approved kindergarten coordination domain.

## Open Questions

- Define implementation-level sheet/row mappings, stable keys, conflict-resolution UX, hostile-file controls, and rollback/cutover/recovery mechanics in the required migration register.
- Complete the role/resource permission matrix, immediate revocation behavior, and sensitive-field data dictionary.
- Name the legal data controller, confirm provider processing and EU-region configuration, select notification provider/retry limits/batching/content-log policy, and operationalize monitoring.
