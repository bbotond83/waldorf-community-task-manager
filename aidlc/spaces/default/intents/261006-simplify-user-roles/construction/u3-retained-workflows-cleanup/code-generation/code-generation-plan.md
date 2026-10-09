# Code Generation Plan — U3 Retained Workflows and Cleanup

## Scope and Inputs

This Build and Test loop-back reuses completed U3 implementation and executes only repair Steps13–16 after fresh Plan Approval. Existing Steps1–12 and earlier results remain historical, not current-attempt execution. Repair the aggregate NFR2 traceability mapping to genuine existing verification controls/tests while keeping final quality acceptance independently pending Build and Test. No application or test-source edit is needed. Fresh approval covers current record reconciliation, scoped checks, architecture review and authorized checkpoint verification. The directive consumes shared inception contract-design/contract-summary.md, units-generation/unit-of-work.md and requirements-analysis/requirements.md; no U3 design approval receipt is invented.

Retain implementation of eight assigned criteria: AC4.1.1–4 and AC4.2.1–4 (US4.1/US4.2), integrated with existing U1 conversion/session contracts and U2 current teacher names. Preserve U1/U2 source, business groups/tasks/families/assignments/owners, historical SQL/audit/reports, private unsigned evidence policy and local-only next-env.d.ts. The teacher browser consumer and mixed-organization administration repairs are present; current refreshed U1/U2 reviews confirmed them. Preserve source unchanged so those reviews remain current.

No new database/schema/repository/service/dependency/production linkage is needed. Existing fixture repositories and real current authorization supply workflow tests. InsForge/backend code is not in scope. Full project checkpoint and final >=80% production lines/branches/functions, build/start/security gates belong to the conductor/integrated verification. No unit run substitutes for them.

## Concrete Findings and Decisions

The following prechange findings and completed implementation decisions document the existing source. They are not instructions for another source rewrite during this evidence refresh.

1. Prechange src/application/admin-facade.ts matrixRowFor selected AUTH-SUPER-ADMIN when any unrevoked Super grant existed, ignoring requested scope. The completed repair passes requested scope and chooses the Super row only for the same actor's valid, unrevoked organization Super grant containing that exact request organization/scope, using existing isRoleScope/scopeContains. Otherwise choose Group core for core resources, retaining explicit import denial and Super-only advanced/governance authorization. Current activity/version checks remain pipeline-owned. Regression actor Super orgA + Group admin groupB/orgB: coreB succeeds, advancedB/governanceB denies with zero port calls/no mutation. Include reverse ordering, wrong subject, revoked/inactive/stale and unknown scopes. No widening policy or role alias.

2. src/admin-experience/admin-service.ts operate currently authorizes every command as admin_operation, which correctly fails closed for Group admin but prevents permitted core workflows. Replace that generic dispatch with an exhaustive operation-to-existing-resource mapping: record→record, approval→approval, archive→archive, role→role_grant, import→import, privacy→lifecycle. Preserve manage action/current scoped authorizer and call operations only after allowed; malformed/unsupported operation denies without execution. Group admin can record/approval/archive only in granted group; role/import/privacy remain organization Super-only. Do not add admin_operation to U1 CORE_RESOURCES. Queue/school-year read behavior and source identities remain intact.

3. src/import-migration/import-service.ts has five read_only_archive destination owners kindergarten-admin. Replace only that administrator metadata with super-admin. Preserve all REQUIRED_SHEETS, modes, destinations, ids/data/snapshots and other process-owner categories. This is archive process responsibility, not task owner reassignment.

4. verification/fixtures.json currently offers five profiles. Keep four current profiles: parent-local, group-admin-local, kindergarten-teacher-local, super-admin-local; teacher uses kindergarten_teacher and /teacher/schedule. Collapse the obsolete administrator fixture into Super rather than create another selectable alias. verification/authorization-matrix.json uses obsolete roles and old teacher routes; rename current teacher rows to AUTH-TEACHER-* including tracking fields, remove obsolete kindergarten allow/deny rows and reference existing Super allow/governance semantics. Rewrite dependent current verification/scenarios.json profile/route/matrix/scenario references atomically, retaining every distinct existing workflow and all required NFR/browser/linked-target inventory. Do not delete a scenario to hide failure. The old kindergarten governance denial scenario becomes an actual allowed Super governance scenario, paired with direct non-Super denial in retained integration/browser tests. Preserve four-role action/field restrictions, not obsolete expectations.

