# Build and Test Summary: Functional test fixes

## Overall status

Build ready, test ready. Every build, static check, unit, component, coverage, browser, accessibility, login-performance, start-smoke and security command passed on Node 24 and npm 11 (details in `test-results.md`). Deployment is out of scope here and the team's rules keep executable deployment workflows disabled until a deployable app and linked target exist.

## Test type inventory

Minimal test strategy with the bugfix floor. New test files: `src/parent-web/notification-context.test.ts`, `tests/integration/mark-notification-read.test.tsx`, `tests/coverage/parent-functional-fixes.test.tsx`, `tests/coverage/admin-functional-fixes.test.tsx`, `tests/browser/functional-fixes.spec.ts`; about 15 existing test files updated (listed in `code-summary.md`). Instruction files: `build-instructions.md`, `integration-test-instructions.md` (browser journeys and accessibility), `performance-test-instructions.md` (login timing regression only), `security-test-instructions.md`.

## Coverage expectations

Repository-wide at least 80% lines, branches and functions. Actual: 95.44% lines, 85.5% branches, 94.27% functions.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| T1-coverage-lines | team.md Testing Posture; Testing Contract | at least 80% lines | 95.44% | `npm run test:coverage` exit 0 | build-and-test | Met |
| T2-coverage-branches | team.md Testing Posture | at least 80% branches | 85.5% | `npm run test:coverage` | build-and-test | Met |
| T3-coverage-functions | team.md Testing Posture | at least 80% functions | 94.27% | `npm run test:coverage` | build-and-test | Met |
| T4-existing-suite-green | Testing Contract scope floor (bugfix) | existing suite passes | 246 Node + 491 Vitest tests, 9 role-migration tests, 278 browser tests (1 by-design skip), 8 login-performance tests, 0 failures | `npm test`, `test:database:roles`, `test:browser`, `test:login-performance` | build-and-test | Met |
| T5-targeted-regressions | Testing Contract scope floor (bugfix) | a regression per fix | menu stays on Értesítések, opening marks read, read card greyed, Értesítések first, admin back links, per-list filters, pending request notice and no duplicate, no test copies or technical text on normal screens, empty-form messages each have a test | `tests/browser/functional-fixes.spec.ts`, `tests/coverage/parent-functional-fixes.test.tsx`, `tests/coverage/admin-functional-fixes.test.tsx`, `src/parent-web/notification-context.test.ts`, `tests/integration/mark-notification-read.test.tsx` | build-and-test | Met |
| T6-NFR1-contrast | requirements.md NFR1 | text at least 4.5:1, UI and focus at least 3:1 | design-tokens test passes, including the read-card colours | `tests/unit/design-tokens.test.ts` in `npm test` | build-and-test | Met |
| T7-NFR1-axe | team.md critical browser flow; NFR1 | no serious or critical axe violations | 0 on chromium, firefox, mobile-chrome | `npm run test:browser` (`@a11y` tests) | build-and-test | Met |
| T8-FR2.1-read-on-open | requirements.md FR2.1, FR2.3 | opening marks read; foreign or unknown ids are ignored | passes in unit, page-render and browser tests | `src/parent-web/notification-context.test.ts`, `tests/browser/functional-fixes.spec.ts` | build-and-test | Met |
| T9-FR6.2-filters | requirements.md FR6.1, FR6.2 | every offered filter value valid for its list; every demo status offered | passes | `tests/coverage/admin-functional-fixes.test.tsx` | build-and-test | Met |
| T10-NFR3-layout | requirements.md NFR3 | 44 px targets, no horizontal overflow from 320 px | passes on the changed screens | `tests/browser/functional-fixes.spec.ts` on all projects | build-and-test | Met |
| T11-NFR4-gates | team.md; requirements.md NFR4 | type check, lint, format, tests, build, start smoke pass | all exit 0 | `test-results.md` | build-and-test | Met |
| T12-dependency-scan | project.md; team.md | no high or critical findings | 0 vulnerabilities | `npm audit --audit-level=high` in `verify:security` | build-and-test | Met |
| T13-secret-and-SAST | team.md Code Style | no high or critical SAST, no secrets | pass | `SECRETS_SCAN_PASS`, `SAST_SCAN_PASS` | build-and-test | Met |
| T14-provisioned-integrations | team.md Testing Posture | provisioned integrations exercised against real targets | no integration was provisioned or changed by this work | n/a | build-and-test | N/A |

## Readiness

Build-ready: yes. Test-ready: yes. Deployment-ready: not assessed (out of scope).

## Known limitations and open items

- All changes are uncommitted on `feature/functional-test-fixes`; nothing is merged yet.
- `playwright.login-existing.config.ts` (an already running server on port 3000, Chrome channel) was not run.
- The fixed screens have not been looked at by the person in a browser; the checks are automated plus the earlier tester walkthrough.
- Accepted minor review notes from Code Generation: the test-copy switch has no `NODE_ENV` guard (R-01); the mark-read action does not check ownership beyond the single synthetic actor, to be enforced in the port when real parents replace it (R-02); field-level error association depends on every admin form using `AdminTextField` (R-03); the greyed card's contrast ratio is not written down (R-04).
- The admin demo item `approval-mobile` ("Mobil felületen elbírálandó kérelem") is test-isolation data still visible in the approvals list.
- The admin synthetic state may have the same module-instance reset problem that was fixed for the parent state; not checked.
