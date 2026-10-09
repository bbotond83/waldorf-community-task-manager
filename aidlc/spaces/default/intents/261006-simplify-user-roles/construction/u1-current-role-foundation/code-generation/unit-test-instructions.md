# Unit Test Instructions — U1 Current Role Foundation

## Setup and Ordering

Use existing locked dependencies, Node 24/npm 11, Node's TypeScript strip-types runner for src colocated tests and installed Vitest delivery project for tests/unit and tests/integration. No new JavaScript database dependency or test runner is introduced. Repair Steps18–21 add a scoped Node database-test command, integrated verification wiring, coverage inventory accounting and PostgreSQL18 CI prerequisites. After Plan Approval, verify runner readiness using the exact existing-path baseline commands below before the first implemented layer's tests. Use test-after: implement a layer, then write/run that layer's tests before proceeding. The plan's embedded Testing Contract is authoritative.

## Exact Unit-Scoped Commands

Baseline runner checks (existing files):
```sh
node --experimental-strip-types --test src/access/access-service.test.ts src/access/access-matrix.test.ts src/application/authorization.test.ts
npx vitest run --config vitest.config.ts --project delivery tests/unit/runtime-boundaries.test.ts tests/integration/synthetic-route.test.ts tests/integration/runtime-shell.test.tsx
```

Model/migration layer, after creation:
```sh
node --experimental-strip-types --test src/access/role-policy.test.ts src/access/current-role-migration.test.ts
```

Repository/conversion layer, after creation:
```sh
node --experimental-strip-types --test src/access/legacy-role-conversion.test.ts src/access/transaction.test.ts src/access/access-service.test.ts
```

Business policy layer:
```sh
node --experimental-strip-types --test src/access/access-service.test.ts src/access/access-matrix.test.ts src/directory/field-policy.test.ts src/directory/directory-service.test.ts src/application/authorization.test.ts src/application/contracts.test.ts src/application/facades.test.ts src/application/isolation.test.ts
```

Runtime/endpoint/presentation layer, after new session test creation:
```sh
npx vitest run --config vitest.config.ts --project delivery tests/unit/runtime-boundaries.test.ts tests/unit/current-role-session.test.ts tests/integration/synthetic-route.test.ts tests/integration/runtime-shell.test.tsx
```

These are the Unit's instructions; all test execution commands are scoped to explicit paths. The separately authorized whole-project checkpoint is managed by the delivery workflow, and full integrated coverage/build/start/browser/security verification belongs to Build and Test.

## Test Cases and Fixture Management

Provide at least five to eight meaningful tests per changed component, more where the permission/conversion matrix needs them. Pair each permitted role/scope behavior with denied wrong scope/organization/action/field; cover unknown/removed roles, stale/missing version, inactive subject, revoked grants and unrelated role/scope pairs. Test teacher read-only/private-field denial without downstream command calls/state changes. Assert correct existing explicit result, focus and announcement metadata.

Conversion fixtures use invented subjects and actual preserved fixture group identities. Include active/inactive/revoked grants, equivalent current target grant, duplicate historical rows, unsupported scope/role/schema, repeat, absent/invalid/overflow versions and incompatible issuer cases. Compare whole pre/post snapshots and all non-role fields; do not delete duplicates. Inject faults at preflight, role writes, version, evidence and enforcement; verify complete rollback. Test final-administrator removal/overwrite, equivalent surviving grants, distinct active subjects, wrong organizations and writer exclusion through the transaction seam. No fake passing concurrency assertion.

Use constructor-injected repositories/time/audit and deterministic scope fixtures; spies verify denied operations never dispatch. Never include real tokens, contact records or secrets in stored evidence. Session tests may create transient signed synthetic tokens but must not persist them. Restore environment, cookies and repository fixture state after every test.

## Coverage and Evidence Boundaries

Keep at least 80% production line, branch and function coverage; preserve existing Vitest/Node thresholds and all existing regressions. Unit commands establish changed-component correctness, not a waiver of integrated coverage or consumers. Static SQL tests check transaction/constraint/policy/evidence shape and ordering; record them as static checks. Fixture transactions establish fixture semantics, not actual PostgreSQL locking or RLS. Real-target execution remains outstanding until an authorized disposable target/tool exists. Do not execute a live migration or silently substitute a synthetic pass.

Full teacher source/refetch/UI/redirect tests are owned by U2; retained advanced/archive/manifest integration is owned by U3. Maintain current-role adaptations needed for compilation/suite compatibility, but do not mark their assigned acceptance criteria complete from this Unit.

## Loop-Back 1: Disposable PostgreSQL Checks

Retain all exact U1-scoped commands above. After fresh Plan Approval verify the existing baseline first; a nonexistent new test file is not readiness evidence. Preserve Node24/npm11, test-after ordering, strict checks and 80% production floors.

After the harness/test file exists and supported PostgreSQL tools are available on PATH or explicitly located by the harness, run:

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test tests/database/current-role-migration.test.ts
```

This file owns supported-schema actual PostgreSQL conversion, identity/version/repeat, negative preflight, rollback, two-connection writer exclusion, RLS and conversion-evidence checks from repair Steps 18–19. Use invented UUIDs/business rows, a private disposable socket, deadlines and finally cleanup; no deployment credentials or existing connection strings. Missing binaries or failing checks must fail, never skip. Record actual versions and scenario results. Existing Access transaction/final-admin tests remain authoritative for the application's current writer; no production writer is introduced.

Dependency scanning is an integrated quality gate rather than a scoped unit test command. Record current npm audit results after dependency repair. Include new executable verification code in the complete production inventory and preserve all 80% thresholds. Preserve local-only next-env.d.ts and verify nonincremental typecheck does not change ignored TypeScript cache. Final broad app/browser/performance/security/coverage execution remains Build and Test.
