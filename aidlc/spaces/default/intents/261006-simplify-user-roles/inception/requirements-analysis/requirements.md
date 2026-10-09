# Role Simplification Requirements

## Intent Analysis

Provide a coherent four-role permission model throughout the application. Replace Munkatárs with Óvónő so kindergarten teachers can follow scheduled work and responsibility without changing records. Remove obsolete permission concepts while preserving kindergarten groups, families, tasks, schedules and their history. [desc] [Q1] [clarification]

The work is on `feature/simplify-user-roles`. This document defines requested behavior; it is not evidence that implementation, tests or a live migration have occurred.

## Sources

- [desc] Initial description: - feature change the avaialble user roles. We need only the following ones: - Parent - Group admin - Kindergarten teacher - Super administrator Create a new branch. Clean up the unnecessary groups from the code properly.
- [clarification] User's verbatim Munkatárs-to-Óvónő clarification recorded in [reverse-engineering questions](../reverse-engineering/reverse-engineering-questions.md).
- [Q1]–[Q5] Completed answers in [requirements-analysis-questions.md](requirements-analysis-questions.md); Q3 explicitly selects super-administrator conversion with added governance rights.
- [current] [business-overview.md](../../../../codekb/waldorf-community-task-manager/business-overview.md), [architecture.md](../../../../codekb/waldorf-community-task-manager/architecture.md), and [code-structure.md](../../../../codekb/waldorf-community-task-manager/code-structure.md): current roles, scope entities, synthetic sessions, authorization surfaces, privacy safeguards and unlinked backend limitations.
- [practices] [team-practices.md](../practices-discovery/team-practices.md): test-after ordering, quality thresholds, localization, deployment prerequisites and private unsigned build evidence.
- [scope] Workflow-selected scope: classic; Standard depth and test strategy. Workflow metadata does not establish additional product permissions.

## Functional Requirements

All requirements below are Must Have. IDs are stable downstream traceability keys.

### Available Roles and Presentation

**FR1 — Exactly four available roles.** The application shall offer Parent, Group admin, Kindergarten teacher and Super administrator as its complete supported role set. Kindergarten administrator and read-only staff shall cease to be assignable or selectable roles. [desc]

- Given role assignment or profile selection is available, when the supported role set is displayed, then precisely these four role categories appear.
- Given a removed role identifier is submitted to normal assignment or profile selection, when validation executes, then it is rejected with no new grant or session created.

**FR2 — Teacher presentation.** The former Munkatárs role shall be presented as Óvónő in current Hungarian user-facing role labels, navigation and relevant screen copy. Current technical role representations shall identify a kindergarten teacher consistently rather than retaining a separate staff category. [clarification] [practices]

- Given a teacher profile, when the user signs in and opens their schedule, then the role is shown as Óvónő.
- Given the current role catalog is inspected, then Munkatárs is not offered as a separate role; historical records remain historically accurate.

**FR3 — Parent permissions.** Parents shall retain existing own-family participation, request and notification behavior and its field restrictions. [Q4] [current]

- Given a parent with a valid own-family grant, when they perform an existing permitted workflow, then its permission outcome remains unchanged.
- Given a different family's record, when the parent requests it, then existing access restrictions apply.

**FR4 — Group-admin permissions.** Group admins shall retain existing group-scoped core administration of records, tasks, assignments, approval queues and archives. Removed organization-level permissions shall not be added to group admins. [Q4] [current]

- Given a valid group-admin grant, when core administration targets an assigned group, then the existing allowed behavior remains available.
- Given an unassigned group or an organization-level import, reminder, privacy or settings operation, when requested by a group admin, then access is denied.

**FR5 — Super-administrator permissions.** Super administrators shall retain organization administration and governance. Imports, reminders, privacy operations and settings shall be available only to this role among the four supported roles. [Q3] [Q4] [current]

- Given a valid super-administrator grant, when an existing organization operation is requested in its authorized organization, then it remains available.
- Given any other supported role, when the same administrative operation is requested directly, then it is denied. This does not remove parents' own-family notifications or existing personal-data views.

### Teacher Tracking

**FR6 — Assigned-group visibility.** Óvónő shall see scheduled tasks/events only in explicitly assigned kindergarten groups. Group filters shall not broaden the grant. [Q2]

