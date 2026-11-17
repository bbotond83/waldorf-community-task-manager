# U6 Full rotas and weekend picks: code summary

Unit U6 adds the family standing (Marad, Távozik, Új), the four yearly rotas, the weekend picks with their checks and notices, and the screens for them. Contains no real names or contact details; all test data is invented.

## What changed

- **Database** (`supabase/migrations/20261053_full_rotas_and_weekend_picks.sql`): standing, four-rota plan, weekend slots and picks, reminders and notices, all as named functions behind row-level security. Tests are in `tests/database/` (standing, draft grid, four-rota plan, checks, contracts, weekend picks and races, migration, identity catalogue).
- **Application layer**: `RotaApplicationFacade` has four new methods (`setStanding`, `pickSlot`, `assignSlot`, `getUnpickedList`); texts live in `src/application/rota-format.ts`; role policy and authorization were extended (`verification/authorization-matrix.json`, `verification/AUTHORIZATION.md`).
- **Screens** (Steps 15 and 16):
  - `/admin/tanev`: families' standing panel (a form per family), the note on the changeover date, the flagged-duties list.
  - `/admin/beosztas`: one tab per rota (links), the two warnings, blockers, per-rota family counts, cell editor.
  - `/admin`: the unpicked list "Ki nem választott?" (`app/admin/_components/UnpickedList.tsx`) for the super admin, with an assign form per item.
  - `/szulo/beosztas`: one section per rota plus the weekend duties; `/szulo/beosztas/[id]`: card texts per job, weekend picker as native radios (`WeekendPicker.tsx`), "Ki mit választott?".
  - New classes use the `admin-` and `parent-` prefixes; colour tokens unchanged; Stylelint clean.
- **Step 16a (noted extension)**: `DUTY_INELIGIBLE` and the `WEEKEND_*` refusals now show a Hungarian sentence on the parent and admin sign-up/pick screens (`app/szulo/_lib/action-state.ts`, `app/admin/_lib/action-state.ts`).
- **Seed**: the small seed holds a draft four-rota plan and standings; the large seed holds a published plan with 6 picks. `buildSeedPlan`/`seedSchema` take an optional `rotaPlan` (`draft` or `published`) so the timing spec can start from a draft on the large set.
- **Docs**: README section "The school calendar, the four rotas and the weekend picks"; three rows in `verification/AUTHORIZATION.md`; U6 deltas appended to `inception/contract-design/contract-summary.md` (C5, C8, C9, C10, C11, C16, C20).

## Checks run

- `npm run verify:local` run 5: exit 0 (format, lint, types, domain, scripts, Vitest with 80/80/80 coverage: 68 files / 1025 tests; database suites 141 files / 1902 tests; build; smoke; browser: 762 passed, 45 skipped, 0 failed in Chromium, Firefox and mobile Chrome).
- Earlier runs failed for environment reasons (settings sourced but not exported; `APP_PUBLIC_URL` must be `http://127.0.0.1:3000`; migration file edited after apply) and, in run 4, one real defect: the "Új" standing badge had a colour contrast of 4.4:1 (needs 4.5:1). Fixed by using the success colour; no token changed.
- After run 5, only `tests/browser/rota-screenshots.spec.ts` was edited (wait for loading text to disappear; Prettier clean) and run on its own; it is skipped in the ordinary run.

## Timing (large seed, 30 families, Chromium, local)

Draft 214 ms, publish 207 ms (targets 5 s). Pages: admin Tanév 50 ms, admin Beosztás 38 ms, weekend tab 35 ms, admin dashboard 346 ms, parent overview 94 ms, duty card 49 ms (target 2 s). The three database checks were timed in Step 10 on a published whole-year plan from the test helper, not on `db:seed:large`.

## Reviewer finding fixed: picking family that may not hold the duty

A picking week whose family is leaving, new or archived on the week's Monday used to count as owed in `weekend_pick_owed`, although `weekend_pick_step` refuses such a family with `DUTY_INELIGIBLE` (administrators too). Nobody could fulfil the pick and no Wednesday notice went out. New forward-only migration `supabase/migrations/20261054_weekend_pick_ineligible_family.sql` (the applied 20261053 is not edited):

