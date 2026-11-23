# Code Summary: u9-recurring-duties

Steps 1 to 18 are done. This file contains no names or contact details. The branch and working tree were left as they were (no branch created or switched, nothing committed).

## What was built

- **Database** (`supabase/migrations/20261064_recurring_duties.sql`, forward-only): schedules and occurrences, the reads (group page, my duties, one occurrence, one schedule, admin list, the bottle line for a duty card), the commands (save and switch a schedule on or off, mark done, undo, skip), the daily check with its notice window, the removal preview and apply pair, the notice kinds and the registry row. Every rule has the fixed test list. A second file, `20261065_recurring_review_fixes.sql`, follows the review: `recurring_lock_holder` now also locks the rota-week row (the real swap path locks that row and no family), and `can_undo` also needs the right to mark. The swap race test now takes the same lock as the real swap. `20261066_recurring_overdue_cap.sql` caps the overdue notice at 60 days past the due date (owner decision).
- **Application** (`src/data/recurring.ts`, `src/application/recurring-facade.ts`, `recurring-format.ts`, contracts, authorization, role policy, navigation): a port and adapter, a facade with the Hungarian text for every refusal, and the date and state wording.
- **Screens** (`app/_recurring`, eight pages, the duty card and school calendar changes, `recurring-` classes in `app/globals.css`): the group page, the schedule form (new and change), my duties, the bottle-cleaning line on the duty card with Kész, Mégsem and Kihagyom as native buttons, and the bottle interval on the school calendar. A teacher sees the list with no button. The empty text shows only after a successful read.
- **Seed**: the starting list with invented Hungarian titles, on the small and large sets.
- **Navigation**: "Ismétlődők" for a parent (so also a coordinator, via the parent page) and for a group administrator; teacher and super admin menus are unchanged (a super admin reaches the lists from each group page).

## Final verification (`npm run verify:local`, local settings loaded, no leftover server)

`LOCAL_VERIFICATION_PASS`, 39 minutes 20 seconds in total. The run was made after four repairs of existing tests that the new objects change (see Existing tests changed).

| Step | Result |
|---|---|
| Format, ESLint, Stylelint, type check, manifests, toolchain | clean |
| `npm run test:domain` (Node) | 690 tests, all pass |
| `npm run test:scripts` (Node) | 270 tests, all pass |
| `npm run test:delivery` (Vitest) | 77 files, 1183 tests, all pass |
| Coverage run | Vitest 160 files, 2143 tests; Node 690 tests; all pass |
| Database files (directory 1978, identity 358, notifications 199, seed 60, stack 131, roles 9) | all pass |
| Shuffled database run | 94 files, all pass (seed 398888348) |
| Build, start smoke | pass |
| Browser, all three projects | 795 passed, 63 skipped (picture and timing specs that need a switch), none failed |
| Evidence, privacy scan, security scans | pass (31 pass, 0 fail, 6 outstanding) |

Coverage over all production source (thresholds 80/80/80, not lowered): statements 92.61%, branches 86.61%, functions 94.02%, lines 94.03%.

After the final run the duty-card read was added to `tests/database/recurring-timing.test.ts`; that file was run on its own (4 tests, pass), with Prettier, ESLint and the type check clean. It was not part of the 39-minute run.

## New tests of Steps 15 and 16

- `tests/integration/recurring-screens.test.tsx` (20 tests): group page for a manager and a teacher, all states in words, empty only after a successful read, denied and error, my duties, the form in four cases, the bottle line, `loadBottleLine`, the bottle interval, the skip button.
- `tests/integration/recurring-pages.test.tsx` (5 tests): the eight thin pages, and a not-found answer for an address that is not an id.
- `tests/integration/recurring-actor.test.ts` and `recurring-actions.test.ts`: the three areas' person, the group page addresses, and the rota-week save message.
- `src/application/recurring-format.test.ts` (Node).
- `tests/browser/recurring.spec.ts` (3 tests per browser, run in Chromium, Firefox and mobile Chrome, with no serious or critical accessibility violation and no sideways scroll): a coordinator adds a schedule (with the interval error shown first), a member marks done and takes it back, the coordinator skips with a reason, a teacher has no button; my duties and the duty card with the bottle line (Kész then Mégsem); the school calendar interval.
- `tests/browser/recurring-screenshots.spec.ts` (runs only with `RECURRING_SCREENSHOTS` set).

## Existing tests changed because of the new objects

Menu lists and counts (parent 10, group administrator 11) in the navigation, shell, copy, runtime-boundaries, access, functional-fixes, navigation-polish and visual-overhaul specs; the production inventory count (304 to 315); the Tanév page test (the recurring facade is mocked away); the notice kinds count (26 to 28) in `notices-send.test.ts`; the daily check count (six to seven) in `notifications-timing.test.ts`; and `reset.test.ts` (the daily check that the reset itself runs now creates the due recurring notices, so that test makes the run once before its snapshot).

## Timing on the large seed (median of 5 after one warm-up, database level)

| Target | Result |
|---|---|
| Group page (`recurring_list_for_group`) under 2 s | about 29 ms |
| Family page (`recurring_my_occurrences`) under 2 s | about 31 ms |
| Duty card (`recurring_bottle_for_duty`) under 2 s | about 4 ms |
| Save a schedule, new and change, under 2 s | about 4 to 5 ms |
| Mark done under 2 s | about 5 ms |
| Daily check, first run under 5 s | 576 to 700 ms |
| Daily check, second run under 2 s | about 16 ms |

These are the database calls; a full page also loads the screen. The page-level timing in a browser was not measured for this unit (no page timing spec was planned).

## Owner-review screenshots

Phone width (390 by 844), Chromium, in `code-generation/owner-review/`: group page, new-duty form, my duties, duty card with the bottle line, school calendar with the bottle interval. Each was opened after taking and none shows an error, denied or not-found page. The duty-card shot shows the line in its done state (an earlier water week of the seed); the due state is covered by the browser spec.

## Differences from the Stitch designs

Not built, as instructed: the bottom tab bar, weekly summary, key-handover boxes, location and description text. The schedule controls (Szerkesztés, Kikapcsolás) are in an "Ütemezések" section of the group page for managers rather than on each occurrence card; the cards keep a Szerkesztés link for managers.

## Functions no screen calls yet, tested directly

The daily check (`recurring_due_check`, run by the scheduled command), the removal preview and apply pair, and `recurring_list` have no screen; they are tested directly in `recurring-check.test.ts` and `recurring-for-later-units.test.ts`. `recurring_my_occurrences` is read by my duties; the remaining recurring functions are used by the screens above.

## Not executed

- Provisioned integrations against real targets: nothing was exercised on a hosted site (none exists); this stays outstanding evidence.
- The picture-comparison against Stitch is the owner's review of the screenshots.
- Page-level timing on the large seed in a browser.

## Notes for the record

- Two small file rewrites were made with a short Python script instead of the file tools (a rename in `RecurringForms.tsx`, and edits to four test files); the results were checked by the test runs.
- `.env.database.local` was loaded with `APP_PUBLIC_URL=http://127.0.0.1:3000`; the identity configuration test expects that default, and a value with port 3100 makes it fail.
