# Cross-Unit Traceability: Worker local-only guard

**Verdict:** PASS (zero-Unit run; every row is owned by the stage-level Code Generation).

| ID | Target | Covered |
|---|---|---|
| FR1.1 | `scripts/db/worker.ts` | yes |
| FR1.2 | `scripts/db/tooling.test.ts` | yes |
| FR1.3 | `scripts/db/local-guard.ts` | yes |
| FR1.4 | `tests/database/worker.test.ts` | yes |
| FR2 | `scripts/db/tooling.test.ts` | yes |
| FR3 | `scripts/db/local-guard.test.ts` | yes |
| FR4 | `README.md` | yes |
| FR5 | `follow-ups/minor-findings-plan.md` (B5 entry) | yes |
| NFR1 | `scripts/db/local-guard.test.ts` | yes |
| NFR2 | `tests/database/worker.test.ts` | yes |
| NFR3 | the check runs in `test-results.md` (type check, lint, format, coverage) | yes |

Uncovered elements: none.
