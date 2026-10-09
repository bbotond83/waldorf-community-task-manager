**Collaborator:** aidlc-developer-agent

## Contribution

### Implementability and scope

The eight workflow stories follow the approved four-role model. Teacher reading and mutation denial are separate, observable outcomes; their fixtures can be exercised independently while sharing one authorization contract. Migration stories correctly preserve scope, inactive/revoked state, history and business identities. The explicit kindergarten-admin-to-super-admin privilege expansion is approved behavior, not a remaining product question. No source change or test execution occurred during this contribution.

The component inventory identifies coordinated changes across Access and Authorization, Application Facades, Runtime and Sessions, Staff Schedule/Web Adapter, App Router Web, SQL Persistence Policies, Import Migration and Verification and Delivery. A catalog-only implementation cannot satisfy these stories. Domain, application, runtime and intended SQL policies must converge before integrated access is considered complete.

### Required refinement: populated-schema conversion and grant validation

FR13 includes a database outcome beyond runtime denial: obsolete populated grants convert before the supported-role constraint is enforced, and new unknown/obsolete grants are refused. AC1.1.3 and AC4.1.5 do not explicitly exercise this persistence boundary. Add an acceptance criterion to US4.2 (and map FR13 there), or to a migration story with explicit FR13 traceability:

> Given a supported populated grant schema containing legacy staff and kindergarten-admin grants, when the migration artifact is applied, then legacy grants are converted before the four-role constraint is enforced, their scope/state/history remain valid, and subsequent attempts to persist removed or unknown roles are rejected without creating a grant.

Repeatability in US3.1 and US3.2 remains required. Database execution evidence must be recorded separately from fixture or static policy checks; an unlinked real target remains outstanding. This refinement restores approved requirement coverage and does not authorize a live migration.

### Sizing and dependencies

- US1.1 establishes current vocabulary and normal identifier validation. Its assignment wording is conditional on an existing assignment surface; it should not introduce a new role-management UI.
- US2.1 is a useful vertical slice through current teacher session, protected schedule projection and Hungarian view. Keep the existing date-filter/error behavior rather than introducing a new event subsystem.
- US2.2 independently proves protected mutation denial and unchanged state, then integrates with US2.1. Frontend control hiding is insufficient completion evidence.
- US3.1 and US3.2 depend on current-role definitions and migration rules. Their shared conversion must finish before obsolete-role persistence constraints take effect. Active, inactive/revoked, already-equivalent and repeat-run fixtures make those dependencies estimable.
- US3.3 follows current grant resolution and consumes migrated-grant scenarios; it must exercise authorization-version and last-admin safeguards independently of stale-cookie presentation.
- US4.1 is the largest story, spanning parent participation, core group administration and organization governance. At Delivery Planning, divide its implementation/verification into persona slices tied to AC4.1.1–AC4.1.5; retain the parent and administrator preservation story as the review-level outcome. If estimated work exceeds one manageable delivery slice, split the story before assigning Units, maintaining requirement and AC traceability.
- US4.2 completes archive-owner and executable-fixture cleanup after conversion semantics exist. Import/archive process-owner metadata and actual task-assignment owners are distinct: map obsolete administrative metadata to super-admin while leaving business owners unchanged.

Affirmed test-after ordering, existing quality thresholds and the local-only next-env.d.ts exclusion remain applicable. Neither this story review nor synthetic execution certifies real RLS, production persistence or deployment.

## Positions

- AGREE: Workflow organization, four personas and current scope follow the user's confirmed choices; no further product question is needed.
- AGREE: Migration and stale-session outcomes preserve authorized scope/state, explicitly include approved governance expansion and avoid claiming live execution.
- AGREE: Keep teacher schedule reading and read-only enforcement separate; each has an independently testable business outcome.
- OBJECT: Draft defect — persisted-role rejection and conversion-before-constraint in approved FR13 need an explicit populated-schema acceptance criterion and story traceability; integrate the criterion above to resolve this objection.
- AGREE: US4.1 can remain one review-level permission-preservation outcome provided Delivery Planning sizes persona slices explicitly or splits it if needed; this is delivery refinement rather than an unresolved product judgment.

Objection classification: one draft defect; no judgment call and no knowledge dispute. No nested delegation or sibling contributions were consulted.
