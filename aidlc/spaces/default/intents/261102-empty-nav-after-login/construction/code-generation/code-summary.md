# Code summary: Sign-in lands on the role home

## Result

After a successful sign-in the person now ends on the home page of their role. `signInAction` redirects to the fixed path `/` (which already resolves the role home), and `SignInPage` redirects a visitor with a valid session to `/` instead of showing the old "signed in" note. Signed-out and unavailable sessions still see the form. The redirect target is a fixed internal path; nothing from the request is used.

## Files created or modified

- `app/bejelentkezes/actions.ts`: `redirect("/")` after the cookies are written; doc comment updated.
- `app/bejelentkezes/page.tsx`: signed-in session redirects to `/`; the signed-in panel and the unused `SignOutButton` import are removed.
- `src/identity/copy.ts`: removed the unused `signedInHeading` and `signedInMessage`.
- `tests/integration/identity-actions.test.ts`: post-sign-in expectation is now `/` (FR4.1 regression).
- `tests/integration/identity-screens.test.tsx`: the old combined test is split into signed-out form, unavailable form, and signed-in redirect to `/` (FR4.2 regression).
- `tests/browser/support/seeded-schema.ts`: new exported `expectSignedIn(page)` (left the sign-in page and holds the session cookie); `signInAs` signs out first when an existing session redirects the visit away, then waits with `expectSignedIn` plus the sign-out button.
- `tests/browser/identity.spec.ts`, `directory-coordination.spec.ts`, `notifications-import.spec.ts`, `visual-overhaul.spec.ts`: the 12 waits for the removed `signed-in-panel` now use `expectSignedIn`; the assertion on the removed heading now checks the parent home URL.
- `tests/browser/visual-overhaul.spec.ts`: four new browser tests, one per seeded role (super admin `/admin` 9 menu items, group admin `/admin` 5, parent `/szulo/ertesitesek` 3, teacher `/teacher/schedule` no menu but the Beosztás heading and sign-out button), each with an accessibility scan that must show no serious or critical violations.
- `README.md` and `HASZNALATI_UTMUTATO_HU.md`: say that after sign-in the app opens the role home (the Hungarian guide no longer mentions the old "Be van jelentkezve" screen).

## Key decisions and deviations from the plan

- The new role-landing browser tests are in `tests/browser/visual-overhaul.spec.ts`, not `identity.spec.ts` as the plan said. `identity.spec.ts` binds an unseeded schema (`seed: false`) and builds its own accounts, so the seeded role accounts do not exist there. The file is in the plan's changed set and in the verified run.
- `expectSignedIn` checks the session cookie and the left sign-in page, not the sign-out button. In `identity.spec.ts` the hand-built accounts (and an invited parent) have no linked parent record, and their role home is the existing "Nincs jogosultság" page, which has no sign-out button. `signInAs` (seeded accounts, full homes) additionally requires the sign-out button.
- In `identity.spec.ts` the helper `newUser` now also inserts a linked `parents` row for parent grants, so those test accounts reach a real parent home. The session-renewal test opens `/bejelentkezes` (not a reload of the role home) to check that a dead session shows the form.
- No threshold or test was weakened or skipped.

## Regression proof (Step 11)

Only the two production lines were put back (action redirect to `/bejelentkezes`, page signed-in branch rendering a note). Running the two integration test files: 2 failed, 34 passed. The failing tests were `signInAction (W1) > stores the tokens in httpOnly cookies and redirects after a successful sign-in` and `pages > sends a signed-in person to the home route instead of showing the form`. With the fix restored: 36 of 36 passed.

## Quality gate results

- `npm run typecheck`: passed.
- `npm run lint`: passed (0 warnings).
- `npm run format:check`: passed.
- `npm test`: 59 files, 838 tests passed.
- `npm run test:coverage`: statements 96.94%, branches 91%, functions 95.65%, lines 97.94% (floor 80% unchanged).
- `npm run build`: passed. It only runs with the local stack's settings in the environment (`.env.database.local` values, a generated session secret, a local public address); without them the pre-build config check refuses, as designed.
- `VERIFY_BROWSER_PROJECTS=chromium npx playwright test` on `identity`, `visual-overhaul`, `directory-coordination` and `notifications-import`: 39 passed, including the four role-landing tests with accessibility scans.

## Tests not executed in this stage

- Firefox and mobile-chrome browser projects were not run here (Chromium only, as requested); CI runs every browser.
- Production and staging deployment checks are not part of this stage.
