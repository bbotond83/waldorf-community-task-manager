# Code Generation Plan — U2 Kindergarten Teacher Tracking

## Scope and Completion Boundary

This Build and Test loop-back reuses completed U2 behavior. Existing Steps1–17 and results record prior work, not current-attempt execution. Execute only repair Steps18–22 after fresh Plan Approval. Changes are limited to formatting U2-owned tests/browser/runtime-foundation.spec.ts and adding missing exact FR6–FR9 traceability rows to existing teacher implementations/tests. Human feedback requires refreshed reviews against current code.

The runtime-foundation selector/copy repair and NFR2.26/NFR2.27 target corrections were completed previously. Preserve their behavior/history. Build and Test found a formatting failure in runtime-foundation.spec.ts; U2 already claims that file, so format it before the new U2 review. Reconcile current records, obtain a fresh review and run the authorized whole-project checkpoint. Full integrated build/start/browser/security/coverage checks remain Build and Test obligations; historical passes do not establish fresh execution.

Initial human Plan Approval covers this plan, the unchanged embedded Testing Contract and unit-test-instructions.md for this restarted attempt. AC1.1.2, AC2.1.1–6 and AC2.2.1 implementation remains present, with shared U1 conversion/session/mutation integration. U3 completed cross-role manifest/reference cleanup and the mixed-organization administration selector repair; the current U1 review confirmed that repair.

Use existing strict TypeScript, Next/React, Node 24/npm 11, constructor injection and result envelopes. No new package, backend link, SQL migration, durable tracking store, deployment, signing or infrastructure artifact is needed. Preserve all existing edits and historical evidence. Exclude local-only next-env.d.ts from source claims and commits. Current source paths below were inspected during planning; implementation and test outcomes are not yet claimed.

## Design Inputs

Read current U2 functional-design entities.md, rules.md, functional-spec.md, frontend-components.md and traceability; all nfr-requirements and nfr-design category artifacts and their reviews/traceability; all infrastructure-design artifacts. Mandatory supplements are ../nfr-design/logical-components.md (exact source records and injection seam) and ../nfr-design/reliability-design.md (existing outcomes/presentation/focus). Shared inputs are ../../../inception/requirements-analysis/requirements.md, domain-design/components.md, units-generation/unit-of-work.md, unit-of-work-story-map.md and contract-design/contract-summary.md.

Installed Next documentation read: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md and route.md; 04-functions/redirect.md. Await page searchParams and dynamic params; await cookies. Old routes use GET-only route handlers with explicit 307/no-body/no-cookie responses, replacing their pages so route.ts and page.tsx never coexist. Do not use a streaming page redirect for the compatibility HTTP contract. Canonical pages remain request-time authorized rendering.

## Concrete Implementation Decisions

