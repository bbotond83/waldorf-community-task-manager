# U12 To-do list and My tasks: code summary

Unit U12 gives the community a shared to-do list. A task belongs to a working group or to one family, has at most one claimant, a status, a done mark, a history and an attention flag. Parents claim, give back and finish tasks; coordinators and administrators create and manage them and pull them into an event's checklist. A "My tasks" page shows a family's duties, recurring duties and claimed tasks by week. All names and texts in tests and seeds are invented; no real names or contact details are used.

## What changed

- **Database** (`supabase/migrations/20261071_todo_and_my_tasks.sql`, one forward-only migration, 1717 lines): the tables `todo_tasks`, `todo_task_history` (cannot be changed or deleted) and `todo_event_links`, with their checks and row-level security; the commands `todo_task_save`, `todo_task_claim`, `todo_task_give_back`, `todo_task_free_claim`, `todo_task_update`, `todo_task_mark_done`, `todo_task_undo_done`; `todo_pull_to_event`; the reads `todo_list`, `todo_get`, `todo_list_for_group` and `my_tasks_get`; the internal `todo_task_set_attention`, `checklist_task_done_state`, `todo_deadline_reminder`, `todo_removal_preview`, `todo_removal_apply` and `migration_load_todo`; the notice kinds `todo_changed` and `todo_due`. Claim, give-back and done mark re-check, after the row is locked, that the caller is still an active parent with an active family.
- **Application layer**: `TodoApplicationFacade` (`src/application/todo-facade.ts`) over the data module `src/data/todo.ts`; display helpers `src/application/todo-format.ts`; Hungarian refusal texts (including `no_parent_record`, `too_many_tasks`, `status_not_allowed`); role policy, authorization and navigation (Feladataim for parent and group admin, Teendők for every role); `verification/authorization-matrix.json` rows.
- **Screens** (`app/_todo/` and the route pages): the to-do list and task page, My tasks, the management page with its tabs, the task form for coordinators and administrators, the "Teendők hozzáadása" pull list on the event page, a read-only teacher view, and the group page changes (a "Kezelés" link for managers, a "Teendők" section for readers, the temporary recurring-duty and template links removed). New CSS uses the `todo-` prefix. Only the owner-approved Stitch copy is used; everything invented in the designs was dropped.
- **Seed and test support**: invented tasks in the normal seed and a few hundred in the large seed; `tests/database/todo-support.ts`.

Routes: `/szulo/teendok`, `/szulo/teendok/[id]`, `/szulo/feladataim`, `/teacher/teendok` and `/teacher/teendok/[id]` (read only), `/admin/teendok` with `uj`, `[id]` and `[id]/szerkesztes`, `kezeles`, `kezeles/teendo` and `kezeles/teendo/[taskId]` under both `/szulo/munkacsoportok/[id]` and `/admin/munkacsoportok/[id]`, and `esemenyek/[id]/teendok` under `/szulo` and `/admin`. The full file list is in `source-manifest.json`.

## Tests added or changed

