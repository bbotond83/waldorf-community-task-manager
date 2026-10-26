# Follow-up plan: open review findings after Code Generation

Status: planned, not started. To be executed after the intent `261012-real-backend-local` is closed (after Build and Test and the later stages), as ordinary pull requests on `main`.

Why wait: the five units are approved. Under the strict change policy, any edit to a file a unit claims (source, tests, a unit's summary or manifest) withdraws that unit's approval and forces a new review. After the intent is closed no approval is at stake, so these changes can be made and reviewed like normal work.

Source: the READY reviews of U1 to U5 recorded on 2026-10-25 (review files under `construction/<unit>/code-generation/reviews/`). Nothing below blocked a READY verdict.

## Summary

| Group | What | Size | Risk if left |
|---|---|---|---|
| A | Close the one Major finding: the network-exposure check ignores IPv6 | Small code change + test | A machine with a LAN or global IPv6 address could pass the check while the local database ports are reachable |
| B | Two small hardening fixes in the database and sign-in code | Small to medium | Failed audit purge stops the daily cleanup; a locked-out person can still be refused after a password reset |
| C | Two flaky tests | Small | Random CI failures that look like real breakage |
| D | Security-tooling gaps (scan exemptions, phone allowlist, moderate audit advisories) | Small | Real personal data in a text file under `aidlc/` or `source-materials/` would not be caught |
| E | Documentation and manifest drift | Docs only | Readers take old counts and old statements as current |
| F | Decisions only the owner can make | Conversation | Behaviour stays as it is today |

Suggested order: A, then B, then C (one PR each, because each changes behaviour), then D and E together (low risk), then F as the owner decides.

## A. Network-exposure check does not look at IPv6 (U1, Major)

- Finding: `scripts/db/stack.ts` (`externalAddresses`, `findExposedPorts`) only probes IPv4 addresses. The Supabase CLI publishes its ports on all interfaces, so a machine with a LAN, private-range or global IPv6 address passes the check while the database, data API and mail catcher are reachable on that address. `db:start` then reports success without the acknowledgement flag.
- Plan: also list the machine's non-internal IPv6 addresses and probe them. Skip link-local addresses that need an interface scope, or probe them with their scope. Add a unit test with a fake IPv6 address that answers (must be refused), and one where no IPv6 address answers (must pass).
- Fallback if probing IPv6 turns out to be unreliable on macOS: state plainly in the code summary and in `--help` that IPv6 is not checked, and keep the rule in the README.
- Checks: stack-free unit tests for `stack.ts`, then one real `db:start` on the owner's machine.
- Owner action: starting the stack stays with the owner (they set the acknowledgement flag; the assistant never does).

## B. Hardening in the database and sign-in code

B1. Audit purge failure stops the housekeeping job (U2 R-18, U5 R-08).
- Finding: `audit_purge()` is called inside `identity_housekeeping()` in the same transaction. If the delete fails or times out (for example the first run against a large backlog), the whole housekeeping call rolls back, so sign-in attempt pruning, stale reservation release and orphan cleanup do not run.
- Plan: run the purge in its own call (preferred) or in an exception block, and cap the rows deleted per call so a large backlog is worked off over several runs. New migration only (merged migrations are never edited). Tests: a purge that fails does not stop the other cleanup; the cap leaves the rest for the next run; young rows and updates are still refused.
- Also record in the unit rules that import and notification audit events follow the same 365-day purge (U4 R-04).
- **Done (branch `fix/audit-purge-own-call`, intent `261026-audit-purge-isolation`).** Migration `supabase/migrations/20261045_audit_purge_isolation.sql`: `audit_purge()` deletes at most 5000 rows per call (oldest first); `identity_housekeeping()` runs it in an exception block and reports `audit_purge_failed`. Recorded limits: (1) an exception block catches errors, not a cancelled query, so a database statement timeout still ends the whole housekeeping call; the 5000-row cap is the protection against timeouts. (2) A failed purge writes no log line and shows only as `audit_purge_failed: true` in the housekeeping result, an accepted risk until alerting exists. (3) The 365-day purge covers every audit event, including those written by the import and notification functions (U4 R-04); a backlog of N aged rows clears in about N / 5000 daily runs.

B2. Password reset skips clearing the failed-attempt counter when ending other sessions fails (U2 R-12).
- Finding: in `src/identity/reset.ts` (`completePasswordReset`), if removing the other sessions fails the function returns before `sign_in_attempt_clear`. A person who was locked out is told to sign in and may still be refused for up to 15 minutes.
- Plan: clear the attempts before the session removal (or in both outcomes). Record the "other sessions stay open up to 30 days" limit as an accepted risk with the owner named. Test: a reset whose session removal fails still clears the lockout.
- **Done (branch `fix/password-reset-clears-lockout`, intent `261026-reset-clears-lockout`).** `completePasswordReset` now calls `sign_in_attempt_clear` right after the password changed and before it ends the other sessions; the clear's result is ignored, so a failed clear changes nothing. Recorded limits: (1) when ending the other sessions fails, those sessions can stay open until they expire, up to 30 days; accepted risk, owner: the repository owner (Botond); revisit if the session lifetime changes or a session-revocation fix is planned. (2) An unexpected exception from the clear is out of scope: the admin port returns failures as results.

B3. Denied-call audit events carry caller-supplied labels (U1 R-02).
- Finding: `lifecycle_hold_place` and `lifecycle_hold_release` record a denied event whose organization and target are supplied by the caller. A signed-in user can append unlimited denied events labelled with another organization. They cannot be cleaned (append-only), apart from the 365-day purge.
- Plan: decide the abuse limit (Group F, decision 1), then either require the organization to exist, store denied events for unknown organizations under a fixed scope, or rate-limit denied writes per account. Add a test for the chosen rule. This is the pattern later units copy, so decide before adding more such functions.

B4. Custom local database password gives a dead-end message (U1 R-10).
- Plan: add one sentence to the refusal message and to the README line: seed and reset only work with the Supabase CLI's default local password. Test: the message contains the hint.

B5. Reset guard on a hosted database through a loopback tunnel (U1 R-09) was fixed by the password check. Confirm `db:worker` applies an equivalent address check; add the same guard if it does not.

## C. Flaky tests

C1. `tests/integration/swap-screens.test.tsx` fails now and then under load (seen once in U3's review and once earlier; U5 R-07).
- Cause (probable): the test clicks the same withdraw button a second time right after the error alert appears, while the button may still be disabled during the pending transition, so the second click is ignored.
- Plan: before the second click wait until the button is enabled (`waitFor` with `toBeEnabled`), then click. Run the file 20 times in a row, in parallel with the full suite, to confirm.

C2. `tests/database/notifications-timing.test.ts` 2000-row import ceiling of 60 s (U4/U5 R-06).
- Facts: it measured 86.8 s once on a loaded machine. The ceiling has not been relaxed.
- Plan: this is a decision (Group F, decision 2): keep the ceiling and rely on the CI runner, or run the timing tests in a quiet stage with one automatic retry that reports both results. Do not raise the ceiling silently.

## D. Security tooling

D1. Content scans skip `aidlc/` and `source-materials/` entirely (U1 R-03).
- Plan: narrow the exemption to the record sub-folders that need it, or scan `source-materials/` for emails and phone numbers using the fixture allowlist. If the exemption stays, record it as an accepted risk in the design. Related: the real workbook is still in git history until the owner rewrites it (Group F, decision 4).

D2. The nine fictitious phone numbers are allowed repository-wide (U1 R-05).
- Plan: optionally restrict them to test paths. Keep the scan test that proves a number not on the list is still flagged.

D3. Five moderate `npm audit` advisories (nodemailer chain) are not listed in any summary (U1, U2, U4 reviews).
- Plan: list them with an owner and a review date, and update the dependency when a fixed version exists. The blocking rule (high and critical) is met today.

## E. Documentation and manifest drift (docs only)

Do these in one PR, with the date in each note, after the intent is closed.

- Unit summaries: add a dated "superseded by later units" note where statements are out of date.
  - U1 `code-summary.md`: "as of the U1 checkpoint" on the verification table (R-04); the audit rows can now be deleted after 365 days by `audit_purge()` only (R-07, and BR3.4 if reopened).
  - U2 `code-summary.md`: refresh the verification block (no more `APP_RUNTIME_MODE=synthetic`; current counts) and reword Step 13 and NFR8.1 (R-13, R-17); note that U3 re-created the access functions over the new family tables, with migrations `20261033` and `20261035` and the lowest-id audit-group rule (R-14); note that U4 gave the service role two more functions on purpose (R-15).
  - U3 `code-summary.md`: the audit purge exists now; the interim admin port is gone (R-12).
  - U4 `code-summary.md`: synthetic mode is removed; audit events are never purged is no longer true (R-03 and the new finding).
  - All units: the "5 moderate advisories" line (see D3).
- Source manifests: drop or mark removed the paths that no longer exist (U3 R-11 and U4 R-02, 12 paths each), add the three U2 migrations `20261021` to `20261023` and `tests/database/identity-email-change.test.ts` to U2's manifest (R-16), and narrow U1's whole-directory claims (`src/runtime/database/`, `scripts/db/`) to the files U1 built (R-11).
- Traceability records (found by Build and Test): in the `traceability.json` files of U2, U3 and U5, give each target exactly one file (several targets list more than one file in one field), and add FR2.6, FR2.7, FR9.1, FR9.2, FR9.3 and FR10.1 to U5's file. Then re-run `aidlc engine sensor-traceability --stage build-and-test` and expect `pass: true`.
- Refresh the three report files `verification/reports/local-acceptance.json`, `local-acceptance.md` and `outstanding-targets.md` by running `npm run verify:local` once and committing the result (Build and Test restored them to keep U5 approved).
- U2 Step 26: its design-file edits are recorded in the summary instead of in the frozen design files. Accept as is, or apply the edits to the design files; the owner decides.

## F. Decisions for the owner

1. Abuse limit for denied-call audit events (B3): require an existing organization, a fixed scope for unknown organizations, or a per-account rate limit.
2. Timing tests (C2): keep the 60 s ceiling as is, or a quiet stage with one automatic retry.
3. Items carried from earlier laps that are still open: Hungarian notice titles need an owner check; reminder recipients are not re-planned when a family changes group; staged-data expiry depends on sign-ins until a scheduler exists; no screen sends invitations yet.
4. Real workbook in git history: the owner performs the history rewrite. Until then the report `verification/reports/u5-workbook-and-known-limits.md` states it.

## Definition of done

- Each PR passes the full local verification and CI (typecheck, lint, tests, coverage 80 percent, build, privacy and security scans, browser suite).
- Every finding above is either fixed with a test, or recorded as an accepted risk with an owner and a date.
- The U1 to U5 summaries and manifests describe the code as it is after these PRs.
