# Test Instructions: sign-out and guidance on the "Nincs jogosultság" screens

Strategy: Minimal (express). One test per requirement, a happy-path test per changed component, plus the regression test. Methodology: test-after.

## Framework and setup

- Vitest with Testing Library (jsdom), project "delivery"; setup file `tests/setup.ts`. No local database needed for these tests.
- Browser test: Playwright with `@axe-core/playwright`; needs the local database stack and a production build (see below).

## Commands scoped to this change

Run from the project root with the Node version the project expects.

```bash
npx vitest run --project delivery tests/integration/access-state-exit.test.tsx tests/integration/parent-components.test.tsx tests/integration/admin-components.test.tsx tests/coverage/parent-pages.test.tsx tests/coverage/app-entrypoints.test.tsx tests/integration/production-home.test.tsx
```

Browser and accessibility (own port, not 3000; environment per README "Run the application locally"):

```bash
npm run build
npx playwright test tests/browser/identity.spec.ts --grep "Nincs jogosultság"
```

Static checks and coverage for the whole change:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
```

## Test list

- `AccessStateExit`: shows guidance and sign-out button; hides guidance when not asked; submitting the form calls the mocked `signOutAction` (FR1.1, FR1.2, FR2).
- `ParentAccessState`: denied shows guidance and button; configuration-error shows button only; signed-out shows neither; link hidden for a `/szulo` home path and shown for another path (FR1, FR2, FR3).
- `AdminAccessState`: denied (full page and embedded) shows guidance and button; configuration-error shows button only; looping link hidden for `/admin`, shown otherwise.
- `TeacherAccessState`: denied shows guidance and button; configuration-error button only; signed-out neither; link unchanged.
- Regression (page level, `tests/coverage/parent-pages.test.tsx`): parent grant with no linked parent record renders the denied screen with `sign-out-button`, guidance, and no `parent-access-home-link`. Fails on the code before this change.
- Unchanged areas: static `/hozzaferes-megtagadva` page and the no-role branch of `app/page.tsx` keep their existing tests green (FR4).
- Browser: purpose-made account (parent grant, no `parents` row) sees the screen with guidance and sign-out; axe reports no serious or critical violations; sign-out lands on `/bejelentkezes`.

## Coverage target

At least 80% lines, branches and functions across all production source (existing threshold in `vitest.config.ts`; never lowered).

## Mocking and test data

- Mock `app/_identity/actions.ts` (`signOutAction: vi.fn()`), `server-only` and `next/navigation` as `tests/integration/production-home.test.tsx` does.
- Page tests use the request double `tests/support/request-world.ts` (set the linked parent record to `undefined` to model "role but no linked record").
- The browser test creates its own throwaway account and parent grant through the existing `newUser` helper pattern, without inserting the `parents` row. Seeded accounts and passwords are not used or printed.