- **Database** (real local stack, in `test:database:directory` and the shuffled run; each rule has the fixed list): `todo-tasks`, `todo-claims`, `todo-races`, `todo-pull`, `todo-reads`, `todo-checks`, `todo-for-later-units`, `todo-removal`, `todo-migration`. `identity-catalogue` and `notification-use-cases` extended for the new objects.
- **Application and data**: `src/application/todo-facade.test.ts`, `todo-format.test.ts` (8), `src/data/todo.test.ts`, `src/access/todo-policy.test.ts`.
- **Screens and actions**: `tests/integration/todo-actions.test.ts` (18), `todo-pages.test.tsx` (10), `todo-actor.test.ts` (3), `todo-screens.test.tsx` (30).
- **Browser**: `tests/browser/todo.spec.ts` (parent flow, coordinator management, event pull list, teacher read-only, super admin, each role's refusals, with axe and sideways-overflow checks in all three browsers), `todo-timing.spec.ts` (runs only with `TODO_TIMING=1`), `todo-screenshots.spec.ts` (runs only with `TODO_SCREENSHOTS=<folder>`).
- **Existing tests updated**: menu items and counts in `app-nav`, `runtime-shell`, `navigation-access`, `runtime-foundation`, `teacher-web`, `visual-overhaul` (super admin 19, group admin 15, parent 14, teacher 9) and `navigation-polish`; group-page links in `recurring-screens`, `event-screens`, `checklist-screens`; production file count 382; notice and seed tests.

## Checks run (real numbers)

`npm run verify:local` was run in full by the coordinator with the local settings loaded and no leftover app server. It passed: 831 browser tests passed and 75 skipped (the timing and screenshot specs), the privacy scan passed, and the evidence is valid. Acceptance report at commit 05ecd50: 31 PASS, 0 FAIL, 6 OUTSTANDING.

| Step | Result |
|---|---|
| Vitest delivery tests | 86 files, 1325 tests, 0 failures |
| Coverage (after the review fixes) | 181 files, 2389 tests; all files 92.18% statements, 87.11% branches, 94.36% functions, 93.77% lines (threshold 80) |
| Follow-up checks | typecheck, `npm run lint`, `npm run format:check` and Stylelint clean; the five to-do database files plus identity-catalogue (160 tests, both schemas) green after the review fixes; the shuffled database run passed (123 files); Playwright on the to-do, working-groups, checklists and events specs, three browsers, 63 passed; the full verify:local was not re-run by me |
| Browser (Chromium, Firefox, mobile Chrome) | 831 passed, 75 skipped |
| Privacy scan, SAST, secrets, no-deploy, dependency audit | pass |

Note on the database-roles step: it needs `TMPDIR=/tmp`. With the default temporary folder it failed in this environment, so the passing run used `TMPDIR=/tmp`.

Timing on the large seed (300 tasks, Chromium, `TODO_TIMING=1`, run before the final full verification): list 166 ms, task page 61 ms, My tasks 67 ms, group page 80 ms, management page 71 ms, pull list 110 ms, claim 106 ms, give back 124 ms. Targets (pages under 2 s, commands under 1 s) are met and were not lowered.

## Follow-up work after the owner's review (the three earlier gaps are closed)

1. **Transfer to another family ("Átadás másik családnak").** The task form has a family chooser (`todo-new-owner-family`), shown to a super admin for a family-owned task; the admin task page has a link to it. It uses the existing save command with a new owner, so **no database change was needed**. The family list comes from the existing scoped family-name read. A coordinator cannot hand over, because the database refuses it; the form shows no chooser then. New tests: allowed, refused (coordinator), out of reach, outdated screen, repeated click and two at once, plus plain-text and revoked-right checks (NFR3.30).
2. **Screen-reader announcement.** A page-level status region (`role="status"`, polite) on the list, task, My tasks and management pages announces the result of Vállalom, Kész, Mégsem kész, Visszaadom and Felszabadítás in Hungarian after the refresh. Errors keep `role="alert"`. Tested in unit tests and in the browser spec.
3. **Management page tabs.** Ismétlődő feladatok, Sablonok and Tagok now render inline (`?ful=` selects the tab; only the open tab is read), reusing the existing reads. The members tab is read only. Parents and teachers have their read-only link to the group's recurring-duty page again.

## Review follow-up (one Major, six Minor)

The unit review answered READY with these findings; all are fixed. The first migration (`20261071`) was applied on the local stack and the project rule is that an applied file is never edited, so the fixes are a **new forward-only file, `supabase/migrations/20261072_u12_review_fixes.sql`**, which replaces the functions and restates their rights (the same way `20261070` did). Nothing needs a reset of the local stack; `npm run db:migrate` applied it.

- **Major, a hand-over kept the claimant.** `todo_task_save` now releases a claim held by a parent of another family when the owner changes to a family: the claimant and claim time are cleared, in progress goes back to open (postponed stays postponed), a `claim_freed` history row is written, the claimant is told, and a claim freed from another person is audited as in the free-claim command. A claim held by a parent of the new family stays; a done task keeps its mark. New database tests: claimed task handed over (allowed), postponed, kept claim and done variants, refused/out of reach/outdated screen, repeated click (one history pair and one notice), and two hand-overs at once.
- **Minor 1.** `migration_load_todo` stores a sheet row "in progress" as open (the load sets no claimant). Test added.
- **Minor 2.** When a family is named as owner, `todo_task_save` now share-locks the family row first, before the task row (the removal pair locks family, then tasks). Only a super admin naming a family takes this lock; the other commands take none, so the existing lock-timing tests are untouched. Test: a hand-over waits for a removal holding the family row and then reads the family as gone.
- **Minor 3.** All seven commands that return a version (save, claim, give back, free claim, update, mark done, undo done) now also return the current version on a repeated key. Tests added.
- **Minor 4.** The owner filter choices on the list page come from a second, wider read when a filter narrows the list, so choosing one owner no longer leaves only that owner in the choices. Test added.
- **Minor 5.** The text for an event link whose checklist task is gone is now "Már nincs az esemény feladatlistáján." (BR185.2).
- **Minor 6.** `traceability.json` names the test cases per entry (a `tests` list of title starts, each checked to exist in its file); entries for configuration files, the privacy allowlist, the authorization matrix and whole screen files keep the file as target. The sensor passes with 0 findings.
- **Not touched, for the owner:** the "Átadás másik családnak" action and the "Csak figyelmet igénylők" filter were not in the approved screen table; they are left as they are until the owner decides.

Remaining limits: a handover is offered only to super admins and only for family-owned tasks (a group-owned task cannot be moved to a family from the form); the family-owned task is not listed on the group management page, so the handover link is on the task page `/admin/teendok/[id]`; the status region is visually hidden; coordinator appointment stays on the group page; NFR7.18 (all or nothing for every command) is covered by the pull test only, with no forced-failure test for the other commands.

Other behaviours to confirm: admin routing differs from the plan's path wording (see Routes above); "Már hozzáadva" on the pull list means the task is on some event's list, and the database skips a task already on the chosen event; a super admin without a family acts with community scope, everyone else with family scope.

New tests closing earlier gaps: timing of the five commands with 600 tasks (NFR9.14), pull of 50 under 2 s (NFR9.15), reminder under 1 s (NFR9.16), escaped markup (NFR1.10), repeated-click audit (NFR4.18). New files: `app/_todo/TodoAnnouncer.tsx`, `tests/integration/todo-announcer.test.tsx`; changed: `TemplateScreens.tsx`, `WorkingGroupDetail.tsx`, the two management pages. `source-manifest.json` now lists 99 files and `traceability.json` was re-checked line by line (the traceability sensor passes with 0 findings).

## Not verified

- Real integrations: nothing was run against a hosted site or a real mail provider; the six outstanding targets stay listed in the evidence report.
- Look of the screens against the Stitch designs is the owner's check. Screenshots were produced, and each is checked to be the intended page and not an error page; I looked at two myself (list on phone, management page on desktop) and did not look at the other five.
- Timing figures above were measured in Chromium only.

## Process disclosures

- One edit to `app/_todo/actions.ts` was made with a Python script instead of a file tool. Two further `python3` calls were harmless no-op prints, and a third no-op print was made while preparing this summary. Nothing was changed by them.
- During the follow-up work one more harmless `python3` no-op print, a second `python3 -V` version check and two no-op heredocs to /dev/null were run by mistake; no file was changed by them. One `npx aidlc` call tried to fetch a package of that name from the internet and failed (unknown command); I then used the installed `aidlc` command instead. Nothing from it is used.
- Nothing was committed and no branch was created or switched.
- `test-results/` from Playwright failures may remain in the project folder (normally git-ignored). The run also rewrote the tracked reports in `verification/reports/`; they are not part of the unit's source list.

## Owner-review screenshots

Generated into the session scratchpad (`.../scratchpad/shots`): `1-kozos-teendok-phone`, `2-teendo-reszletei-phone`, `3-feladataim-phone`, `4-munkacsoport-kezelese-phone` and `-desktop`, `5-uj-teendo-phone`, `6-teendok-hozzaadasa-phone`. Regenerate with `TODO_SCREENSHOTS=<folder>` and `todo-screenshots.spec.ts`.
