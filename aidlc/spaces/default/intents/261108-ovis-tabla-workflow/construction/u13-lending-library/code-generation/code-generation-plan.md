# Code Generation Plan: u13-lending-library

## Summary

- Builds: the lending library: books with an owner, borrowing with an optional "until when" date, the owner's return, "tell me when it is back" requests, the book notices and the reminder to a leaving family, plus the functions later units call (daily check, removal block C16, one-off load C17)
- Touches: one new migration in `supabase/migrations`, a new library module in `src/data`, `src/application`, `src/access` and `app/` (parent library screens, teacher read-only), `scripts/db/seed`, `verification`, `contract-summary.md`, and the catalogue tests
- Tests: five new database test files with the fixed list (core and reads, commands, borrow and return with races, watches and notices, functions for later units), changed catalogue, adapter, facade and access tests, and a new library browser specification

## Ground Rules

- Build order follows `functional-spec.md` ("Conversion of Existing Code") and the lock order of `nfr-design/scalability-design.md`: the book row (the last C1 step), then its loan row and watch rows ascending. The removal block locks the family first, then books ascending. The daily check takes no book lock; this is an accepted exception, because a reminder for a book returned during the run is a harmless extra notice.
- Nothing is committed until the owner asks, and no branch is created or switched.
- Measurable targets are inputs: coverage stays at 80/80/80; list, book page, borrow, return and add finish under 2 seconds and the daily check under 5 seconds on the `db:seed:large` set (median of 5 runs); no target is lowered to pass.
- New screens follow the Stitch designs the owner approves first (`team.md`); the owner compares the built screens by screenshot. New classes use the `library-` prefix (a new area prefix, kebab-case); existing browser specs keep their class names or change in the same step.
- All data is invented; every test address or phone number is added to `scripts/verification/privacy-allowlist.json`.
- Function names follow `functional-spec.md`: `library_list` and `library_get` (the NFR design called them book list and book get). Reads return the result envelope with the data, as `notification_list` does, and a denied reader gets the denied refusal, never an empty list.
- Review findings carried from the design stages are built in as follows. The owner can change any of them at plan approval.
  - The "until when" date is checked against today when it is set (not before today, at most one year ahead); the table only requires that it is not before the borrowing date (BR133.3).
  - A second press on Visszakaptam gets VERSION_CONFLICT (the screen is outdated); a return called with the current version on a book with no open loan gets BOOK_NOT_ON_LOAN. The screen shows the same Hungarian text for both.
  - The removal preview returns counts and the opaque ids of the open loans it would flag, so U14 can list held books; no title or name is returned. The removal block's lock order is family, then books ascending, then loans and watches ascending.
  - The audit actions are named: `library_book_returned_by_admin`, `library_book_changed_by_admin`, `library_book_removed_by_admin`, `library_owner_changed_by_admin` and `library_removal_applied`. `migration_load_book` writes no audit entry and returns only a code and the row position, never a cell value.
  - A change of owner refuses a new owner who currently holds the book, and deletes the new owner's own watch on it, so a holder or a watcher never becomes the owner.
  - The notice target `book` registers a facts function `book_notice_facts` that returns the title, the link and, for the reminder, the changeover date and nothing else; it works for a removed book and for the service role (NFR10.1).
  - The return's notices go to active watchers other than the person recording the return (BR135.2); an exception from the notice function rolls the return back, a failed email never does.
  - Add book requires an active parent, group admin or super admin and no family (BR131.1); borrowing requires a family (BR133.1); the watch commands allow a parent, a group admin and a super admin (BR135.1).
  - The registry row `library_return_due` states its run kind `daily` and the last allowed `lock_step` after the existing checks, as the C9 amendment says.
  - Accent-insensitive search uses a small immutable helper with `translate` over the Hungarian accented letters and escaped wildcards; no extension is installed.
  - The race tests repeat each two-at-once case 20 times inside the test file, because the shuffled run shuffles files once and does not repeat them.
  - Contract deltas (C16, C17, C9, as listed in `functional-spec.md`) are written into `contract-summary.md` in this Unit.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "Implement each testable layer, then write and run its tests before moving to the next layer.",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.\n- **Methodology evidence**: Unchanged. Tests sit next to the code or in `tests/` in the same pull request, and each fix commit carries its regression test. Recent merges show this for screens (#2, #3, #6) and for the database (#45 added its migration and its test file together). No history shows tests written ahead of the code as a rule.\n\nWe write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source (Vitest with the Istanbul provider, thresholds 80/80/80 in `vitest.config.ts`). That figure counts application code, meaning TypeScript and JavaScript under `app/`, `src/` and `scripts/`; it does not see SQL.\n\nBefore merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. All of these run through `npm run verify:local`, which the `Validate` job runs on every pull request in Chromium, Firefox and mobile Chrome. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets.\n\nOur database rules are tested on the real local database stack in `tests/database/`, with the tests acting as the real database roles and signed-in accounts. Each new test file must be added by hand to its `test:database:*` script and to the shuffled run; a file listed in neither never runs.\n\nBecause the coverage figure cannot see the database, every database rule gets a fixed list of must-have tests: allowed; refused; out of reach; outdated screen; repeated click; and two people acting at once.\n\nThe one-off spreadsheet migration script lives in the repository. Its automatic checks use only an invented workbook in `tests/fixtures/fictitious/`. The owner additionally does trial runs against the anonymised workbook, on the owner's computer only, to prove the script reads the real layout. The anonymised workbook stays outside the repository and is not used for anything until the anonymiser has been fixed and re-run and the owner has checked the result.\n\nThe existing gates react to styling: browser specs assert computed styles, element sizes, layout at several widths and class hooks, and `tests/unit/design-tokens.test.ts` reads colour tokens only in the form `--name: #rrggbb` inside `:root` of `app/globals.css`. Changed screens keep those class names, measurements and token format, or the matching tests change in the same pull request. New screens follow `DESIGN.md`.\n\nWe design new screens in Stitch before building them. We check how new or restyled screens look by owner review: the owner compares each built screen with its Stitch design using screenshots provided by the assistant. We do not add automatic picture-comparison tests.\n\nStylelint checks `app/globals.css` as a blocking step of `npm run verify:local`. `react`, `react-dom`, `zod`, `@axe-core/playwright`, `@playwright/test`, `stylelint` and `stylelint-config-standard` stay on exact versions, guarded by `tests/unit/dependency-pins.test.ts`. CI installs from `package-lock.json`, so the development tools still marked `latest` change only when the lockfile is refreshed."
    },
    {
      "layer": "project",
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06) \n- ALWAYS stop leftover app servers (pkill -f next-server) before a full npm run verify:local, because a leftover server on port 3100 can block the browser runs. (learned 2026-11-14) \n\n- ALWAYS add every phone number or e-mail address used in a test to scripts/verification/privacy-allowlist.json, or the privacy scan fails the verification run. (learned 2026-11-14) \n\n- ALWAYS check owner-review screenshots for error pages before sending them, because a wrong address in the screenshot script silently shows an error screen instead of the intended screen. (learned 2026-11-14) \n\n- ALWAYS extend tests/database/identity-catalogue.test.ts (elevated-function list, policy-test list, scope-probe decisions) and src/data/notification-use-cases.test.ts when a new database function or table is added, or they fail on the new objects. (learned 2026-11-17)"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:7e57f43a84dafdf2f881bad3d2e69af7d331a70373be3005b521dbe35ed51924",
  "contract_sha256": "sha256:5d63c64b08ccc084f9928899775ef98244d8bddec8541e8f8aa3fbb85933a4f8"
}
```

## Steps

| Step | Stories and requirements |
|---|---|
| 1 to 2 | Set-up for all |
| 3 to 4 | US16.1 and the reads of US16.2 (AC16.1.1, AC16.1.2), BR130, BR131, NFR1, NFR3.4, NFR7.3, NFR7.5, NFR9.4 |
| 5 to 6 | US16.1 and the change and removal of a book, BR131, BR132, BR139.2, NFR3.2, NFR4.1 |
| 7 to 8 | US16.2 and US16.3 (AC16.2.1 to AC16.2.4, AC16.3.1), BR133 to BR135, BR137, BR138, NFR3.3, NFR3.5, NFR5, NFR7.1, NFR7.2, NFR10.1 |
| 9 to 10 | AC16.3.2, AC17.1.1, AC17.1.6, BR136, BR139, BR140, NFR6.4, NFR7.4, NFR7.6, NFR11 |
| 11 | NFR3.9, NFR6.3, NFR9.1 to NFR9.3 |
| 12 to 14 | All three stories on screen, NFR4.8, NFR4.9, NFR8 |
| 15 to 16 | The Unit's closing evidence |

### Set-up

- [ ] Step 1: Stay on the current branch and working tree (no branch is created or switched). Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [ ] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database: tables, notices and reads

- [ ] Step 3: Start one migration, `supabase/migrations/20261058_lending_library.sql`, that opens and commits its own transaction; steps 5, 7 and 9 add to this same file. In this step: the tables `books`, `loans` and `return_watches` with their row checks (one open loan per book by a partial unique index; an owner that is a parent or a typed name but not both; a typed name only with a source key; a return not before the borrowing; the until date not before the borrowing date; one watch per parent and book; title and authors up to 200 and description up to 1000 characters), indexes by book, by borrower family and by watch book, no right for a signed-in account on any of them; the search helper; the notice kinds `book_returned` and `book_return_due`, the target `book` with `book_notice_facts`, the registry row `library_return_due` (run kind `daily`, last lock step), and the audit action values of the ground rules, all added without touching existing rows; the reads `library_list` (with search text) and `library_get`, open to every signed-in reader including teachers, returning display names only. Every function starts with `revoke all` and an explicit `grant execute` or none, pins its search path and returns the C1 envelope.
- [ ] Step 4: Write and run `tests/database/library-core.test.ts`: the row checks attacked as the database owner (NFR7.3), the exact fields each read returns and that no signed-in role can read the tables (NFR1.2, NFR1.4), search by title and authors with and without accents and wildcard characters, korábbi tag and typed owner names, empty library and empty search, teacher and signed-out reach, and the migration applied over a seeded database with existing row counts unchanged (NFR7.5). Add the file to its `test:database:*` script and to `DATABASE_TEST_FILES` in `scripts/db/shuffled-tests.ts`.

### Database: add, change and remove

- [ ] Step 5: In the same migration: `library_book_add`, `library_book_change` and `library_book_remove` (BR131.1, BR131.2, BR132.1, BR132.2; owner defaults to the adder; version check; removal refused with BOOK_ON_LOAN and ending the book's watches without notices; owner change rules and the super-admin audit entries named in the ground rules, written in the same transaction so a failed audit write rolls the change back).
- [ ] Step 6: Write and run `tests/database/library-books.test.ts` with the fixed list for the three commands: allowed, refused for a teacher, a non-owner and a parent of another family, out of reach, outdated screen, repeated click (rows counted), the owner and a super admin at once, length and owner-validation refusals, the audit entry for a super admin and its rollback with a temporary failing trigger inside the test, and a timing check for add on the large seed (NFR9.2). Add the file to the scripts.

### Database: borrow, return and watches

- [ ] Step 7: In the same migration: `library_book_borrow` (book lock, open-loan refusal BOOK_NOT_AVAILABLE, own-book refusal, family required, optional until date, the borrower's own watch deleted), `library_loan_set_until` (borrower only, same answer for a real and a made-up loan), `library_book_return` (owner, or a super admin when no owner has rights; closes the loan, raises the version, clears a removed borrower's links, sends `book_returned` to the other active watchers with the once key book_returned plus loan id, then deletes the watches, audited for a super admin) and `library_watch_add` and `library_watch_remove` (BOOK_AVAILABLE, ALREADY_WATCHING, holder or owner refused, removing a missing watch succeeds). Row-based commands read the book id, lock the book, then the loan and watch rows ascending, then re-check.
- [ ] Step 8: Write and run `tests/database/library-loans.test.ts` (fixed list for the five loan commands and the two watch commands, including each refusal code asserted, a teacher and a coordinator refused on return, the notice text and recipients read from the local test mailbox with no holder, owner, other watcher or contact detail, a forced failure midway leaving the book borrowed, a failed email leaving the return in place) and `tests/database/library-races.test.ts` (two borrows at once, two returns at once, the owner and a super admin together, return against watch in both orders, removal against borrow in both orders, each repeated 20 times with no deadlock; timing of borrow and of a return carrying the most watches on the large seed). Add both files to the scripts.

### Database: daily check, removal and later units

- [ ] Step 9: In the same migration: `library_due_check` (takes the moment of the run; for each open loan of a leaving family inside the window of changeover date minus 30 days up to the day before, sends `book_return_due` to each active parent with an account of that family through `notice_send` with the once key book_return_due plus loan id; Budapest dates; internal, never granted to a signed-in role), `library_removal_preview` and `library_removal_apply` (C16: delete the subject's watches, clear closed-loan borrower links and owner links, flag held books and return their open-loan ids; zero counts for a subject that holds nothing; locks family, then books ascending, then loans and watches ascending) and `migration_load_book` (C17: title, authors, optional description, owner parent or typed owner name, a source key; a second call with the same key creates nothing; returns a code and the row position and no cell value; service role only).
- [ ] Step 10: Write and run `tests/database/library-for-later-units.test.ts`: the check at the moment just before and after each end of the window in both clock-change weeks, twice on one day and two runs at once, a failing run recorded while other checks still run, a returned book, a staying or new family and a cleared family link sending nothing, timing of the check on the large seed; the removal pair for a parent and for a family and for a subject that holds nothing, rows kept and links cleared; the load with an invented workbook's rows, a bad row, a repeated key, and refusal for every signed-in role. Extend `tests/database/identity-catalogue.test.ts` (elevated-function list, policy-test list, scope-probe decisions) and `src/data/notification-use-cases.test.ts` for the new functions, tables, notice kinds and target, and check the existing timed-run tests still pass with the new registry row. Add the new file to the scripts.
- [ ] Step 11: Add the library rows to `verification/authorization-matrix.json` for every role, the privacy allowlist entries, the large seed (`scripts/db/seed`) with 300 books carrying loan history, open loans and watches (one book with the most watches) and a small invented set for the ordinary seed, and update `contract-summary.md` with the deltas in the ground rules.

### Application layer and screens

- [ ] Step 12: Add the library module in `src/data` (port and adapter), `src/application` (contracts, facade, message mapping with the Hungarian refusal text for every code, including the same text for VERSION_CONFLICT and BOOK_NOT_ON_LOAN on a return) and `src/access` (`role-policy.ts`, `authorization.ts`, navigation with Könyvtár under "Több" and in the parent and teacher menus), with the Server Actions under a new `app/_library` module beside the events module; write and run the Vitest and Node tests for the adapter, facade, mapping, policy and seed, including a test that counts the data calls of each page (NFR9.4).
- [ ] Step 13: Build the screens after the owner approves their Stitch designs: the library list at `/szulo/konyvtar` with a native search box and "Új könyv", the book page at `/szulo/konyvtar/[id]` with Kölcsönveszem and its date, Értesítést kérek or Mégsem kérem, Visszakaptam, the borrower's date change, Szerkesztés and Törlés, and the book form at `/szulo/konyvtar/uj` and `/szulo/konyvtar/[id]/szerkesztes`, with the teacher seeing the list and book page read-only. Use the `library-` classes, add `data-testid` to interactive elements, show the error and denied states and the empty-library text only after a successful read (NFR4.9), and keep all text Hungarian.
- [ ] Step 14: Write and run the screen, action and access tests and a browser specification for the critical library flow (list, search, open, borrow with a date, ask to be told, owner returns) with no serious or critical accessibility violations in Chromium, Firefox and mobile Chrome.

### Closing evidence

- [ ] Step 15: Run the full `npm run verify:local` with the local settings loaded and no leftover app server; record the counts, coverage and the timing results against the targets on the large seed in `code-summary.md`; send the owner screenshots of each built screen after checking none shows an error page; list the functions that no screen calls yet (daily check, removal pair, load) as tested directly.
- [ ] Step 16: Write `code-summary.md`, `source-manifest.json` and `traceability.json` for this unit.