- Rename src/staff-schedule/ to src/teacher-tracking/ and src/staff-web/ to src/teacher-web/. Rename StaffScheduleService to TeacherScheduleService, StaffApplicationFacade/Port to TeacherApplicationFacade/Port, synthetic adapter/factory/scenario constants to teacher names. Rename application schedule view models to TrackingEntry/TrackingModel, with groupId and ownerDisplayName/assigneeDisplayNames/currentStatusLabel. Remove old exports and update direct consumers atomically in each layer; no implementation aliases.
- src/teacher-tracking/tracking-model.ts defines TrackingSourceRecord, TrackingEntry, TrackingQuery, read-only TeacherScheduleRepository and pure strict-calendar/source-validation/projection helpers. Keep browser keys exactly C3. Source-only sourceRecordId/organizationId never reach browser. Scope mismatch denies whole result; malformed required values fail terminal, no partial rows. Preserve start-instant inclusive UTC bounds and elapsed date difference <=31 days, including same-day and exactly31; reject impossible normalized dates. Hungarian/Budapest formatting stays presentation-only.
- src/teacher-web/synthetic-teacher-repository.ts introduces the missing injected current-read repository, isolated fixture copies and separate validated operator/test update handle. Adapter constructor receives its read-only port; teacher never receives the update handle. Each workflow reads once, never per row, never cached across requests. Explicit additions to existing records follow logical-components.md: garden owner Kitalált Dóra, assignee Kitalált Eszter, status Ütemezett; crafts owner Kitalált Fanni, assignees Kitalált Géza/Kitalált Hanna, status Nyitott; coverage null owner, [] assignees, null status. Preserve ids/groups/dates/title/location/coordination; sourceRecordId equals existing id, organization from existing group. These are declared synthetic fields, not inferred real identities or guessed joins to admin fixtures.
- Add only an optional teacher filter-validation callback in src/application/facade-pipeline.ts, run after successful current authorization and before domain/source invocation. Existing callers keep behavior. Teacher facade uses it for strict range/parse errors, avoiding validation-before-authorization and duplicate authorization. U2 does not change U1 policy, authorization result definitions or administration row selection. Detail reuses authorized list, normalizes empty to generic denial; zero-row success becomes empty. Preserve all codes/focus/announcements from reliability-design.md, including SCHEDULE_ENTRY_READY and SCHEDULE_RECOVERY_UNAVAILABLE.
- Teacher grant-derived options match current active explicit group grants and organization; static synthetic group records supply labels only. Missing group chooses a currently granted group, never a global option. No grants denies. Valid ungranted group denies before date validation. Defaults remain 2026-08-12 to 2026-08-20. A malformed supplied group never silently triggers a source query.
- Canonical filter names are groupId/from/to. Compatibility translates csoport/kezdet/veg. Any repeated value or simultaneous canonical/legacy value for a field is ambiguous and invalid. Identifiers must be nonempty, <=128 characters, match ASCII letters/digits with period/underscore/colon/hyphen after a first letter/digit; dates are exact real YYYY-MM-DD. Unknown host/returnTo/path/scenario/fixture fields are dropped. Missing values stay absent for destination defaults. Preserve valid unambiguous group even when dates are invalid, so an ungranted group denies first.
- Pin compatibility invalid encoding: any malformed/ambiguous supplied recognized filter creates fixed internally generated from=invalid&to=invalid; never reflect offending text. Preserve only a syntactically valid unambiguous groupId. If group was malformed/ambiguous, destination may choose its current granted group solely to display validation; the fixed sentinel guarantees zero source calls and no data/default read. Canonical malformed values also produce safe validation. Empty values count malformed. IDs are opaque single encoded segments; reject empty/control/dot-only ids to a fixed safe detail sentinel with generic absent-detail denial, never arbitrary host/path reflection.
- The synthetic fixture mechanism is a bounded canonical-page-only fixture selector, accepting ready/empty/denied/retryable/terminal only in synthetic runtime after session/grant gates. It supplies adapter scenario injection, cannot change grants or widen source scope, and is not an ordinary user control or business filter. Production ignores it and remains unlinked. Compatibility drops all old scenario and fixture parameters. Retry removes fixture and retains validated groupId/from/to, giving a fresh ready read; direct test injection covers malformed/source-invalidation scenarios without adding public switches.
- Move the full current staff UI to app/teacher/. Current copy is Óvónő; teacher CSS/test IDs replace staff names with consumers updated in the same unit. Table/cards/detail contain dates/group/title/location/coordination plus owner/assignees/status with exactly Nincs kijelölt felelős, Nincs beosztott, Nincs elérhető állapot for absence. Preserve 44rem switch, one keyboard-visible representation, local overflow, text statuses, wrapping names, native labels/forms/back links, focus targets and announcement semantics. No mutation/export/create/approval control or raw data in failure/hidden markup.

## Numbered Implementation Steps

