# Cross-Unit Traceability: Password reset clears the lockout

**Verdict:** PASS. Source: `aidlc engine sensor-traceability --stage build-and-test` (pass: true, no uncovered IDs). Zero-Unit run, so every row is owned by the stage-level Code Generation.

| ID | Owning stage | Target | Covered |
|---|---|---|---|
| FR1.1 | code-generation | `src/identity/reset.ts` | yes |
| FR1.2 | code-generation | `src/identity/reset.test.ts` | yes |
| FR1.3 | code-generation | `src/identity/reset.test.ts` | yes |
| FR2.1 | code-generation | `src/identity/reset.test.ts` | yes |
| FR2.2 | code-generation | `src/identity/reset.test.ts` | yes |
| FR2.3 | code-generation | `src/identity/reset.test.ts` | yes |
| FR3 | code-generation | `follow-ups/minor-findings-plan.md` (B2 entry) | yes |
| NFR1 | code-generation | `src/identity/reset.test.ts` | yes |
| NFR2 | code-generation | `src/identity/reset.ts` | yes |
| NFR3 | code-generation | `src/identity/reset.test.ts` | yes |
| NFR4 | build-and-test | the check runs listed in `test-results.md` (type check, lint, format, coverage) | yes (evidence in this stage; the code-generation row points at the unit test file) |

Uncovered elements: none.
