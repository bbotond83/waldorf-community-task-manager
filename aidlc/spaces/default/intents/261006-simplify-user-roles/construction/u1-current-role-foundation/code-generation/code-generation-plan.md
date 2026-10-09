# Code Generation Plan — U1 Current Role Foundation

## Scope and Ownership

This Code Generation attempt repairs Build and Test loop-back 1. Preserve the completed U1 implementation and U2/U3 product behavior. Steps 1–14 record the earlier implementation and handoff; they are historical context, not fresh execution or approval evidence. Execute repair Steps 15–23 after fresh Plan Approval. U1 owns dependency/tooling repairs, isolated actual PostgreSQL verification and exact FR10 coverage. U2 separately owns missing FR6–FR9 coverage; U3 separately owns the runtime browser-test formatting failure and NFR2 traceability. All units require fresh current-attempt reviews. The failed run and append-only loop-back log are in construction/build-and-test/test-results.md under the active record.

Implement U1 only, sequentially on feature/simplify-user-roles. Access owns policy, grants and conversion; Runtime owns current profile/session bindings; Application owns shared authorization/contracts. Make the minimal current-role consumer and test adaptations needed for compilation and the existing suite. U2 owns teacher source/projection/module renaming/routes/redirects; U3 owns retained workflow changes, archive ownership metadata and final scenario/manifest cleanup. No separate service, deployment, signing or live migration is included. Preserve local-only next-env.d.ts, historical evidence and business records.

Preserve the completed TypeScript cache repair: package.json typecheck uses `tsc --noEmit --incremental false`, retaining strict compiler checks while leaving the ignored cache unchanged. Existing tsconfig.json incremental caching for Next remains intact. Exclude generated cache from source-manifest.json; claim changed tooling/configuration files instead. Verify Node24 typecheck passes and cache SHA-256 matches before/after. Next builds may generate their own ignored cache. Preserve the complete production inventory convention and all 80% coverage floors; account for newly added executable verification files explicitly.

Use English Kindergarten teacher technical names and Óvónő UI copy. Retain existing ports, injection, explicit results and reproducible locked dependencies, with only the security repair below. Unsupported roles/scopes/issuer/schema fail closed; do not add compatibility role/profile aliases.

## Ordered Implementation Steps

