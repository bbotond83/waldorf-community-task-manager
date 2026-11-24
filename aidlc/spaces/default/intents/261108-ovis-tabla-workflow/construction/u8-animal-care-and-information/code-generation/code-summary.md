# Code Summary: u8-animal-care-and-information

Steps 1 to 17 are done. This file contains no names or contact details. The branch and working tree were left as they were (no branch created or switched, nothing committed).

## What was built

- **Database** (`supabase/migrations/20261068_animal_care_and_information.sql`, forward-only): the calendar and slots, sign-up and give-up, the fair share, the daily and monthly checks, the information sections with six starting sections, and the information links on duty cards. Every rule has the fixed test list. A second file, `20261069_schedule_leaves_out_animal_slots.sql`, makes the teacher schedule leave out the daily slots (see Decisions). A third, `20261070_u8_review_fixes.sql`, answers the architecture review: a first save of the calendar by two super admins at once gives the loser a version conflict (not a raw unique error), and `info_section_update` checks the caller before locking the section and refuses a coordinator on a hidden section.
- **Application** (`src/data/animal-care.ts`, `information.ts`, `src/application/animal-care-facade.ts`, `information-facade.ts`, `section-text.ts`, contracts, authorization, role policy, navigation, wiring in `services.ts`): ports and adapters, two facades, and a renderer that turns the stored text into plain blocks (never HTML) and allows only http(s) and in-app links.
- **Screens**: `/szulo/allatok` (fair share, two weeks of days, Elvállalom, Lemondás with confirmation, Csere kérése within 24 hours, button names that include the day and part, a status line, back to the row), `/informacio` for every role (section disclosures; a duty link opens its section; Szerkesztés for those allowed), the section editor (formatting help and the warning about phone numbers, email addresses and children's names; a super admin also sets title, owner, season months and order, adds, hides and restores), `/admin/allatgondozas` (two times, alert group, Időpontok létrehozása with its result), and the "Tudnivalók" links on duty cards. Classes use `parent-`, `admin-` and `info-` prefixes.
- **Navigation**: Állatgondozás for a parent, a group admin (parent page) and a super admin (admin page); Információ for every role (a teacher too).
- **Seed**: starting information sections, a calendar, slots and duties on both sets; held assignments on the large set.

## Final verification (`npm run verify:local`, local settings loaded, no leftover server)

`LOCAL_VERIFICATION_PASS` on the fourth full run. The first three stopped early for reasons listed under Repairs during verification.

| Step | Result |
|---|---|
| Format, ESLint, Stylelint, type check, manifests, toolchain | clean |
| Node tests (`test:domain` and scripts) | 738 and 273 tests, all pass |
| `npm run test:delivery` (Vitest) | 82 files, 1258 tests, all pass |
| Coverage run | Vitest 172 files, 2269 tests; Node 738 tests; all pass |
| Database files (directory 2328, identity 358, notifications 199, seed 61, stack 131, roles 9) | all pass |
| Shuffled database run | all pass (seed 909145660) |
| Build, start smoke | pass |
| Browser, all three projects | 810 passed, 69 skipped (picture and timing specs that need a switch), none failed |
| Evidence, privacy scan, security scans | pass (31 pass, 0 fail, 6 outstanding) |

Coverage over all production source (thresholds 80/80/80, not lowered): statements 91.87%, branches 86.53%, functions 94.02%, lines 93.41%.

## New tests

- `tests/integration/animal-care-actions.test.ts` (13): every action, its refusals and its messages.
- `tests/integration/animal-care-screens.test.tsx` (12): every slot state, the fair share, settings, the information page, the editor for a coordinator and a super admin, and the empty and error states (empty only after a successful read).
- `tests/browser/animal-care.spec.ts` (3 tests per browser, Chromium, Firefox and mobile Chrome, no serious or critical accessibility violation and no sideways scroll): a parent takes a slot and gives it up; a duty link opens its section and a super admin edits it, which a parent then reads; a super admin saves the times.
- `tests/browser/animal-care-screenshots.spec.ts` (runs only with `ANIMAL_SCREENSHOTS` set).
- Database, facade, adapter and seed tests from Steps 2 to 13, plus a regression test that the teacher schedule leaves out the slots.

## Decisions and design deviations

- **Teacher schedule leaves out animal slots** (migration 20261069, kept at the owner's decision): the daily slots number about 440 in the seed and bury the 8 real entries in the default list. Teachers instead get a read-only Állatgondozás page at `/teacher/allatok` (menu entry after Könyvtár) that shows who looks after the animals, with no sign-up, give-up or swap control.
- The browser spec edits a section as a super admin: the seeded coordinator does not coordinate the group that owns the sections. The coordinator-edits-text-only rule is covered by the database tests and the screen tests.
- Edit and hide controls sit inside each section, so a section is opened before they show.
- After a sign-up or give-up the page reloads and the message shows in a status line at the top (the row's form is replaced); a refusal shows in the row's form.
- Notice facts compute their text live. `slot_give_up` sends no notice to the family itself. `rota_duty_card` was not extended to the `animal_slot` origin. Swap behaviour for animal slots is untested.
- Baseline suite counts before this unit were never captured.

## Existing tests changed because of the new objects

Menu lists and counts (parent 12, group administrator 13, super admin 18, teacher 8) in the navigation, shell, copy, runtime-boundaries, access, app-nav, functional-fixes, runtime-foundation, teacher-web, visual-overhaul and navigation-polish tests; the production inventory count (340 to 354); the notice kinds count and daily check count; and the seed tests (task counts exclude slots, information sections excluded from the reset comparison).

## Repairs during verification

1. Six menu-count tests had not been updated (fixed).
2. `APP_PUBLIC_URL` must be `http://127.0.0.1:3000` for the identity configuration test; a value with port 3100 fails it (my setting, not a defect).
3. The teacher schedule listed the slots (migration 20261069, regression test).
4. One checklist race test failed once in a full database run earlier and passed in the later full and shuffled runs; it is a known timing flake.

## Timing

No page-level timing spec was planned for this unit. The daily checks over the large seed run in about 83 ms against the daily window (`animal-checks.test.ts`). Page-level timing of the sign-up page on the large seed was not measured in a browser.

## Owner-review screenshots

Phone width (390 by 844) and one computer-width shot, Chromium, in `code-generation/owner-review/`: sign-up page, information page with a section opened from a duty link, section editor, admin settings. Each was checked and none shows an error, denied or not-found page.

## Differences from the Stitch designs

Not built: the invented school name, family names, key code, extra navigation items, undo button and extra policy panel. The layout follows the designs.

## Not executed

- Provisioned integrations against real targets: nothing was exercised on a hosted site (none exists); this stays outstanding evidence.
- The picture comparison against Stitch is the owner's review of the screenshots.
- `verification/reports/*` were rewritten by the verification run for the tested SHA.


## Owner review changes (after the first approval question)

- Kept the schedule filter and added the read-only teacher page `/teacher/allatok` (new `readOnly` mode of `AnimalCareScreen`, menu entry `teacher-animal-care`, the matrix rows already named this route).
- Migration 20261070 (calendar first-save race, section update order and hidden sections) with new database tests: two first saves at once, a repeated save click, a coordinator on a hidden section, hide repeated click, outdated page and two hides at once.
- New tests: teacher read-only screen (integration) and a teacher browser test; menu expectations updated for the teacher's eighth entry.
- The checklist two-at-once test (`tests/database/checklist-claims-races.test.ts`, from the earlier events unit) failed about one run in five: when the claim wins, the removal correctly reads a version conflict. The test now accepts success or conflict for the removal and still checks that no orphan claim is left.
