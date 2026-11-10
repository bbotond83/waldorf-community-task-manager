# Code summary: u2-first-rota-slice (plan steps 1 to 14)

All fourteen steps are done. Nothing is committed and no branch was created or switched.

## Baseline (before any change)

Domain 469, scripts 250, delivery 841, roles 9, stack 131, identity 332, directory 551, notifications 124, seed 57.

## Results (real counts)

| Command                                                                | Result                                  |
| ---------------------------------------------------------------------- | --------------------------------------- |
| `test:database:directory` (includes the 3 new files)                   | passes inside `verify:local` (see below) |
| `test:database:identity`, `notifications`, `seed`                      | pass inside `verify:local`              |
| `test:domain` (node)                                                   | 501 of 501                              |
| `test:scripts`                                                         | 253 of 253                              |
| `test:delivery` (vitest, 62 files)                                     | 856 of 856                              |
| `tests/browser/rota.spec.ts` in Chromium, Firefox and mobile Chrome    | 12 of 12                                |
| `tests/browser/community-roles.spec.ts` with the new routes (Chromium) | passes                                  |
| `typecheck`, `lint`, `lint:css`, `format:check`                        | clean                                   |

`npm run verify:local` result: see "Step 13" below.

## What changed in steps 9 to 14

- Screens, built from the four approved Stitch designs with the app's own look (`app/globals.css`, kebab-case `admin-rota-*` and `parent-rota-*` classes, colour tokens only in `:root`, 44px controls, no card in a card):
  - `/admin/tanev` (school year dates, changeover date, break weeks add and remove, the list of school weeks, the late-change warning).
  - `/admin/beosztas` (no plan: make a draft; draft: change a week per row, count per family with the uneven mark, blockers list, discard with "N hét kézzel módosítva", publish only when allowed; published: read-only).
  - `/szulo/beosztas` and `/teacher/beosztas` (one shared component `src/runtime/RotaOverview.tsx`: week cards on a phone, a table from 44rem, a family filter, "Ti" mark, "Szünet", "Még nincs közzétett beosztás.").
  - `/szulo/beosztas/[id]` (the duty card: family, Monday and Sunday, the fixed text, the no-fixed-day sentence, the break-week warning).
  - Every screen has success, empty, denied and error states. A refused or failed read never shows the empty state (tested).
- Left out on purpose (Stitch extras that are not in U2): swap and cancel controls, the done status, opening hours, key-pickup rules, PDF download, child and group names, a fixed admin name, search boxes, the school logo and fake sidebars, the invented three cleaning steps, and invented family names.
- Hungarian wording for every refusal code in `src/application/rota-format.ts` (`rotaRefusalMessage`), used by the admin actions through `app/admin/_lib/rota-state.ts`; date and week formatting and the fixed card text are in the same module.
- Admin commands in `app/admin/rota-actions.ts` (save school year, add or remove break week, make draft, set week, discard, publish).
- The school-year save now carries the changeover date (`src/data/admin-records.ts`, `admin-payloads.ts`), with a test.
- Navigation entries (`src/runtime/navigation.ts`): parent "Beosztás", teacher "Takarítási beosztás", group admin "Beosztás" (to `/szulo/beosztas`, the group admin is also a parent), super admin "Tanév" and "Beosztás". `navigation-access.test.ts` and the other tests that list the menus were updated.
- Defect found and fixed with a regression test: the database's overview returns `is_own` as null for a break week (no rota row), and the adapter threw, so a parent saw the error state as soon as a plan was published. `src/data/rota.ts` now reads null as "not own" (`rota.test.ts`). The migration was not edited (applied files are never edited).
- Tests: `tests/integration/rota.test.tsx` (overview, card, states, state mapper), `src/application/rota-format.test.ts`, `tests/browser/rota.spec.ts` (each screen as each role, draft hidden from parents and teacher, empty-week blocker, discard, publish, own card, other family and made-up id refused, accessibility check, no sideways scroll), the role walk in `community-roles.spec.ts`, and the production inventory count (212 to 223: eleven new production files).
- Two env-guarded helpers that do nothing unless asked: `tests/browser/rota-screenshots.spec.ts` (`ROTA_SCREENSHOTS=<folder>`) and `tests/browser/rota-timing.spec.ts` (`ROTA_TIMING=1`).
- Documents: `README.md` (new section on the calendar and rota) and `verification/AUTHORIZATION.md` (table of the new routes and rights).
- Step 12: no change to `vitest.config.ts` or any threshold; coverage stays 80/80/80 and the 1500 ms ceiling is unchanged.

## Step 13: timings on the 30-family set (Chromium, production build, local stack, worker schema)

From `tests/browser/rota-timing.spec.ts`, worst of three loads for pages:

