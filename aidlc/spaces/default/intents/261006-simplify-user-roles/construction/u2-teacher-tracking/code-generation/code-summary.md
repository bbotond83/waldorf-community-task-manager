# Code Summary — U2 Teacher Tracking

## Current Build and Test Repair — 2026-10-08

This repair attempt started2026-10-08T13:30:05Z and executes approved Steps18–21 only. The authoritative supplied brief contains both U2/Testing Contract markers and the unchanged contract `sha256:5f582ac45759862dc64c88fa4a4d2b6ad903e3cae677ff61fe998e255ad40751`. Initial testing-posture verification allowed execution with reason `approved`. The source change is exclusively Prettier formatting of one existing `expect` call in tests/browser/runtime-foundation.spec.ts (three wrapped lines become one). Comparison against a saved pre-format copy confirms unchanged selector, heading, assertions, scenarios and behavior. No production module, dependency, runner configuration, threshold, browser project, timeout, U1/U3 source, next-env.d.ts or ignored TypeScript cache was edited. Steps1–17 and all evidence in the subsequent historical sections describe earlier attempts; their phrases about current source/results are relative to those earlier attempts.

Readiness used installed Node24.21.0/npm11.19.0, current Vitest/Node/Playwright configuration and installed Next16.3.8 redirect documentation before the source edit. No framework API changed. Read-only `discoverProduction()` execution found151 production files, including U1's genuine database helper. The all-production reporter and80% line/branch/function floors remain intact. No filtered run below produces a full-production coverage claim.

All commands below used `PATH=/opt/homebrew/opt/node@24/bin:$PATH`. Output identifiers identify the actual tool results; no browser run or full-project checkpoint was executed in this repair.

| Exact current command | Actual outcome / output |
| --- | --- |
| `node --experimental-strip-types --input-type=module -e 'import {discoverProduction} from "./tests/coverage/support/production-inventory.ts"; console.log(JSON.stringify({productionSourceCount:discoverProduction().length}));'` | exit0;151 production sources; output65ca19 |
| `npx --no-install prettier --write tests/browser/runtime-foundation.spec.ts` | exit0; formatted owned file; outputdd8129 |
| F1: `npx --no-install prettier --check tests/browser/runtime-foundation.spec.ts` | exit0; all matched files conform; outputcb17f4 |
| F2: `npx --no-install eslint tests/browser/runtime-foundation.spec.ts --max-warnings 0` | exit0; no diagnostics; session2023, final output06aa38 |
| D4: `node --experimental-strip-types --test src/teacher-tracking/tracking-model.test.ts src/teacher-tracking/schedule-service.test.ts src/teacher-web/synthetic-teacher-repository.test.ts src/teacher-web/synthetic-teacher.test.ts src/application/teacher-facade.test.ts src/application/isolation.test.ts` | exit0;41 passed,0 failed/cancelled/skipped/todo;111.840167ms; output7fbac5 |
| I5: `npm run test:delivery -- tests/unit/teacher-filters.test.ts tests/integration/teacher-boundaries.test.ts tests/integration/teacher-routes.test.ts tests/integration/teacher-components.test.tsx tests/coverage/teacher-pages.test.tsx` | exit0;39 tests passed in5 files (7/6/8/8/10);7.04s; session32584, final outpute87237 |
| B3: `npm run test:browser -- tests/browser/runtime-foundation.spec.ts` | Not run: production build is from Next16.3.6, while installed patched framework is16.3.8. A conductor-supplied current production build is required before this browser proof. Historical12/12 below is not current evidence. |

Exact upstream FR6–FR9 definitions come from inception/requirements-analysis/requirements.md:51/56/62/67. The trace adds these four genuine OK mappings to the unchanged8 AC/12 BR/20 NFR rows (44 upstream IDs and44 coverage rows). OK establishes implemented verification mapping, not final aggregate acceptance. NFR2.23 remains Deferred.

