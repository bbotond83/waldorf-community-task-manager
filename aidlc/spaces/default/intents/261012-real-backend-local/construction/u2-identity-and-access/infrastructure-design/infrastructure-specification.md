# Infrastructure Specification: U2 Identity and access

No hosted infrastructure is created or changed and no deployment workflow is added. U2 reuses U1's local stack and CI stack step and adds configuration, mail sending and mail-reading tests. Source: the confirmed answers Q1 to Q3 in `infrastructure-design-questions.md`, the functional design, the NFR requirements and U1's infrastructure specification. Items that depend on the Supabase CLI's exact behaviour are marked **verify in code generation** with a stated fallback.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | Unchanged from U1: containers on Docker Desktop started by the pinned Supabase CLI; the web app runs as before | Nothing new to deploy |
| Networking | Unchanged: published ports checked by `db:start` for non-loopback exposure (U1); the app talks to the sign-in service and mail server on loopback | U1 decisions stand |
| Environments | Local development and CI only | No deployment workflow yet |
| Infrastructure as code | `supabase/config.toml` (sign-in service and mail settings), SQL migrations, `.env.example`, and the CI workflow | One configuration for local and CI |
| Mail | The stack's local mail server (the CLI's mail catcher) receives all mail; the app sends invitations over SMTP to it; the sign-in service sends recovery emails to it | No real delivery (out of scope) |

## Configuration Changes (`supabase/config.toml`; key names verify in code generation)

| Setting | Value | Rule |
|---|---|---|
| open sign-up (`[auth] enable_signup`, `[auth.email] enable_signup`) | false in both places (both are true today) | BR2.13 |
| site address (`[auth] site_url`) | `APP_PUBLIC_URL` (local `http://127.0.0.1:3000`) and the allowed redirect list for `/jelszo-visszaallitas/uj` | BR2.12 |
| session inactivity timeout (`[auth.sessions]`) | 30 days | BR2.5 |
| access token lifetime (`[auth] jwt_expiry`) | 3600 seconds | BR2.5 |
| recovery one-time-code lifetime (`[auth.email] otp_expiry`) | 3600 seconds | BR2.12 |
| minimum password length (`[auth] minimum_password_length`) | 8 | BR2.4 |
| rate limits (`[auth.rate_limit]`) | `sign_in_sign_ups = 30` and `token_refresh = 30` and `token_verifications = 30` (requests per 5 minutes per source address), `email_sent = 30` (emails per hour, project-wide); per-user email gap `[auth.email] max_frequency = "1m0s"` | NFR2.4, NFR1.24 |
| recovery email template (`[auth.email.template.recovery]`) | a file under `supabase/templates/` whose link is `{{ .SiteURL }}/jelszo-visszaallitas/uj?token_hash={{ .TokenHash }}&type=recovery` | BR2.12 |
| mail server (the mail catcher section of the CLI configuration: `[local_smtp]` in this repository's configuration, named `[inbucket]` in older CLI versions) | enabled; its web port is 54324 today; the SMTP port the app sends to is read from the CLI's status output at start and written to the ignored local settings file, and confirmed in code generation | BR2.10, BR2.12 |

Format notes: durations in the configuration file are written the way the CLI expects (`3600` seconds for token and one-time-code lifetimes, `"720h"` for the 30-day inactivity timeout, `"1m0s"` for the email gap); exact key names are confirmed against the installed CLI in code generation.

Fallback: where this CLI version cannot set an item (for example the inactivity timeout), the item is enforced inside `current_session_is_active()` (BR2.6) and the gap is recorded in the code summary.

## Application Settings (names only in `.env.example`)

| Setting | Meaning | Validation |
|---|---|---|
| `APP_PUBLIC_URL` | Public address used in links | http only for a loopback host, otherwise https; no query or path; a test checks it equals the stack's `site_url` so recovery links and invitation links agree |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | Where and as whom invitation email is sent | Host must be loopback in local runs; port numeric; sender a valid address |
| `SUPABASE_SERVICE_ROLE_KEY` | Read only by the server-only admin module (BR2.23) | Never in the general runtime configuration; never in `NEXT_PUBLIC_*` |

How the key reaches the app: locally, `db:start` already writes the stack's service-role key to the ignored tooling file `.env.service.local` (U1); the server-only admin module reads that file (or the process environment when set) through its own small reader, so the general runtime configuration, which refuses a service credential (U1 BR1.3, BR1.4), is unchanged and the key never passes through the framework's public settings; in CI, the stack step writes the key from the CLI's status output into the job environment with the value masked in the log; in a hosted deployment later it is a server-side secret of the platform. The Next.js dev server and the tests therefore need no extra step beyond `db:start`.
| session secret | Existing; also keys the email hash used by the lockout | 32+ characters, not the example (U1 BR1.3) |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Postgres | database | U2's tables, partial unique index, policies, named functions, privilege revokes for the service-role key | Same schemas as U1 (default and four worker schemas) |
| Sign-in service (Auth) | identity provider | As the table above | Used by U2 |
| Mail server (Inbucket) | receives mail | Local only | Tests read it through its web API |
| Data API | database access | Unchanged | Worker schemas stay exposed as in U1 |
| Disabled services | Studio, storage, realtime, edge functions, analytics, pooler | Unchanged | U1 |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Sign-in service configuration | U2 | U3, U4, U5 | Changed only through `config.toml` and read back by the NFR2.9 test |
| Server-only admin module (holds the service-role key) | U2 | U3, U4 (create sign-in users for sign-up flows if needed) | Server code only; bundle test |
| Mail sending function and templates | U2 | U3, U4 (notification emails are simulated, not sent) | One function, one sender |
| Elevated function list and the service-role privilege list | U2 | U3, U4, U5 | Later units append; the catalogue and privilege tests fail otherwise |