5. Current executable verification docs AUTHORIZATION.md/RUNBOOK.md must describe four current roles, teacher routes/fields and migrated Super governance. verification/sensitive-fields.json also contains current staff labels in allowed/redactFrom: replace those labels with scoped kindergarten teacher/teacher without weakening any field restriction, existing field IDs or retention. Tracking owner/assignee display names use existing SF-DISPLAY-NAME/SF-PARTICIPANT-NAME classes; no unrelated/private class becomes allowed. Existing reports under verification/reports and intent/audit histories remain historical. Add a narrow explicit legacy-reference inventory regression distinguishing current manifests/source/browser consumers from permitted U1 conversion inputs, removed-profile rejection tests and U2 old-URL compatibility. Never blanket-remove migration or denial coverage. scripts/verification/core.ts should enforce exact current profile catalog/role/home/reference consistency and current matrix references using runtime catalog contracts; preserve all existing metadata, evidence freshness, SHA/artifact/privacy, mandatory NFR/browser and OUTSTANDING-target checks.

6. tests/browser/admin-core.spec.ts uses obsolete profile hooks for restore; tests/browser/admin-advanced.spec.ts has obsolete profile union/selections and an old governance-denied expectation. Use super-admin-local/current Super administrator wording, governance visible/usable for Super and denied for Group admin/Parent/Teacher. Preserve conflict, interruption/idempotency, reminder correlation, revocation next request, lifecycle blockers, settings allowlist, <2000ms existing timing, keyboard/zoom/44px/Axe checks. Parent workflows are preserved and tested against existing data; no speculative Parent code rewrite is planned.

Installed Next docs read before planning framework behavior: page.md and redirect.md under node_modules/next/dist/docs/01-app/03-api-reference/. Await params/searchParams; redirect throws and must remain outside catch. No framework file changes are currently necessary; read the relevant installed Server Action/cookies guide before any newly necessary endpoint edit and ask conductor if it changes approved scope.

## Numbered Steps — Test After Each Layer

