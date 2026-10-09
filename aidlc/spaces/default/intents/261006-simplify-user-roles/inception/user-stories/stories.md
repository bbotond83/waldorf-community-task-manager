# Four-Role User Stories

## Plan and Sources

Four personas and eight initial stories, organized by user workflow as selected in [user-stories-questions.md](user-stories-questions.md). Standard story form, stable US/AC IDs and independently testable Given/When/Then outcomes apply. All stories are Must Have, matching the approved [requirements.md](../requirements-analysis/requirements.md).

Sources: [personas.md](personas.md); shared CodeKB business-overview.md and component-inventory.md; [team-practices.md](../practices-discovery/team-practices.md). The inventory informs affected authorization/session/schedule/import surfaces, not a claim of implemented behavior. Existing checks, test-after ordering, Hungarian user-facing copy and privacy safeguards apply throughout. No tests or live migration have run for this work.

## Choosing Current Access

### US1.1 — Select and assign one of four current roles

As a **Super administrator (P4)**, I want the application to offer only the four supported role categories, so that I can assign understandable, current permissions.

**Priority:** Must Have. **Requirements:** FR1, FR2, FR13, FR14, NFR3.

- **AC1.1.1:** Given role assignment or synthetic profile selection is available, when the current role catalog is displayed, then its categories are Parent, Group admin, Óvónő/Kindergarten teacher and Super administrator, with no kindergarten-admin or separate Munkatárs category.
- **AC1.1.2:** Given a teacher signs in, when their role and navigation are presented, then current Hungarian copy identifies the role as Óvónő consistently.
- **AC1.1.3:** Given an unknown or removed role/profile identifier is submitted to normal selection or assignment, when validated, then it creates no grant/session and does not fall through to teacher or administrator access.
- **AC1.1.4:** Given historical records refer to earlier roles, when the catalog is cleaned up, then that history remains accurate; explicit migration/regression references are not offered as current roles.

**Dependencies:** None for isolated catalog/validation tests with current-role fixtures. **INVEST:** One current-access outcome; implementation identifiers remain a design choice; positive/negative criteria make completion observable.

## Tracking Work as a Teacher

### US2.1 — Follow assigned-group scheduled work

As an **Óvónő (P3)**, I want to view existing scheduled tasks/events and their responsibility/status within my assigned groups, so that I can follow progress.

**Priority:** Must Have. **Requirements:** FR6, FR7, FR9, NFR1, NFR3.

- **AC2.1.1:** Given a teacher has a valid grant for group A, when they fetch the schedule, then authorized items show dates, group, responsible owner, assignments and current status.
- **AC2.1.2:** Given an authorized item has no owner or assignment, when shown, then the absence is explicit and no person is invented; given an authorized schedule with no matching items, an understandable empty state is shown. Given no assigned-group access or a denied group request, the existing no-access/denied state is shown without implying an unauthorized group has no tasks or disclosing its names/counts. Neither state offers a create-task action.
- **AC2.1.3:** Given a teacher has no grant for group B, when a filter or crafted request targets group B, then neither its items nor owner/assignee names are disclosed; no assigned groups means no group data.
- **AC2.1.4:** Given authorized backing records contain financial, allergen or private-contact information, when returned or rendered for a teacher, then only permitted tracking fields are exposed, including scoped owner/assignee display names.
- **AC2.1.5:** Given the underlying authorized item changes, when the teacher fetches the view again, then current records/status are reflected; an invalid filter or dependency failure uses the existing explicit failure states without hidden-field leakage.
- **AC2.1.6:** Given the teacher tracking flow and its role/navigation labels, when operated with the keyboard and inspected through the existing critical-flow accessibility check, then existing navigation remains operable, names identify Óvónő consistently, and there are no serious or critical automated accessibility violations. Execution proof remains a Build and Test deliverable.

**Dependencies:** Teacher authorization contract; US1.1 for integrated role presentation. Isolated tests may seed a current teacher grant. **INVEST:** One schedule-reading outcome; uses existing schedule records and no new event-management or realtime-push feature.

### US2.2 — Track work without changing it

As an **Óvónő (P3)**, I want my tracking view to remain read-only, so that observing work cannot accidentally change tasks or administrative records.

**Priority:** Must Have. **Requirements:** FR8, FR9, FR13, NFR1, NFR3.

