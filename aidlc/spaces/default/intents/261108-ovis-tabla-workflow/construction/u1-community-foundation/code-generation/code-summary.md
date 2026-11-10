# Code Summary: u1-community-foundation

Contains no names or contact details. Nothing is committed yet.

## What changed

- One forward migration, `supabase/migrations/20261047_community_foundation.sql`: the clean start, working groups with a description, membership per parent, optional group on events and tasks, the new role and scope pairs, the converted rules, the working-group list and name-only family list, and removal of the import's functions and tables.
- The application: `/szulo/munkacsoportok`, `/teacher/munkacsoportok` and `/admin/munkacsoportok`, "Munkacsoport" on Nyilvántartások with a description and no family membership field, the teacher's whole-community schedule and filter, the "Koordinátor" label, the "Szülői nézet" / "Adminisztráció" link, and group administrators without records.
- The import is gone: screen, actions, parser, adapters, `@e965/xlsx`, the timing stage, the 6 MB server-action limit, the verification rows and stories US-08 to US-10.

## Test results (last run of each command)

| Command | Result |
|---|---|
| `verify:local`, after rebuilding the local database | Pass: every step, including the identity suite and all three browsers |
| `test:domain` | 469 of 469 |
| `test:scripts` | 250 of 250 |
| `test:delivery` | 841 of 841 |
| `test:database:roles` | 9 of 9 |
| `test:database:stack` | 131 of 131 |
| `test:database:identity` | Passes inside `verify:local` |
| `test:database:directory` | 551 of 551 |
| `test:database:notifications` | 124 of 124 |
| `test:database:seed` | 57 of 57 |
| `test:database:shuffled` | Passes inside `verify:local` |
| `test:bundle` | 5 of 5 |
| `test:coverage` | Passes at 80/80/80. Delivery: lines 97.74, statements 96.7, branches 90.73, functions 95.57. Domain: lines 99.14, branches 94.12, functions 96.58 |
| `verify:manifests`, `format:check`, `lint`, `lint:css`, `typecheck`, `build`, `smoke:start`, `verify:security` | Pass |
| `test:browser`, Chromium, Firefox and mobile Chrome | 648 passed, 21 skipped by existing per-browser rules, 0 failed |

`identity-catalogue.test.ts`, "pins the search path of every function", failed before this Unit, in the `public` schema only: the owner's long-lived local database stored `platform_audit_write`'s path differently. On the owner's instruction the local `public` schema was rebuilt from the migration files and re-seeded, and the test now passes. No repository change was needed. `verify:local` judged the working tree on top of commit `d24ab2a`; nothing is committed.

## Baseline

Before any change took effect:

| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| `test:domain` | 511 | 511 | 0 | 0 |
| `test:scripts` | 254 | 254 | 0 | 0 |
| `test:delivery` | 901 | 901 | 0 | 0 |
| `test:database:roles` | 9 | 9 | 0 | 0 |
| `test:database:stack` | 131 | 131 | 0 | 0 |
| `test:database:identity` | 332 | 331 | 1 | 0 |
| `test:database:directory` | 352 | 352 | 0 | 0 |
| `test:database:notifications-import` | 258 | 256 | 0 | 2 |
| `test:database:seed` | 57 | 57 | 0 | 0 |

Totals fell where the import's tests were removed and rose in `test:database:directory` with the new `community-*` files.

## NFR9.1 timings

Production build, Chromium, `db:seed:large` set (30 families, 11 tasks), median of 5 loads against a target of under 2000 ms. Full data: `verification/reports/u1-community-foundation/nfr9-timings.json`.

| Page | Median | Worst |
|---|---|---|
| Working-group list (parent) | 43 ms | 44 ms |
| Parent Feladatok | 40 ms | 44 ms |
| Teacher unfiltered Beosztás | 43 ms | 47 ms |
| Administrator Feladatok és események | 46 ms | 49 ms |

## Key Decisions and Deviations

- `schedule_get` takes a scope of `all`, `community` or `group`, plus an optional group id.
- `directory_actor_family` follows `current_family_id`, so an account with a linked parent but no parent grant has no family.
- A group administrator's Archívum lists their own archived groups, read-only, with no restore button.
- Stories US-08 to US-10 and `NFR08-IMPORT` left the required verification lists, because they were the import's.
- `tests/integration/admin-advanced-components.test.tsx` was deleted rather than rewritten: it tested only the import workflow.
- The `ineligible` assignment codes went with the membership check.
- Steps 3 to 6 were done together, because the seed test (BR2.1) needed the seed.
- All tests were written and run; none is left unexecuted.

## Limitations

- A signed-out visitor to a parent page sees "Bejelentkezés szükséges" with a link to sign-in, and to a teacher or admin page is redirected to the home page, which offers sign-in. This is the existing behaviour of those areas. BR2.4 says "redirect to sign-in".
- A group-admin grant counts in the database while the linked parent is active, but the pages also need the account's parent grant to read that parent. An account holding the group-admin grant with no parent grant is refused on the pages. It fails closed. The seed's administrators hold both.
