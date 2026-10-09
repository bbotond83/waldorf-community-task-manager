# Cross-Unit Traceability

## Verdict

PASS: 54/54 exact upstream FR/NFR/three-segment AC IDs have an OK mapping to an existing file. This is implemented coverage; execution acceptance is independent in the target matrix.

## Per-ID Coverage

| ID | Owning stage/unit | Existing target | Status |
|---|---|---|---|
| FR1 | code-generation/u3-retained-workflows-cleanup | scripts/verification/core.ts | OK |
| FR2 | code-generation/u3-retained-workflows-cleanup | verification/AUTHORIZATION.md | OK |
| FR3 | code-generation/u3-retained-workflows-cleanup | tests/integration/retained-workflows.test.ts | OK |
| FR4 | code-generation/u3-retained-workflows-cleanup | src/admin-experience/admin-service.test.ts | OK |
| FR5 | code-generation/u3-retained-workflows-cleanup | tests/integration/retained-workflows.test.ts | OK |
| FR6 | code-generation/u2-teacher-tracking | src/application/teacher-facade.test.ts | OK |
| FR7 | code-generation/u2-teacher-tracking | src/teacher-web/synthetic-teacher-repository.test.ts | OK |
| FR8 | code-generation/u2-teacher-tracking | tests/integration/teacher-boundaries.test.ts | OK |
| FR9 | code-generation/u2-teacher-tracking | src/teacher-tracking/tracking-model.test.ts | OK |
| FR10 | code-generation/u1-current-role-foundation | tests/database/current-role-migration.test.ts | OK |
| FR11 | code-generation/u3-retained-workflows-cleanup | tests/integration/retained-workflows.test.ts | OK |
| FR12 | code-generation/u3-retained-workflows-cleanup | src/application/admin-facade.test.ts | OK |
| FR13 | code-generation/u3-retained-workflows-cleanup | tests/coverage/verification-entrypoints.test.ts | OK |
| FR14 | code-generation/u3-retained-workflows-cleanup | tests/unit/current-role-references.test.ts | OK |
| FR15 | code-generation/u3-retained-workflows-cleanup | src/import-migration/import-service.test.ts | OK |
| NFR1 | code-generation/u3-retained-workflows-cleanup | src/application/admin-facade.test.ts | OK |
| NFR2 | code-generation/u3-retained-workflows-cleanup | tests/coverage/verification-entrypoints.test.ts | OK |
| NFR3 | code-generation/u3-retained-workflows-cleanup | tests/browser/admin-advanced.spec.ts | OK |
| AC1.1.1 | code-generation/u1-current-role-foundation | tests/unit/current-role-session.test.ts | OK |
| AC1.1.2 | code-generation/u2-teacher-tracking | tests/coverage/teacher-pages.test.tsx | OK |
| AC1.1.3 | code-generation/u1-current-role-foundation | tests/unit/current-role-session.test.ts | OK |
| AC1.1.4 | code-generation/u1-current-role-foundation | tests/unit/current-role-session.test.ts | OK |
| AC2.1.1 | code-generation/u2-teacher-tracking | tests/browser/teacher-web.spec.ts | OK |
| AC2.1.2 | code-generation/u2-teacher-tracking | tests/integration/teacher-components.test.tsx | OK |
| AC2.1.3 | code-generation/u2-teacher-tracking | src/application/teacher-facade.test.ts | OK |
| AC2.1.4 | code-generation/u2-teacher-tracking | src/teacher-tracking/tracking-model.test.ts | OK |
| AC2.1.5 | code-generation/u2-teacher-tracking | src/teacher-web/synthetic-teacher-repository.test.ts | OK |
| AC2.1.6 | code-generation/u2-teacher-tracking | tests/browser/teacher-web.spec.ts | OK |
| AC2.2.1 | code-generation/u2-teacher-tracking | tests/integration/teacher-boundaries.test.ts | OK |
| AC2.2.2 | code-generation/u1-current-role-foundation | src/application/authorization.test.ts | OK |
| AC2.2.3 | code-generation/u1-current-role-foundation | src/application/authorization.test.ts | OK |
| AC2.2.4 | code-generation/u1-current-role-foundation | src/application/authorization.test.ts | OK |
| AC3.1.1 | code-generation/u1-current-role-foundation | src/access/legacy-role-conversion.test.ts | OK |
| AC3.1.2 | code-generation/u1-current-role-foundation | src/access/legacy-role-conversion.test.ts | OK |
| AC3.1.3 | code-generation/u1-current-role-foundation | src/access/legacy-role-conversion.test.ts | OK |
| AC3.1.4 | code-generation/u1-current-role-foundation | src/access/legacy-role-conversion.test.ts | OK |
| AC3.2.1 | code-generation/u1-current-role-foundation | src/access/legacy-role-conversion.test.ts | OK |
| AC3.2.2 | code-generation/u1-current-role-foundation | src/access/legacy-role-conversion.test.ts | OK |
| AC3.2.3 | code-generation/u1-current-role-foundation | src/access/legacy-role-conversion.test.ts | OK |
| AC3.2.4 | code-generation/u1-current-role-foundation | src/access/legacy-role-conversion.test.ts | OK |
| AC3.3.1 | code-generation/u1-current-role-foundation | tests/unit/current-role-session.test.ts | OK |
| AC3.3.2 | code-generation/u1-current-role-foundation | tests/unit/current-role-session.test.ts | OK |
| AC3.3.3 | code-generation/u1-current-role-foundation | tests/unit/current-role-session.test.ts | OK |
| AC3.3.4 | code-generation/u1-current-role-foundation | tests/unit/current-role-session.test.ts | OK |
| AC4.1.1 | code-generation/u3-retained-workflows-cleanup | tests/integration/retained-workflows.test.ts | OK |
| AC4.1.2 | code-generation/u3-retained-workflows-cleanup | src/application/admin-facade.test.ts | OK |
| AC4.1.3 | code-generation/u3-retained-workflows-cleanup | tests/integration/retained-workflows.test.ts | OK |
| AC4.1.4 | code-generation/u3-retained-workflows-cleanup | src/application/admin-facade.test.ts | OK |
| AC4.1.5 | code-generation/u1-current-role-foundation | src/application/authorization.test.ts | OK |
| AC4.2.1 | code-generation/u3-retained-workflows-cleanup | tests/unit/current-role-references.test.ts | OK |
| AC4.2.2 | code-generation/u3-retained-workflows-cleanup | src/import-migration/import-service.test.ts | OK |
| AC4.2.3 | code-generation/u3-retained-workflows-cleanup | tests/integration/retained-workflows.test.ts | OK |
| AC4.2.4 | code-generation/u3-retained-workflows-cleanup | tests/unit/current-role-references.test.ts | OK |
| AC4.2.5 | code-generation/u1-current-role-foundation | src/access/legacy-role-conversion.test.ts | OK |

## Uncovered Elements

None.