- Given a teacher assigned to group A, when opening the schedule or filtering it, then only authorized group A records are returned.
- Given a crafted request for group B without a grant, then its records and owners are not disclosed. With no assigned groups, no group data is returned.

**FR7 — Tracking information.** The existing schedule shall expose the dates, groups, responsible owners, assignments and current status needed to follow existing scheduled tasks/events. It shall use existing records rather than introduce a new event-management feature. [clarification] [Q5]

- Given an authorized scheduled item with an owner, assignments and status, when viewed by a teacher, then its tracking information is visible.
- Given an item has no owner or assignment, then the view indicates the absence without inventing a person. Existing empty and invalid-filter states remain understandable.
- Given the underlying authorized schedule/status changes, when the view is fetched again, then it reflects the current records; this requirement does not introduce realtime push updates.

**FR8 — Read-only enforcement.** Teachers shall not create, edit, delete, assign, approve or otherwise mutate tasks/events or administrative records using this role. Restriction shall apply at protected application/domain entry points as well as the interface. [clarification] [Q2] [current]

- Given a teacher views the schedule, then mutation controls are unavailable.
- Given the teacher crafts a direct mutation request, then it is denied and business state remains unchanged.

**FR9 — Teacher privacy.** Teacher tracking shall preserve existing sensitive-field restrictions. Owner/assignee display names needed for tracking may be shown within authorized groups; family financial, allergen, private contact and unrelated personal details shall not be exposed through this view. [clarification] [current]

- Given authorized schedule records containing sensitive backing fields, when projected for a teacher, then only permitted tracking fields are returned.
- Given direct detail requests or denied states, then hidden fields and out-of-scope names are not included in responses or rendered content.

### Existing Grants and Consistency

**FR10 — Staff-to-teacher conversion.** Existing read-only staff grants shall become kindergarten-teacher grants with their existing organization/group boundaries. Active, revoked and otherwise inactive grant states shall be preserved, with no access expansion or resurrection. [clarification] [Q2] [current]

- Given an active staff grant for group A, when the migration is applied, then the corresponding teacher grant has only the same authorized group scope.
- Given a revoked staff grant, then conversion does not reactivate it. Repeating migration does not duplicate grants.

**FR11 — Kindergarten-admin conversion.** Existing kindergarten-administrator grants shall convert to super-administrator grants, retaining their organization scope and gaining governance rights as explicitly selected by the user. Grant identity/history and inactive/revoked state shall be preserved; migration shall not produce duplicate effective grants. [Q3]

- Given an active kindergarten-admin grant for organization A, when migrated, then the user has super-administrator administration and governance within organization A.
- Given a revoked or inactive grant, then migration does not activate it. If an equivalent super-admin grant already exists, repeating conversion does not duplicate effective access.

**FR12 — Session and revocation integrity.** Profile/session resolution shall recognize the four current roles consistently. Existing revocation/version checks and last-super-administrator safeguards shall remain effective. Cached old-role sessions shall be refreshed through current grant resolution or rejected for reauthentication before access; they shall not retain an independent legacy-role authorization path. [current] [FR10] [FR11]

- Given a current teacher or super-admin grant, when a fresh valid session is resolved, then its home and permissions match the current role.
- Given an old-role or revoked session after migration, then it cannot authorize through a stale role or grant version.
- Given removal of the last qualifying super administrator, then existing protection still prevents loss of the final administrator.

**FR13 — Permission parity and unknown-role denial.** Domain, application, runtime/profile and intended SQL/RLS representations shall implement the same four-role boundaries. Removed and unknown role strings shall not fall through to permissive authorization; legacy identifiers may be handled only by explicit migration logic. [desc] [current]

- Given the four supported roles and authorized/unauthorized scopes, when each permission representation is evaluated, then outcomes match FR3–FR9.
- Given an unknown or removed role string at a normal runtime authorization boundary, then access is denied rather than treated as staff or administrator.
- Given the database migration is applied to a supported populated schema, then obsolete grants are converted before the supported-role constraint is enforced; new obsolete/unknown role grants are refused.

**FR14 — Proper code and fixture cleanup.** Remove obsolete role-specific live catalog entries, branches and fixtures; align current exports, resolvers, labels, permission contracts, import ownership references and verification scenarios with the four-role model. Preserve the functionality and record coverage previously associated with removed administrative ownership labels by assigning it to super administrators. Historical evidence shall not be rewritten to claim the new roles existed earlier. [desc] [Q1] [Q4] [current]

