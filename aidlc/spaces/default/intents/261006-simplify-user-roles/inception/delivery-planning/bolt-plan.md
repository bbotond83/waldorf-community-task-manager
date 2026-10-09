# Delivery Plan

## Approved Planning Inputs

A Bolt is one build pass over a piece of work, ending in a verifiable result. The human selected three Bolts, one per approved unit, handled from this session. All belong to the existing shared application release on `feature/simplify-user-roles`; no intermediate production release is planned. English development role name is Kindergarten teacher; Hungarian UI label remains `Óvónő`.

Use the recorded serial, unit-first execution: finish each unit's applicable design, code and verified checkpoint before its dependent unit. Classic scope has the walking-skeleton ceremony off; Bolt 1 is an embedded foundation, not a claimed end-to-end skeleton. The approved unit dependency graph has no independent implementation batch. This document groups delivery milestones; it does not override the runtime Unit DAG or its recorded execution settings.

| Bolt | Unit ID / directory | Kind | Prerequisites | Owner |
| --- | --- | --- | --- | --- |
| B1 Current-role integrity | U1 / u1-current-role-foundation | library | Approved C1/C2/C5 and U1 detailed design | aidlc-developer-agent (AI) |
| B2 Teacher tracking | U2 / u2-teacher-tracking | service | U1 verified; approved C3/C4 and U2 detailed design | aidlc-developer-agent (AI) |
| B3 Retained workflows and cleanup | U3 / u3-retained-workflows-cleanup | service | U1/U2 verified and their current contracts available | aidlc-developer-agent (AI) |

## B1: Current-role Integrity

**Included work:** Four-role policy/catalog/session foundation, current consumer role checks, deterministic grant conversion, authorization invalidation, redacted audit, last-super-administrator protection and matching SQL migration/constraint artifact. Primary stories US1.1, US3.1, US3.2, US3.3; shared policy criteria of US2.2/US4.1/US4.2 remain explicitly mapped.

**Definition of Done:** U1 required design and code artifacts completed; unknown/removed roles fail closed; populated active/inactive/revoked/duplicate/repeat conversion fixtures preserve subject/scope/history/business records; stale sessions cannot authorize; old synthetic profiles require the approved fresh selection/sign-in; current callers compile; changed layers have test-after tests; `npm run typecheck && npm test` passes at the verified checkpoint. SQL static/local execution evidence is labeled accurately; real RLS execution remains outstanding.

**Confidence hypothesis:** Populated fixture conversion and fresh/stale session checks demonstrate that changing the role vocabulary neither reactivates grants nor broadens scope beyond the explicitly approved kindergarten-admin governance promotion.

**Expected demonstration:** Show current-role catalog output and test results for active/revoked staff and kindergarten-admin conversion, duplicate/repeat handling, stale-cookie rejection and final-admin protection. This is an embedded library/policy demonstration, not full teacher UI or production migration proof.

## B2: Teacher Tracking

**Included work:** Current teacher source/projection and adapter seam, facade/results, responsive collection/detail/state screens, labels/navigation and minimal old schedule/detail redirects. Primary stories US2.1/US2.2; integrated teacher label, converted grant and current-session criteria from US1.1/US3.1/US3.3.

**Definition of Done:** Required owner/assignment/status inputs mapped explicitly to existing synthetic source records without guessing joins or equating owner/coordinator; refetch reflects changed backing data; assigned-group scope and field allowlist enforced before rendering; no mutations/private fields/ungranted names; equal desktop/mobile fields and explicit absence/empty/denied/failure states; safe old-link redirects and detail/back filters; keyboard/focus behavior covered; per-layer tests plus the approved checkpoint command pass. Read installed Next.js docs before framework changes. Actual browser/accessibility evidence is produced when the owning checks run and rechecked in final Build and Test.

**Confidence hypothesis:** A teacher can follow responsible owners, assignments and status within granted groups while direct requests and hidden source fields cannot bypass scope/privacy/read-only restrictions.

**Expected demonstration:** Runnable synthetic teacher flow with tracking fields, narrow cards, details/back and old bookmark redirect; pair it with unauthorized group/mutation denial and backing-record refetch checks. Do not claim linked-target or real-user data evidence.

## B3: Retained Workflows and Cleanup

**Included work:** Parent own-family behavior, Group admin core workflows, Super administrator advanced/governance behavior including converted-user fixtures, archive/import owner metadata and final executable fixtures/manifests/scenarios. Primary US4.1/US4.2 and migrated/current admin integration from US3.2/US3.3.

**Definition of Done:** Retained persona permission slices pass allowed/wrong-scope/direct-advanced-denial cases without business mutation on denial; supported archive/sheet coverage and actual groups/task owners remain intact; no selectable fifth role or dangling executable reference outside intentional migration/denial/history/URL compatibility; manifest references resolve; layer tests and approved checkpoint command pass; local next-env.d.ts remains excluded from feature commits; history/audit is preserved. All eight stories' cross-unit criteria are ready for final integrated verification.

**Confidence hypothesis:** Role simplification leaves Parent/Group admin/Super administrator responsibilities coherent and preserves existing business/import coverage, with one complete executable current-role vocabulary.

**Expected demonstration:** Current four-role selection and retained workflow permission cases, migrated Super administrator governance access in its organization, preserved import/archive records and an inventory of intentional legacy references.

## Integrated Release Definition of Done

Finish B1–B3, then final Build and Test across the completed application. Require current evidence for strict type checks, applicable tests, at least 80% line/branch/function coverage across production source, production build, deterministic start smoke, critical browser flow with no serious/critical automated accessibility violations, applicable privacy/secret/SAST and high/critical dependency gates. Preserve actual toolchain/configuration constraints; report blocked real target/provider/Safari checks as outstanding rather than synthetic PASS.

The authorized checkpoint command is `npm run typecheck && npm test`; its receipt does not replace these broader checks. Layer testing follows affirmed test-after ordering. Command execution and initial Code Generation plan approvals remain their own required decisions where the workflow asks; no automatic Construction autonomy is inferred from this delivery plan.

Keep a single integrated application release/PR; follow green checks and existing squash-merge-to-main practice when Git publication is authorized. No live database change, production deployment, backend linkage or new signing infrastructure is included. Private CI evidence remains explicitly unsigned. Applying a migration to an actual target requires separate available-target execution and appropriate deployment authorization; reverting app code alone is not assumed to reverse promoted grants.

## Traceability and Sources

[requirements.md](../requirements-analysis/requirements.md), [stories.md](../user-stories/stories.md), [mockups.md](../refined-mockups/mockups.md), [components.md](../domain-design/components.md), [unit-of-work.md](../units-generation/unit-of-work.md), [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md), [unit-of-work-story-map.md](../units-generation/unit-of-work-story-map.md), [contract-summary.md](../contract-design/contract-summary.md), [team-practices.md](../practices-discovery/team-practices.md) and completed [delivery-planning-questions.md](delivery-planning-questions.md). See [team-allocation.md](team-allocation.md), [risk-and-sequencing-rationale.md](risk-and-sequencing-rationale.md) and [external-dependency-map.md](external-dependency-map.md).

## Assumptions & Open Questions

None for delivery grouping/staffing/checkpoint command. Required detailed design and execution evidence remain future work. No application tests, code changes, builds, browser checks or migrations have run in this planning stage.
