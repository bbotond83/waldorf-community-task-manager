# Code Generation Plan: u5-reminders-and-email

## Summary

- Builds: notices sent by email through a queue, a daily run that sends the duty reminders on time with no page open, retry rounds and a super-admin screen "Kézbesítési hibák" with "Újrapróbálás", the notice and check registries later units plug into, and the removal step (C16) for notices and emails
- Touches: one new migration in `supabase/migrations`, `src/data`, `src/identity/mail.ts`, `src/access`, `src/runtime`, `app/szulo/ertesitesek`, `app/admin/emlekeztetok` (becomes "Kézbesítési hibák"), a new `npm run timed:run` command under `scripts/`, `scripts/db`, `verification`, `contract-summary.md`, and every test that uses the simulated delivery or the page-open reminder tick
- Tests: new database test files with the fixed list, notice-mailer and timed-command tests, a changed notifications port test, an updated role-by-screen browser specification, and the existing notification tests changed for the new model

## Ground Rules

- Build order follows `functional-spec.md` ("Existing Code That Changes") and the lock order of `nfr-design/scalability-design.md`: family row, task rows, assignment rows, then job rows and delivery rows ascending; every registered check carries a `lock_step`, and the run calls checks by `lock_step` then name.
- Nothing is committed until the owner asks, and no branch is created or switched: earlier Units' work is on `main` and the workflow files stay as they are in the working tree.
- Measurable targets are inputs: coverage stays at 80/80/80, the notice list and "Kézbesítési hibák" load in under 2 seconds on the `db:seed:large` set, and no target is lowered to pass.
- The "Kézbesítési hibák" screen follows the Stitch design the owner approves first (`team.md`); the owner compares the built screen by screenshot. Existing browser specs keep their class names, or change in the same step.
- Review findings carried from the design stages are built in: titles from facts functions with an optional full title (swap decisions, rota published); Try again sends the list of (delivery id, try count) and restarts exactly that list; the failure screen titles a group by the kind label and the item date with no facts call; `notice_send` takes the community from the parent for a service-role call; the expiry sweep is service role only with `skip locked`; the mail adapter drops error text and enforces one overall 30-second timeout; removal locks the family row, then job rows ascending, then delivery rows ascending; the `housekeeping` check never reads run records to decide what is due.
- The command must not import `server-only`; it uses `createAdminAccess` and `SERVICE_ENV_FILE` as `scripts/db/first-super-admin.ts` does.
- All data is invented; every test address is added to `scripts/verification/privacy-allowlist.json`.

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
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06) \n- ALWAYS stop leftover app servers (pkill -f next-server) before a full npm run verify:local, because a leftover server on port 3100 can block the browser runs. (learned 2026-11-14) \n\n- ALWAYS add every phone number or e-mail address used in a test to scripts/verification/privacy-allowlist.json, or the privacy scan fails the verification run. (learned 2026-11-14) \n\n- ALWAYS check owner-review screenshots for error pages before sending them, because a wrong address in the screenshot script silently shows an error screen instead of the intended screen. (learned 2026-11-14)"
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
  "input_sha256": "sha256:999d92c3bba4d841472e4ba6c73cff72b9560820c912ee7564a6e0812882ff46",
  "contract_sha256": "sha256:c024f4f709c4133abfa772370e48f46abeef293b966889a9d3fdb7fb897c21a9"
}
```

## Steps

| Step | Requirements |
|---|---|
| 1 to 2 | Set-up for all |
| 3 to 4 | AC17.1.1 to AC17.1.6, BR50 to BR56, NFR1, NFR3, NFR5, NFR7, NFR11 |
| 5 to 6 | BR54, BR55, NFR1.2 to NFR1.4, NFR9 |
| 7 to 8 | BR51, BR52.6, BR55, NFR7.2, NFR7.3, NFR7.6, NFR7.11, NFR9.5 |
| 9 to 10 | NFR3.8 |
| 11 to 13 | AC17.1.2, AC17.1.4, NFR4.3, NFR8, NFR9.1 |
| 14 to 16 | The Unit's closing evidence |

### Set-up

- [ ] Step 1: Stay on the current branch and working tree (no branch is created or switched). Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [ ] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database

- [ ] Step 3: Add one migration (next file name after the latest in `supabase/migrations`) that opens and commits its own transaction, covering the "Existing Code That Changes" table of `functional-spec.md`. Registries: notice kinds (name, Hungarian label, prefix, target type), notice target types (name, facts function), timed checks (name, function, run kind, active, `lock_step`, rejected when missing), written only here, with a name-pattern constraint; seed every existing kind and target type, including `rota_published` and the swap decisions. Facts functions: one per target type, returning name, date, path and an optional full title, reproducing today's titles; not executable by application roles. Tables: delivery, attempt, timed run and timed check-run (outcome success, failed or missing; created and skipped counts; error code), with row-level security on and no select for application roles; `reminder_jobs.due_on` filled from the old scheduled moment's Budapest date, jobs in simulated states set to cancelled, the simulated attempt table dropped; the indexes of `performance-design.md`. Functions, each with `revoke all` then explicit `grant execute`, search path pinned, C1 envelope, refusals through `U3R00`: `notice_send` (no application role), `notice_email_claim`, `notice_email_sweep`, `notice_email_record` and `timed_checks_run_system` (service role only), the changed notice list and mark read, the delivery-problems list and `delivery_retry` (signed-in, checks an active super admin), the duty-reminder check, the `housekeeping` check, and `notifications_removal_preview` and `notifications_removal_apply` (C16, internal). Remove `reminder_run_jobs`, `reminder_run_due`, `reminder_run_due_system`, `reminder_list` and `reminder_retry`; update `reminder_plan` to plan a due date. Lock order follows `scalability-design.md`.
- [ ] Step 4: Write and run the database tests. New files, each with the fixed list from `unit-test-instructions.md`: `tests/database/notices-send.test.ts` (BR50), `tests/database/notices-delivery.test.ts` (BR51), `tests/database/notices-run.test.ts` (BR52, BR53, BR56), `tests/database/notices-failures.test.ts` (BR54), `tests/database/notices-migration.test.ts` (migration over seeded data: counts, job states, one title per kind before and after). Change the existing notifications database tests that use the old functions and the simulated delivery (schema, functions, handoff, locks, timing, adapters). Add each new file to `test:database:notifications` and to the shuffled run.

### Seed and data access

- [ ] Step 5: Update `scripts/db/seed` and `db:seed:large` (invented notices, queued and failed deliveries, run records) and `scripts/db/reset.ts` (one daily-run call in place of the per-organisation system tick; change `scripts/db/seed/commands.test.ts` in the same step). Update `src/data/notifications.ts` and its port: drop the member tick and the simulated delivery field; replace the reminders port with the delivery-problems port (list and "Try again" with the shown (delivery id, try count) list); add the Hungarian message mapping for every new refusal code.
- [ ] Step 6: Write and run the seed and adapter tests, including that the failure list result contains no address, parent name or family name (NFR1.3), and the shared leak test over every registered target type with two families (NFR10.4).

### Delivery and command

- [ ] Step 7: In `src/identity/mail.ts` add the notice mailer (fixed template: title as subject; item name, date, link from `APP_PUBLIC_URL`, automatic-email line; one recipient; every send error mapped to a reason class with the library text dropped; one overall 30-second timeout). Add `scripts/timed-run.ts` and the `timed:run` entry in `package.json`: run the daily or Friday-noon checks, then the delivery pass (sweep first, claim batches of 10, at most 50 per pass, no new batch after 2 minutes, record each outcome), print counts-only lines, exit non-zero on a failed check or failed email; no `server-only` import.
- [ ] Step 8: Write and run the command and mailer tests with a fake transport: sent, unavailable, rejected, slow server (overall timeout), 60 due emails (50 claimed, rest queued with no try counted), error text holding an address (never logged or stored), no-session run, and one integration check through the local mail catcher that reads the message and checks the title, item, link and automatic line and no other family's details.

### Access policy

- [ ] Step 9: Update `role-policy.ts`, `authorization.ts`, `src/runtime/navigation.ts` and `verification/authorization-matrix.json` together: "Kézbesítési hibák" for super admins only (coordinators lose the old reminders entry), a row per viewer and command.
- [ ] Step 10: Write and run the access tests: `role-policy.test.ts`, the matrix test for every changed row, and `navigation-access.test.ts`.

### Screens

- [ ] Step 11: After the owner approves the Stitch design, change `/admin/emlekeztetok` into "Kézbesítési hibák" (failed-email groups with the kind label, item date, latest try and failed count, failed or missing check records of the last 30 days, "Újrapróbálás" with success, stale, nothing-to-retry, denied and error states kept separate), with `admin-` classes; keep the old route redirecting or removed as the functional spec states. Keep the parent notice page layout, remove the simulated-delivery label and the page-open tick.
- [ ] Step 12: Update the navigation entry and any link to the old reminders screen.
- [ ] Step 13: Write and run the frontend tests: component tests for the new screen and its states, the changed notification integration and unit tests, and the role-by-screen browser specification (the new screen as each role, phone width, keyboard, accessibility clean).

### Close

- [ ] Step 14: Confirm the test configuration needs no change: coverage thresholds stay as they are. Amend `contract-summary.md` for C8 (target type `duty` stored as `task`, `rota_plan`), and C9 (`lock_step`, error code, outcome `missing`, optional moment, delivery pass).
- [ ] Step 15: Run `npm run verify:local` (with the local settings loaded and leftover servers stopped). On the `db:seed:large` set, time the notice list and "Kézbesítési hibák" and the daily run, and record the results in `code-summary.md`.
- [ ] Step 16: Update `README.md` (the timed command) and `verification/AUTHORIZATION.md`, write `code-summary.md`, `source-manifest.json` and `traceability.json`, then take screenshots for the owner's comparison with the Stitch design (checking each for an error page first).

### Review fixes

- [ ] Step 17: Fix the review findings (owner asked for changes): the Try again key is built from a hash of the full sorted (delivery id, try count) list, with a test for the collision case; no bare "Időpont:" or "Feladat:" line when a rota notice has no date or a deleted item has no name; groups of more than 500 failed emails can be retried (or show a specific Hungarian message); the timed command still runs the delivery pass when the run call itself fails, then exits non-zero; the notice send is cancelled after the 30-second timeout so a late delivery plus a retry cannot send twice; `rules.md` and `functional-spec.md` say "`lock_step` order, then check-name order"; `notices-send.test.ts` records why "outdated screen" is not meaningful for `notice_send`. Run the changed tests, `test:database:notifications` and vitest with coverage, update the summary files if file lists change, then run `npm run verify:local` again.
