# Unit Test Instructions — U3 Retained Workflows

## Readiness and Ordering

Node24/npm11 with installed Node strip-types, Vitest delivery/jsdom and Playwright/Axe. Existing includes cover new exact paths; no new dependency/configuration expected. Test-after per unchanged embedded contract: metadata then tests, business then tests, retained integration, manifests then tests, browser consumers then browser tests. Commands execute only after initial Plan Approval. Use isolated invented fixtures, deterministic versions/times, real U1 authorization/converter and injected ports; spies/snapshots prove denied commands make no downstream calls or changes. No live target or secret records.

All commands below are exact U3 paths; prefix each with PATH as shown. Standard5–8 meaningful grouped cases/component; retain every existing regression/security assertion. Baseline uses existing files; new files run only after creation.

## Exact Scoped Commands

This loop-back executes Steps13–16 only. R0 confirms current runner readiness; D3/I3 establish fresh retained workflow/reference/quality-control evidence. B1/B2 remain pending until a patched current production build is supplied. Earlier layer commands remain applicable to final integrated verification. NFR2's OK trace mapping must identify genuine existing verification controls/tests; it never substitutes for the independently executed final quality matrix. No source, runner or configuration change is planned.

R0 — existing runner baseline:
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/admin-experience/admin-service.test.ts src/import-migration/import-service.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/unit/verification-core.test.ts
```
D1 — metadata after Step3:
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/import-migration/import-service.test.ts
```
D2 — business after Step5:
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/application/admin-facade.test.ts src/admin-experience/admin-service.test.ts
```
I1 — retained real-foundation integration after Step6:
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/integration/retained-workflows.test.ts
```
I2 — current manifest/reference integrity after Step8:
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/unit/current-role-references.test.ts tests/unit/verification-core.test.ts tests/coverage/verification-entrypoints.test.ts
```
B1 — retained browser after Step10; requires conductor-supplied current production build; all configured browsers:
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:browser -- tests/browser/parent-web.spec.ts tests/browser/admin-core.spec.ts tests/browser/admin-advanced.spec.ts
```
B2 — explicit retained accessibility:
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:browser -- tests/browser/parent-web.spec.ts tests/browser/admin-core.spec.ts tests/browser/admin-advanced.spec.ts --grep @a11y
```
D3 — cumulative U3 domain/application:
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/import-migration/import-service.test.ts src/admin-experience/admin-service.test.ts src/application/admin-facade.test.ts
```
I3 — cumulative U3 delivery:
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/integration/retained-workflows.test.ts tests/unit/current-role-references.test.ts tests/unit/verification-core.test.ts tests/coverage/verification-entrypoints.test.ts
```
Optional exact discovery regression only if Step11 changes its source count assertion:
```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/coverage/production-inventory.test.ts
```

## Decisive Cases

- R-01 actor Super organizationA and Group groupB/organizationB: coreB allowed, advanced/governanceB denied; valid same-org Super allowed. Wrong-subject/revoked/stale/inactive/malformed authorities never dispatch. Scope cannot be obtained from copied roles/scopes or grant array position.
- Exhaustive record/approval/archive core mappings vs role/import/privacy advanced mappings, granted/ungranted scopes, unsupported operation, zero calls and unchanged state on denial. Preserve queue/year projections.
- Parent own-family signup/request/notification and other-family denial; converted supported legacy administrator becomes current Super via existing U1 converter; current/stale/inactive/revoked equivalent fixtures preserve business identity.
- Archive all REQUIRED_SHEETS retain mode/destination/coverage and records; only administrator process owner becomes super-admin. No task owner changes.
- Four current fixture profiles and current teacher fields/routes; atomic matrix/scenario references, no dangling fifth role or obsolete allowed branch. Mandatory NFR/browser/evidence inventories remain, linked-target results stay OUTSTANDING. Explicit migration/removal regression/old-bookmark/history exceptions are narrowly inventoried and do not become current profiles.
- Browser current Super governance visibility and Group/Parent/Teacher direct advanced denial, zero hidden sensitive state, retained conflict/import recovery/idempotency/reminder correlation/revocation/lifecycle/settings. Preserve <2000ms budgets, keyboard/focus/zoom/44px and zero serious/critical Axe.

## Quality/Handoff

No unit-filter report establishes full production coverage. Conductor separately owns project checkpoint and final >=80% lines/branches/functions, strict types/lint/format/build/start and dependency/secret/SAST gates blocking high/critical findings. Preserve counters/includes/thresholds and private unsigned evidence policy. Report browser build/cache prerequisite failures accurately, notify root immediately if escalation approval is pending, and use bounded polling. No actual database/RLS/production integration claim; no broad test fixing or historical report rewrite. Preserve U1/U2 and local-only next-env.d.ts.
