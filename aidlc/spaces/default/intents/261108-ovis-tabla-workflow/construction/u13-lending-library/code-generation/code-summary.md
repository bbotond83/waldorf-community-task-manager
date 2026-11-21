# U13 Lending library: code summary

Unit U13 adds the community lending library: books with an owner (a parent, a typed name or a former member), loans with a "until" date, a "keep me posted" watch, and the daily check for late and returned books. Contains no real names or contact details; all test data is invented.

## What changed

- **Database** (`supabase/migrations/20261058_lending_library.sql`, one new forward-only file; an unreleased draft edited and re-applied during this unit, no applied file was edited): tables for books, loans and watches; named functions behind row-level security for add, change, remove, borrow, set-until, return, watch, unwatch, list and get. Lists return strict booleans (`coalesce`).
- **Application layer**: `LibraryApplicationFacade` (`src/application/library-facade.ts`) over the data adapter (`src/data/library.ts`); date wording and overdue logic in `src/application/library-format.ts`; Hungarian copy in `src/data/copy.ts`; role policy, authorization, navigation ("Könyvtár" in all four menus) and nine `AUTH-LIBRARY-*` rows in `verification/authorization-matrix.json`.
- **Screens** (`app/_library/`; pages under `app/szulo/konyvtar`, `app/teacher/konyvtar`, `app/admin/konyvtar`): list with search (`kereses`), book page (available, borrowed by you, borrowed by someone else), new/edit form, borrow, set-until, return, watch/unwatch, remove. The parent pages serve parents and group admins; the teacher pages are read-only; the admin pages serve a super admin without a parent record of their own (the seeded super admin has none, so `/szulo/*` would be denied). CSS prefix `library-`.
- **Seed**: invented books, loans and watches (`scripts/db/seed/data.ts`, `write.ts`).
- **Contract summary**: "Deltas from U13" section appended.

## Tests

- New: `tests/database/library-{core,books,loans,races,adapter,timing,for-later-units}.test.ts` and `library-support.ts`; `src/data/library.test.ts`, `src/application/library-facade.test.ts`, `library-format.test.ts`; `tests/integration/library-actions.test.ts`, `library-screens.test.tsx`; `tests/browser/library.spec.ts` (all three browsers, axe and overflow checks), plus `library-timing.spec.ts` and `library-screenshots.spec.ts` (switched on only by environment variables).
- Updated for the new menu item and the new objects: navigation, runtime-shell, copy, identity catalogue, seed tests, production inventory (296 files), and the browser specs `functional-fixes`, `navigation-polish`, `runtime-foundation`, `teacher-web`, `visual-overhaul`.

## Found while verifying, and fixed

- Library list failed ("Hiba történt") because `is_own` / `borrowed_by_me` came back null: fixed with `coalesce` and a strict-boolean test.
- "Mégsem kérem" never showed for a watcher of a book that became available: the watch form now shows when `canWatch || isWatching`.
- The seeded super admin has no parent record, so `/szulo/konyvtar` was denied for them: the super admin's "Könyvtár" now opens `/admin/konyvtar`.

## Checks run (real numbers)

`npm run verify:local` passed end to end (`LOCAL_VERIFICATION_PASS`), after earlier runs stopped on stale menu expectations, a Prettier warning and the two inventory/route tests, all fixed.

| Step | Result |
|---|---|
| format, lint, lint:css, typecheck, manifests | pass |
| node tests: domain 655, scripts 269 | pass, 0 failures |
| database tests (public and shuffled per schema) | pass |
| Vitest delivery | 152 files, 2025 tests, pass |
| coverage (statements / branches / functions / lines) | 92.21 / 86.3 / 93.79 / 93.7 (floor 80) |
| privacy, secrets, SAST scans | pass |
| browser (Chromium, Firefox, mobile Chrome) | 780 passed |

Timing: list and book page are far under the two-second target (measured in `library-timing.test.ts` and `library-timing.spec.ts`).

## Limits to know

- The step-1 baseline test count was not recorded separately, so no before/after delta is given.
- The daily check, the removal pair and the load function are tested directly in the database tests; no screen calls them yet.
- Owner approved the three Stitch designs (list, book page, new-book form); screenshots are in `owner-review/`.
