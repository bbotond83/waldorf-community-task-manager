# Cross-Unit Traceability

Verdict: pass. Every functional requirement is built by a unit and covered by a check. The non-functional requirements NFR1 to NFR6 are cross-cutting, not built by one unit; the traceability sensor lists them as uncovered by unit, and this stage covers them in the Target Verification Matrix of `build-and-test-summary.md`, each Met.

## Functional requirements

| ID | Owning unit | Target |
|---|---|---|
| FR1.1, FR1.2 | u1-foundation-slice | `app/layout.tsx` |
| FR1.3, FR1.4 | u1-foundation-slice | `tests/unit/fonts.test.ts` |
| FR2.1, FR2.3 | u1-foundation-slice | `app/globals.css` |
| FR2.2 | u1-foundation-slice | `tests/unit/design-tokens.test.ts` |
| FR2.4, FR3.1 | u1-foundation-slice | `tests/browser/sign-in-typography.spec.ts` |
| FR3.2 | u2-parent-task-list | `app/globals.css` |
| FR3.3 | u3-task-details-signup | `app/globals.css` |
| FR3.4 | u4-cancellation | `app/globals.css` |
| FR3.5 | u2-parent-task-list | `tests/browser/parent-list-style.spec.ts` |
| FR3.6 | u5-approval-screens | `app/globals.css` |
| FR4.1, FR6.1 | u1-foundation-slice | `tests/unit/css-lint.test.ts` |
| FR5.1 to FR5.6 | u1 to u5 | the per-unit style specs (sign-in typography, parent list, parent detail, parent cancellation, teacher, admin approvals) |
| FR6.2 | u1-foundation-slice | `tests/unit/dependency-pins.test.ts` |
| FR6.3 | u1-foundation-slice | `DESIGN.md` |

## Non-functional requirements (covered at stage level)

| ID | Covered by | Verdict |
|---|---|---|
| NFR1 | `@a11y` scans in the full browser run | Met |
| NFR2 | size assertions in the per-unit style specs | Met |
| NFR3 | 320 px and 44rem assertions in the per-unit style specs | Met |
| NFR4 | `tests/unit/fonts.test.ts`, `sign-in-typography.spec.ts` | Met |
| NFR5 | the full gate run in `test-results.md` | Met |
| NFR6 | five owner-approved unit checkpoints | Met |

Uncovered elements: none.