- **AC2.2.1:** Given a teacher opens a permitted tracking view, when controls are rendered, then task/event create, edit, delete, assign and approve controls are unavailable.
- **AC2.2.2:** Given a teacher crafts a direct mutation request, when the protected application/domain entry point evaluates it, then it is denied and business state remains unchanged.
- **AC2.2.3:** Given the same teacher role/scope is represented in domain, application and intended SQL/RLS policies, when mutation permission is evaluated, then each denies it; synthetic checks do not certify real RLS execution.
- **AC2.2.4:** Given denial or dependency failure, when the response is produced, then it preserves explicit failure handling and redacted audit behavior without exposing forbidden fields.

**Dependencies:** Teacher permission contract; US2.1 supplies the integrated reading flow but direct-denial tests run independently. **INVEST:** One safety outcome with request-level assertions; implementation may share policy helpers without merging the story with schedule presentation.

## Transitioning Existing Access

### US3.1 — Preserve staff access as teacher access

As an **Óvónő (P3)** whose prior grant was Munkatárs, I want conversion to preserve my assigned groups and grant state, so that I can continue appropriate tracking without gaining unrelated access.

**Priority:** Must Have. **Requirements:** FR10, FR12, FR13, FR15, NFR1.

- **AC3.1.1:** Given an active staff grant for organization A/group A, when explicit migration is applied, then the corresponding current teacher grant retains only that scope and read-only permissions.
- **AC3.1.2:** Given a revoked or inactive staff grant, when converted, then it remains revoked/inactive and does not authorize access.
- **AC3.1.3:** Given conversion is repeated or equivalent effective teacher access already exists, when migration runs again, then it creates no duplicate effective grant and preserves grant/history integrity.
- **AC3.1.4:** Given linked groups, task assignments and historical records, when the role changes, then business identities/associations/owners are unchanged.

**Dependencies:** Current teacher role/policy from US1.1/US2.2; isolated migration fixtures supply those definitions. **INVEST:** One conversion outcome, repeatable with populated local fixtures; deliverable is a migration artifact, not an unauthorized live-target operation.

### US3.2 — Convert former kindergarten admins to super admins

As a **Super administrator (P4)** whose prior role was kindergarten administrator, I want my grant converted within its organization, so that I retain administration and receive the approved governance rights.

**Priority:** Must Have. **Requirements:** FR5, FR11, FR12, FR15, NFR1.

- **AC3.2.1:** Given an active kindergarten-admin grant for organization A, when explicit migration runs, then current super-admin access retains organization A administration and gains governance rights there.
- **AC3.2.2:** Given a revoked/inactive kindergarten-admin grant, when converted, then it does not become active; given access only to organization A, conversion does not grant organization B access.
- **AC3.2.3:** Given an equivalent super-admin grant already exists or migration is repeated, when conversion runs, then no duplicate effective access is created and grant/history integrity is preserved.
- **AC3.2.4:** Given existing groups and linked business records, when conversion completes, then they and their owners/assignments remain unchanged.

**Dependencies:** Current super-admin policy/catalog; independent populated grant fixtures verify conversion. **INVEST:** One deliberate privilege-transition outcome; user explicitly approved governance expansion, so automatic downgrade is not substituted.

### US3.3 — Resolve current sessions and reject stale access

As a **Super administrator (P4)**, I want sessions and revocation to resolve current grants consistently, so that removed roles or stale sessions cannot bypass current permissions.

**Priority:** Must Have. **Requirements:** FR12, FR13, NFR1.

- **AC3.3.1:** Given a valid current-role grant and a fresh valid session, when resolved, then its role home and permissions match that grant across the four-role model.
- **AC3.3.2:** Given a cached old-role session following migration, when used, then current-grant resolution refreshes it or rejects it for reauthentication before access; no separate legacy-role authorization path remains. When reauthentication is needed, the existing sign-in/session-expiry recovery is available and protected content is not displayed from the stale session.
- **AC3.3.3:** Given a revoked grant or mismatched authorization version, when a protected request is made, then access is denied; given an unknown role, it is also denied rather than treated as staff/admin.
- **AC3.3.4:** Given an operation would remove the last qualifying super administrator, when executed, then the existing final-administrator protection prevents loss of that administrator.

**Dependencies:** US1.1 current catalog; US3.1/US3.2 provide integrated migrated-grant scenarios. Fixtures allow independent session tests. **INVEST:** One current-access integrity outcome spanning resolution/revocation boundaries; detailed boundary packaging remains design work.