| Requirement | Implementation and decisive existing tests |
| --- | --- |
| FR6 — Assigned-group visibility; group filters must not broaden grants | src/application/teacher-facade.ts and app/teacher/_lib/filters.ts; src/application/teacher-facade.test.ts authorizes before validation/source, denies an ungranted group with zero reads and denies inactive/revoked/no grants; tests/unit/teacher-filters.test.ts preserves grant-derived options. D4/I5 passed these current scoped cases. |
| FR7 — Existing schedule dates/groups/owners/assignments/current status | src/teacher-tracking/tracking-model.ts and injected src/teacher-web/synthetic-teacher-repository.ts; repository test preserves identities/dates/scopes and updates current fields; facade test refetches the same source; teacher-components/teacher-pages tests cover displayed values and explicit absence. D4/I5 passed. No new task/event store or inferred owner join. |
| FR8 — No teacher task/event/administration mutations at entry points or UI | tests/integration/teacher-boundaries.test.ts checks direct create/update/delete/manage denial and unchanged source snapshots, assignment-domain denial and redacted audit; teacher-components tests assert no write controls. Existing authorization ports remain read-only. I5 passed. |
| FR9 — Preserve sensitive-field restrictions within authorized groups | src/teacher-tracking/tracking-model.test.ts checks exact projection keys excluding private/source-only fields; teacher-facade tests remove finance/email/allergen sentinels and return no data on failures; teacher-boundaries checks wrong organization/revocation without disclosure; components render hostile values as text. D4/I5 passed. |

source-manifest.json retains all61 unique original claims, including deleted rename sources and two narrow directory claims, covering69 expanded paths. Read-only validation exited0 (output75039b):44 upstream IDs/coverage rows,4 FR/8 AC/12 BR/20 NFR, every OK target exists and every expanded path is claimed. The23 absent historical deletion paths are retained intentionally. TypeScript printer comparison of the saved original and formatted browser file produced identical parsed output, confirming formatting-only semantics. Original corrected NFR2.26/NFR2.27 targets remain. The new formatting edit is already covered by the runtime-foundation claim. No Build and Test ledger or sibling record was changed. SHA256 checks before/after record finalization remained unchanged for local next-env.d.ts (`0f70629890b72a0a82e91972cc032c04b658b26c265373cb711cf576bfbf8fcc`) and ignored tsconfig.tsbuildinfo (`f1bb711ba39a70309a561e3220616b81bcb5b8b2cb037f8bef0f2252495f7837`).

The executable instructions now correct the stale U1 administration R-01 statement: U3 already implemented that repair and it has been checked in the current shared source. The conductor supplied actual local PostgreSQL fixture evidence,9/9 passed; this worker did not execute that database run. Synthetic U2 tests, actual local fixture checks, deployed integration and production DB/RLS are separate evidence categories. Production remains unlinked; local fixture proof does not establish deployment. This same-attempt correction uses the lowered Plan Approval fence: verification still reports `execution_allowed:true` and reason `The plan-approval check is off; continue with the current plan and test instructions without a new approval.` Original approval answer/tags and Testing Contract remain unchanged; fingerprint/receipt validity becomes false because the permitted instructions changed.

Step22 and fresh architecture review/project checkpoint belong to the conductor. Current B3/build prerequisite, full integrated coverage, browser/start/security/performance gates and real production target evidence remain pending; the scoped passes above do not certify them. Owned source and handoff artifacts are frozen for the conductor's review.

## Historical Redo Attempt — Reused Implementation Handoff

The current approved U2 reuse attempt started on 2026-10-08 at09:17:26UTC under the redo begun2026-10-07T15:49:05Z, with approved fingerprint `4a040b2ee8819c67eee85979258196b47671e8d4af89966adbc30e9e39866800` and unchanged Testing Contract `sha256:5f582ac45759862dc64c88fa4a4d2b6ad903e3cae677ff61fe998e255ad40751`. Completed U1/U2/U3 source and existing cache bytes are preserved. This attempt changes only handoff records; no application or test source changed and no typecheck, tests, browser runs or checkpoint were executed by this worker. Earlier reviews/checkpoints and all scoped/browser/build counts remain historical; conductor owns fresh U2 review and Node24 checkpoint. The prior attempt replaced both removed staff profile selector hooks and the obsolete welcome heading in tests/browser/runtime-foundation.spec.ts with the existing kindergarten-teacher-local selector and Óvónő heading. Every isolation, history, sign-out, security and accessibility assertion remains intact. That repair addresses U2 review R01 without taking ownership of U3 administration work.

