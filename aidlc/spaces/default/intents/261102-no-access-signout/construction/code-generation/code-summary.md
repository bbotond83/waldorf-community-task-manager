# Code Summary: sign-out and guidance on the "Nincs jogosultság" screens

## Files created and modified

| File | Change |
|---|---|
| `app/_identity/AccessStateExit.tsx` | New. Shared block: guidance paragraph (`access-guidance`, when `explain` is true) followed by the existing `SignOutButton`. |
| `src/identity/copy.ts` | Added `COPY.noAccess.guidance` (Hungarian). |
| `app/szulo/_components/ParentAccessState.tsx` | Denied: guidance + sign-out; configuration-error: sign-out only; signed-out: neither. Back link hidden when `homePath` starts with `/szulo`. |
| `app/admin/_components/AdminAccessState.tsx` | Same variants (full page and embedded). Back link hidden when `homePath` starts with `/admin`. |
| `app/teacher/_components/TeacherAccessState.tsx` | Same variants. Back link unchanged. |
| `tests/integration/access-state-exit.test.tsx` | New. 3 tests for `AccessStateExit`, 3 for `TeacherAccessState`. |
| `tests/integration/parent-components.test.tsx`, `admin-components.test.tsx` | 5 and 3 new tests; mock `server-only` and `signOutAction`. |
| `tests/coverage/parent-pages.test.tsx` | New page-level regression test (parent grant, no linked record). |
| `tests/coverage/production-inventory.test.ts` | Expected production-file count 217 to 218 (one new production file); no threshold touched. |
| `tests/browser/identity.spec.ts` | New browser test; `newUser` gained an optional `{ linkParent?: boolean }` argument (default unchanged). |

Not changed: `SignOutButton`, `signOutAction`, `app/hozzaferes-megtagadva/page.tsx`, the no-role branch of `app/page.tsx`.

## Key implementation decisions

- Sign-out is the existing `SignOutButton` and `signOutAction`; nothing new was written for sign-out itself (FR1.1, NFR5).
- The guidance text lives in one place (`COPY.noAccess.guidance`) and is shown only in the no-access state, not in the configuration-error variant (FR2.1).
- The loop-hiding rule is a path-prefix check on the home path the access check already supplies. It is a plain prefix match, so a hypothetical route such as `/szulofoo` would also hide the link; no such route exists.
- The admin denied screen now has two paragraphs: its existing sentence plus the guidance.

## Test results

- Scoped vitest run: 6 files, 119 tests passed.
- Full `npm run test:coverage`: 127 files, 1615 tests passed; domain run 511 passed, 0 failed. Coverage: statements 96.94%, branches 91.09%, functions 95.66%, lines 97.94% (floor 80%, unchanged).
- `npm run format:check`, `npm run lint` (zero warnings) and `npm run typecheck`: clean.
- `npm run build`: succeeded.
- Browser: the new test passed in Chromium on port 3100 against the local database stack; the whole Chromium browser phase, 160 tests, passed.
- Regression proof: with only the three `*AccessState.tsx` edits stashed, the new page-level test failed ("expected … to contain data-testid=\"access-guidance\"") and the other 20 tests in that file passed; with the edits restored it passes.

## Tests written but not executed in this stage

- Firefox and mobile Chrome browser projects were not run here (Chromium only); CI runs every browser on every run.
- Database test groups, `npm run test:bundle`, `npm run smoke:start` and `npm run verify:security` were not run; this change touches no database or build configuration.

## Deviations from the plan

- Teacher back link left unchanged (as the plan's design decision said); assumption A3 in the requirements is narrowed accordingly.
- `tests/coverage/production-inventory.test.ts` was updated (not listed in the plan) because it pins the production-file count.
- The developer wrote the browser spec edit with a one-off script instead of the file tool; the result is Prettier-clean.