- [x] **Step 1 — Read prerequisites and establish source boundaries.** Read this Unit's functional/NFR/infrastructure designs, shared contracts and assigned story criteria; inspect existing source callers. Read installed Next.js route-handler, cookies, redirect and authentication guides before framework edits. Record baseline changes so unrelated workflow records and next-env.d.ts are excluded from source ownership. Map all normal accepting session/version boundaries and grant writers. (US1.1, US3.1–3.3, US4.2)
- [x] **Step 2 — Verify runner/configuration readiness.** Use the existing Node 24/npm 11 and installed Node/Vitest runners. Verify the existing exact Unit-scoped test commands in unit-test-instructions.md after approval; preserve coverage thresholds/configuration. No dependency upgrade or new runner. New test paths are introduced only with their implementation layer. (NFR2.1–3)
- [x] **Step 3 — Implement data model and migration artifact.** Replace Role with exactly parent/group_admin/kindergarten_teacher/super_admin in src/access/types.ts and exports; separate explicit legacy conversion input from current grants. Add current-role/scope validation and grant-local policy/effective dedup helpers at src/access/role-policy.ts. Add supabase/migrations/20261006_current_roles.sql alongside the historical migration. Writer-exclusive transaction locks before preflight; supported-schema/role/scope/version/issuer checks; preserve all non-role columns, identities and revocation; initialize missing versions to 2 only under the documented baseline/universal-authoritative-lookup assumptions; once-per-changed-subject invalidation, restricted original/current conversion evidence, role constraints and replacement policies/helpers in one transaction. Narrow family checks to actual family identities, group core to actual group scope; absent/unsupported relations deny. No raw teacher family access. Do not execute against a live target. (US1.1, US2.2, US3.1–3.3, US4.1, US4.2)
- [x] **Step 4 — Write/run model and migration tests.** Add src/access/role-policy.test.ts and src/access/current-role-migration.test.ts. Test exhaustive supported/legacy/unknown inputs, role-specific scope validity, cross-organization denial, all policy branches and restrictive SQL structure/order/privilege/policy inventory. Label static SQL checks accurately; actual RLS/locking execution remains outstanding if no authorized disposable database is available. Run this layer's exact tests before the next layer. (AC1.1.1/3/4, AC2.2.2–4, AC4.1.5, AC4.2.5)
- [x] **Step 5 — Implement transactional repository capability.** Extend existing Access ports/in-memory adapters with coherent list/snapshot/transaction seams for grants, users, versions and evidence; introduce src/access/legacy-role-conversion.ts using those seams. All writes roll back together on injected failure; explicit conversion only, preserve non-role fields and inactive/revoked state, deduplicate effective permissions without deleting history, repeat without second invalidation/evidence. Transaction failures are safe explicit results. Keep existing constructors/callers compatible through injected capabilities or update them explicitly; never silently substitute nontransactional saves. Adapt src/access/supabase-route-adapter.ts to current policy RPC contracts and strict return validation. (US3.1–3.3, US4.2)
- [x] **Step 6 — Write/run repository and conversion tests.** Add src/access/legacy-role-conversion.test.ts and src/access/transaction.test.ts; extend adapter tests in src/access/access-service.test.ts as appropriate. Cover active/inactive/revoked/equivalent/repeat, exact identity/business preservation, unsupported scope/schema, absent/invalid/overflow versions, issuer preconditions, fault injection before each commit boundary and deterministic writer exclusion. Fixture tests establish injected transaction semantics only. Run exact layer tests. (AC3.1.1–4, AC3.2.1–4, AC3.3.2/4, AC4.2.5)
- [x] **Step 7 — Implement shared business authorization.** Refactor src/access/access-service.ts to exhaustive grant-local policy, current active/version checks, current-role validated grant mutations, locked read/validate/write with authorization invalidation and redacted evidence. Prevent revoke/overwrite/downgrade of the final distinct active organization Super administrator; surviving equivalent same-subject grants count correctly. Update src/directory/directory-service.ts role-check sections. Update src/application/contracts.ts and authorization.ts with paired current grants, activity/current-version checks, AUTH-TEACHER-TRACKING and no obsolete administrative row, per-action/resource/field policy and safe navigation. Preserve existing result/focus/announcement conventions. Mechanically adapt session producers, facade row references and policy tests across existing callers to the new required contract without implementing U2/U3 features. (US1.1, US2.2, US3.3, US4.1)
- [x] **Step 8 — Write/run business policy tests.** Extend src/access/access-service.test.ts, access-matrix.test.ts, src/directory/field-policy.test.ts, directory-service.test.ts, src/application/authorization.test.ts, contracts.test.ts, facades.test.ts and isolation.test.ts. Pair allowed current-role cases with teacher mutation/private-field, mixed-grant, unsupported scope, wrong-organization, inactive/revoked/stale, last-administrator and no-state-change cases. Preserve existing retained-role regressions under the current vocabulary. Run exact layer commands. (AC1.1.1/3, AC2.2.2–4, AC3.3.1–4, AC4.1.5)
- [x] **Step 9 — Implement runtime/session/form bindings.** Update src/runtime/synthetic/profiles.ts to four current profiles with kindergarten-teacher-local and kindergarten-teacher; remove staff-local and kindergarten-admin-local aliases, preserve other profile identities. Update src/runtime/synthetic/composition.ts, session/session.ts, types.ts and shared Application SessionFacade bindings to authoritative current active grants/version. Preserve signatures, eight-hour expiry, nonce rotation, origin/cookie safeguards and production-unavailable behavior. Restrict app/api/synthetic/session/route.ts changes to C5 validation/result behavior; root and existing teacher/admin session gates use current identifiers so consumers compile. Do not create the U2 teacher routes or redirects here. (US1.1, US3.3)
- [x] **Step 10 — Write/run runtime and endpoint tests.** Extend tests/unit/runtime-boundaries.test.ts, tests/integration/synthetic-route.test.ts and tests/integration/runtime-shell.test.tsx; add tests/unit/current-role-session.test.ts for current grant/version, removed-profile cookie recovery, inactive/revoked/missing generation and catalog cases. Check C5 303/400/403/503 conditions against the installed framework and existing configuration boundary; production remains unlinked. Keep the regression excluding Clear-Site-Data intact. Run exact Unit-scoped commands. (AC1.1.1/3/4, AC3.3.1–4, NFR1.6)
- [x] **Step 11 — Implement minimal catalog presentation bindings.** Update existing selector/shell and role gates only where current profiles/types require it; keep existing names, data-testid, focus, keyboard and announcement contracts. Teacher screen source fields/layout/routes remain U2. Adapt existing browser/integration profile references only as needed for current catalog and session behavior; do not claim later teacher or advanced workflow acceptance. (US1.1, US3.3, NFR3.1–2)
- [x] **Step 12 — Write/run foundation presentation tests.** Exercise four selectable roles and no removed-role selection; invalidated navigation has no protected cached payload; current selector names/role text and recovery remain operable in runtime-shell and current-role-session tests. Run exact scoped Vitest commands before finalization. Leave full teacher browser/accessibility evidence for integrated verification after U2. (AC1.1.1/3/4, AC3.3.1–3, NFR3.2)
- [ ] **Step 13 — Validate integration/configuration.** Preserve locked tooling, test configuration and 80% coverage thresholds; format/lint changed applicable code. Run the authorized Unit checkpoint npm run typecheck && npm test through the workflow checkpoint when requested. Existing callers/tests must remain green; any needed policy-contract adaptation remains narrowly owned by U1. Stop on failure and report actual output. Full build/start/browser/security/coverage gates remain Build and Test obligations. (NFR2.1–3)
- [ ] **Step 14 — Record code and evidence handoff.** Write code-summary.md, strict source-manifest.json claiming every created/modified/deleted application/test/migration path and traceability.json for all 20 assigned ACs, 11 detailed NFRs and 11 BRs. Separate implemented/tested/static/outstanding target evidence and deviations. Record intentional legacy conversion/regression/history text; preserve frozen baseline SQL/history and local-only next-env.d.ts. Request the named architecture review before Unit completion. (All U1 stories; NFR1–3)

