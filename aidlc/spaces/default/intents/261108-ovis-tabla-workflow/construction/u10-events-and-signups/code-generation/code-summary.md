# U10 Events and sign-ups: code summary

Unit U10 turns events into a full feature: community and working-group events, notices, roles with an organiser mark, the year's tale, sign-ups with a note, food offers, three event notice kinds, and the functions later units call. Contains no real names or contact details; all test data is invented.

## What changed

- **Database** (`supabase/migrations/20261056_events_and_signups.sql`, `20261057_event_list_signup_counts.sql`): events gain summer flag, sign-up deadline, notice lead, food switch and tale (and lose the three note fields and the coordinator name); tables for notices, roles, sign-ups and food offers; named functions behind row-level security for every change and read; removal preview/apply for C16. The second migration adds the sign-up count and an "is signed up" flag to `event_list` and `event_list_for_group`. Both are forward-only; no applied file was edited.
- **Application layer**: `EventApplicationFacade` (`src/application/event-facade.ts`) over `createEventPort` (`src/data/events.ts`); Hungarian wording in `src/application/event-format.ts` and `src/data/copy.ts`; role policy, authorization, navigation (four "Események" items) and `verification/authorization-matrix.json` extended.
- **Screens** (`app/_events/`, routes under `app/szulo/esemenyek`, `app/teacher/esemenyek`, `app/admin/esemenyek`): events list with past switch, event page (open, closed, finished, cancelled, signed-up), event form with notices, role and tale editors, cancel with confirmation, food-offer add/change/withdraw, and an Események section on the three group pages. New CSS uses the `parent-event-` and `parent-group-events` prefixes.
- **Seed**: invented events with notices, roles, sign-ups and offers in the first group. Each seeded event role now gets its own creation second (see "Found while verifying").

## Tests added in steps 15 and 16

- `tests/integration/event-actions.test.ts` (17 tests): every event action, boundary refusals, Hungarian messages, scope choice for coordinators.
- `tests/integration/event-screens.test.tsx` (22 tests): list, event page states, form editors, group section.
- `tests/browser/events.spec.ts` (2 tests, all three browsers): coordinator creates an event; parent opens the list and the event, signs up with a note, adds, changes and withdraws a food offer, withdraws; coordinator cancels; parent sees it cancelled. Accessibility (axe) and sideways-overflow checks on the new-event form, the list, the open event, the signed-up event, the cancelled event, the group page and the seeded event page.
- `tests/browser/events-timing.spec.ts` and `events-screenshots.spec.ts`: switched on only by `EVENT_TIMING=1` and `EVENT_SCREENSHOTS=<folder>`.
- Spec location: the plan text said `tests/e2e/events.spec.ts`; the project's Playwright folder is `tests/browser/`, so the spec lives there.
- No phone or e-mail was added to tests, so the privacy allowlist is unchanged.

## Found while verifying, and fixed

- `tests/database/notifications-handoff.test.ts`: it said a cancelled event writes no notice. Since BR118 it tells the families, so the test now expects only event-cancelled notices to be new.
- `tests/database/notices-send.test.ts`: the registry holds 19 notice kinds (16 plus the three event kinds).
- `tests/database/notices-failures.test.ts`: the shared leak test now has a case for the new `event` target type.
- `tests/browser/visual-overhaul.spec.ts`: menu counts +1 for every role (13, 8, 8, 5).
- `tests/browser/teacher-web.spec.ts` and `scripts/db/seed/write.ts`: the teacher schedule shows the name of an event's oldest role. The seed inserted all roles in one instant, so which one was oldest depended on random ids and differed between browsers (Chromium showed "Szervező", Firefox "Süteménysütő"). The seed now gives each role its own second, with a regression assertion in `scripts/db/seed/write.test.ts`; the browser test expects "Szervező".
- Browser worker schemas (`worker_1` to `worker_3`) had to be brought up to date with `npm run db:worker -- worker_N`, otherwise the new tables were missing there.

## Checks run (real numbers)

