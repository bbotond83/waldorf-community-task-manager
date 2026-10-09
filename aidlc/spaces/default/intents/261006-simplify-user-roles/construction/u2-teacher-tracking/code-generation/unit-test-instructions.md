# Unit Test Instructions — U2 Teacher Tracking

## Framework Readiness

Use installed Node24/npm11 and existing Node test runner for src colocated .test.ts, Vitest4/Istanbul/jsdom for delivery tests, React Testing Library, Playwright/Axe. Existing vitest.config.ts discovers tests/unit, integration and coverage; coverage-only domain adapter includes src/**/*.test.ts. Do not lower 80% line/branch/function thresholds or exclude new runtime files. Inspect tests/setup.ts and current reporters/config before testing; no new dependency or configuration change is expected.

Planning performed no test execution. For the restarted reuse attempt, these current teacher paths replace the deleted staff baseline paths; prior baseline results remain historical. After fresh approval, runner readiness may use these exact current U2 files when required by the conductor:
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/teacher-tracking/schedule-service.test.ts src/teacher-web/synthetic-teacher.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/integration/teacher-components.test.tsx tests/coverage/teacher-pages.test.tsx
```
New-file commands below become runnable only after their paired implementation/test step. The conductor separately owns the authorized project-wide baseline/checkpoint; these instructions never substitute a unit run for it.

## Exact Unit Commands

Current loop-back executes Steps18–22 only: D4/I5, F1/F2, and B3 when its current-build prerequisite is available. Existing layer commands remain applicable to final integrated verification. Preserve all browser projects and assertions; no new runner/configuration is required.

**F1 — scoped formatting after Step19**
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npx --no-install prettier --check tests/browser/runtime-foundation.spec.ts
```
**F2 — scoped blocking lint after Step19**
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npx --no-install eslint tests/browser/runtime-foundation.spec.ts --max-warnings 0
```

FR6–FR9 exact trace rows must identify current decisive tests: assigned-group denial; source owner/assignee/status, absence and current refetch; paired direct mutation denial with snapshots; and explicit allowlist/no-data/sensitive-field exclusion. These rows document implemented coverage and do not replace executed final quality gates.

**D1 — model/domain after Step4**
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/teacher-tracking/tracking-model.test.ts src/teacher-tracking/schedule-service.test.ts
```
**D2 — repository/adapter after Step6**
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/teacher-web/synthetic-teacher-repository.test.ts src/teacher-web/synthetic-teacher.test.ts
```
**D3 — facade after Step8** (existing mixed-consumer files include only U2 teacher cases by exact name filter; isolation inventory is a direct U2 rename regression)
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/application/teacher-facade.test.ts src/application/isolation.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test --test-name-pattern='Teacher|teacher' src/application/facades.test.ts
```
**I1 — current foundation/teacher boundary after Step8**
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/integration/teacher-boundaries.test.ts
```
**I2 — filter/route after Step10**
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/unit/teacher-filters.test.ts tests/integration/teacher-routes.test.ts
```
**I3 — presentation after Step12**
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/integration/teacher-components.test.tsx tests/coverage/teacher-pages.test.tsx
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/coverage/app-entrypoints.test.tsx -t 'Teacher|teacher|compatibility'
```
**B1 — teacher browser after Step13** (requires existing current production build; Playwright owns three synthetic start processes)
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:browser -- tests/browser/teacher-web.spec.ts
```
**B2 — explicit teacher accessibility**
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:browser -- tests/browser/teacher-web.spec.ts --grep @a11y
```
**I4 — U2 inventory after Step14** (name this exact discovery case U2 teacher inventory; keep all denominator/counter safety assertions intact)
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/coverage/production-inventory.test.ts -t 'U2 teacher inventory'
```
**B3 — restarted U2 R01 shared browser consumer repair** (only after fresh approval and supplied current production build; preserve all configured browsers and every existing isolation/history/security/accessibility assertion)
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:browser -- tests/browser/runtime-foundation.spec.ts
```
**D4 — cumulative U2 source cases**
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/teacher-tracking/tracking-model.test.ts src/teacher-tracking/schedule-service.test.ts src/teacher-web/synthetic-teacher-repository.test.ts src/teacher-web/synthetic-teacher.test.ts src/application/teacher-facade.test.ts src/application/isolation.test.ts
```
**I5 — cumulative U2 delivery**
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/unit/teacher-filters.test.ts tests/integration/teacher-boundaries.test.ts tests/integration/teacher-routes.test.ts tests/integration/teacher-components.test.tsx tests/coverage/teacher-pages.test.tsx
```
Do not use a bare project test command here. Global coverage/build/start/type/lint/security execution belongs to conductor/integrated verification; no per-unit filtered report certifies full production coverage. Report prerequisite/failing-command limitations instead of changing thresholds.

## Cases and Scope

Standard 5–8 meaningful cases per model/service, repository, adapter, facade, filter/route and component family, table-driven variants where needed; maintain happy path per component and key-boundary integration.

- Model: strict real YYYY-MM-DD, leap/impossible dates, same-day/exact 31/over 31/order; inclusive UTC starts; required source shape; all-or-nothing group/org mismatch; explicit allowlist/frozen copies and missing values.
- Repository/adapter: explicit three existing fixture records; injected same-instance update then refetch owner/assignees/status; sourceRead spy zero denied/one authorized; interleaved actors/groups; isolated updates/snapshot identities; ready/empty/denied/retryable/terminal; update handle absent from teacher port.
- Facade: current/inactive/revoked/stale grants, invalid-session/wrong-org/unknown-role safe results; authorization denial before invalid-date feedback; no data on every failure even after success; empty normalization and generic absent detail; exact existing result/presentation/focus/announcement mappings; sensitive sentinels absent from results and safe audit.
- Routes: fixed307/no-body/no-cookie compatibility, canonical and Hungarian translation, duplicates/conflicts/empty/malformed safe invalid constants, unknown host/returnTo/scenario/fixture dropped, valid ungranted group denial before generated invalid dates, malformed group current-grant validation-only/zero read, opaque id segment encoding and current destination authorization.
- Synthetic fixtures: allowlisted canonical fixture parameter only synthetic and after authority; no role/grant change or new mutation route. Retry drops fixture retaining validated filters and fresh source. Production remains unavailable, unknown selector cannot bypass authorization.
- UI/browser: Óvónő, grant-derived native filters, owner/assignees/status plus existing fields equal table/cards/detail, missing wording, safe back/reset/retry, no create/edit/assign/approve/export or sensitive hidden fields, HTML-escaped malicious display text, 44rem one-visible keyboard representation, Budapest dates, local overflow/zoom/wrapped names, 44px targets, focus/correction/recovery and no serious/critical Axe.
- Integration: converted supported teacher uses current scoped grants; stale/revoked conversion context cannot reuse rows; successful read paired with denied direct writes and before/after group/task/assignment snapshots. U1 owns migration/SQL policy; static fixtures are not real RLS proof.

## Fixtures, Injection and Mocking

Create isolated source repositories and authorization versions per case. Inject the same read repository into adapter/facade for before/update/after assertions; separately held validated operator handle updates existing record by id only. Use declared synthetic names/labels from logical-components.md; never join unrelated admin IDs/groups or coordinator-as-owner. Freeze/snapshot source and result arrays. Use deterministic dates and current grants, real shared authorization for boundary integration, read spies for call counts and explicit typed retryable/terminal errors. Mock only unavailable framework cookies/navigation at page tests; verify actual HTTP behavior in browser tests. Never mock away scope/field checks. No live production, SQL mutation or external user data.

## Coverage, Security and Performance Evidence

Final combined production evidence must enforce 80% each line/branch/function across every current executable source; dynamic inventory must include new paths and exclude deleted paths, preserving reporter linkage checks. Current source discovered count is authoritative. Do not relax counter validation, exclusions, thresholds, latency or accessibility gates.

Existing browser first-view budget remains <2000ms, all configured Chromium/Firefox/mobile projects remain applicable. Capture actual results and fixture/runtime size/mode. Security acceptance uses private-field/escaping/redirect/direct-denial sentinels; existing integrated secret/SAST/dependency scans must block high/critical findings. Record only actual commands/exits/counts; no historical count as current evidence. Browser prerequisite build/start, full production coverage and unlinked integrations remain outstanding until actually run. U3 has implemented the U1 R-01 administration selector repair, which has been checked in the current shared source; no teacher waiver is needed. The conductor supplied actual local PostgreSQL fixture evidence (9/9 passed). That local fixture proof is separate from synthetic U2 tests and does not establish deployment or linked production DB/RLS validation.

## Execution Ordering and Handoff

Follow embedded Testing Contract test-after per layer: readiness, model then model tests, repository then repository tests, facade then facade/integration tests, routes then route tests, frontend then frontend/browser tests. Record commands/results in code-summary.md; maintain strict source-manifest.json including changed/deleted rename paths and exact traceability to assigned ACs, BRs and detailed NFRs. Preserve next-env.d.ts and all unrelated concurrent edits.
