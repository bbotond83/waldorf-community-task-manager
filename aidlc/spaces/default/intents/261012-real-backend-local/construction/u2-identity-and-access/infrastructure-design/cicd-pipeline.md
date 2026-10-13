# CI/CD Pipeline: U2 Identity and access

The existing workflow `.github/workflows/ci.yml` (extended by U1 to start the same local stack with the same command) is extended again; no deployment workflow is created or enabled. Source: the NFR requirements, U1's CI design and the team rules (immutable action revisions, blocking checks, private evidence records).

## Files That Change

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | Job `validate`: add `APP_PUBLIC_URL`, `SMTP_HOST`, `SMTP_FROM` as job environment values (local-only), a step before the stack start that generates the session secret with `openssl rand -hex 32` into the job environment (masked), and make the stack step write the SMTP port and the service-role key from the CLI's status output into the job environment (masked) so the admin module finds them; job `build_evidence`: add the same setting names with build-only placeholder values (an https `APP_PUBLIC_URL` on a reserved example domain, a loopback SMTP host, a freshly generated session secret, no service-role key) because the production build validates them; no deployment step is added |
| `scripts/verification/run-local-verification.ts` | Add the identity database stage (policy matrix, catalogue and privilege tests, configuration read-back, invitation and reset tests that read the mail server) after the U1 database stage |
| `supabase/config.toml`, `supabase/templates/` | The configuration table in the infrastructure specification |
| `.env.example` | Names of the new settings, no values |
| `package.json` | The pinned SMTP library and the server-side session helper at exact versions |

## Stages

1. Install, static checks (type check, lint, format check), and scans (secret, privacy, dependency audit, SAST, no-deployment), as in U1.
2. Start the stack with the same command; the new configuration applies automatically.
3. Migrate and test: U1's database tests, then U2's: the policy matrix per role and table in the default and a worker schema, the elevated-function catalogue test, the service-role privilege test, the configuration read-back test (NFR2.9; see below for how each value is read), the migration repeatability test for U2's files (NFR6.1), the housekeeping test with a controllable clock (NFR6.7; housekeeping runs from seed, reset and the operator command, and is also called opportunistically once per hour by the first sign-in of the hour), invitation, grant and reset tests (mail read through the mail server's web API), the lockout test with a controllable clock, the two-connection race tests, and coverage at or above 80%.
4. Production build and start smoke, including the production-mode check of the sign-in route's cookie flags (answer Q3).
5. Browser and accessibility checks: the sign-in, invitation, reset request and new-password screens in success and error states with the automated accessibility scan, and the two-people-at-once test.
6. Stop the stack (always), then the existing private evidence records.

## How the Configuration Read-Back Reads Each Value (NFR2.9)

The sign-in service's settings endpoint exposes only a few values, so each setting is read the way that actually shows its effective value:

| Value | How it is read |
|---|---|
| Open sign-up refused | A real sign-up call must be refused |
| Minimum password length 8 | A real admin create with a 7-character password must be refused and an 8-character one accepted |
| Access token lifetime | A freshly issued token's expiry minus its issue time equals 3600 seconds |
| One-time-code lifetime, inactivity timeout, rate limits, email gap | The environment of the running sign-in service container (the CLI passes every configuration value to it as an environment variable), read through Docker, compared with the values in `config.toml`; where a value is not visible there, the test reads the configuration file and the fallback in `current_session_is_active()` is exercised instead |
| Recovery link shape | A real recovery request lands in the mail server and the link is parsed |
| Site address | `site_url` equals `APP_PUBLIC_URL` |

## Cookie Flag Check (answer Q3, NFR1.7)

The owner's answer to question Q3 replaces the "behind a local https origin" wording of NFR1.7: the secure flag is proved by the unit test of the cookie options for an http and an https address and by the production-mode smoke of the sign-in route; no local https server is added. This is recorded as a deliberate narrowing of that NFR check.

## Stage to Gate Mapping

| Stage | Blocks merge when |
|---|---|
| Static checks and scans | Any finding, including the service-role key name in client output |
| Start the stack | The stack does not become healthy or a published port is not loopback-only (U1) |
| Database tests | A policy, catalogue, privilege, configuration, atomicity or race test fails, or coverage is under 80% |
| Build and start smoke | The build or the smoke (including cookie flags) fails |
| Browser and accessibility | A failure or a serious or critical accessibility violation |

## Deployment Strategy, Rollback and Promotion

Not applicable: no deployment workflow exists. Rollback of a bad merge is a revert on `main`; local recovery is a reset (U1 NFR6.3).

## Secrets Management in CI

The stack's well-known local defaults are not secrets (U1); the session secret is generated per run; the service-role key is the stack's local default, read only by the server-only admin module and never printed. Actions stay pinned to immutable revisions.