- [x] **Step 1 — Source and runner readiness.** Record bounded prechange ownership/diff, inspect package.json, vitest.config.ts, tests/setup.ts, playwright.config.ts and production-inventory checks. Existing Node24/npm11, Node/Vitest/Playwright/Axe runners need no configuration/dependency change. Run R0 exact existing unit paths only after approval. Map all eight assigned ACs/NFR2.
- [x] **Step 2 — Model/archive metadata.** Change the five administrator owners in src/import-migration/import-service.ts only. No schema migration or new data store applies. Preserve complete sheet/data identities. Map AC4.2.2/3, FR14/15.
- [x] **Step 3 — Model tests.** Extend src/import-migration/import-service.test.ts with complete REQUIRED_SHEETS/destination/mode preservation and current administrator owner assertions, plus unchanged business snapshots around reads/import failure. Run D1 before business layer. Map AC4.2.2/3.
- [x] **Step 4 — Business workflow repair.** Fix scope-aware matrixRowFor/invokeAdmin in src/application/admin-facade.ts; exhaustive scoped resource dispatch in src/admin-experience/admin-service.ts. Reuse existing authorizers/repositories, preserving result/focus/idempotency contracts and U1 policy/session guards. No unrelated formatting/refactor or advanced source fixture rewrite. Map AC4.1.2/3/4; U1 R-01.
- [x] **Step 5 — Business tests.** Add src/application/admin-facade.test.ts with5–8 grouped scope/role/action cases and mixed-org regression. Extend src/admin-experience/admin-service.test.ts to5–8 meaningful cases including exhaustive allowed/denied mappings and zero-call/no-state-change snapshots. Run D2 before consumer integration. Map AC4.1.1–4/NFR1.
- [x] **Step 6 — Retained integration tests.** Add tests/integration/retained-workflows.test.ts with5–8 grouped real-foundation cases: Parent own/other family participation/request/notifications; Group core granted/ungranted; Super advanced/governance same/wrong organization; Parent/Teacher/Group advanced direct denial; populated U1 kindergarten-admin conversion consumed as current Super; stale/inactive/revoked/equivalent grant behavior; preservation/redacted audit. Inject existing ports/fixtures rather than authorize-all mocks or another converter. Run I1 before manifests/browser consumer layer. Map AC4.1.1–4, AC4.2.3; shared US3.2/3.3.
- [x] **Step 7 — Current manifests/reference cleanup.** Update verification/{fixtures.json,authorization-matrix.json,scenarios.json,sensitive-fields.json,AUTHORIZATION.md,RUNBOOK.md} and only necessary current-reference validation in scripts/verification/core.ts. Keep all required scenario/story/NFR/browser inventories and true boundary assertions, all linked-target OUTSTANDING semantics and historical reports. Map AC4.2.1/4, US1.1 remaining copy.
- [x] **Step 8 — Manifest/reference tests.** Add tests/unit/current-role-references.test.ts to inventory permitted legacy references explicitly and validate exact four current fixtures, all references/current teacher contracts, archive preservation and untouched historical sources. Extend tests/unit/verification-core.test.ts and tests/coverage/verification-entrypoints.test.ts for malformed fifth/removed/unknown catalog and dangling old rows; preserve existing evidence-integrity rejection tests. Run I2 before browser layer. Map AC4.2.1–4/NFR2/3.
- [x] **Step 9 — Browser consumers.** Update only tests/browser/admin-core.spec.ts and admin-advanced.spec.ts current hooks/labels/governance expectations. Add meaningful current non-Super advanced-denial cases and retain existing Parent tests unchanged. No app/UI mutation route or legacy selector alias. Map AC4.1.1–4/AC4.2.1.
- [x] **Step 10 — Browser verification.** After conductor supplies a current production build, run B1 scoped Parent/admin browser suites and B2 explicit accessibility. Preserve configured Chromium/Firefox/mobile, timing/privacy/security assertions; report cache escalation/startup issues honestly. Run cumulative D3/I3; do not rerun U2 history as new U3 evidence. Map AC4.1.1–4/NFR2/3.
- [x] **Step 11 — Configuration and integrated handoff.** Preserve locked tooling, existing all-production inventory and every80%/security/Axe/performance floor. Update tests/coverage/production-inventory.test.ts only if actual production source count changes (new test files do not change runtime denominator); retain exact current discovery assertions. Conductor owns strict typecheck/format/lint/full checkpoint/build/start/coverage/security; missing target checks remain outstanding. No live DB/InsForge/deployment/signing changes.
- [x] **Step 12 — Evidence/traceability/review.** Write code-summary.md, source-manifest.json and traceability.json for all8 assigned ACs and shared FR/NFR targets. Claim every actual created/modified/deleted source/test/manifest/doc path; use narrow trailing-slash directory claims only if literal Next bracket filenames are necessary, plus expanded literal inventory. Preserve next-env exclusion. Record actual commands/results, source/data provenance and resolved U1 R-01 evidence. Freeze source for conductor architecture review/checkpoint; no fabricated receipts or completion.

## Exact Ownership / Planned Files

### Current repair Steps13–16

