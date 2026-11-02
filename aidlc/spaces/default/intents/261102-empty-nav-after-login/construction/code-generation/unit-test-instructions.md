# Unit Test Instructions: Sign-in lands on the role home

Strategy: Minimal, scope floor bugfix (a targeted regression at the narrowest level that reproduces the defect, existing suite stays green). Methodology: test-after.

## Test framework

- Unit and integration tests run with Vitest (`vitest.config.ts`); server actions and the sign-in page are tested with mocks for `next/navigation`, `next/headers` and `server-only`, exactly as in the existing files.
- Browser tests run with Playwright (`playwright.config.ts`) against a production build started on port 3100 (`npm run start`), using the seeded schema `worker_1` of the local database stack (`npm run db:start` must be running). Seeded passwords are read from `scripts/db/seed/data.ts` by the helpers; they are never printed.

## Commands scoped to this change

Run from the project folder, with Node 24 first on the path:

```bash
export PATH=/opt/homebrew/opt/node@24/bin:$PATH && npx vitest run tests/integration/identity-actions.test.ts tests/integration/identity-screens.test.tsx
```

Copy and navigation tests that may mention the removed text (path confirmed in plan Step 2):

```bash
export PATH=/opt/homebrew/opt/node@24/bin:$PATH && npx vitest run tests/integration/production-home.test.tsx src/identity/copy.test.ts
```

Browser check of the changed specs in Chromium only:

```bash
export PATH=/opt/homebrew/opt/node@24/bin:$PATH && npm run build && VERIFY_BROWSER_PROJECTS=chromium npx playwright test --config playwright.config.ts tests/browser/identity.spec.ts tests/browser/visual-overhaul.spec.ts tests/browser/directory-coordination.spec.ts tests/browser/notifications-import.spec.ts
```

## Tests added or changed

| Test | Level | Requirement | Expected |
| --- | --- | --- | --- |
| `signInAction` redirects to `/` after a successful sign-in (changed in `identity-actions.test.ts`) | integration | FR4.1, FR1.1 | fails today (`/bejelentkezes`), passes after Step 3 |
| `SignInPage` redirects a signed-in visitor to `/` (new in `identity-screens.test.tsx`) | integration | FR4.2, FR2.1 | fails today (renders the panel), passes after Step 5 |
| `SignInPage` shows the form to a signed-out and to an unavailable session (changed) | integration | FR2.2 | passes before and after |
| Role landing and menu for super admin, group admin, teacher, parent (new in `identity.spec.ts`) | browser | FR1, FR3 | passes after Steps 3 and 5; 9, 5, 3 menu items and none for the teacher |
| Existing browser specs wait for the role home through `expectSignedIn` | browser | FR4.3 | pass |

## Coverage targets

At least 80% lines, branches and functions across all production source (`npm run test:coverage`), unchanged. The changed files `app/bejelentkezes/actions.ts` and `app/bejelentkezes/page.tsx` stay fully covered by the integration tests above.

## Mocking and test data

- Mock `next/navigation` `redirect` to throw an error whose `digest` carries the target, as the existing tests do, and assert the target is exactly `/`.
- Session states for the page test come from the mocked `currentSession`: `signed-in`, `signed-out`, `unavailable`.
- Browser tests use the seeded accounts `public`-style addresses of the worker schema through `seedAccount(schema, tag)`; no real credentials, no real mail.

## Regression proof

After the fix is in and green, temporarily restore only the two production lines (plan Step 11), confirm the two regression tests fail, restore the fix and confirm they pass. The outcome is recorded in `code-summary.md`.