- [x] **Step 1 — Structure and source boundary:** Record prechange diff and bounded affected imports; prepare coordinated renames listed below without unrelated refactors or duplicate modules. Preserve U1 foundation and next-env.d.ts. Map US1.1 AC1.1.2; US2.1 all ACs; US2.2 AC2.2.1.
- [x] **Step 2 — Runner readiness and baseline:** Inspect existing package.json, vitest.config.ts, tests/setup.ts, playwright.config.ts and coverage reporter. Preserve includes, Istanbul all-production denominator and 80% thresholds. Run existing unit-scoped baseline commands in instructions before changes; no missing new-file command is used for readiness. Only adjust config if an exact new test path is demonstrably excluded; ordinary existing includes need no edit. Map NFR2.23/27.
- [x] **Step 3 — Model/domain implementation:** Implement tracking-model.ts and rename schedule-service.ts/index.ts into teacher-tracking, keeping no framework import. Align authorization-before-validation, source shape/scope, strict dates, immutable explicit projection and absence. No database/schema migration applies: this is a logical source model. Map AC2.1.1–5, BR2.1–5/7/12, NFR1.24/26/30 and NFR2.22.
- [x] **Step 4 — Model/domain tests after implementation:** Rename/extend schedule-service.test.ts and add tracking-model.test.ts with 5–8 meaningful cases per component (table-driven boundary subcases permitted). Test happy path, allowlist sensitive fields, null/empty values, shape/scope mismatch, leap/impossible dates, same-day/exact 31/over 31, denied precedence and immutable projection. Run D1 in instructions before repository work. Map AC2.1.1–5 and shared AC2.2.2–4.
- [x] **Step 5 — Repository/adapter implementation:** Add synthetic-teacher-repository.ts, rename synthetic-staff.ts to synthetic-teacher.ts/index exports; inject repository into SyntheticTeacherScheduleAdapter and factory. Preserve classifier and read-only surface, scenario behavior, isolated snapshots and same-record operator updates. Map AC2.1.1/2/3/4/5, BR2.3–6/12, NFR1.21/27/30, NFR2.22/24.
- [x] **Step 6 — Repository/adapter tests after implementation:** Add synthetic-teacher-repository.test.ts and rename/extend synthetic-teacher.test.ts (5–8 cases/component). Read, replace same record owner/assignees/status, read again through same injected instance; interleave actors/groups, query edges, scope mismatch, frozen-copy protection, snapshot identities unchanged, empty/denied/retryable/terminal and no teacher write method. Run D2 before facade changes.
- [x] **Step 7 — Application business layer:** Rename staff-facade.ts to teacher-facade.ts and exports/models in contracts.ts/index.ts. Add scoped optional validation hook in facade-pipeline.ts; keep all other consumers unchanged. Validate/project every source response; map list/detail/no-data failures exactly. Update direct facades.test.ts/isolation.test.ts teacher consumers. Map AC2.1.1–5, BR2.1–8/12, NFR1.22/24/28/29 and NFR2.25.
- [x] **Step 8 — Application tests after implementation:** Add src/application/teacher-facade.test.ts with 5–8 grouped cases covering authorization/version precedence, zero denied source calls/one authorized read, current refetch, wrong-org rows, every result mapping, absent/empty detail and source faults. Extend only teacher cases in facades.test.ts and rename inventory reference in isolation.test.ts; add tests/integration/teacher-boundaries.test.ts for converted teacher read plus denied direct writes, snapshot/audit/privacy and stale/revoked recovery. Run D3 and I1 before routes.
- [x] **Step 9 — Endpoint/runtime and filter layer:** Move _lib/session.ts/facade.ts/filters.ts to app/teacher/_lib/, retaining current session resolution and synthetic-only composition. Add app/teacher/_lib/compatibility.ts for fixed safe translation. Replace old pages with app/munkatars/beosztas/route.ts and [id]/route.ts GET handlers; remove old staff layout/components/libs once canonical consumers move. Keep canonical pages at app/teacher/schedule/page.tsx and [id]/page.tsx; await request props and reauthorize. Do not alter live backend or create cookies in compatibility. Map AC1.1.2, AC2.1.3/5, BR2.1/2/6/9/11 and NFR1.25.
- [x] **Step 10 — Endpoint/filter tests after implementation:** Add tests/unit/teacher-filters.test.ts (5–8 grouped cases) and tests/integration/teacher-routes.test.ts (5–8 cases). Test old/canonical translation, duplicate/conflicting/empty/malformed recognized values, safe sentinel/no reads, valid ungranted denial precedence, unknown host/scenario drop, opaque encoded ids, status307/no Set-Cookie/no response data, current destination authorization and bounded fixture/retry mechanism. Run I2 before presentation work.
- [x] **Step 11 — Frontend implementation:** Move layout.tsx/loading.tsx/error.tsx, FocusedStateSection.tsx, TeacherAccessState.tsx/TeacherStatePanel.tsx and ScheduleFilter.tsx/ScheduleCollection.tsx to app/teacher. Complete canonical list/detail rendering using one projected model; update teacher CSS section in app/globals.css and every corresponding test hook. Layout/session failure uses existing safe recovery and no hidden stale children. Map AC1.1.2, AC2.1.1/2/4/5/6, AC2.2.1; BR2.5–10; NFR3.22/23.
- [x] **Step 12 — Frontend tests after implementation:** Rename tests/integration/staff-components.test.tsx to teacher-components.test.tsx; rename tests/coverage/staff-pages.test.tsx to teacher-pages.test.tsx and update actual page/handler consumers in tests/coverage/app-entrypoints.test.tsx. Include 5–8 cases per component family with table-driven result matrix, all fields/missing copy table/cards/detail, malicious text escaping, no hidden source/private data, no mutations, grant options, correction/retry/back context and loading/error recovery. Run I3 before browser consumer update.
- [x] **Step 13 — Browser tests after frontend implementation:** Rename tests/browser/staff-web.spec.ts to teacher-web.spec.ts; update profile to kindergarten-teacher-local, canonical routes/params/fixture, teacher hooks/CSS. Preserve existing <2000ms first-view acceptance, configured browsers, zoom/local overflow, 44px touch, keyboard focus and zero serious/critical Axe; extend current field/missing value parity and compatibility-to-destination scenarios. Run B1/B2 after existing production build prerequisite is supplied by verification; record honestly if unavailable. Map AC2.1.6, AC2.2.1 and NFR2.21/3.23.
- [x] **Step 14 — Source inventory and integration consumers:** Inspect bounded rg results for former modules/types/routes. Update only direct U2 executable imports, teacher test data/shapes and source discovery assertions in tests/coverage/production-inventory.test.ts using actual inventory and explicit new teacher paths (no arbitrary stale count). The dynamic discovery/reporters continue requiring every executable source; no exclusions or thresholds relaxed. Shared verification manifests/remaining role vocabulary are U3 work; hand off exact teacher contract/route/hook names without falsely claiming those fixtures already run. Run I4 and cumulative D4/I5.
- [ ] **Step 15 — Environment/build configuration:** Retain existing package lock, Next/runtime config, CI and disabled unlinked deployment. No Docker/IaC/dependency change is necessary. Verify new routes/renames through existing conductor-owned strict typecheck, blocking lint/format, full production coverage, build/start and security gates at integrated verification; unit-specific commands remain scoped here. Map all NFR2.23/26/27, NFR3.21.
- [x] **Step 16 — Documentation and manifest:** Add inline rationale only for strict-calendar boundaries, source privacy, authorization validation seam and generated invalid sentinel. Write current U2 code-summary.md, strict source-manifest.json listing every created/modified/deleted source/test path including old rename paths, and traceability.json for8 assigned ACs, BR2.1–12, twenty detailed NFRs with existing implementation/test targets. Explain shared AC integration versus owning units, source/data provenance, actual commands/results and outstanding checks. No historical diary/state edits.
- [x] **Step 17 — Review/completion handoff:** Freeze current artifacts/source for the conductor's mandated architecture review and completion. Broad integrated coverage/build/start/browser/security/real DB targets remain outstanding unless actual current evidence exists. Initial approval, review/checkpoint evidence and lifecycle transitions are conductor responsibilities.

