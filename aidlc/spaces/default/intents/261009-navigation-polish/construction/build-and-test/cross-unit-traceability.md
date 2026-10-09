# Cross-Unit Traceability: Visual overhaul, second round

## Verdict

PASS. Zero-Unit work: every `FR` and `NFR` ID in `inception/requirements-analysis/requirements.md` (38 IDs: FR1.1 to FR7.4 including FR3.3a, FR3.3b and FR6.4a, and NFR1 to NFR6) appears in `construction/code-generation/traceability.json` with status `OK`, and every target file exists in the workspace (checked by listing each distinct target). No user-stories stage ran, so no `AC` IDs apply.

## Per-ID coverage

Owner is the stage-level Code Generation (no Units).

| ID | Target (from `traceability.json`) | Exists |
|---|---|---|
| FR1.1 | `app/admin/_components/ResponsiveCollection.tsx` | yes |
| FR1.2 | `app/teacher/schedule/_components/ScheduleCollection.tsx` | yes |
| FR1.3 | `app/szulo/ertesitesek/page.tsx` | yes |
| FR1.4 | `tests/browser/navigation-polish.spec.ts` | yes |
| FR1.5 | `tests/coverage/parent-pages.test.tsx` | yes |
| FR2.1 | `src/application/status-labels.ts` | yes |
| FR2.2 | `src/application/status-labels.test.ts` | yes |
| FR2.3 | `app/admin/_components/AdminFilterBar.tsx` | yes |
| FR2.4 | `src/application/status-labels.test.ts` | yes |
| FR3.1 | `app/szulo/ertesitesek/page.tsx` | yes |
| FR3.2 | `app/szulo/_components/NotificationReadForm.tsx` | yes |
| FR3.3 | `tests/integration/notification-read-form.test.tsx` | yes |
| FR3.3a | `tests/integration/notification-read-form.test.tsx` | yes |
| FR3.3b | `app/szulo/_components/NotificationReadForm.tsx` | yes |
| FR3.4 | `app/globals.css` | yes |
| FR3.5 | `tests/integration/notification-read-form.test.tsx` | yes |
| FR4.1 | `tests/browser/navigation-polish.spec.ts` | yes |
| FR4.2 | `app/globals.css` | yes |
| FR5.1 | `src/runtime/AppNav.tsx` | yes |
| FR5.2 | `tests/integration/app-nav.test.tsx` | yes |
| FR5.3 | `tests/browser/navigation-polish.spec.ts` | yes |
| FR6.1 | `app/api/synthetic/session/route.ts` | yes |
| FR6.2 | `app/page.tsx` | yes |
| FR6.3 | `src/runtime/AppShell.tsx` | yes |
| FR6.4 | `app/belepes/actions.ts` | yes |
| FR6.4a | `src/runtime/synthetic/profiles.ts` | yes |
| FR6.5 | `src/runtime/BackToHomeLink.tsx` | yes |
| FR6.6 | `tests/coverage/app-entrypoints.test.tsx` | yes |
| FR7.1 | `src/runtime/synthetic/profiles.ts` | yes |
| FR7.2 | `tests/browser/navigation-polish.spec.ts` | yes |
| FR7.3 | `app/admin/_lib/session.ts` | yes |
| FR7.4 | `tests/unit/navigation-access.test.ts` | yes |
| NFR1 | `tests/unit/design-tokens.test.ts` | yes |
| NFR2 | `app/globals.css` | yes |
| NFR3 | `tests/browser/navigation-polish.spec.ts` | yes |
| NFR4 | `tests/coverage/production-inventory.test.ts` | yes |
| NFR5 | `tests/integration/synthetic-route.test.ts` | yes |
| NFR6 | `HASZNALATI_UTMUTATO_HU.md` | yes |

## Uncovered elements

None.

## Findings to weigh

- Coarse targets: a few IDs point at a single representative file (for example NFR4 at the production file count test and NFR6 at the Hungarian user guide); the Target Verification Matrix in `build-and-test-summary.md` cites the real checks for each target. This does not change the pass verdict.