NFR2.26 targets existing scripts/verification/aggregate-evidence.ts and NFR2.27 targets existing tests/coverage/production-inventory.test.ts; neither implementation changed during that target correction. The existing manifest includes runtime-foundation.spec.ts, so61 supported claims/69 expanded actual paths remain accurate. All D/I/B1/B2/B3 counts and build/typecheck results below are historical evidence, not current-attempt reruns. Prior B3 completed after the conductor supplied a fresh production build (session54040 exit0, compilation2.0s, TypeScript4.5s). The exact command `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:browser -- tests/browser/runtime-foundation.spec.ts` passed12/12 cases in12.5s (session19753 exit0), across Chromium/Firefox/mobile. Profile switching, sign-out/history isolation and zero serious/critical Axe assertions all passed. Browser cache access required the separately approved exact command escalation; no duplicate command or test configuration change was used. Current U2 architecture review and conductor checkpoint remain pending. U3 implemented administration R-01; its source is preserved. U2 review R01 shared browser consumer repair remains implemented with prior B3 evidence; no broader U3 work is claimed.

## Implementation and Decisions

Implemented all eight assigned ACs: AC1.1.2, AC2.1.1–6 and AC2.2.1. English teacher modules and `/teacher/schedule` now serve Hungarian Óvónő list/detail pages. Table, mobile cards and detail share the projected dates/group/title/location/coordination/owner/assignees/status fields and explicit absence text. Native grant-derived filters, Budapest dates, 44rem layout, focus/announcement mapping and read-only UI are retained.

The injected read repository provides current isolated synthetic records, never a guessed join to administration data. Existing three record identities and relationships remain; declared synthetic responsibility fields follow logical-components.md. A separately held validated test/operator handle updates existing records; teacher ports expose no writes. Current authorization precedes filter validation and source access; scoped source reads occur once, mismatched scope denies the whole result, malformed/duplicate source data fails closed, and browser projection explicitly omits source metadata/private fields. No protected projection cache or automatic retry was added.

GET-only legacy bookmarks return fixed relative307 responses with empty body/no cookie, whitelisted canonical groupId/from/to and Hungarian translation. Ambiguous/malformed values become internally generated invalid date sentinels. Valid ungranted groups deny before validation; malformed group context uses a grant-derived group only for validation with zero source calls. Unknown scenario/fixture/host/return fields are discarded. Only canonical synthetic pages accept bounded fixture scenarios; retry drops fixture and reauthorizes/refetches.

No package, schema migration, backend link, infrastructure, policy or administration selector changes. Installed Next page/route/redirect documentation was read before implementation. Local-only next-env.d.ts is excluded and was never edited by this agent. The approved plan/instructions/Testing Contract stayed frozen except checkbox ticks; test-after ordering was followed for each layer.

## Historical Verification — Prior Attempt

All commands below used `PATH=/opt/homebrew/opt/node@24/bin:$PATH`. Commands/results are local synthetic/static evidence. D/I/B labels identify the exact unchanged command blocks in unit-test-instructions.md; they do not certify whole-project coverage.