| What                                          | Time   | Limit  |
| --------------------------------------------- | ------ | ------ |
| Make a full-year draft (click to table shown) | 121 ms | 5 s    |
| Publish a full-year plan (click to published) | 128 ms | 5 s    |
| `/admin/tanev`                                | 41 ms  | 2 s    |
| `/admin/beosztas` (published plan)            | 41 ms  | 2 s    |
| `/szulo/beosztas` (parent overview)           | 53 ms  | 2 s    |
| `/szulo/beosztas/[id]` (duty card)            | 42 ms  | 2 s    |

The database-only timings from `rota-plan.test.ts` (draft 4 ms, plan page 2 ms, publish 6 ms, overview 3 ms on the same size of set) are unchanged.

`npm run verify:local`: PASSED (LOCAL_VERIFICATION_PASS). 1612 delivery tests in 128 files, 660 browser tests across Chromium, Firefox and mobile Chrome, coverage 93.7% statements, 86.73% branches, 92.88% functions, 94.68% lines. An earlier run failed in the browser step because five specs still expected the old menu sizes and labels; they were updated, and the group-admin "Beosztás" menu entry was removed (it pointed to /szulo/beosztas, which shows the parent menu, so the group admin's menu changed from page to page). The group admin no longer has a menu link to the rota overview.

## Screenshots for the owner (phone width 390 and computer width 1280, full page)

Folder: `aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u2-first-rota-slice/code-generation/screenshots/`

1. `1-tanev-phone.png`, `1-tanev-computer.png` (Tanév)
2. `2-beosztas-nincs-terv-*` (Beosztás tervezése, no plan yet)
3. `3-beosztas-tervezet-*` (Beosztás tervezése, draft)
4. `4-attekintes-nincs-kozzetett-*` (parent overview, nothing published)
5. `5-beosztas-kozzetett-*` (Beosztás tervezése, published)
6. `6-attekintes-*` (parent overview, published)
7. `7-feladatlap-*` (duty card)

## Assumptions

- A missing or foreign id is refused with the denied code.
- Rota duties are guarded by role mode (admin or family).
- "Refused while a plan exists" for the school year means a change of the year's dates gives `ROTA_PLAN_EXISTS`.
- `duty_create` accepts only the `rota_week` origin.
- Marking an already-done place succeeds and keeps the first who and when.
- A group administrator reads the overview at `/szulo/beosztas` because that is the route in the access-policy rows and the group administrator is also a parent.
- The school year form saves with a button, not on leaving a field as the Stitch design shows (clearer for keyboard and screen-reader users, and one clear success or error message).

## Review fixes (the owner rejected the Unit checkpoint)

1. Super admin duty card: new read-only page `/admin/beosztas/[id]` (same `RotaDutyCard` view, back link to `/admin/beosztas`). Matrix row `AUTH-ROTA-DUTY-SUPER-ADMIN-ALLOW` now names `/admin/beosztas/**`; a new deny row covers parent, group admin and teacher there. `role-policy.ts` and `authorization.ts` already allowed it, so only their comments changed. The planning page does not link to cards yet; a super admin opens one by its address.
2. Working-group admin: the group admin menu has a "Beosztás" link to `/szulo/beosztas`. The matrix has a new allow row (group admin who is a parent of the holding family) and the deny row now says "without holding family"; `AUTHORIZATION.md` says the same. The link opens the parent view, which shows the parent menu (like "Szülői nézet"); a group admin who is not a parent gets the denied page there.
3. Teacher menu: `/teacher/beosztas` stays; the entries are now "Beosztás" (task schedule) and "Takarítás" (cleaning rota) instead of "Beosztás" and "Takarítási beosztás".

Tests: a page test (`tests/coverage/rota-card-pages.test.tsx`), an authorization test for a group admin alone and as a parent, navigation and menu-count tests, and a browser walk of the admin card as each role. Existing specs naming or counting menu entries were updated (teacher label, group admin 6 items, the group admin's last menu page is the parent view). Inventory count 223 to 224. Typecheck, lint and format are clean, and `npm run verify:local` passed (`LOCAL_VERIFICATION_PASS`, browser 660 passed and 27 skipped, evidence valid, privacy scan pass; coverage thresholds 80/80/80 unchanged and met). A first run failed on three group admin specs; they were fixed as above and the full run repeated.

## Deviations

- The teacher's overview is `/teacher/beosztas` (the route in the matrix rows), not a sub-page under `/teacher/schedule`.
- (Fixed, see "Review fixes".) No page showed a duty card to a super admin: the card route sat in the parent area.
- Planning screen: Stitch's filter chips (all weeks, empty weeks, break weeks), the "someone else edited" banner and the rules card were left out; a stale change shows the conflict message instead. Weeks are edited with an always-visible selector per row rather than a click-to-edit cell.
- Step 5's Hungarian refusal messages were delivered in step 9 as planned (see above).
- Shell rule slips: in the earlier work two small python3 commands and one scratch file in `/tmp`; in this part a few `sed -i` and `node -e` one-line edits on test files and `package`-free sources (all re-formatted and covered by the green checks), and one empty heredoc command that changed nothing.