- [x] **Step 13 — Current source and runner readiness:** Confirm retained U3 implementation, original19 source claims, current exact scoped commands and unchanged Node24/Vitest/Playwright configuration. The production inventory is now151 including U1's real database verification helper; discover it without lowering counts, exclusions or80% floors. Preserve U1/U2 frozen source and completed reviews. No database/model, repository, business logic, endpoint, frontend, dependency or infrastructure change is needed. Map all8 assigned criteria, US4.1/US4.2 and NFR2.
- [x] **Step 14 — Current scoped verification:** Run R0 readiness, D3 and I3 against existing retained workflow, reference and verification-control tests; preserve all positive/denial/privacy assertions. Browser B1/B2 require a current patched Next16.3.8 production build; until supplied, record the prerequisite explicitly rather than claim historical execution. Map US4.1/US4.2, NFR1/2/3.
- [x] **Step 15 — Aggregate NFR2 mapping and evidence:** Replace the Deferred free-text NFR2 coverage entry with OK and an existing decisive implementation/test target only after verifying it genuinely implements the required quality-control behavior. Inspect scripts/verification/core.ts, tests/unit/verification-core.test.ts and tests/coverage/verification-entrypoints.test.ts for applicable suite/gate/evidence controls. Preserve all21 upstream IDs and20 other rows. Explain that OK certifies implemented verification coverage, while fresh integrated typing/tests/coverage/build/start/browser/accessibility/performance/security/database results remain Build and Test's independent acceptance obligation. Do not lower a quality target or turn unavailable target proof into passed evidence. Refresh code-summary.md with actual commands/results, current151-source provenance and preserved19-claim manifest; retain historical reports and the append-only failure ledger. Distinguish U1's actual9/9 disposable PostgreSQL fixture evidence from unlinked deployment.
- [ ] **Step 16 — Freeze and completion handoff:** Freeze U3 artifacts and claimed source for the conductor's separate fresh advisory review and authorized project checkpoint. The conductor owns review/checkpoint receipts. Preserve ignored TypeScript cache and local next-env.d.ts; no source edits or review-bookkeeping copies. Full integrated quality verdict follows in Build and Test.

Current edits are only the six U3 code-generation record files. Original application/test ownership below describes retained implementation, not work to repeat.

Production: src/import-migration/import-service.ts; src/admin-experience/admin-service.ts; src/application/admin-facade.ts; scripts/verification/core.ts. Current contracts/data: verification/fixtures.json, authorization-matrix.json, scenarios.json, sensitive-fields.json. Current docs: verification/AUTHORIZATION.md, RUNBOOK.md. Tests: src/import-migration/import-service.test.ts; src/admin-experience/admin-service.test.ts; new src/application/admin-facade.test.ts; new tests/integration/retained-workflows.test.ts; new tests/unit/current-role-references.test.ts; tests/unit/verification-core.test.ts; tests/coverage/verification-entrypoints.test.ts; tests/browser/admin-core.spec.ts; tests/browser/admin-advanced.spec.ts. Conditional exact production count assertion only: tests/coverage/production-inventory.test.ts. Total19 planned paths plus one conditional inventory path; three new test files. No source renames/deletions are expected. Parent/teacher source and shared Access policy remain unchanged.

## Assigned Traceability

| Criterion | Steps / decisive evidence |
| --- | --- |
| AC4.1.1 Parent retained behavior |6/10; retained-workflows + parent-web browser |
| AC4.1.2 Group core behavior |4–6/10; admin service/facade mixed-org + admin-core |
| AC4.1.3 Super advanced/governance |4–6/10; converted Super integration + admin-advanced |
| AC4.1.4 Other-role advanced denial |5/6/9/10; zero calls/snapshot + direct browser denial |
| AC4.2.1 Current executable refs |7/8/9; current-role-references + manifest validators |
| AC4.2.2 Archive/sheet coverage |2/3/8; complete source destination identity assertions |
| AC4.2.3 Business preservation |3/6/8; before/after immutable identities/data |
| AC4.2.4 Historical/exclusion integrity |1/7/8/12; intentional legacy inventory, next-env excluded |
| NFR2 implemented verification coverage |13–15; actual existing verification controls and tests; independent final acceptance remains Build and Test |

## Quality and Evidence Limits

Standard5–8 cases per component with grouped exhaustive subcases, key-boundary integration and required browser/privacy/performance checks. Existing production >=80% lines/branches/functions, no serious/critical Axe, high/critical dependency/SAST blockers, current source SHA/private unsigned evidence and all retained browser budgets remain. Synthetic conversion/repositories/static SQL are distinct from actual DB/RLS; no linked target claim. Existing reports are historical, new artifacts report only actual current runs. No tests or source changes performed in planning.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "Implement each testable layer, then write and run its tests before moving to the next layer.",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.\n\nWe write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source.\n\nBefore merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets."
    },
    {
      "layer": "project",
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06)"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:bf274a0c9cdadce57aa36e266adaf7a3c4db266ed6e6b1b7a0dcc12e3189e021",
  "contract_sha256": "sha256:5f582ac45759862dc64c88fa4a4d2b6ad903e3cae677ff61fe998e255ad40751"
}
```
