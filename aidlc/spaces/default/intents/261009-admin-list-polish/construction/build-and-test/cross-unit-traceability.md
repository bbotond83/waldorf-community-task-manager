# Cross-Unit Traceability: Admin and schedule list polish

## Verdict

PASS. Zero-Unit work: every `FR` and `NFR` ID in `inception/requirements-analysis/requirements.md` (28 IDs: FR1.1 to FR4.6 and NFR1 to NFR7) appears in `construction/code-generation/traceability.json` with status `OK`, and every target file exists in the workspace. No user-stories stage ran, so no `AC` IDs apply.

## Per-ID coverage

Owner is the stage-level Code Generation (no Units).

| ID | Target (from `traceability.json`) | Exists |
|---|---|---|
| FR1.1 | `app/teacher/_lib/filters.ts` | yes |
| FR1.2 | `src/teacher-web/synthetic-teacher-repository.ts` | yes |
| FR1.3 | `src/runtime/FilterClearLink.tsx` | yes |
| FR1.4 | `app/teacher/_components/TeacherStatePanel.tsx` | yes |
| FR1.5 | `app/admin/_components/AdminFilterBar.tsx` | yes |
| FR1.6 | `tests/integration/filter-clear-link.test.tsx` | yes |
| FR1.7 | `tests/unit/teacher-filters.test.ts` | yes |
| FR2.1 | `app/globals.css` | yes |
| FR2.2 | `tests/browser/list-polish.spec.ts` | yes |
| FR2.3 | `app/teacher/schedule/_components/ScheduleFilter.tsx` | yes |
| FR3.1 | `app/admin/nyilvantartasok/page.tsx` | yes |
| FR3.2 | `app/admin/feladatok/page.tsx` | yes |
| FR3.3 | `tests/browser/list-polish.spec.ts` | yes |
| FR3.4 | `app/admin/nyilvantartasok/uj/page.tsx` | yes |
| FR3.5 | `tests/coverage/admin-pages.test.tsx` | yes |
| FR4.1 | `src/runtime/StatusBadge.tsx` | yes |
| FR4.2 | `src/application/status-labels.ts` | yes |
| FR4.3 | `tests/integration/status-badge.test.tsx` | yes |
| FR4.4 | `tests/integration/admin-components.test.tsx` | yes |
| FR4.5 | `src/application/status-symbols.test.ts` | yes |
| FR4.6 | `app/teacher/schedule/_components/ScheduleCollection.tsx` | yes |
| NFR1 | `tests/unit/design-tokens.test.ts` | yes |
| NFR2 | `tests/integration/status-badge.test.tsx` | yes |
| NFR3 | `tests/browser/list-polish.spec.ts` | yes |
| NFR4 | `tests/coverage/production-inventory.test.ts` | yes |
| NFR5 | `tests/browser/list-polish.spec.ts` | yes |
| NFR6 | `tests/browser/teacher-web.spec.ts` | yes |
| NFR7 | `HASZNALATI_UTMUTATO_HU.md` | yes |

## Uncovered elements

None.

## Findings to weigh

- Coarse targets: a few IDs point at a single representative file (for example NFR4 at the production file count test and NFR7 at the Hungarian user guide); the Target Verification Matrix in `build-and-test-summary.md` cites the real checks for each target. This does not change the pass verdict.