| Command | Actual result |
| --- | --- |
| `node --experimental-strip-types --test src/staff-schedule/schedule-service.test.ts src/staff-web/synthetic-staff.test.ts` | Prechange baseline:11 passed |
| `npm run test:delivery -- tests/integration/staff-components.test.tsx tests/coverage/staff-pages.test.tsx` | Prechange baseline:12 passed |
| D1: `node --experimental-strip-types --test src/teacher-tracking/tracking-model.test.ts src/teacher-tracking/schedule-service.test.ts` |15 passed |
| D2: `node --experimental-strip-types --test src/teacher-web/synthetic-teacher-repository.test.ts src/teacher-web/synthetic-teacher.test.ts` |15 passed |
| D3: `node --experimental-strip-types --test src/application/teacher-facade.test.ts src/application/isolation.test.ts` | Initial10 passed; expanded current cases included in D4 |
| D3: `node --experimental-strip-types --test --test-name-pattern='Teacher|teacher' src/application/facades.test.ts` |3 passed |
| I1: `npm run test:delivery -- tests/integration/teacher-boundaries.test.ts` |6 passed |
| I2: `npm run test:delivery -- tests/unit/teacher-filters.test.ts tests/integration/teacher-routes.test.ts` |15 passed |
| I3: `npm run test:delivery -- tests/integration/teacher-components.test.tsx tests/coverage/teacher-pages.test.tsx` |18 passed |
| I3: `npm run test:delivery -- tests/coverage/app-entrypoints.test.tsx -t 'Teacher|teacher|compatibility'` |1 passed,12 nonteacher cases skipped |
| I4: `npm run test:delivery -- tests/coverage/production-inventory.test.ts -t 'U2 teacher inventory'` |1 passed,5 unrelated cases skipped; current discovery150 production paths |
| D4: `node --experimental-strip-types --test src/teacher-tracking/tracking-model.test.ts src/teacher-tracking/schedule-service.test.ts src/teacher-web/synthetic-teacher-repository.test.ts src/teacher-web/synthetic-teacher.test.ts src/application/teacher-facade.test.ts src/application/isolation.test.ts` |41 passed |
| I5: `npm run test:delivery -- tests/unit/teacher-filters.test.ts tests/integration/teacher-boundaries.test.ts tests/integration/teacher-routes.test.ts tests/integration/teacher-components.test.tsx tests/coverage/teacher-pages.test.tsx` |39 passed |
| Direct renamed consumer: `npm run test:delivery -- tests/coverage/app-session-boundaries.test.ts` |3 passed |
| B1: `npm run test:browser -- tests/browser/teacher-web.spec.ts` |24 passed across Chromium/Firefox/mobile,22.9s; existing first-view <2000ms assertions passed |
| B2: `npm run test:browser -- tests/browser/teacher-web.spec.ts --grep @a11y` |3 passed across Chromium/Firefox/mobile,17.0s; zero serious/critical Axe findings, keyboard/focus/zoom/touch checks passed |
| Conductor `npm run build` | Current source production compilation/type/static routes passed; supplied prerequisite before B1/B2 |
| Conductor `npm run typecheck` | Current refreshed types passed |

Initial implementation test failures were repaired and rerun: obsolete component record fixture, inventory count149 versus actual150, and scope denial precedence before duplicate-ID terminal validation. Source/test session/import type errors were repaired. Two conductor build attempts initially failed solely stale `.next/dev/types` references to deleted staff pages; installed Next typegen refreshed production types and the current build/typecheck then passed. Conductor preserved local next-env content and handled generated-cache restoration; temporary dev watcher EMFILE was not production browser evidence.

First B1 invocation stopped before discovery with sandbox EPERM writing the installed Firefox cache. Exact rerun with approved cache access passed24. The first B2 escalation was pending approval and interrupted without execution output; approved exact rerun passed3. No framework/test threshold or browser matrix was changed.

## Source Inventory and Traceability

source-manifest.json records61 supported manifest claims covering69 actual created/modified/deleted application and test paths. Narrow trailing-slash claims `app/munkatars/beosztas/` and `app/teacher/schedule/` cover their children because the engine rejects literal Next `[id]` filenames as glob syntax. Other paths remain exact; no duplicate child claims remain. The expanded inventory below includes old rename sources/destinations and direct executable test consumers. Current production inventory test includes teacher model/repository/compatibility and both legacy handlers, removes deleted staff modules, and preserves all-production denominator/counter checks. Shared profile measurement, runtime browser navigation and session-boundary consumers use the teacher contract without claiming the entire mixed-role suites ran here.

traceability.json maps8 assigned ACs,12 BRs and20 detailed NFRs to concrete existing implementation/test paths. NFR2.23 remains Deferred because integrated gates are still outstanding. Successful unit tests and browser runs do not constitute full-production80% line/branch/function proof. Step15 is deliberately unchecked until the conductor completes integrated verification.

## Remaining Work and Risks

Conductor owns architecture review, full-project checkpoint, blocking lint/format, whole-production coverage>=80% lines/branches/functions, deterministic smoke and integrated dependency/SAST/secret scans blocking high/critical findings. Current unit production build/typecheck and teacher browser/accessibility evidence have been supplied, but remaining global gates are not claimed.

U3 completed the U1 R-01 mixed-organization administration selector repair and cross-role consumer/manifest cleanup. U2 claims neither that implementation nor its test results. U1 also owns the package.json nonincremental verification typecheck repair; U2 does not modify that configuration or the ignored cache. No linked production service or actual target DB/RLS validation was executed. Synthetic fixture updates prove fresh reads and read-only boundaries, not real database policy enforcement.