## Preserving Existing Behavior and Records

### US4.1 — Keep parent and administrator permissions coherent

As a **Group admin (P2)**, I want each existing role to keep its approved scope and operations, so that I can manage my groups while parents and super administrators retain their responsibilities.

**Priority:** Must Have. **Requirements:** FR3, FR4, FR5, FR13, NFR1.

- **AC4.1.1:** Given a valid parent own-family grant, when existing participation, request or notification workflows run, then they retain their permitted behavior; requests for another family's protected records remain restricted.
- **AC4.1.2:** Given a group admin granted group A, when core records/tasks/assignments/queues/archives are administered in A, then existing allowed behavior remains available; unassigned group B operations are denied.
- **AC4.1.3:** Given a valid super-admin grant, when organization imports, reminders, privacy operations, settings or governance are requested in its organization, then existing operations remain available.
- **AC4.1.4:** Given a parent, teacher or group admin, when the same organization-level advanced operation is requested directly, then it is denied without changing business state; parent own-family notifications/personal-data views remain available under their existing rules.
- **AC4.1.5:** Given equivalent roles, scopes and operations are evaluated by domain, application, runtime and intended SQL/RLS policies, then their current-role decisions match these boundaries; unlinked real-target verification remains outstanding.

**Dependencies:** Approved current-role permission contract; US1.1 for integrated catalog selection. Independent role/scope fixtures exercise each criterion. **INVEST:** One coherent permission matrix; if detailed implementation sizing exceeds one delivery slice, split by persona without changing these IDs' traceability meaning.

### US4.2 — Remove obsolete role ownership without losing records

As a **Super administrator (P4)**, I want obsolete role references cleaned up while preserving groups and import/archive coverage, so that the four-role system remains complete and maintainable.

**Priority:** Must Have. **Requirements:** FR13, FR14, FR15, NFR1, NFR3.

- **AC4.2.1:** Given current exports, catalogs, resolvers, labels, permission contracts, fixtures and executable verification scenarios, when cleanup completes, then no selectable/authorized fifth role or dangling obsolete-role reference remains outside explicit migration/regression/history handling.
- **AC4.2.2:** Given import/archive ownership previously assigned to kindergarten-admin, when current ownership is mapped to super-admin, then supported sheet/archive record coverage remains intact and no owner references a removed current role.
- **AC4.2.3:** Given real kindergarten groups, families, children, tasks and assignments, when cleanup/migration runs, then identifiers, relationships, business content and owners remain unchanged; names alone never trigger deletion.
- **AC4.2.4:** Given historical audit/evidence records and the local-only next-env.d.ts edit, when feature files are prepared for commit, then history is not retroactively rewritten and that local edit remains excluded.
- **AC4.2.5:** Given a supported populated grant schema containing legacy staff and kindergarten-admin grants, when the migration artifact is applied, then grants are converted before the four-role constraint is enforced, scope/state/history remain valid, and subsequent attempts to persist removed or unknown roles are rejected without creating a grant. Fixture/static checks and database execution evidence remain distinct; an unlinked real target stays outstanding.

**Dependencies:** US1.1 current vocabulary; US3.1/US3.2 integrated migrations. Archive metadata and preservation fixtures permit independent testing. **INVEST:** One completeness/preservation outcome; no unrelated repository-wide refactor or business-group deletion. Administrative import/archive owner metadata is distinct from task owners: map obsolete metadata to super-admin without changing actual business ownership.

## Quality, Scope and Traceability

Authorization, privacy and unchanged-state denials are embedded in the story criteria (NFR1). Localization and existing explicit/accessibility states apply to US1.1, US2.1, US2.2 and US4.2 (NFR3). NFR2's full execution/coverage proof is deferred to Build and Test (`build-and-test`) using affirmed test-after ordering; this story artifact is not execution evidence.

No story introduces separate event management, realtime updates, production linking/deployment, a live migration or signing infrastructure. Requirements are covered in traceability.json. Delivery Planning assigns Units and release sequencing; story dependencies name semantic prerequisites, not completed implementation.

## Assumptions & Open Questions

None. Personas, permissions, migration choices and document organization are sourced from confirmed requirements and the completed planning answer. Route naming, policy helper structure and migration packaging remain design choices within these outcomes.
