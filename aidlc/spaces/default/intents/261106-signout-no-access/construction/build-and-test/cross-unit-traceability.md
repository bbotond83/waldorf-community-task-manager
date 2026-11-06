# Cross-Unit Traceability

Verdict: **pass**. Every requirement is built or tested; nothing is uncovered. This is a zero-Unit change, so every row is owned by the `code-generation` stage.

| ID | Covered | Owning stage | Target file |
| --- | --- | --- | --- |
| FR1.1 | yes | code-generation | `app/hozzaferes-megtagadva/page.tsx` |
| FR1.2 | yes | code-generation | `tests/browser/no-access.spec.ts` |
| FR2.1 | yes | code-generation | `tests/coverage/app-entrypoints.test.tsx` |
| FR3 | yes | code-generation | `tests/coverage/app-entrypoints.test.tsx` |
| FR4 | yes | code-generation | `tests/browser/no-access.spec.ts` |
| FR5 | yes | code-generation | `app/_identity/AccessStateExit.tsx` (unchanged) |
| NFR1 | yes | code-generation | `tests/browser/no-access.spec.ts` |
| NFR2 | yes | code-generation | `app/hozzaferes-megtagadva/page.tsx` |
| NFR3 | yes | code-generation | `tests/coverage/app-entrypoints.test.tsx` |
| NFR4 | yes | code-generation | `tests/coverage/app-entrypoints.test.tsx` |

Uncovered elements: none.

Note: FR1 and FR2 are parent requirements; the sensor tracks their sub-requirements FR1.1, FR1.2 and FR2.1.