Source is stable for current conductor review. The earlier repair attempt changed only the three approved expectations/hooks in runtime-foundation.spec.ts and the two traceability targets plus handoff documentation. The current redo reconciles records only, preserving that implementation and all U1/U3 source. No application/test source, next-env.d.ts, thresholds, browser matrix or Testing Contract changed in this attempt. No lifecycle transition, review receipt, commit, push or live data operation was performed by this agent.

## Expanded Actual Source/Test Inventory

The following69 literal paths record actual writes/deletions; they are reviewer inventory, distinct from the61 supported manifest claims.

```text
.gitignore
app/globals.css
app/munkatars/_components/FocusedStateSection.tsx
app/munkatars/_components/StaffAccessState.tsx
app/munkatars/_components/StaffStatePanel.tsx
app/munkatars/_lib/facade.ts
app/munkatars/_lib/filters.ts
app/munkatars/_lib/session.ts
app/munkatars/beosztas/[id]/page.tsx
app/munkatars/beosztas/[id]/route.ts
app/munkatars/beosztas/_components/ScheduleCollection.tsx
app/munkatars/beosztas/_components/ScheduleFilter.tsx
app/munkatars/beosztas/page.tsx
app/munkatars/beosztas/route.ts
app/munkatars/error.tsx
app/munkatars/layout.tsx
app/munkatars/loading.tsx
app/teacher/_components/FocusedStateSection.tsx
app/teacher/_components/TeacherAccessState.tsx
app/teacher/_components/TeacherStatePanel.tsx
app/teacher/_lib/compatibility.ts
app/teacher/_lib/facade.ts
app/teacher/_lib/filters.ts
app/teacher/_lib/session.ts
app/teacher/error.tsx
app/teacher/layout.tsx
app/teacher/loading.tsx
app/teacher/schedule/[id]/page.tsx
app/teacher/schedule/_components/ScheduleCollection.tsx
app/teacher/schedule/_components/ScheduleFilter.tsx
app/teacher/schedule/page.tsx
src/application/contracts.ts
src/application/facade-pipeline.ts
src/application/facades.test.ts
src/application/index.ts
src/application/isolation.test.ts
src/application/staff-facade.ts
src/application/teacher-facade.test.ts
src/application/teacher-facade.ts
src/staff-schedule/index.ts
src/staff-schedule/schedule-service.test.ts
src/staff-schedule/schedule-service.ts
src/staff-web/index.ts
src/staff-web/synthetic-staff.test.ts
src/staff-web/synthetic-staff.ts
src/teacher-tracking/index.ts
src/teacher-tracking/schedule-service.test.ts
src/teacher-tracking/schedule-service.ts
src/teacher-tracking/tracking-model.test.ts
src/teacher-tracking/tracking-model.ts
src/teacher-web/index.ts
src/teacher-web/synthetic-teacher-repository.test.ts
src/teacher-web/synthetic-teacher-repository.ts
src/teacher-web/synthetic-teacher.test.ts
src/teacher-web/synthetic-teacher.ts
tests/browser/runtime-foundation.spec.ts
tests/browser/staff-web.spec.ts
tests/browser/support/profile-login-measurement.ts
tests/browser/teacher-web.spec.ts
tests/coverage/app-entrypoints.test.tsx
tests/coverage/app-session-boundaries.test.ts
tests/coverage/production-inventory.test.ts
tests/coverage/staff-pages.test.tsx
tests/coverage/teacher-pages.test.tsx
tests/integration/staff-components.test.tsx
tests/integration/teacher-boundaries.test.ts
tests/integration/teacher-components.test.tsx
tests/integration/teacher-routes.test.ts
tests/unit/teacher-filters.test.ts
```

## Authored Test Inclusion Correction

The conductor corrected `.gitignore` from `coverage/` to `/coverage/` after the review prerequisite rejected the authored `tests/coverage/teacher-pages.test.tsx` through `check-ignore --no-index`, even when force-staged. This necessary correction keeps generated root coverage output ignored while exposing authored coverage tests. No engine, guard, test threshold or test configuration changed. The manifest includes this correction; it now contains61 claims covering69 actual paths.