### Current repair Steps18–22

- [x] **Step 18 — Structure and runner readiness:** Verify existing U2 boundaries and exact scoped commands with Node24 and the unchanged Node/Vitest/Playwright configurations. Preserve all original source claims. Read relevant installed Next16.3.8 documentation before source edits. No new dependency, database/model, repository, business logic, endpoint, frontend behavior or infrastructure is needed. Discover the production inventory; its current151 files include U1's genuine database helper, with unchanged80% floors. Map US1.1/US2.1/US2.2 and NFR2.23/27.
- [x] **Step 19 — Format the owned browser regression:** Apply existing Prettier only to tests/browser/runtime-foundation.spec.ts; preserve every assertion, scenario, browser project and timeout. Run scoped F1/F2 after editing and inspect the diff for formatting-only semantics. Map US1.1/US2.1/US2.2 integration and NFR2.23/27.
- [x] **Step 20 — Current scoped behavior evidence:** Run D4 and I5, keeping teacher positive/denial/privacy cases and unchanged floors. Run B3 only when a current production build is supplied; otherwise record the prerequisite and leave actual browser proof to Build and Test. No historical browser result is current evidence. Map US2.1/US2.2, FR6–FR9 and NFR2.21/23/26/27.
- [x] **Step 21 — Exact requirement coverage and records:** Add FR6/FR7/FR8/FR9 to traceability upstream_ids and coverage, with OK only if existing implementation and decisive tests support them. FR6 targets teacher-facade assigned-group/current-grant tests; FR7 targets tracking-model/repository refetch and teacher presentation; FR8 targets teacher-boundaries direct-mutation denial snapshots and absent controls; FR9 targets projection/sensitive-field/no-data tests. Preserve all8 ACs,12 BRs and20 detailed NFRs. Validate target existence and manifest completeness, reconcile actual151-source discovery and fresh results in code-summary.md, distinguish historical/synthetic/local PostgreSQL/unlinked-target evidence, and preserve the Build and Test failure ledger. Mapping implemented verification does not mean final aggregate checks passed.
- [ ] **Step 22 — Freeze and completion handoff:** Freeze U2 artifacts and claimed source for the conductor's fresh architecture review and authorized project checkpoint. The conductor owns those receipts. Preserve local next-env.d.ts, ignored TypeScript cache, concurrent edits and history; do not edit reviewed outputs after review begins.

