# Code Generation Plan: U2 Identity and access

## Summary

- Builds: real email-and-password sign-in with sessions, invitations, password reset, role grants with deactivation, the row-level security framework with its policy tests, the first-super-admin command, and the four Hungarian screens.
- Touches: `supabase/` (config, templates, migrations), `src/identity/`, `src/runtime/database/`, `app/` (new routes), `scripts/db/` (operator command, read-back), `tests/database/`, `tests/browser/`, `.github/workflows/ci.yml`, `package.json`, `.env.example`.
- Tests: about 150 tests across ten components (unit, real-stack database, browser with accessibility checks), 10 to 15 per component.
- Repair pass (Steps 18 to 27, added 2026-10-20 after the code review found three Major and five Minor defects): unsticks stale invitation reservations, blocks direct sign-in email changes, corrects the unit-test instructions, fixes the early lock release in housekeeping, reconciles failed ban and ban-lift calls, separates rate limiting from outages, keeps a reset link usable after a password the sign-in service rejects, and brings the plan, summary and design back in line with the built code. Built on a short-lived branch from `main`; every database change is a new migration, and no merged migration is edited.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "Implement each testable layer, then write and run its tests before moving to the next layer.",
  "scope": "classic",
  "test_strategy": "comprehensive",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.\n\nWe write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source.\n\nBefore merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets."
    },
    {
      "layer": "project",
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06)"
    }
  ],
  "obligations": {
    "strategy": "comprehensive",
    "strategy_volume": [
      "Ten to fifteen tests per component.",
      "Unit, integration, and E2E tests.",
      "Add performance and security tests when NFRs demand them."
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
  "input_sha256": "sha256:37019a2673d9609f9cba1d03866d2b51b65aff00c3b258229a4590493cad4de4",
  "contract_sha256": "sha256:8249630496afe806bf8700aca318c689ae19e1a84e4e11c246148a0794aafd3c"
}
```

## Steps

Prerequisite: Docker Desktop running (the Docker CLI is at `/Applications/Docker.app/Contents/Resources/bin`; add it to PATH) and Node 24. Every step that touches the stack runs against the real local Supabase stack; nothing is built on mocks. Where the Supabase CLI cannot set a configuration value the design names, the stated fallback is applied and recorded in `code-summary.md`.

- [x] **Step 1: Project structure and configuration skeleton.** Create `src/identity/` (server modules), `src/identity/copy.ts` (Hungarian copy), `app/bejelentkezes/`, `app/jelszo-visszaallitas/` and `app/jelszo-visszaallitas/uj/` route folders, `supabase/templates/`; add the pinned SMTP library and the Supabase server-side session helper to `package.json` as exact versions; extend `supabase/config.toml` per the infrastructure specification (sign-up off in both places, inactivity timeout, token and one-time-code lifetimes, minimum password length, rate limits, `max_frequency`, recovery template path, `site_url`, redirect list); add `supabase/templates/recovery.html`; extend `.env.example` with names only (`APP_PUBLIC_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`). **Spike first**: confirm the CLI's exact key names, duration formats, the SMTP port of the mail catcher, and whether the inactivity timeout can be set; apply the stated fallbacks otherwise. Traces: FR2.2, FR2.4, BR2.5, BR2.12, BR2.13, NFR2.4.
- [x] **Step 2: Verify the test runners and record the unit-scoped commands.** Confirm the Node test runner, Vitest, the real-stack database tests and Playwright run for new files; record the exact commands in `unit-test-instructions.md`. Traces: NFR2.8.
- [x] **Step 3: Runtime configuration and the admin module (business logic).** Extend `src/runtime/database/config.ts` with `APP_PUBLIC_URL` and the SMTP settings (validated as in the infrastructure specification); add `src/identity/admin-client.ts`, the only module that reads the service-role key (from the process environment or `.env.service.local`), marked server-only; change U1's check so the general runtime configuration still refuses the key and only this module reads it. Traces: BR2.16, BR2.23, NFR1.4, NFR1.5.
- [x] **Step 4: Configuration and admin-module tests.** `src/runtime/database/config.test.ts` additions and `src/identity/admin-client.test.ts` (public address rules, SMTP settings, key read only by the module, a bundle scan test that fails if the key name or module path appears in client output) (10 to 15 tests). Run and fix.
- [x] **Step 5: Identity and access schema (data model).** New migrations under `supabase/migrations/`: tables `accounts`, `invitations`, `sign_in_attempts` with the columns, constraints, partial unique index and indexes of the entities file; extend `app_role_grants` (uuid default, organization already present) and `app_authorization_versions`; replace the two self-read policies with active-session versions; add an audit read policy (super admin organization-wide, group admin for own group); extend U1's audit action constraint with `account.deactivate` and `account.reactivate`; revoke every table right of `service_role` on all schema tables and its execute right on the U1 hold, cleanup and other functions not named for it; conditionally drop `app_audit_events` per BR2.22. Traces: FR2.5, FR3.3, BR2.13, BR2.15, BR2.22, BR2.23.
- [x] **Step 6: Schema tests.** `tests/database/identity-schema.test.ts`: constraint and index tests, the partial unique index, the audit read policy per role, the service_role privilege list, the catalogue test for `app_audit_events` (10 to 15 tests). Run in the default schema and a worker schema. Fix until green.
- [x] **Step 7: Database functions (data access and business logic).** One migration per function group, each `SECURITY DEFINER` where the elevated list says so, with `SET search_path FROM CURRENT`, execute granted only to the named roles, and each calling `current_session_is_active()` first where a session exists: `current_session_is_active` and the updated helpers; `sign_in_lockout_check`, `sign_in_attempt_record`, `sign_in_attempt_clear`; `invitation_create`, `invitation_resend`, `invitation_revoke`, `invitation_lookup`, `invitation_reserve`, `invitation_accept`; `account_find_by_email`; `grant_change`; `account_deactivate`, `account_reactivate`; `sessions_remove`; `scope_probe`; `operator_first_super_admin`; `identity_housekeeping`. Each audited change uses U1's audit and idempotency functions. Traces: FR2.1 to FR2.5, FR3.3, BR2.1 to BR2.18, BR2.21.
- [x] **Step 8: Function tests.** `tests/database/identity-session.test.ts`, `identity-lockout.test.ts`, `identity-invitation.test.ts`, `identity-grants.test.ts`, `identity-probe.test.ts`, `identity-housekeeping.test.ts`, `identity-catalogue.test.ts` (security-definer catalogue and elevated list, pinned search path, service_role privilege test): active session in four token states per table and function, lockout with a controllable clock, invitation reserve and concurrent double submit, atomic acceptance with injected failures, grant reach per actor, last-super-admin race on two connections, probe per record type, housekeeping retention, the policy matrix per role and table (10 to 15 tests per file group). Run each in the default and a worker schema. Fix until green.
- [x] **Step 9: Server modules (API and repository layer).** `src/identity/cookies.ts` (cookie options), `src/identity/session.ts` (read cookie, refresh, active check, sign-out), `src/identity/sign-in.ts` (lockout, sign-in, generic errors), `src/identity/invitations.ts` (create, resend, revoke, accept with compensation), `src/identity/reset.ts`, `src/identity/mail.ts` (SMTP sender and templates), `src/identity/events.ts` (structured event lines with the keyed hash), `src/identity/redact.ts` use, server actions for the screens, and the follow-up calls after deactivation. Results use the explicit result states. Traces: FR2.1 to FR2.5, BR2.1 to BR2.12.
- [x] **Step 10: Server module tests.** Unit tests with fakes for ordering and failure handling plus real-stack tests: `src/identity/*.test.ts` and `tests/database/identity-server.test.ts` (generic sign-in error and identical responses for unknown, deactivated and active addresses, lockout wiring, cookie options for http and https, token refresh, acceptance compensation and orphan reuse, reset single use with GET versus POST, mail read through the mail catcher's web API, SMTP failure, secrets never in logs) (10 to 15 tests per module). Run and fix.
- [x] **Step 11: Operator command.** `scripts/db/first-super-admin.ts` and the `db:first-super-admin` script: typed host confirmation, non-echoed password prompt (BR2.4), refuses when the organization has an active super admin, creates the user, Account, grant and version row, removes the new user on failure, local-only guard unless the host is typed. Traces: BR2.18.
- [x] **Step 12: Operator command tests.** `scripts/db/first-super-admin.test.ts` with a fake terminal plus real-stack tests: host mismatch, password rule, existing admin, injected failure, two-process race (10 to 15 tests). Run and fix.
- [x] **Step 13: Screens (frontend).** `app/bejelentkezes/page.tsx` and `SignInForm`, the real branch of `app/meghivas/[token]/page.tsx` with `AcceptInvitationForm` (the existing synthetic behaviour stays for unknown tokens until U5), `app/jelszo-visszaallitas/page.tsx` with `RequestResetForm`, `app/jelszo-visszaallitas/uj/page.tsx` with `SetPasswordForm`, `SignOutButton` in the existing top bar for real sessions, Hungarian copy from `src/identity/copy.ts`, stable test ids. Traces: BR2.19, BR2.20.
- [x] **Step 14: Screen tests.** Vitest component tests for each form (validation messages, error regions, no credentials left in state) and Playwright tests: sign in, wrong password, lockout message, invitation accept, expired link, reset request and use, sign-out, two people in two browser contexts, the automated accessibility scan on each screen in success and error states (10 to 15 tests per component group). Run and fix.
- [x] **Step 15: Configuration, bundle and smoke checks.** `tests/database/identity-config.test.ts` (the read-back of every NFR2.4 value as the CI design describes), the bundle test, and the production-mode smoke of the sign-in route's cookie flags. Traces: NFR1.7, NFR2.9.
- [x] **Step 16: Environment, CI and build configuration.** Update `.github/workflows/ci.yml` (settings in both jobs, secret generation, writing the SMTP port and service-role key from the CLI status into the masked job environment), `scripts/verification/run-local-verification.ts` (identity database stage), U1's tests that called hold and cleanup functions as service_role (now through a signed-in super admin or the owner connection), and keep the build and start smoke passing. Traces: NFR2.6, NFR2.8.
- [x] **Step 17: Full verification, documentation and traceability.** Run type check, lint, format check, all tests, coverage at or above 80% for lines, branches and functions, the browser suite, scans and the production build; keep `.env.example` and the new scripts' `--help` complete; write `code-summary.md`, `traceability.json` and `source-manifest.json` for this unit. Traces: all U2 requirements.

### Repair pass (code review of 2026-10-20)

Branch: `fix/u2-identity-review` from `main`, squash-merged after green checks. Same prerequisites as above. Each defect gets a regression test that fails on the current `main` and passes after the fix.

- [x] **Step 18: Branch and baseline.** Create the branch, run `npm ci`, start the stack (`npm run db:start`), run `npm run test:database:identity` and `npm test` and record the baseline counts in `code-summary.md`. Traces: NFR2.8.
- [x] **Step 19: Stale invitation reservations (data model and data access; review Major 1).** New migration `supabase/migrations/20261021_identity_invitation_stale_reservation.sql` that replaces `invitation_create`, `invitation_resend`, `invitation_revoke`, `invitation_reserve` and `identity_housekeeping` (same signatures, grants, `SECURITY DEFINER`, `SET search_path FROM CURRENT` and active-session checks as today). One shared internal helper `invitation_release_stale(invitation_id)` returns an `accepting` row whose reservation is older than 2 minutes to `pending`. It is called first in revoke, resend, create (for the open invitation it is about to replace) and reserve (before the expiry check). Create also marks an expired `accepting` invitation `replaced`, so the partial unique index no longer blocks a new invitation. Housekeeping releases every stale reservation before it deletes rows. This makes the code match the entity rule "a reservation older than 2 minutes is released back to pending". Traces: FR2.3, BR2.6 to BR2.9.
- [x] **Step 20: Stale reservation tests.** Add to `tests/database/identity-invitation.test.ts` and `tests/database/identity-housekeeping.test.ts`, with the controllable clock: reserve then fail to release, then within 2 minutes revoke and resend still refuse; after 2 minutes revoke, resend and re-create succeed; after the 7-day expiry, create marks the old row `replaced` and the new invitation is created; housekeeping releases a stale reservation and leaves a fresh one alone; a release racing a late successful acceptance keeps the acceptance (two connections). Run in the default and a worker schema.
- [x] **Step 21 (built as a trigger created only for the default schema; the app never calls email change, so no service mapping was needed): Block direct sign-in email changes (data model; review Major 2).** The sign-in service in this CLI version has no setting that turns self-service email change off, and auto-confirm makes a change take effect at once. New migration `supabase/migrations/20261022_identity_email_change_guard.sql` adds a `BEFORE UPDATE OF email, email_change ON auth.users` trigger that raises a fixed error when `email` changes or `email_change` is set. The one exception is a transaction-local setting `app.identity_email_change = 'allowed'` that only a future admin function may set, and no function sets it in U2. The trigger function is `SECURITY DEFINER`, with no execute right for `anon`, `authenticated` or `service_role`. Add it to the elevated-function catalogue, and record the decision in `code-summary.md` with the rejected alternative (keeping `accounts.email` in step, which still lets one person take another's address). In `src/identity/service.ts`, map the resulting error to `email_change_not_allowed` so it is never reported as an outage. Traces: FR2.3, FR2.4, BR2.12, NFR1 (security).
- [x] **Step 22: Email change guard tests.** New `tests/database/identity-email-change.test.ts`, run against the real stack through the sign-in service with a signed-in person's own token: a direct change to a free address is refused, and `auth.users.email` and `accounts.email` are unchanged; a change to a pending invitee's address is refused and the invitation is still accepted afterwards; password reset for the original address still sends mail (read through the mail catcher); an admin-created user and the operator command are unaffected; the catalogue test covers the trigger function. Add the file to the `test:database:identity` script in `package.json`.
- [x] **Step 23: Lock-safe housekeeping and ban reconcile (data access and business logic; review Minor 4 and 5).** In the Step 19 migration's `identity_housekeeping`, delete sign-in attempt rows only when they are older than 30 minutes, which is the lock function's own horizon, so a run inside an active lock cannot shorten it. Add `identity_account_ban_pending()`, which lists accounts whose status and sign-in ban disagree, and a reconcile call in `src/identity/accounts.ts` (`reconcileAccountBans`). Housekeeping and the operator check both run it, and it reuses the existing three-try ban, ban-lift and session-removal calls. Correct the misleading "retried" comment. Tests: a lockout test with a housekeeping run inside the lock in `tests/database/identity-lockout.test.ts`; reconcile after an injected ban-lift failure in `src/identity/accounts.test.ts` (fakes) and `tests/database/identity-server.test.ts` (real stack). Traces: BR2.3, BR2.14.
- [x] **Step 24: Rate limiting versus outage (business logic and frontend; review Minor 6).** In `src/identity/service.ts`, map HTTP 429 to a new explicit result `rate_limited`, separate from `unavailable`, for sign-in, refresh and the admin calls. In `src/identity/copy.ts`, add the Hungarian message «Túl sok próbálkozás érkezett rövid idő alatt. Kérjük, várjon néhány percet, majd próbálja újra.» and show it on the sign-in, reset and invitation screens. State the community-wide ceiling (30 sign-in requests per 5 minutes from the server's one address) in `code-summary.md` and the design (Step 26). Tests: `src/identity/service.test.ts`, `src/identity/sign-in.test.ts` and the screen test in `tests/integration/identity-screens.test.tsx`.
- [x] **Step 25 (built as a clear message that a new link is needed, because the page holds no recovery session to keep): Recoverable reset after a rejected password (business logic and frontend; review Minor 7).** In `src/identity/reset.ts`, `completePasswordReset` keeps the recovery session until the sign-in service accepts the new password. When the service rejects it (same as before, or its own rule), it returns `password_rejected` and the person can try another password on the same screen. The session is removed only after success, or when the one-hour link lifetime ends. Hungarian copy: «Ezt a jelszót nem lehet használni. Adjon meg egy másikat.» Tests: `src/identity/reset.test.ts` (fakes) and the reset flow in `tests/database/identity-server.test.ts` and `tests/browser/identity.spec.ts`, including the accessibility scan of the new error state.
- [x] **Step 26: Plan, summary and design reconciliation (documentation; review Major 3 and Minor 8).** Rewrite `unit-test-instructions.md` so every command runs and covers every U2 test file (see that file). In this plan's Step 9, record that `src/identity/redact.ts` was not built and that redaction lives in `src/identity/events.ts`, and that the server-side session helper package was replaced by `src/identity/refresh.ts` and `src/identity/cookies.ts`. In the design, apply the edits the fixes make necessary: add `account_recovery_check` and the email-change trigger function to the elevated-function list and to the BR2.23 execute-right list, and say in W6 step 2 that the server calls the recovery check first (`functional-design/functional-spec.md`, `functional-design/rules.md`); say that reactivation lifts the ban (W7 step 3, BR2.14); define the lock as five failed attempts inside a sliding 15-minute window (BR2.3, W1 step 2); in `infrastructure-design/infrastructure-specification.md`, keep `[auth.email] enable_signup = true` and name `config.toml` (`smtp_port = 54325`) as the one source of the SMTP port; in `nfr-requirements/security-requirements.md` NFR2.4, state the shared-address ceiling. Traces: all U2 requirements.
- [x] **Step 27 (browser suite run and passing; pull request 22 opened): Full verification and records.** Run `export PATH=/opt/homebrew/opt/node@24/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH && npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:database:identity && npm run test:bundle && npm run test:coverage && npm run test:browser && npm run build`, with coverage at or above 80% for lines, branches and functions. Update `code-summary.md` (current counts, dated, replacing the U2-time ones), `traceability.json` and `source-manifest.json`. Open the pull request with the fixes listed against the review findings.

## Traceability (requirement to plan step)

| Requirement | Plan steps |
|---|---|
| FR2.1 | 7, 8, 9, 10, 13, 14, 24 |
| FR2.2 | 1, 5, 7, 8, 9, 10, 15, 23 |
| FR2.3 | 7, 8, 9, 10, 11, 12, 13, 14, 19, 20, 21, 22 |
| FR2.4 | 1, 9, 10, 13, 14, 21, 22, 25 |
| FR2.5 | 5, 6, 7, 8, 23 |
| FR3.3 | 5, 6, 7, 8 |