## Loop-Back 1 Repair Steps

- [x] **Step 15 — Read failure evidence and verify runner readiness after approval.** Read this Unit's current designs/contracts, failed Build and Test results and dependency diagnosis. Read installed Next installation/upgrade guidance before changing tooling and the fresh installed guidance afterward. Run existing exact U1 policy/migration and runtime-boundary baseline commands before new tests. Preserve unrelated source and historical evidence. (US1.1, US3.1–3.3, NFR2.1)
- [x] **Step 16 — Implement the minimal dependency repair.** Align Next/@next/env and applicable Next lint tooling at 16.3.8; resolve patched sharp 0.35.5 in package-lock.json. Prefer normal compatible resolution, with a narrow sharp override only if needed. Preserve Node24/npm11, unrelated dependency versions, strict types, all coverage floors and immutable CI action pins. Do not omit affected optional dependencies or suppress audit findings. (NFR2.3, FR13)
- [x] **Step 17 — Run tests after the tooling layer.** Run exact U1 policy/conversion/session/runtime-boundary tests under the changed locked tools and current npm audit with no high/critical findings. Verify nonincremental strict typecheck leaves the cache bytes unchanged. Remaining advisories are failure, not a waiver. Full cross-unit checks remain Build and Test. (NFR2.1–3, NFR1.6)
- [x] **Step 18 — Implement an isolated PostgreSQL verification harness.** Add scripts/verification/current-role-database.ts and tests/database/fixtures/current-role-baseline.sql with an invented supported populated schema. Use psql/initdb/pg_ctl binaries for a disposable temporary cluster with a private local socket and no external listener. Never read production connection strings or select an existing database. Enforce fail-fast prerequisites, process/statement timeouts, explicit errors and finally cleanup. Execute the actual supabase/migrations/20261006_current_roles.sql; label evidence actual disposable PostgreSQL, not deployed RLS. No JavaScript database dependency or production adapter is planned. (US3.1–3.3, BR3.1–4, NFR1.3–5)
- [x] **Step 19 — Write/run database tests after the harness layer.** Actual PostgreSQL18 exposed an unquoted reserved `current_role` column/alias in the new migration; minimally quote that identifier consistently, preserving the evidence key/semantics, and update its static regression. Estimated repair10–20minutes,$0,low semantic risk. The invented historical-baseline fixture uses nonreserved alias `g`; frozen historical SQL stays untouched. Add tests/database/current-role-migration.test.ts using Node24, with at least eight meaningful scenarios: supported active/revoked/equivalent conversion preserves every nonrole/business/history snapshot; versions increment once and supported missing versions initialize correctly; repeat adds zero conversions; issuer/schema/role/scope/version/overflow preconditions fail atomically; injected preflight/role/version/evidence/constraint/policy failures roll back; two actual database connections prove writer exclusion and removed-role insertion rejection after commit; Parent own-family, Group admin and Super administrator scopes enforce correctly while teacher raw sensitive-table reads/mutations deny; governance-only redacted conversion evidence reads and ordinary client writes deny. Keep existing Access final-administrator interleaving tests. Do not invent a privileged production writer or claim arbitrary privileged bypass is secured. Label instrumented faults/barriers distinctly from the unmodified migration success run. (FR10, FR12, FR13, FR15, NFR1.1–5)
- [x] **Step 20 — Wire configuration and prerequisites.** Add npm test:database:roles for exactly this U1 database test file and include it in scripts/verification/run-local-verification.ts. Document supported PostgreSQL binaries/PATH and disposable execution. Missing tools must fail explicitly, never skip. Expose supported PostgreSQL tools in the existing CI verification job if needed, without deployment, new external services or unpinned actions. Request normal installation permission for required writes outside the workspace. (NFR2.1–3, NFR3.1)
- [x] **Step 21 — Test configuration and regressions after wiring.** Run the new exact database command and existing U1 scoped commands. Verify absent-tool errors and cleanup on failure. Run formatting/lint for U1-owned changed files and strict typing. Keep new executable verification code in the complete production inventory and update the expected inventory count only for genuinely added files, preserving all 80% floors. (NFR2.1–3, NFR3.1)
- [x] **Step 22 — Refresh source evidence and exact traceability.** Preserve all assigned AC/BR/detailed NFR entries and add exact FR10 targeting genuine conversion tests. Claim every changed U1 tooling/lockfile/script/test/SQL-fixture/CI path in source-manifest.json; exclude next-env.d.ts and ignored cache. Update code-summary.md with actual commands, versions and static/fixture/disposable database distinctions. Preserve the append-only Build and Test loop-back log. (FR10, FR15, all U1 stories)
- [ ] **Step 23 — Fresh review and checkpoint handoff.** Obtain the current attempt's architecture review, resolve findings and run the recorded human-authorized whole-project Unit checkpoint through the workflow tool. No self-approved plans or fabricated receipts. Build and Test reruns every integrated gate and target after all units settle. (NFR1–3)

