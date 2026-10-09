# Build and Test Summary: Admin and schedule list polish

## Overall status

Build ready, test ready. Every build, static check, unit, component, coverage, browser, accessibility, login-performance, start-smoke and security command passed on Node 24 and npm 11 (details in `test-results.md`). Deployment is out of scope here and the team's rules keep executable deployment workflows disabled until a deployable app and linked target exist.

## Test type inventory

Minimal test strategy with the bugfix floor. New test files: `src/application/status-symbols.test.ts`, `tests/unit/teacher-schedule.test.ts`, `tests/integration/status-badge.test.tsx`, `tests/integration/filter-clear-link.test.tsx`, `tests/browser/list-polish.spec.ts`; about 16 existing test files updated (listed in `code-summary.md`). Instruction files: `build-instructions.md`, `integration-test-instructions.md` (browser and accessibility), `performance-test-instructions.md` (login timing regression only), `security-test-instructions.md`.

## Coverage expectations

Repository-wide at least 80% lines, branches and functions. Actual (delivery project): 95.6% lines, 86.15% branches, 94.49% functions.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| T1-coverage-lines | team.md Testing Posture; Testing Contract | at least 80% lines | 95.6% | `npm run test:coverage` exit 0 | build-and-test | Met |
| T2-coverage-branches | team.md Testing Posture | at least 80% branches | 86.15% | `npm run test:coverage` | build-and-test | Met |
| T3-coverage-functions | team.md Testing Posture | at least 80% functions | 94.49% | `npm run test:coverage` | build-and-test | Met |
| T4-existing-suite-green | Testing Contract scope floor (bugfix) | existing suite passes | 258 Node + 531 Vitest tests, 9 role-migration tests, 383 browser tests (1 by-design skip), 8 login-performance tests, 0 failures | `npm test`, `test:database:roles`, `test:browser`, `test:login-performance` | build-and-test | Met |
| T5-targeted-regressions | Testing Contract scope floor (bugfix) | a regression per fix | clear empties every field (teacher and three admin lists), label above field, both create buttons, "elem" wording, a symbol before every status word each have a test | `tests/browser/list-polish.spec.ts`, `tests/integration/filter-clear-link.test.tsx`, `tests/integration/status-badge.test.tsx`, `src/application/status-symbols.test.ts`, `tests/unit/teacher-schedule.test.ts`, `tests/coverage/admin-pages.test.tsx` | build-and-test | Met |
| T6-NFR1-contrast | requirements.md NFR1 | text at least 4.5:1, icons and controls at least 3:1 | design-tokens test passes, including the icon tones on card surfaces | `tests/unit/design-tokens.test.ts` in `npm test` | build-and-test | Met |
| T7-NFR1-axe | team.md critical browser flow; NFR1 | no serious or critical axe violations | 0 on chromium, firefox, mobile-chrome | `npm run test:browser` (`@a11y` tests) | build-and-test | Met |
| T8-FR4.2-symbol-table | requirements.md FR4.2 | every status label has a symbol | passes; no emoji-presentation character in the dropdown set | `src/application/status-symbols.test.ts` in `npm test` | build-and-test | Met |
| T9-FR1-clear | requirements.md FR1.1 to FR1.5 | "Szűrők törlése" empties every field and shows the unfiltered list | passes in component and browser tests incl. unsubmitted and address-supplied values and Back | `tests/browser/list-polish.spec.ts`, `tests/integration/filter-clear-link.test.tsx` | build-and-test | Met |
| T10-NFR3-layout | requirements.md NFR3; FR2 | labels above fields, 44 px targets, no horizontal overflow from 320 px | passes on the listed filters and create forms | `tests/browser/list-polish.spec.ts` on all projects | build-and-test | Met |
| T11-FR3.4-wording | requirements.md FR3.4 | no user-facing "rekord" left | search finds only two negative assertions | `rekord` search in `test-results.md` | build-and-test | Met |
| T12-NFR4-gates | team.md; requirements.md NFR4 | type check, lint, format, tests, build, start smoke pass | all exit 0 | `test-results.md` | build-and-test | Met |
| T13-dependency-scan | project.md; team.md | no high or critical findings | 0 vulnerabilities | `npm audit --audit-level=high` in `verify:security` | build-and-test | Met |
| T14-secret-and-SAST | team.md Code Style | no high or critical SAST, no secrets | pass | `SECRETS_SCAN_PASS`, `SAST_SCAN_PASS` | build-and-test | Met |
| T15-provisioned-integrations | team.md Testing Posture | provisioned integrations exercised against real targets | no integration was provisioned or changed by this work | n/a | build-and-test | N/A |

## Readiness

Build-ready: yes. Test-ready: yes. Deployment-ready: not assessed (out of scope).

## Known limitations and open items

- All changes are uncommitted on `feature/admin-list-polish`; nothing is merged yet.
- `playwright.login-existing.config.ts` (an already running server on port 3000, Chrome channel) was not run.
- The changed screens have not been looked at by the person in a browser; the checks are automated.
- Dropdown glyphs were checked on desktop chromium, firefox and the mobile emulation only, not on a real Android or older iOS device; screen readers may read the glyphs in option text oddly (review note R-02).
- Accepted minor review notes from Code Generation: one failing group hides the other groups in the all-groups teacher list, and groups are read one after another (R-01); the label-above browser check tolerates a 1 px overlap (R-03).
- The first visit of the teacher schedule is now unfiltered (all granted groups, no date limit), replacing the old default window; the teacher's "Ütemezett" now reads "Ütemezve".
- Demo wording noted by the scan but out of scope: "Tesztprofil váltása", "kitalált", "Szimulált szolgáltató", "OUTSTANDING", the `?scenario=` selector on the swap and cancel pages.
