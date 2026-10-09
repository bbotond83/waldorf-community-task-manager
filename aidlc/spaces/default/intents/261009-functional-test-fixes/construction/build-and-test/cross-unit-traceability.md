# Cross-Unit Traceability: Functional test fixes

## Verdict

PASS. Zero-Unit work: every `FR` and `NFR` ID in `inception/requirements-analysis/requirements.md` (38 IDs: FR1.1 to FR9.2 and NFR1 to NFR7) appears in `construction/code-generation/traceability.json` with status `OK`, and every target file exists in the workspace. No user-stories stage ran, so no `AC` IDs apply.

## Per-ID coverage

Owner is the stage-level Code Generation (no Units).

| ID | Target (from `traceability.json`) | Exists |
|---|---|---|
| FR1.1 | `app/szulo/ertesitesek/page.tsx` | yes |
| FR1.2 | `app/szulo/feladatok/[id]/page.tsx` | yes |
| FR1.3 | `src/parent-web/notification-context.ts` | yes |
| FR2.1 | `app/szulo/_components/MarkNotificationRead.tsx` | yes |
| FR2.2 | `app/szulo/actions.ts` | yes |
| FR2.3 | `src/parent-web/notification-context.test.ts` | yes |
| FR2.4 | `tests/coverage/parent-functional-fixes.test.tsx` | yes |
| FR3.1 | `app/globals.css` | yes |
| FR3.2 | `app/szulo/ertesitesek/page.tsx` | yes |
| FR3.3 | `tests/unit/design-tokens.test.ts` | yes |
| FR4.1 | `src/runtime/synthetic/profiles.ts` | yes |
| FR4.2 | `tests/unit/runtime-boundaries.test.ts` | yes |
| FR5.1 | `app/admin/_components/AdminBackLink.tsx` | yes |
| FR5.2 | `app/admin/nyilvantartasok/uj/page.tsx` | yes |
| FR5.3 | `app/admin/_components/AdminMutationForm.tsx` | yes |
| FR5.4 | `app/admin/_components/AdminBackLink.tsx` | yes |
| FR6.1 | `app/admin/_components/AdminFilterBar.tsx` | yes |
| FR6.2 | `tests/coverage/admin-functional-fixes.test.tsx` | yes |
| FR6.3 | `app/admin/nyilvantartasok/page.tsx` | yes |
| FR6.4 | `src/application/status-labels.ts` | yes |
| FR7.1 | `app/szulo/_components/ParentMutationForm.tsx` | yes |
| FR7.2 | `app/szulo/_components/PendingRequestNotice.tsx` | yes |
| FR7.3 | `app/szulo/feladatok/[id]/csere/page.tsx` | yes |
| FR7.4 | `src/application/status-labels.ts` | yes |
| FR7.5 | `tests/coverage/parent-actions.test.ts` | yes |
| FR8.1 | `src/parent-web/synthetic-parent.ts` | yes |
| FR8.2 | `app/admin/_components/DeveloperDetails.tsx` | yes |
| FR8.3 | `app/admin/_components/DeveloperDetails.tsx` | yes |
| FR8.4 | `tests/browser/functional-fixes.spec.ts` | yes |
| FR9.1 | `app/admin/actions.ts` | yes |
| FR9.2 | `app/admin/_lib/action-state.ts` | yes |
| NFR1 | `tests/unit/design-tokens.test.ts` | yes |
| NFR2 | `tests/integration/app-nav.test.tsx` | yes |
| NFR3 | `tests/browser/functional-fixes.spec.ts` | yes |
| NFR4 | `tests/coverage/production-inventory.test.ts` | yes |
| NFR5 | `tests/browser/functional-fixes.spec.ts` | yes |
| NFR6 | `tests/browser/parent-web.spec.ts` | yes |
| NFR7 | `HASZNALATI_UTMUTATO_HU.md` | yes |

## Uncovered elements

None.

## Findings to weigh

- Coarse targets: a few IDs point at a single representative file (for example NFR4 at the production file count test and NFR7 at the Hungarian user guide); the Target Verification Matrix in `build-and-test-summary.md` cites the real checks for each target. This does not change the pass verdict.
