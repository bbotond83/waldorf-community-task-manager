# Build and Test Summary: Visual overhaul, second round

## Overall status

Build ready, test ready. Every build, static check, unit, component, coverage, browser, accessibility, login-performance, start-smoke and security command passed on Node 24 and npm 11 (details in `test-results.md`). Deployment is out of scope here and the team's rules keep executable deployment workflows disabled until a deployable app and linked target exist.

## Test type inventory

Minimal test strategy with the bugfix floor. Test files for this change: new `src/application/status-labels.test.ts`, `tests/unit/navigation-access.test.ts`, `tests/integration/app-nav.test.tsx`, `tests/integration/notification-read-form.test.tsx`, `tests/browser/navigation-polish.spec.ts`; about 25 existing tests and the profile-login helper updated (listed in `code-summary.md`). Instruction files: `build-instructions.md`, `integration-test-instructions.md` (browser and accessibility), `performance-test-instructions.md` (login timing regression only), `security-test-instructions.md`.

## Coverage expectations

Repository-wide at least 80% lines, branches and functions. Actual: 94.96% lines, 84.51% branches, 94.02% functions.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| T1-coverage-lines | team.md Testing Posture; Testing Contract | at least 80% lines | 94.96% | `npm run test:coverage` exit 0 | build-and-test | Met |
| T2-coverage-branches | team.md Testing Posture | at least 80% branches | 84.51% | `npm run test:coverage` | build-and-test | Met |
| T3-coverage-functions | team.md Testing Posture | at least 80% functions | 94.02% | `npm run test:coverage` | build-and-test | Met |
| T4-existing-suite-green | Testing Contract scope floor (bugfix) | existing suite passes | 232 Node + 431 Vitest tests, 9 role-migration tests, 209 browser tests (1 by-design skip), 8 login-performance tests, 0 failures | `npm test`, `test:database:roles`, `test:browser`, `test:login-performance` | build-and-test | Met |
| T5-targeted-regressions | Testing Contract scope floor (bugfix) | a regression per fix | whole-card items, Hungarian status words, default landing pages, one menu per profile, notification checkbox and focus, no focus ring on headings each have a test | `tests/integration/admin-components.test.tsx`, `src/application/status-labels.test.ts`, `tests/unit/navigation-access.test.ts`, `tests/integration/app-nav.test.tsx`, `tests/integration/notification-read-form.test.tsx`, `tests/browser/navigation-polish.spec.ts` | build-and-test | Met |
| T6-NFR1-contrast | requirements.md NFR1 | text at least 4.5:1, UI and focus at least 3:1 | design-tokens test passes, including the new menu button colours | `tests/unit/design-tokens.test.ts` in `npm test` | build-and-test | Met |
| T7-NFR1-axe | team.md critical browser flow; NFR1 | no serious or critical axe violations | 0 on the existing routes and the four new default pages on chromium, firefox, mobile-chrome | `npm run test:browser` (`@a11y` tests) | build-and-test | Met |
| T8-FR2.4-hungarian-status | requirements.md FR2.4 | every renderable status has a Hungarian label | all values labelled; unknown value returns "Ismeretlen állapot" | `src/application/status-labels.test.ts` in `npm test` | build-and-test | Met |
| T9-FR7.4-menu-access | requirements.md FR7.4; NFR5 | every menu link and default page is allowed for its role; no new access | passes; group admin menu excludes import, reminders, privacy, settings | `tests/unit/navigation-access.test.ts` in `npm test` | build-and-test | Met |
| T10-NFR3-layout | requirements.md NFR3 | 44 px targets, no horizontal overflow from 320 px | no overflow on the changed screens at 320 px | `tests/browser/navigation-polish.spec.ts` on all projects | build-and-test | Met |
| T11-NFR4-gates | team.md; requirements.md NFR4 | type check, lint, format, tests, build, start smoke pass | all exit 0 | `test-results.md` | build-and-test | Met |
| T12-dependency-scan | project.md; team.md | no high or critical findings | 0 vulnerabilities | `npm audit --audit-level=high` in `verify:security` | build-and-test | Met |
| T13-secret-and-SAST | team.md Code Style | no high or critical SAST, no secrets | pass | `SECRETS_SCAN_PASS`, `SAST_SCAN_PASS` | build-and-test | Met |
| T14-provisioned-integrations | team.md Testing Posture | provisioned integrations exercised against real targets | no integration was provisioned or changed by this work | n/a | build-and-test | N/A |

## Readiness

Build-ready: yes. Test-ready: yes. Deployment-ready: not assessed (out of scope).

## Known limitations and open items

- All changes are uncommitted on `feature/visual-overhaul-navigation`; nothing is merged yet.
- `playwright.login-existing.config.ts` (an already running server on port 3000, Chrome channel) was not run.
- The new menus, lists and notification cards have not been looked at by the person in a browser; the checks are automated.
- Minor accepted review notes: the removed "Kapcsolódó feladat" link in the notification success message, and a silent no-op if the notification card link were ever absent (cannot happen on the real page).