- `weekend_pick_owed` is false when `family_hold_reason(family, week_start)` is not null.
- In `weekend_picks_due_check`, the missing-picker loop treats such a week like a week with no family: the weekend family gets `weekend_slot_returned` and the administrators get `weekend_picker_missing`, once for each week and job; the ineligible family is not reminded.
- Follow-up migration `20261055_weekend_pick_step_keeps_reason.sql`: with the first migration alone, a pick by such a family was refused as `WEEKEND_PICK_NOT_NEEDED` (the existing BR60.4 test in `weekend-picks.test.ts` caught it, verify:local run 6). BR60.4 promises `DUTY_INELIGIBLE` with the reason (the reason reaches the super admin and the family's own parent only, as before), so `weekend_pick_step` now reports "not needed" only when the week is not owed for another reason than the family's eligibility; an ineligible family falls through to the `DUTY_INELIGIBLE` refusal. The test and the Hungarian message mapping (Step 16a) are unchanged. A week not owed for another reason (for instance published after Saturday began) and also ineligible now gets `DUTY_INELIGIBLE` instead of "not needed", an unlikely edge with no effect on data.
- Tests: three cases (leaving, new, archived) added to `tests/database/rota-checks.test.ts`, run in both schemas (34 tests pass, was 28). They check that the week is not owed, the other picking family still is and is reminded, the right two notices go out, only for the indoor-cleaning week, and a later run sends nothing again. No new test file, so no change to the `test:database:*` scripts or the shuffled run. The fixed list is met by the existing allowed, refused, out-of-reach and repeated-run cases of that file; outdated screen and two at once do not apply to a timer check.

## Separate change: Next.js security upgrade (owner approved)

On 2026-11-17 the build in `verify:local` started failing with `SecurityFatalError`: npm advisory GHSA-mfr8-8qww-v76h (information disclosure across root params when a "use cache" function is called through `unstable_cache()`; moderate; affects next >=16.3.0 <=16.4.4). Not part of U6. The owner approved the upgrade in the current checkout: `next` and `@next/env` moved from 16.4.2 to 16.4.6 (exact pins kept) in `package.json`; `package-lock.json` changed only for the Next family (version, integrity and the platform SWC binaries). `eslint-config-next` (16.3.8) was left alone. `npm audit --audit-level=high` exits 0. This change is independent of the U6 files and can be committed on its own.

## Differences from the Stitch designs (for owner review)

- Our header, navigation and footer are kept; the design's invented menu, "Új tanév rögzítése" button, notification dot and "Aktív tervezési időszak" chip are not built.
- Standings and the unpicked list use a visible select plus a save button per row, not a click-to-edit row.
- No "Érvényes ettől" column (the model has no such date; the changeover date applies to all).
- No Friday-noon banner; the unpicked list is a section on `/admin` (the notice links go there), not its own page.
- The cell editor offers every family with its count, not only allowed ones: the model has no per-week eligibility, so the database refuses (`DUTY_INELIGIBLE`, `ROTA_SAME_WEEK_CLASH`).
- Rota tabs are plain links; the weekend tab is called "Hétvégi állatgondozás".

## Screenshots

`code-generation/screenshots/built/` holds 9 screens at phone and computer size. Each is checked for error texts before it is taken and for the loading text ("Betöltés folyamatban"); a first take showed the loading text in the phone pictures of screens 2 and 3, so the spec now waits, and all pictures were retaken. All 18 pictures were opened and show the intended screens, with no error page and no loading text. Screens 6 and 7 are very tall (up to 40,000 px), so they were only skimmed at thumbnail size; the spec's text check covers them. The "Ugrás a fő tartalomra" skip link shows in some full-page shots because it takes focus; it is not an error.

## Not done or not verified

- The `-- @@NEXT-SECTION@@` comment is still in the migration. The local `public` schema holds the file as applied and the migration runner refuses a changed applied file. Remove it after the owner resets `public` (`npm run db:reset -- --yes`, then `db:migrate`, `db:seed`); it is only a comment.
- `traceability.json` maps acceptance criteria to tests from the plan's step table; the mapping is approximate, as the AC texts were not re-read.
- Hungarian card and warning texts are drafts for owner review.
- Weekend picks, notices and mail were not exercised against a real mail target (local catcher only).
- Process slips: a few files were edited through shell tools (node, sed) instead of the Edit tool, and scratch logs briefly sat in the project root and `/tmp`.