- Given live code, current fixtures and executable authorization scenarios, then there is no selectable or authorized fifth role and no dangling removed-role reference outside explicit migration/regression/history handling.
- Given existing import sheet/archive coverage, then removing obsolete owner labels does not delete supported records or leave an owner without a current role.

**FR15 — Preserve business groups and records.** Role cleanup shall retain actual kindergarten groups and their linked families, children, tasks, assignments, schedules and historical records. Role migration shall not delete business entities or change assignment ownership. [Q1]

- Given existing groups and linked records, when role conversion/cleanup runs, then their identities, associations and business content are unchanged.
- Given a group label resembles an old permission or process-owner label, then it is not deleted solely because of its name.

## Non-Functional Requirements

**NFR1 — Authorization and data integrity.** All tested teacher mutations, unauthorized-scope disclosures and unknown/removed-role requests shall be denied without business-state changes. Migration shall be repeatable without duplicate effective grants and shall preserve inactive/revoked state. Audit output shall continue to respect existing redaction rules. [current] [practices] [FR8] [FR10] [FR11] [FR13]

**NFR2 — Verification quality.** Use the affirmed test-after ordering. Require green type checking, applicable tests, production build, start smoke, critical browser/accessibility flow and security/dependency gates before merge, with at least 80% line, branch and function coverage across production source. Positive role scenarios must be paired with relevant scope/privacy/mutation-denial regressions. Real backend checks remain outstanding until executed against a linked target; synthetic results shall not be described as real RLS verification. [practices] [current]

**NFR3 — Maintainability and usability.** Use consistent English technical role identifiers and Hungarian user-facing copy, preserve module boundaries and explicit failure states, and retain the critical browser flow's existing no-serious-or-critical accessibility-violation requirement. The four-role catalog and teacher navigation shall remain coherent across current screens and verification references. [practices] [desc]

No new numeric performance, availability or realtime-update target was requested. Existing checks remain applicable; no additional performance or integration claim is invented.

## Constraints

- Keep the repository private and use the already approved unsigned private CI evidence approach. This role change does not add signing or deployment infrastructure. [practices]
- Preserve the local-only `next-env.d.ts` edit and exclude it from feature commits. [existing user instruction]
- Read installed Next.js documentation before framework implementation, as required by AGENTS.md; retain current package/toolchain constraints. [current]
- Production composition and backend targets are unlinked. Deliver migration artifacts and bounded local evidence without claiming a live grant migration. Applying changes to a real target requires an available target and authorized deployment work. [current]
- Preserve existing records and historical workflow/audit evidence. [Q1] [current]

## Assumptions & Open Questions

None. All five product questions are answered. Source-level route names, internal identifiers, migration packaging and exact schedule projection structure will be specified during design; they do not change the approved role or permission behavior. Real target execution is an outstanding verification dependency, not an inferred deployment authorization.

## Out of Scope

- Deleting kindergarten groups or business records. [Q1]
- A separate event-management feature or realtime push updates. [Q5]
- Expanding group-admin permissions or teacher mutation capabilities. [Q4] [clarification]
- Linking a production backend, executing a live migration, changing deployment hosting or adding signing infrastructure. [current] [practices]
- Rewriting historical records to rename roles retroactively or performing an unrelated repository-wide refactor. [Q1] [current]

## Traceability and Completion

| Source | Requirements |
| --- | --- |
| Initial four-role request | FR1, FR2, FR13, FR14 |
| Teacher clarification | FR2, FR6–FR10 |
| Q1: obsolete roles only | FR14, FR15 |
| Q2: assigned groups | FR6, FR9, FR10 |
| Q3: super-admin conversion | FR5, FR11, FR12 |
| Q4: super-admin-only advanced operations | FR3–FR5, FR14 |
| Q5: existing schedule tracking | FR7–FR9 |
| Current safeguards and architecture | FR9–FR15, NFR1 |
| Affirmed team practices | NFR1–NFR3, constraints |

Design, Unit and test references will be assigned in their respective downstream stages using these stable IDs. Completion requires implemented four-role behavior, repeatable migration artifacts, preserved business records and current validation evidence; this requirements document alone satisfies none of those execution checks.
