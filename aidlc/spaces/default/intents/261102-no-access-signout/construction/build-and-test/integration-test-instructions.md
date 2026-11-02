# Integration Test Instructions

Minimal strategy: no additional integration suite beyond what Code Generation produced. The relevant component and page integration tests are:

```bash
npx vitest run --project delivery tests/integration/access-state-exit.test.tsx tests/integration/parent-components.test.tsx tests/integration/admin-components.test.tsx tests/coverage/parent-pages.test.tsx tests/coverage/app-entrypoints.test.tsx tests/integration/production-home.test.tsx
```

The end-to-end flow (sign-in, denied screen, sign-out) is covered by the Playwright test "Nincs jogosultság: an account with a parent role but no linked record can read why and sign out" in `tests/browser/identity.spec.ts`:

```bash
npm run build
VERIFY_BROWSER_PROJECTS=chromium npx playwright test tests/browser/identity.spec.ts --grep "Nincs jogosultság"
```

Needs the local database stack. Test data: the test creates its own throwaway account; seeded accounts are not used.
