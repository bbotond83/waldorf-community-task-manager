# Code Generation Plan: U2 Identity and access

## Summary

- Builds: real email-and-password sign-in with sessions, invitations, password reset, role grants with deactivation, the row-level security framework with its policy tests, the first-super-admin command, and the four Hungarian screens.
- Touches: `supabase/` (config, templates, migrations), `src/identity/`, `src/runtime/database/`, `app/` (new routes), `scripts/db/` (operator command, read-back), `tests/database/`, `tests/browser/`, `.github/workflows/ci.yml`, `package.json`, `.env.example`.
- Tests: about 150 tests across ten components (unit, real-stack database, browser with accessibility checks), 10 to 15 per component.

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

## Traceability (requirement to plan step)

| Requirement | Plan steps |
|---|---|
| FR2.1 | 7, 8, 9, 10, 13, 14 |
| FR2.2 | 1, 5, 7, 8, 9, 10, 15 |
| FR2.3 | 7, 8, 9, 10, 11, 12, 13, 14 |
| FR2.4 | 1, 9, 10, 13, 14 |
| FR2.5 | 5, 6, 7, 8 |
| FR3.3 | 5, 6, 7, 8 |
