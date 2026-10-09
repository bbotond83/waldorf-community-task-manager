# Architecture Decisions

## Basis

These decisions implement the approved four-role change, preserving existing module boundaries and minimally redirecting old staff schedule bookmarks. English development role name is Kindergarten teacher; Hungarian UI label is `Óvónő`. All decisions are proposed for approval with this stage's catalogue.

Sources: [requirements.md](../requirements-analysis/requirements.md), [stories.md](../user-stories/stories.md), [team-practices.md](../practices-discovery/team-practices.md), shared CodeKB [architecture.md](../../../../codekb/waldorf-community-task-manager/architecture.md) and [component-inventory.md](../../../../codekb/waldorf-community-task-manager/component-inventory.md), approved refined mockups, and answered [domain-design-questions.md](domain-design-questions.md). [components.md](components.md) is the authoritative logical catalogue; deployment grouping belongs to Units Generation.

## ADR-001: Preserve Boundaries with Access Owning Current Role Semantics

**Context:** Roles appear in domain checks, facades, runtime catalogs, SQL and executable verification fixtures. Existing modules separate access lifecycle from scheduling and business ownership. The user selected preserving these boundaries.

**Decision:** Access owns current-role semantics, grants, revocation and conversion. Application, Runtime, Web and existing business modules consume/enforce this policy. SQL is a persistence enforcement dependency. Align consumers using explicit permission cases covering roles, scope, actions, sensitive fields and stale sessions. Unknown persisted/runtime role values deny access explicitly. Retain existing Parent, Group admin and Super administrator workflow boundaries; rename staff scheduling to KindergartenTeacherTracking.

**Consequences:** The change remains bounded and existing ports/injection survive. Policy is still implemented in multiple languages/surfaces, so semantic parity requires executable checks; one role union alone is insufficient. No new central service, infrastructure or deployment boundary is introduced. Access changes must be coordinated with all consumers before delivery.

**Alternatives Rejected:** Combine role policy and teacher tracking into a new feature component: couples grant/revocation lifecycle to presentation and increases restructuring. Keep independent policy definitions without a parity corpus: preserves the current drift risk. These alternatives were considered; the first was offered to the user, who selected retained boundaries.

## ADR-002: Teacher Tracking Projects Existing Business Records

**Context:** Teachers need dates, groups, responsible owners, assignments and current status, but the existing schedule has only date/title/group/location/coordination display values. Coordination's Task model and synthetic admin task/event fixtures are not already a proven joined source. Owner, coordinator and assignee are different concepts.

**Decision:** Coordination retains writable task/assignment ownership, Directory retains identity ownership, and KindergartenTeacherTracking owns the existing read model and allowlisted projection through its injected schedule repository. Add explicit source inputs for owner/assignee/current-status presentation in the downstream contracts and map them to actual existing records/fixtures. Preserve existing location/coordination separately. Missing values are explicit absences; no new event state machine, task store, owner inference or sensitive fallback fetch is introduced. The teacher projection and destination authorization are applied before response serialization.

**Consequences:** Read-only tracking remains isolated from mutation workflows and sensitive fields. Required source/fixture alignment is additional implementation work and must be tested. Contract Design must resolve record identifiers, authoritative field provenance and failure outcomes; Functional Design must resolve exact shapes without fabricating successful data. Mobile and desktop consume identical projected information. No live backend mapping has been exercised.

**Alternatives Rejected:** Copy tasks into a new teacher-owned writable store: duplicates ownership and adds consistency work. Treat coordination display name as responsible owner: can misrepresent the actual owner. Reuse the current projection unchanged: omits approved owner/assignment/status requirements.

## ADR-003: Convert Grants Safely and Preserve Bookmark Compatibility

**Context:** The user approved staff-to-teacher and kindergarten-admin-to-super-admin conversion, including governance rights within existing organization scope. Requirements mandate preserving inactive/revoked state, versioned authorization and business records. Signed synthetic sessions include old profile IDs. The user selected redirects for old schedule URLs.

**Decision:** Access owns deterministic, repeat-safe legacy grant conversion and redacted evidence. Preserve subject, scope and grant/user state; resolve duplicate target grants without reactivation. Update authorization versions with conversion in the applicable transaction and prevent stale claims from authorizing. Audit conversion consistently with existing audit boundaries. Convert populated legacy rows before adding the current-role constraint; unsupported mappings block with remediation evidence. Normal subsequent governance retains last-super-administrator protection. Runtime exposes only four current roles and resolves current profiles/grants; removed synthetic profile cookies may require selection or sign-in. Web retains only minimal old schedule/detail redirects, preserving validated filter context and reauthorizing the teacher destination. The redirects do not authorize a legacy role.

**Consequences:** Real group records and task ownership survive. Former active kindergarten administrators gain the user-approved governance permission within their organization. Existing bookmarks remain usable, but some sessions legitimately require refresh/sign-in. Detailed SQL transaction, deduplication, versioning and audit behavior must be specified and exercised against populated fixtures before delivery. Production migration or rollback readiness is not inferred from synthetic execution. Exact route strings and redirect response details belong to downstream design.

**Alternatives Rejected:** Change only TypeScript role types: leaves persisted grants, policies and sessions inconsistent. Automatically reactivate converted grants: violates approved preservation. Keep old role/profile aliases as independently authorizing roles: violates the four-role catalog. Remove all old URLs: user selected bookmark compatibility instead. Perform conversion on arbitrary requests without a migration boundary: risks partial role/policy rollout and untraceable promotion.

## Security, Quality and Handoff

Each decision preserves scope checks and field minimization. Super administrator advanced operations remain separate from Group admin core rights; teacher mutations must be denied independently of hidden controls. Current private CI evidence remains explicitly unsigned; this role intent adds no signing infrastructure. Existing test-after, coverage and critical browser/accessibility requirements apply in implementation and verification. No tests, builds, browser sessions, real target calls or live migration have been performed in this design stage.

## Assumptions & Open Questions

No outstanding human decision. Detailed entity schema, projection contracts, migration collision handling and route compatibility specification are downstream deliverables constrained by these decisions. Units Generation will decide implementable grouping without changing logical ownership.