Environment: local stack running, `.env.database.local` loaded, `APP_SESSION_SECRET` set, `APP_PUBLIC_URL=http://127.0.0.1:3000` (the stack's own site address; with 3100 one identity test fails by design), `SMTP_FROM` set, leftover servers stopped first.

`npm run verify:local` was run four times. The last full pass stopped at the `security` step; everything before it passed:

| Step | Result |
|---|---|
| toolchain, manifests (37 scenarios), format, lint, lint:css, typecheck | pass |
| tests (domain 637, scripts 268, Vitest delivery) | pass, 0 failures |
| database roles, stack, identity, directory, notifications (199), seed, shuffled | pass |
| coverage | pass: domain tests 99.38 lines, 94.55 branches, 97.23 functions; Vitest 147 files, 1979 tests, 94.30 lines, 86.69 branches, 94.14 functions, 92.93 statements (thresholds 80/80/80) |
| security: privacy, secrets, SAST, no-deploy scans | pass |
| security: `npm audit --audit-level=high` | **FAIL**: 12 high findings in existing development tools (the `picomatch` chain used by stylelint, vitest, vite, fast-glob, tinyglobby) and 6 moderate (`minimatch` under typescript-eslint). `package-lock.json` is unchanged by this unit, so the advisory is new, not caused by U10. Fixing it means refreshing the lockfile or the pinned tools, which is outside this unit |

Because `verify:local` stops at the first failure, the later steps were run by hand with the same environment: `build` (pass), `test:bundle` (pass), `smoke:start` (pass), `test:browser`: 753 passed, 48 skipped (timing and screenshot specs), 15 failed. The 15 were the five tests described above (teacher schedule, four menu counts) in three browsers. After the fixes, `visual-overhaul`, `teacher-web` and `events` specs were rerun in all three browsers: 66 passed. A complete browser run after the fixes was not repeated, and `verify:local` has not been run to the end in one piece because of the audit step.

Format, lint, Stylelint, typecheck, privacy scan and manifest validation were run again after the last edits: pass.

## Timing against the 2-second target (NFR9.1)

`EVENT_TIMING=1` on the 30-family large seed (schema `worker_1`, Chromium, slowest of three loads, local machine): parent list 86 ms, parent event page 71 ms, group page with events 62 ms, admin edit page 841 ms. All under 2000 ms. Limits: the seed puts only two sign-ups and two offers on an event, so this is not a worst case for a busy event; and a local run says nothing about a hosted site.

## Not verified

- The audit step (above) and therefore one uninterrupted green `verify:local`.
- Real integrations: nothing here was run against a hosted site or real mail provider.
- Look of the screens against the Stitch designs: screenshots were taken and opened to confirm none is an error or sign-in page; the comparison is the owner's.

## Owner-review screenshots

In `screenshots/` (phone 390 px wide for parent screens, desktop 1280 px for the form), all opened and checked: `1-esemenyek-lista-phone.png`, `2-esemeny-nyitott-phone.png` (the seed already holds a sign-up for this parent, so it shows the signed-up layout with the add form), `3-esemeny-jelentkezve-phone.png` (after one more sign-up with a note), `4-munkacsoport-esemenyek-phone.png`, `5-esemeny-szerkesztes-computer.png`.

## Design choices

- Business rules stay in database functions; the application layer authorizes, translates and presents.
- The list count and the "Jelentkeztél" flag come from the database read, so the screen needs no extra queries.
- The manager's scope is derived from the person's own grants (`manageScopeFor`); nothing the browser sends picks it.

## Rework after Request Changes (2026-11-21)

The owner asked for the architecture reviewer's findings to be fixed before approval. Changed:

- **Removal tests:** `tests/database/events-removal.test.ts` gains a "two at once" test (a sign-up made while a removal holds the event waits for it, then lands after it, no deadlock). The file header now says why "outdated screen" does not apply to a step that takes no version.
- **Lengths:** the sign-up note box allows 500 characters and the event title box 200, matching the database and BR108.1 / BR102.1; the note is no longer cut at 300.
- **Refusal words:** `VAL-ARCHIVED` and `VAL-DATE-RANGE` now read as Hungarian sentences (`src/data/copy.ts`, `app/_events/event-result.ts`), with a regression test in `src/data/events.test.ts`.
- **Accessibility:** the withdraw buttons carry an accessible name that says whose sign-up or which offer they act on (`submitAriaLabel` on `ParentMutationForm`), tested in `tests/integration/event-screens.test.tsx`.
- **Documents:** BR110.1 (a repeated withdrawal answers denied) and BR119.1 (`event_list_for_group` readable by every signed-in reader, with the count and own flag) now match the built behaviour; the test instructions point to `tests/browser/events.spec.ts` and list `events-list-signups.test.ts`.
- **Not changed:** the sign-up note stays visible to all signed-in readers; the removal-race note on family locks; `event_role_save` visibility check and role order by `created_at`; focus move to the cancel confirmation; a confirmation for a manager deleting someone else's sign-up. These stay open as advisory notes.
