# Code Generation Plan: u3-directory-and-profile

## Summary

- Builds: the community directory with field-level visibility, the sharing tick box, own details, password and email change, adding families and parents, removing a parent, invitations, and the removal (C16) and one-off load (C17) steps for later units
- Touches: one new migration in `supabase/migrations`, `src/data`, `src/identity`, `src/access`, `src/runtime`, `app/szulo`, `app/admin/nyilvantartasok`, a new email-confirmation page, `scripts/db`, `verification`, and every test that reads or writes the old profile fields
- Tests: new database test files with the fixed list, a sign-in service test for the password and email change, directory and account component tests, an updated role-by-screen browser specification, and the existing suites changed for the new fields

## Ground Rules

- Build order follows `functional-spec.md` ("Existing Code That Changes") and the lock order of `nfr-design/scalability-design.md` (family row, account rows ascending, parent rows ascending, request and invitation rows ascending; one address-keyed advisory lock taken before the family lock in every address-setting step; the migration redefines `identity_set_account_status`, invitation accept and account link to this order).
- Nothing is committed until the owner asks, and no branch is created or switched: the earlier Units' uncommitted work stays in the working tree.
- Measurable targets are inputs: coverage stays at 80/80/80, the directory, "Fiókom" and records pages load in under 2 seconds on the 30-family seed, and no target is lowered to pass.
- New screens follow the Stitch design the owner approves first (`team.md`); the owner compares the built screens by screenshot.
- The review findings carried from NFR Design are built in: one lock order (family, parent, request) for email confirmation and removal; the address-taken check is serialised wherever an address is set; the password-change audit row is written by the app server after the sign-in service confirms, with a failure line; removal deletes the pending email request outright.
- All data is invented. No real name or contact detail enters the repository.

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
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06)"
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
  "input_sha256": "sha256:c641c2c8dae704e348414eaa406c7b8535303d2c6e397b1c6b1ba8f4807b7e30",
  "contract_sha256": "sha256:33d6dcb00d5a59adb9d6f9f293812591067e95d72be813d1d9d7269e3fd7c964"
}
```

## Steps

| Step | Requirements |
|---|---|
| 1 to 2 | Set-up for all |
| 3 to 4 | AC3.1.x to AC3.7.x, BR30 to BR38, NFR1 to NFR7, NFR10, NFR11 |
| 5 to 6 | BR30.6, BR35, BR36, NFR9, NFR1.2 |
| 7 to 8 | BR33, BR34, BR37, NFR3.5, NFR3.6, NFR10, NFR4.7, NFR4.8 |
| 9 to 10 | NFR3.8, BR30.1, BR32.1 |
| 11 to 13 | US3.1 to US3.7, NFR8, NFR9 |
| 14 to 16 | The Unit's closing evidence |

### Set-up

- [x] Step 1: Stay on the current branch and working tree (earlier Units' uncommitted work is the base; no branch is created or switched). Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [x] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database

- [x] Step 3: Add one migration (next file name after `20261048`) that opens and commits its own transaction, covering the "Existing Code That Changes" table of `functional-spec.md`: the profile table (phone, residence, occupation, hobby, how I support, sharing consent with its time, version) filled from the old columns with every sharing value set to false, then the old free-text, consent and contact columns dropped; `email_change_requests` (partial unique index for one pending request per account, unique token hash, finish-time rules) and `email_send_attempts` (keyed address hash, index on kind, hash and sent time), both with row-level security on and no direct read for application roles; a unique index on the active parent's email on record; the audit action constraint widened by the 8 names in `observability-design.md`; the contacts read rule narrowed to super admins and the parent themself. Functions, each with `revoke all` then explicit `grant execute`, search path pinned, C1 envelope and refusals through `U3R00`: `directory_list`, `profile_set_sharing`, `profile_update_own`, `email_change_request`, `email_change_cancel`, `email_change_confirm` (all three service role only, called by the server after it checks the password; each checks the account is active and linked), `family_add`, `parent_add`, `parent_edit`, `parent_remove`, `invitation_send`, `directory_removal_preview` and `directory_removal_apply` (C16, internal), `migration_load_family` (C17, service role only), and the resend-limit check. Redefine the records save function, the lifecycle anonymisation step, the account-status step (deactivation sets sharing false) and `identity_housekeeping()` (starting from the `20261047` version, keeping every existing deletion and its grant, adding the two new deletions). Update the parents table's column rights. Lock order and the per-address advisory lock follow `scalability-design.md`.
- [x] Step 4: Write and run the database tests. Add `tests/database/directory-profile.test.ts` (BR30 to BR32, one test per row of the "Who sees what" matrix as real roles, including a parent who ticked and was then deactivated), `tests/database/directory-records.test.ts` (BR35, BR36, BR38) and `tests/database/identity-email-change.test.ts` additions (BR34, BR37, the resend limit, the guard still refusing every other sign-in email route), each with the fixed list from `unit-test-instructions.md`, plus a migration test over seeded data comparing row counts. Change the existing database tests that touch the old fields (directory schema and functions, lifecycle, seed, community roles and structure, identity, data adapters, schedule). Add each new file to `test:database:directory` or `test:database:identity` and to the shuffled run.

### Seed and data access

- [x] Step 5: Update `scripts/db/seed` and `db:seed:large` to the new profile fields with invented values. Update `src/data` (admin records adapter, payload builders, contracts, field projection) to send name, email on record, phone and children only; add a directory port and adapter, an own-account port, an invitation port and the Hungarian message mapping for each refusal code, including `EMAIL_RATE_LIMITED`.
- [x] Step 6: Write and run the seed and adapter tests, including the exact field list a viewer receives for each row of the matrix (NFR1.2, NFR1.3) and the changed admin and teacher port tests.

### Sign-in service and server

- [x] Step 7: In `src/identity`, add password change (current password checked through the existing attempt step, new password rule, ending other sessions, audit row written after confirmation, failure lines `password_change_audit_failed` and `sessions_end_failed`), the email-change request with the mail send and the change notice, the confirmation step, and the invitation mail with its resend limit (events `email_change_mail_failed` and `email_rate_limited`). Links come from `crypto.ts` (hash stored only).
- [x] Step 8: Write and run the sign-in service tests: allowed, wrong current password counted towards the lockout, invalid new password, repeated submit, forced audit failure line, forced session-end failure line, link single-use and expiry, address taken at confirmation, the fixed refusal naming nobody.

### Access policy

- [x] Step 9: Update `role-policy.ts`, `authorization.ts`, `src/runtime/navigation.ts` and `verification/authorization-matrix.json` together for the directory, own account, records and invitations (a row per viewer and command).
- [x] Step 10: Write and run the access tests: `role-policy.test.ts`, the matrix test for every new row, and `navigation-access.test.ts`.

### Screens

- [x] Step 11: After the owner approves the Stitch designs, build `/szulo/szulok` (cards, client-side search, "Nincs találat", empty text) and the teacher's equivalent, `/szulo/fiokom` (Adataim, Láthatóság, Bejelentkezés with the pending-change panel, "Mégse" and "Új levél"), the email confirmation page (success, no longer valid), and change `/admin/nyilvantartasok` (profile text and consent removed; add family and parent, edit, removal confirmation, invitation state, "Meghívó küldése" or "Új meghívó"), with `parent-` and `admin-` classes and success, empty, denied and error states kept separate (NFR4.5).
- [x] Step 12: Update the invitation acceptance page's invalid-link text and the navigation entries for the directory and "Fiókom".
- [x] Step 13: Write and run the frontend tests: component tests for the directory, account panels and records form, the changed existing integration and unit tests, and `tests/browser/directory.spec.ts` which walks each new screen as each role, checks no network call while typing in the search, and keeps the accessibility check clean.

### Close

- [x] Step 14: Confirm the test configuration needs no change: coverage thresholds stay as they are.
- [x] Step 15: Run `npm run verify:local` (with the local settings loaded). On the 30-family set, time the directory, "Fiókom" and records pages (NFR9.1) and record the results in `code-summary.md`.
- [x] Step 16: Update `README.md` and `verification/AUTHORIZATION.md`, write `code-summary.md`, `source-manifest.json` and `traceability.json`, then take screenshots for the owner's comparison with the Stitch design.
