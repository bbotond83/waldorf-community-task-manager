# Build and Test Summary: Visual overhaul and UX fixes

## Overall status

Build ready, test ready. Every build, static check, unit, component, coverage, browser, accessibility, start-smoke and security command passed on Node 24 and npm 11 (details in `test-results.md`). Deployment is out of scope here and the team's rules keep executable deployment workflows disabled until a deployable app and linked target exist.

## Test type inventory

Minimal test strategy with the bugfix floor. Test files for this change: `tests/unit/design-tokens.test.ts`, `src/runtime/hyphenation.test.ts`, `tests/coverage/admin-dashboard.test.tsx`, `tests/browser/visual-overhaul.spec.ts`, plus updated `runtime-shell`, `app-entrypoints`, `parent-pages` and `production-inventory` tests and two browser support files. Instruction files: `build-instructions.md`, `integration-test-instructions.md` (browser and accessibility), `performance-test-instructions.md` (cover image weight only), `security-test-instructions.md`.

## Coverage expectations

Repository-wide at least 80% lines, branches and functions. Actual: 94.93% lines, 83.97% branches, 93.97% functions.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| T1-coverage-lines | team.md Testing Posture; Testing Contract | at least 80% lines | 94.93% | `npm run test:coverage` exit 0 | build-and-test | Met |
| T2-coverage-branches | team.md Testing Posture | at least 80% branches | 83.97% | `npm run test:coverage` | build-and-test | Met |
| T3-coverage-functions | team.md Testing Posture | at least 80% functions | 93.97% | `npm run test:coverage` | build-and-test | Met |
| T4-existing-suite-green | Testing Contract scope floor (bugfix) | existing suite passes | 386 Vitest tests, 9 role-migration tests, 132 browser tests, 0 failures | `npm test`, `test:database:roles`, `test:browser` | build-and-test | Met |
| T5-targeted-regressions | Testing Contract scope floor (bugfix) | a regression per fix | single-button chooser card, whole-card task link, clickable admin cards, role-name breaks, cover weight each have a test | `tests/integration/runtime-shell.test.tsx`, `tests/coverage/parent-pages.test.tsx`, `tests/coverage/admin-dashboard.test.tsx`, `src/runtime/hyphenation.test.ts`, `tests/browser/visual-overhaul.spec.ts` | build-and-test | Met |
| T6-NFR1-contrast | requirements.md NFR1 | text at least 4.5:1, UI and focus at least 3:1 | token test passes (text on background 13.9:1, muted 6.3:1, white on primary about 6.5:1, focus 7.7:1, control border 4.1:1) | `tests/unit/design-tokens.test.ts` in `npm test` | build-and-test | Met |
| T7-NFR1-axe | team.md critical browser flow; NFR1 | no serious or critical axe violations | 0 on `/`, `/szulo/feladatok`, `/teacher/schedule`, `/admin/nyilvantartasok`, `/admin/import` on chromium, firefox, mobile-chrome | `npm run test:browser` (`@a11y` tests) | build-and-test | Met |
| T8-NFR3-no-remote-fonts | requirements.md NFR3; CSP | no remote origin for fonts or images | no `@font-face`/remote URL; `proxy.ts` unchanged | `git diff --stat proxy.ts` empty; token test (no hex outside `:root`); SAST pass | build-and-test | Met |
| T9-NFR4-image-weight | requirements.md NFR4 (no numeric figure in the requirement) | cover resized for narrow screens; test limit 250 KB at 375 px | 104, 124 and 202 KB measured at widths 750, 828 and 1080 | `tests/browser/visual-overhaul.spec.ts` NFR4 test passes on all three projects; `code-summary.md` deviation note | build-and-test | Met |
| T10-NFR5-gates | team.md; requirements.md NFR5 | type check, lint, format, tests, build, start smoke pass | all exit 0 | `test-results.md` | build-and-test | Met |
| T11-dependency-scan | project.md; team.md | no high or critical findings | 0 vulnerabilities | `npm audit --audit-level=high` in `verify:security` | build-and-test | Met |
| T12-secret-and-SAST | team.md Code Style | no high or critical SAST, no secrets | pass | `SECRETS_SCAN_PASS`, `SAST_SCAN_PASS` | build-and-test | Met |
| T13-provisioned-integrations | team.md Testing Posture | provisioned integrations exercised against real targets | no integration was provisioned or changed by this work | n/a | build-and-test | N/A |

## Readiness

Build-ready: yes. Test-ready: yes. Deployment-ready: not assessed (out of scope).

## Known limitations and open items

- `public/brand/` is staged in git but not committed; the work must be committed together with those images for CI.
- The NFR4 number lives only in the browser test and `code-summary.md`; `requirements.md` NFR4 states no figure (review finding R-05 from Code Generation).
- `traceability.json` from Code Generation maps a few IDs to coarse targets (for example FR5.3 points to the user guide rather than the brand images); see `cross-unit-traceability.md`.
- `npm run test:login-performance` was not re-run and the admin overview and parent task list were not checked by eye.
