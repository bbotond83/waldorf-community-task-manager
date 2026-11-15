# U4 code summary

Baseline before U4 (Step 1 suite counts): domain 569, scripts 264, vitest 64 files / 922 tests, database stack 131, identity 358, directory 847, seed 57; notifications 199 measured after the migration existed (195 passed, 4 failed because of U4's registry additions, fixed since).

## What changed
- Migrations `20261051_working_groups.sql` (join, leave, group page read, coordinator appoint and revoke with notice and email, C7 facts `group_members` and `group_coordinators`, C16 removal block, lifecycle fix, closed direct grant path) and `20261052_governance_revoke_coordinator.sql` (the admin Settings revoke of a group-admin right is routed to the coordinator-revoke path).
- Data port, facade, role policy, authorization matrix (12 exact rows for the three group routes), seed, Hungarian message map.
- Screens (Steps 11 and 12): `app/szulo|teacher|admin/munkacsoportok/[id]`, one shared page component `src/runtime/WorkingGroupDetail.tsx` (classes `parent-group-*`, `teacher-group-*`, `admin-group-*`), the parent's join and leave panel with the coordinator warning, server actions `app/szulo/group-actions.ts` and `app/admin/group-actions.ts`, shared result mapper `app/_lib/working-group-result.ts`. List cards are links (`workgroup-card-link`, whole card clickable). The navigation needed no change (the entries point at the list pages; the group page keeps its list entry highlighted).
- Page address that is not an identifier reads as an unavailable group, not an error (`src/data/working-groups.ts`, with a test).

## Design choices and differences from the Stitch designs
- Built only what the plan names. Not built: meeting rhythm, place, recommended hours, children's classes, "Archívum megtekintése", "Leírás szerkesztése", "+ Új tag felvétele", member filter, bottom tab bar (our own navigation is kept), ERR_ codes, and the stacked state showcase. States are real and separate: success, empty member list, unavailable, denied (same as unavailable), conflict, error.
- The design's "Aktív fiók / Nincs fiók" column is not built: the account status is not in the member model (the database withholds it from the page; a refusal for a person without an account says so in words after pressing the button).
- A member's name links to the area's directory page (`/szulo/szulok`, `/teacher/szulok`, `/admin/szulok`); directory cards have no address of their own, so it cannot go to one card.
- A group administrator sees the member list without the coordinator buttons (the row version is given to super admins only); the teacher page is the parent page without any button.
- Leaving asks "Biztosan ki szeretnél lépni ebből a csoportból?" first; a coordinator also reads the warning from the rules.
- Informal address (tegező) follows the approved rules text, so it differs from the older formal copy elsewhere.

## Checks run
- Typecheck, ESLint, Prettier, Stylelint clean.
- `npm run verify:local`: PASS (28 min 24 s, all three browsers: Chromium, Firefox, mobile Chrome; 756 browser tests passed, 3 screenshot and timing specs skipped as designed). Counts: domain 587, scripts 265, vitest delivery 66 files / 990 tests (coverage run 1842 tests; coverage 93.46 / 86.29 / 93.06 / 94.66, thresholds 80 unchanged), roles 9, stack 131, identity 358, directory 959, notifications 199, seed 58, shuffled run green.
- New tests: `tests/integration/working-group-pages.test.tsx` (44: page states, member rows, contact details, join and leave panel, the four actions with refusal wording and input checks, the three pages as each role), `tests/browser/working-groups.spec.ts` (11 per browser: each route as each role, card link, join by keyboard and leave after confirmation, coordinator warning, teacher and group admin read-only, appoint and revoke as super admin until the group is bare, missing group, phone width, visible focus, axe serious/critical none). Changed: `community-roles.spec.ts` (six links), `working-groups.test.tsx`, `request-world.ts` (working-group port double), `production-inventory.test.ts` (245 to 253 production files).
- Test configuration: no change; coverage thresholds stay 80/80/80.

## Lock order exception: coordinator_appoint only
The migration header says every path locks family, accounts, parents, memberships, then grants. `coordinator_appoint` locks the membership row first, and its grant insert (through `grant_admin`) then takes a key-share lock on the account row, the reverse of `lifecycle_run_core` and `working_groups_removal_apply` (accounts, then memberships). This is safe today: the lifecycle step runs only on an archived family and `grant_admin` refuses an archived family, so the two cannot hold crossing locks (the 50-round appoint-against-lifecycle race ends only in a refusal, never a wait). `coordinator_revoke` is in order: it ends the grant through `end_admin`, which takes no account lock. The applied migration is not edited. Open item for U14: its removal on an active family must add a race test (appoint against removal apply) or take the accounts lock before the membership lock.

## Timing on db:seed:large (Chromium, owner's computer)
The large seed data set holds the 11-member group measured here, one run per role; the 2 s margin is therefore indicative and should be re-measured with a larger group before it is relied on. Group page with 11 members, slowest of three loads until the member list is on screen: parent 67 ms, teacher 835 ms, super admin 839 ms (target 2 s). Teacher and admin areas stream their content behind a loading screen, and the existing admin directory page measured the same way takes about 365 ms (first load after sign-in up to 840 ms), so this is the area's own cost, not the group read; the database call itself takes about 5 ms. Command: `WORKING_GROUP_TIMING=1 npx playwright test --project=chromium tests/browser/working-groups-timing.spec.ts`. The race tests add about 6 s per run of their file, about 12 s per `verify:local` because the file is in both the directory list and the shuffled run.

## Environment note
The roles database suite (`test:database:roles`) failed to start its disposable PostgreSQL here only because this session's temporary folder path is too long for a Unix socket. With a short `TMPDIR` it passes (9 of 9), so it is not a gap of the code. `APP_PUBLIC_URL` must be `http://127.0.0.1:3000` for the identity configuration test.

## Documents
`verification/AUTHORIZATION.md` (new "Working groups" section), contract-summary C7 (names) and C16 (U4 before U3), `source-manifest.json`, `traceability.json`.

## Owner-review screenshots
`screenshots/built/`, phone (390 px) and computer (1280 px) each: 1 parent not a member, 2 parent after joining, 3 leave confirmation, 4 coordinator leave warning, 5 teacher, 6 admin, 7 admin after appointing, 8 admin with no coordinator. Every shot first checks the heading and that no error, denied or unavailable page shows. Regenerate: `WORKING_GROUP_SCREENSHOTS=<folder> npx playwright test --project=chromium tests/browser/working-groups-screenshots.spec.ts`.

## Not verified
No hosted target; real mail servers not used. Pictures are for the owner's comparison with Stitch; no automatic picture comparison. Nothing committed.
