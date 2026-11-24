# U11 Checklists and templates: code summary

Unit U11 gives every event a checklist of tasks that parents can take, give back and mark done, and gives administrators and working-group coordinators reusable templates to start an event's checklist from. All names in tests and seeds are invented; no real names or contact details are used.

## What changed

- **Database** (`supabase/migrations/20261067_checklists_and_templates.sql`, forward-only, one migration): tables for checklist sections, tasks, claims and templates; named functions behind row-level security for every read and change (claim, withdraw, mark done, undo, section and task edit, reorder, template save, copy, remove and restore); the event link of a duty is retired (BR169.1); starting templates are seeded.
- **Application layer**: `ChecklistApplicationFacade` (`src/application/checklist-facade.ts`) over the data port `src/data/checklists.ts`; Hungarian wording in `src/data/copy.ts`; role policy, authorization, navigation (a "Sablonok" item for the super admin) and `verification/authorization-matrix.json` extended.
- **Screens** (`app/_checklists/`, route pages under `app/*/esemenyek/[id]/feladatlista`, `app/*/munkacsoportok/[id]/sablonok` and `app/admin/sablonok`): the checklist block on the event page, the checklist editor, the template list and template editor, a template choice on the new-event form (the chosen template is copied right after the event is saved), and a "Sablonok" link on the group's events section. New CSS uses the `checklist-` prefix.
- **Seed and tests support**: invented template and checklist data; `tests/database/checklist-support.ts`.

## Tests added

- Database (real local stack, run through the `test:database:*` scripts and the shuffled run): `checklist-claims`, `checklist-claims-races` (two at once), `checklist-edit`, `checklist-templates`, `checklist-copy-read`, `checklist-removal`, `checklist-checks`, `checklist-migration`, `checklist-starting-templates`, `checklist-for-later-units`, `task-event-link-retired`. Each rule has the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two at once.
- Application and data: `src/application/checklist-facade.test.ts`, `src/data/checklists.test.ts`.
- Screens and actions: `tests/integration/checklist-actions.test.ts` (14), `tests/integration/checklist-screens.test.tsx` (18), `tests/unit/checklist-form.test.ts` (7); `event-actions` and `event-screens` extended for the template copy on create.
- Browser: `tests/browser/checklists.spec.ts` (2 flows, all three browsers, with axe and sideways-overflow checks): a coordinator starts an event from a template, a parent takes a task and gives it back, the team marks it done and takes it back; the administrator lists, creates, edits and removes a template. `tests/browser/checklists-screenshots.spec.ts` runs only when `CHECKLIST_SCREENSHOTS=<folder>` is set.

## Other existing tests updated

Menu counts (super admin 16), the navigation access test (new route and menu item), the production file count (335), the identity catalogue, notification use-case and seed tests for the new database objects, and a mock of the checklist block in the event-offer test.

## Checks run (real numbers)

Environment: local stack running, `.env.database.local` loaded, `APP_SESSION_SECRET` and `SMTP_FROM` set, `APP_PUBLIC_URL=http://127.0.0.1:3000` (the stack's own address), leftover servers stopped first.

`npm run verify:local` ran to the end in one piece: `LOCAL_VERIFICATION_PASS` at the tested commit. Earlier runs failed and were fixed: typecheck (two typing errors in new tests), five tests that counted the menu or loaded the event page without the checklist block, one identity test that needs the stack's own site address, and the super-admin menu count in `visual-overhaul.spec.ts`.

| Step | Result |
|---|---|
| format, lint, Stylelint, typecheck, manifests (37 scenarios) | pass |
| Vitest delivery tests | 80 files, 1228 tests, 0 failures |
| coverage | 92.15% statements, 86.66% branches, 94.08% functions, 93.7% lines (threshold 80) |
| database roles, identity, directory, notifications, seed, shuffled | pass |
| build, bundle, start smoke | pass |
| browser (Chromium, Firefox, mobile Chrome) | 801 passed, 66 skipped (timing and screenshot specs) |
| security scans (privacy, secrets, SAST, no-deploy, dependency audit) | pass |

The run also rewrote the tracked reports in `verification/reports/` (acceptance and outstanding targets); they are not part of the unit's source list.

## Not verified

- Real integrations: nothing was run against a hosted site or a real mail provider; six targets stay listed as outstanding in the evidence report.
- Look of the screens against the Stitch designs: screenshots were opened to confirm none is an error page; the comparison is the owner's. The two longest screens were also cropped for easier viewing.
- No timing measurement was made for these screens.

## Deferred (no screen yet)

- Naming a person who is not signed in (claim by typed name) for the team, and editing the note of an existing claim: both exist in the database and application layer, with no form on a screen.

## Owner-review screenshots

In `owner-review/`: `1-esemeny-feladatlista`, `2-uj-esemeny-sablonnal`, `3-feladatlista-szerkeszto` (and `-teteje`), `4-sablonok-lista`, `5-sablon-szerkeszto` (and `-teteje`), `6-csoport-sablonok`.
