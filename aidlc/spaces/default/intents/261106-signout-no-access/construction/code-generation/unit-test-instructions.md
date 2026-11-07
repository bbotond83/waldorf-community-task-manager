# Unit Test Instructions: sign-out on the no-access page

## Framework

- Test runner: Vitest (`vitest.config.ts`), with the Istanbul coverage provider and 80/80/80 thresholds.
- Rendering in tests: `renderToStaticMarkup` from `react-dom/server`, as the existing tests in `tests/coverage/` do.

## Exact commands (scoped to this change only)

Run these from the project folder. Do not run a project-wide test command for this change.

1. Before the fix (confirms the regression test fails):
   `npx vitest run tests/coverage/app-entrypoints.test.tsx -t "no-access page"`
2. After the fix (confirms it passes):
   `npx vitest run tests/coverage/app-entrypoints.test.tsx`

Name filter note: the new test's name contains the words "no-access page" so the `-t` filter selects it.

## What the new test checks

- Renders `app/hozzaferes-megtagadva/page.tsx`.
- Expects the sign-out button (`data-testid="sign-out-button"`).
- Expects the guidance paragraph (`data-testid="access-guidance"`) with the Hungarian text from `COPY.noAccess.guidance`.
- Keeps the existing heading and home link checks.

## Mocks and data

- No database or network is used. The sign-out button is rendered only; the action is not invoked.
- No test data to manage.

## Coverage target

- The changed page is covered by the new test. Coverage for the whole project must stay at or above 80% for lines, branches and functions.