## Estimated Impact and Evidence Limits

Dependency repair: 30–90 minutes; PostgreSQL harness: 2–4 hours; exact traceability/format repairs across units: 15–30 minutes, plus review and verification. Package/service fees: $0. Moderate native/tooling portability risk, low product behavior risk for traceability/format. Local tool installation may need filesystem permission. At plan preparation no actual PostgreSQL run had occurred; current repair execution is recorded in code-summary.md and repair-evidence. A supported disposable fixture does not prove compatibility with an unlinked deployed target. No signing, live migration, target linkage, weaker threshold or historical rewrite is included.

## Tests and Quality

Standard strategy requires five to eight meaningful tests per changed component plus key integration boundaries; add cases where security/conversion risk requires more. Happy paths and at least two edge/failure cases are mandatory. Existing production coverage floors remain 80% lines, branches and functions. Unit test commands and fixtures are specified in unit-test-instructions.md. Never weaken thresholds or manufacture successful integration evidence.

## Assigned Acceptance Criteria

AC1.1.1, AC1.1.3, AC1.1.4; AC2.2.2, AC2.2.3, AC2.2.4; AC3.1.1–4; AC3.2.1–4; AC3.3.1–4; AC4.1.5; AC4.2.5. Other criteria remain with U2/U3. The source grant transaction and database migration do not create a new writable teacher task/event store.

## Sources and Boundaries

Current Unit functional-design/{functional-spec,rules,entities}.md, nfr-requirements/{security-requirements,tech-stack-decisions}.md, nfr-design/{security-design,logical-components}.md, infrastructure-design/cicd-pipeline.md; inception contract-design/contract-summary.md, units-generation/{unit-of-work,unit-of-work-story-map}.md and requirements-analysis/requirements.md. Installed framework docs govern actual framework edits. The plan is not execution evidence. No new product ambiguity requires another questions round.

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


## Implementation Handoff Status

Steps 1–14 describe the previous implementation/handoff. Repair Steps15–22 are implemented and locally verified after the recorded current human Plan Approval. Same-attempt artifact corrections are permitted by the lowered fence and are not described as freshly approved. Step23 fresh named review and recorded whole-project checkpoint remain conductor-owned and pending. Earlier review/checkpoint receipts belong to the preceding attempt and do not certify this repair. Current execution results are in code-summary.md and repair-evidence.
