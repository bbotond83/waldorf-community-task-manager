# Cross-Unit Traceability

## Verdict

FAIL: 48/54 exact requirement/acceptance IDs have at least one current OK entry with an existing target file.

## Coverage

| ID | Status | Owning Unit | Target |
| --- | --- | --- | --- |
| AC1.1.1 | OK | u1-current-role-foundation | tests/unit/current-role-session.test.ts |
| AC1.1.2 | OK | u2-teacher-tracking | tests/coverage/teacher-pages.test.tsx |
| AC1.1.3 | OK | u1-current-role-foundation | tests/unit/current-role-session.test.ts |
| AC1.1.4 | OK | u1-current-role-foundation | tests/unit/current-role-session.test.ts |
| AC2.1.1 | OK | u2-teacher-tracking | tests/browser/teacher-web.spec.ts |
| AC2.1.2 | OK | u2-teacher-tracking | tests/integration/teacher-components.test.tsx |
| AC2.1.3 | OK | u2-teacher-tracking | src/application/teacher-facade.test.ts |
| AC2.1.4 | OK | u2-teacher-tracking | src/teacher-tracking/tracking-model.test.ts |
| AC2.1.5 | OK | u2-teacher-tracking | src/teacher-web/synthetic-teacher-repository.test.ts |
| AC2.1.6 | OK | u2-teacher-tracking | tests/browser/teacher-web.spec.ts |
| AC2.2.1 | OK | u2-teacher-tracking | tests/integration/teacher-boundaries.test.ts |
| AC2.2.2 | OK | u1-current-role-foundation | src/application/authorization.test.ts |
| AC2.2.3 | OK | u1-current-role-foundation | src/application/authorization.test.ts |
| AC2.2.4 | OK | u1-current-role-foundation | src/application/authorization.test.ts |
| AC3.1.1 | OK | u1-current-role-foundation | src/access/legacy-role-conversion.test.ts |
| AC3.1.2 | OK | u1-current-role-foundation | src/access/legacy-role-conversion.test.ts |
| AC3.1.3 | OK | u1-current-role-foundation | src/access/legacy-role-conversion.test.ts |
| AC3.1.4 | OK | u1-current-role-foundation | src/access/legacy-role-conversion.test.ts |
| AC3.2.1 | OK | u1-current-role-foundation | src/access/legacy-role-conversion.test.ts |
| AC3.2.2 | OK | u1-current-role-foundation | src/access/legacy-role-conversion.test.ts |
| AC3.2.3 | OK | u1-current-role-foundation | src/access/legacy-role-conversion.test.ts |
| AC3.2.4 | OK | u1-current-role-foundation | src/access/legacy-role-conversion.test.ts |
| AC3.3.1 | OK | u1-current-role-foundation | tests/unit/current-role-session.test.ts |
| AC3.3.2 | OK | u1-current-role-foundation | tests/unit/current-role-session.test.ts |
| AC3.3.3 | OK | u1-current-role-foundation | tests/unit/current-role-session.test.ts |
| AC3.3.4 | OK | u1-current-role-foundation | tests/unit/current-role-session.test.ts |
| AC4.1.1 | OK | u3-retained-workflows-cleanup | tests/integration/retained-workflows.test.ts |
| AC4.1.2 | OK | u3-retained-workflows-cleanup | src/application/admin-facade.test.ts |
| AC4.1.3 | OK | u3-retained-workflows-cleanup | tests/integration/retained-workflows.test.ts |
| AC4.1.4 | OK | u3-retained-workflows-cleanup | src/application/admin-facade.test.ts |
| AC4.1.5 | OK | u1-current-role-foundation | src/application/authorization.test.ts |
| AC4.2.1 | OK | u3-retained-workflows-cleanup | tests/unit/current-role-references.test.ts |
| AC4.2.2 | OK | u3-retained-workflows-cleanup | src/import-migration/import-service.test.ts |
| AC4.2.3 | OK | u3-retained-workflows-cleanup | tests/integration/retained-workflows.test.ts |
| AC4.2.4 | OK | u3-retained-workflows-cleanup | tests/unit/current-role-references.test.ts |
| AC4.2.5 | OK | u1-current-role-foundation | src/access/legacy-role-conversion.test.ts |
| FR1 | OK | u3-retained-workflows-cleanup | scripts/verification/core.ts |
| FR10 | Uncovered | — | No exact entry |
| FR11 | OK | u3-retained-workflows-cleanup | tests/integration/retained-workflows.test.ts |
| FR12 | OK | u3-retained-workflows-cleanup | src/application/admin-facade.test.ts |
| FR13 | OK | u3-retained-workflows-cleanup | tests/coverage/verification-entrypoints.test.ts |
| FR14 | OK | u3-retained-workflows-cleanup | tests/unit/current-role-references.test.ts |
| FR15 | OK | u3-retained-workflows-cleanup | src/import-migration/import-service.test.ts |
| FR2 | OK | u3-retained-workflows-cleanup | verification/AUTHORIZATION.md |
| FR3 | OK | u3-retained-workflows-cleanup | tests/integration/retained-workflows.test.ts |
| FR4 | OK | u3-retained-workflows-cleanup | src/admin-experience/admin-service.test.ts |
| FR5 | OK | u3-retained-workflows-cleanup | tests/integration/retained-workflows.test.ts |
| FR6 | Uncovered | — | No exact entry |
| FR7 | Uncovered | — | No exact entry |
| FR8 | Uncovered | — | No exact entry |
| FR9 | Uncovered | — | No exact entry |
| NFR1 | OK | u3-retained-workflows-cleanup | src/application/admin-facade.test.ts |
| NFR2 | Uncovered | — | Deferred: Prior scoped domain/delivery tests, conductor production build/typecheck, retained B1 browser72 and B2 accessibility9 passed across all configured browsers with zero serious/critical Axe violations. These are historical implementation evidence, not current redo execution. Current conductor review/checkpoint and integrated full-production80% line/branch/function coverage, lint/format/start/security gates remain outstanding. Real target DB/RLS is unlinked. |
| NFR3 | OK | u3-retained-workflows-cleanup | tests/browser/admin-advanced.spec.ts |

## Uncovered Elements

FR10, FR6, FR7, FR8, FR9, NFR2

Detailed child NFR IDs do not substitute for the aggregate requirement ID. Other stage traceability does not substitute for Code Generation coverage.
