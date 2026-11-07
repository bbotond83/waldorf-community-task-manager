# Code summary: sign-out on the standalone "Nincs jogosultság" page

## Result

The standalone no-access page (`/hozzaferes-megtagadva`) now shows the existing Hungarian guidance and the existing sign-out button. Signing out ends the session and opens the sign-in page. No new sign-out logic was written: the page renders `AccessStateExit`, which already wraps `SignOutButton` and `signOutAction` for the other no-access screens.

## Files created or modified

- `app/hozzaferes-megtagadva/page.tsx`: renders `<AccessStateExit explain />` after the home link. Heading, sentence and link are unchanged.
- `tests/coverage/app-entrypoints.test.tsx`: one new regression test (button, guidance test id, guidance text). It failed before the page change and passes after it.
- `tests/browser/no-access.spec.ts` (new): an `@a11y` test (no serious or critical axe violations) and a sign-out test (guidance shown, sign-out leads to `/bejelentkezes`).

## Key decisions and deviations

- The parent, teacher and admin no-access screens already had sign-out and guidance (commit 78a0ab5, PR #3, merged before this work). This change covers only the standalone page, which still lacked them. The code scan found no sign-in path that redirects to this page, so the exact way a person reaches it is not confirmed.
- `@axe-core/playwright` was already declared at 4.13.0 but missing from the installed folder; it was restored with `npm install` from the lock file. `package.json` and the lock file are unchanged.
- The new browser test needs no seeded account: sign-out works for any session, including none.
- No threshold or existing test was weakened or skipped.

## Regression proof

Before the page change: the new unit test failed (the page output had no `sign-out-button`). After: it passes.

## Quality gate results

- `npx vitest run` (delivery suite): 63 files, 899 tests passed.
- `npm run test:coverage:delivery`: statements 96.95%, branches 91.09%, functions 95.66%, lines 97.92% (floor 80%).
- Prettier, ESLint (0 warnings) and `npm run typecheck`: passed on the changed files and the whole typecheck.
- `npm run build`: passed with the local stack settings in the environment.
- `VERIFY_BROWSER_PROJECTS=chromium npx playwright test tests/browser/no-access.spec.ts`: 2 passed.
- Manual check on a second dev server (port 3100, a copy of the project): the page showed the guidance and button; clicking sign-out opened the sign-in page.

## Not executed

- Firefox and mobile-chrome browser projects, and the full browser suite (Chromium, new spec only).
- Sign-in with a seeded account and a real "no linked record" account.
- `npm run domain` tests (no domain code changed) and the start smoke test.
