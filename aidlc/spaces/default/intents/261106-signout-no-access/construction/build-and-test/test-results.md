# Test Results

Date: 2026-11-06. Commit under test: working tree on top of `1672d98` (nothing committed).

## Build

- `npm run build`: success (exit 0) with the local stack settings in the environment.
- `npm run typecheck`: success (exit 0).

## Static checks

- `npm run lint` (ESLint, 0 warnings allowed): pass.
- `npm run format:check` (Prettier): pass.
- `npm run lint:css` (Stylelint): pass.

## Tests

| Suite | Command | Result |
| --- | --- | --- |
| Domain | `npm run test:domain` (part of `npm test`) | pass |
| Scripts | `npm run test:scripts` (part of `npm test`) | pass |
| Delivery (Vitest) | `npm run test:delivery` | 63 files, 901 tests passed, 0 failed, 0 skipped |
| Browser, Chromium | `VERIFY_BROWSER_PROJECTS=chromium npx playwright test tests/browser/no-access.spec.ts` | 2 passed |

## Failure found and fixed in this stage

The first full `npm test` run failed one delivery test (`tests/unit/browser-harness.test.ts`: "no-access.spec.ts empties and seeds its project's schema through the helper"). Cause: the new browser spec did not call `bindSeededSchema()`. Fix: the spec now calls `bindSeededSchema({ seed: false })` (the page shows no records). After the fix: 901 of 901 passed. No threshold or test was weakened.

## Environment event

The local database stack was stopped by its own safety check because its ports were reachable from other devices on the network (it uses the Supabase CLI's well-known default keys). The owner told the assistant to run it with `DB_ALLOW_ALL_INTERFACES=1`. The browser spec was re-run on that stack (2 of 2 passed) and the stack was stopped again afterwards (`npm run db:stop`, data kept).

## Coverage

- Delivery (Vitest, Istanbul): statements 96.95%, branches 91.09%, functions 95.66%, lines 97.92% (floor 80/80/80).
- Domain (node test coverage): lines 99.39%, branches 94.32%, functions 97.30% (floor 80).

## Security checks

- `npm run scan:privacy`, `scan:secrets`, `scan:sast`, `verify:no-deploy`: all exit 0.
- `npm audit --audit-level=high`: exit 0; 8 moderate findings, none high or critical.

## Regression proof

Before the page change the new unit test failed (no `sign-out-button` in the page output). After the change it passes.

## Target Verification Matrix

See `build-and-test-summary.md`.

## Not executed

- Firefox and mobile-chrome browser projects, and the other existing browser specs (Chromium, new spec only). CI would run all three projects.
- Start smoke test (`npm run smoke:start`), and a sign-in with a seeded account or a real "no linked record" account.