## File and Blast Radius Inventory

Current source edit: tests/browser/runtime-foundation.spec.ts only, already claimed by U2. Current artifact edits: the six code-generation plan/questions/instructions/summary/manifest/traceability files within U2. Earlier inventories describe retained implementation, not fresh work to repeat.

High impact: src/application/{contracts.ts,index.ts,facade-pipeline.ts,teacher-facade.ts,facades.test.ts,isolation.test.ts,teacher-facade.test.ts}, removing staff-facade.ts; shared view-model names require direct teacher consumer updates only. Keep other result/policy behavior untouched.

Medium impact: rename src/staff-schedule/{index.ts,schedule-service.ts,schedule-service.test.ts} to src/teacher-tracking equivalents; add tracking-model.ts/tracking-model.test.ts. Rename src/staff-web/{index.ts,synthetic-staff.ts,synthetic-staff.test.ts} to src/teacher-web/{index.ts,synthetic-teacher.ts,synthetic-teacher.test.ts}; add synthetic-teacher-repository.ts/test.ts.

Medium impact: app/teacher/{layout.tsx,loading.tsx,error.tsx}, _lib/{session.ts,facade.ts,filters.ts,compatibility.ts}, _components/{FocusedStateSection.tsx,TeacherAccessState.tsx,TeacherStatePanel.tsx}, schedule/page.tsx, schedule/[id]/page.tsx, schedule/_components/{ScheduleFilter.tsx,ScheduleCollection.tsx}; old app/munkatars tree removed except the two compatibility route.ts handlers. app/globals.css teacher styles modified.

Test consumers: src/application/facades.test.ts/isolation.test.ts; tests/unit/teacher-filters.test.ts; tests/integration/{teacher-boundaries.test.ts,teacher-routes.test.ts,teacher-components.test.tsx}; tests/coverage/{teacher-pages.test.tsx,app-entrypoints.test.tsx,production-inventory.test.ts}; tests/browser/teacher-web.spec.ts. Delete renamed former test paths in manifest. Existing profiles already navigate to /teacher/schedule, so no profile/auth rewrite is planned. Existing test configs/includes cover these paths; inspect readiness without speculative config churn.

## Acceptance Traceability

| Assigned criterion | Planned steps / decisive test |
| --- | --- |
| AC1.1.2 |1,9–13; teacher-routes and teacher-pages current Óvónő namespace |
| AC2.1.1 |3–8,11–13; source/model and responsive/detail fields |
| AC2.1.2 |3–8,11–12; explicit absence/authorized empty versus no-grant denial |
| AC2.1.3 |3–10; wrong-group/org and source zero-call denial |
| AC2.1.4 |3–8,11–13; sensitive sentinels result/DOM excluded |
| AC2.1.5 |5–12; same-instance source update, invalidated/retry/terminal/no stale data |
| AC2.1.6 |11–13; native keyboard/focus/Óvónő/Axe |
| AC2.2.1 |8,11–13; read-only facade/UI and paired direct write denial |
| FR6 |18,20–21; teacher-facade assigned-group/current-grant denial tests |
| FR7 |18,20–21; model/repository refetch and teacher fields/absence tests |
| FR8 |18–21; teacher-boundaries mutation-denial snapshots and absent controls |
| FR9 |18,20–21; allowlist, sensitive-field and no-data failure tests |

Shared AC2.2.2–4, AC3.1.1–4 and AC3.3.1–4 are exercised only at teacher integration; U1 retains underlying ownership. US4.1/US4.2 broad completion remains U3/integrated verification. NFR1.21–30, NFR2.21–27 and NFR3.21–23 map to the numbered steps; no new SLA or legal certification is invented.

## Quality and Evidence

Standard strategy: 5–8 cases per testable component, key-boundary integration and required teacher browser/privacy/performance cases. At final verification all production source must meet >=80% lines, branches and functions; unit-filter coverage is diagnostic, never whole-production proof. Existing strict typecheck/lint/format/tests, production build/start, <2000ms existing teacher first-view check, zero serious/critical accessibility and high/critical security blockers remain. Synthetic/static/local DB/real-target execution are separate categories. Production linkage and real RLS remain unavailable; no live target is touched.

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
