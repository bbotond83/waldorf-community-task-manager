# Waldorf Kindergarten Community Task Manager

A responsive web application for replacing the current Excel-based kindergarten parent community coordination workflow.
The application has one runtime: it talks to a database (Supabase: Postgres, the sign-in service and a local mail
catcher). On a developer machine the database runs in Docker. There is no demo mode and no profile picker: everybody
signs in with an e-mail address and a password.

- Code and technical artifacts: English. User-facing UI: Hungarian.
- MVP: users, families, children, school years, groups, tasks, events, signups, swaps, cancellations, notifications, and one-time Excel import.
- A personal learning project, built to help one kindergarten parent community with its task planning. Every name,
  address and telephone number in this repository is invented. If you run it for real people, you handle their (and
  their children's) personal data and are responsible for data protection (GDPR) yourself. See [SECURITY.md](./SECURITY.md).
- For a Hungarian hands-on walkthrough and test checklist, see [HASZNALATI_UTMUTATO_HU.md](./HASZNALATI_UTMUTATO_HU.md).

## Prerequisites

- **Docker Desktop** (or another Docker engine the Supabase command line tool supports). It runs the local database
  stack. Docker Desktop is free for personal use, education and small businesses, but larger organizations need a paid
  subscription: check the licence terms that apply to your organization before you install it, and keep it running
  while you work.
- **Node.js 24.x** (`.nvmrc`) and **npm 11.x**. The Supabase command line tool is a pinned development dependency; it
  is installed by `npm ci` and needs no global install.
- Enough free memory for Docker Desktop to run the stack, and the local ports 54320 to 54325 free
  (`supabase/config.toml`: database, data API, mail catcher and its SMTP port).
- On macOS, PostgreSQL 18 command line tools (`brew install postgresql@18`) for the disposable role-migration check
  (see the last section).

Select the supported tools for the current terminal. If nvm is installed:

```bash
nvm install 24
nvm use 24
```

If Node 24 is already installed through Homebrew at `/opt/homebrew/opt/node@24/bin`, use it without installing nvm:

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
```

This PATH selection applies only to the current terminal. Verify the selected versions before installing:

```bash
node --version                  # must report v24.x
npm --version                   # must report 11.x
npm run check:toolchain
npm ci
```

Install and start commands fail closed with a stable `TOOLCHAIN_*_UNSUPPORTED` code when the Node or npm major does not
match. Configuration values are never part of that output.

## Start the local stack

| Command                                     | What it does                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:start`                          | Starts the stack (Postgres, sign-in service, data API gateway, mail catcher) and waits until it is healthy. It writes the git-ignored files `.env.database.local` (address and public key) and `.env.service.local` (tooling values only).                                                                                                                     |
| `npm run db:migrate`                        | Applies every migration to the default schema and to the worker schemas. Run it after `db:start` and after pulling new migrations.                                                                                                                                                                                                                             |
| `npm run db:stop`                           | Stops the stack. The database volumes are kept, so the data is still there after the next start.                                                                                                                                                                                                                                                               |
| `npm run db:worker -- <worker_N> [--reset]` | Prepares one test schema (`worker_1` to `worker_4`): creates it, applies the migrations, empties it, and removes its accounts. `--reset` drops it first. Like the seed and the reset, it refuses any database that is not the local stack (loopback address, the Supabase CLI's default local password, a database that identifies itself as the local stack). |

The Supabase command line tool publishes its ports on all network interfaces and the stack uses well-known default keys.
`db:start` therefore checks that the ports cannot be reached from other machines, on both the IPv4 and the IPv6 addresses of your machine. If they can, it stops the stack and
fails. Block inbound connections to those ports with a host firewall rule on your machine, then acknowledge it with
`DB_ALLOW_ALL_INTERFACES=1 npm run db:start` (or `npm run db:start -- --allow-all-interfaces`). Never set this on a
machine that is reachable from an untrusted network.

The mail catcher shows every message the application sends (invitations, password reset) at
`http://127.0.0.1:54324`. Nothing is delivered to a real mailbox.

## Seed, large seed and reset

The seed and the reset change only the local stack: they refuse any database whose address is not a loopback address
or that does not identify itself as the local stack, and they change nothing when they refuse.

| Command                 | What it does                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:seed`       | Fills one schema with invented data: the small set (2 groups, 6 families with parents and children, a super admin, two group admins, a teacher, a few events and tasks) and creates the sign-in accounts. One transaction: all of it or nothing. Running it again changes nothing.                                                                                                                                  |
| `npm run db:seed:large` | The 30-family set made by the same rules (used by the timing tests).                                                                                                                                                                                                                                                                                                                                                |
| `npm run db:reset`      | Empties one schema (every table except the workbook sheet list, the audit log included) and removes only the sign-in accounts whose address starts with `<schema>.`. For the default `public` schema it needs `--yes` (`npm run db:reset -- --yes`), because that is the data you work with; the test schemas need none. It first runs the expiry and reminder functions for the organizations still in the schema. |

### The schema selector

All three commands take `--schema <name>`: `public` (the default, what `npm run dev` uses), or `worker_1` to
`worker_4` (the test schemas). Any other name is refused. Example: `npm run db:seed -- --schema worker_2`.

The seed and the reset also refuse a database whose connection password is not the local stack's default, so a hosted database reached through a tunnel on this machine is never touched. This means the seed and the reset work only with the Supabase CLI's default local database password; a stack started with a custom password has to be restarted with the default one to use them.

The seeded sign-in addresses are `<schema>.<tag>@example.test` with the tags `super-admin`, `group-admin-1`,
`group-admin-2`, `teacher-1` and `parent-1` to `parent-6` (`parent-1` to `parent-30` in the large set). The fictitious
test passwords, one per role, are kept only in `scripts/db/seed/data.ts`; no command prints them. The prefix `<schema>.`
is the same namespace `db:worker` uses, so a reset of one schema never removes another schema's accounts.

To make the first real super admin of an organization on a developer machine, use
`npm run db:first-super-admin -- --organization <id> --email <address>` (it asks for the password twice, without echo).

## Run the application locally

The application reads its settings from the environment. After `db:start`, load the stack's file into the terminal,
add a session secret and the public address, and start the server:

```bash
set -a; . ./.env.database.local; set +a
export APP_SESSION_SECRET="$(openssl rand -hex 32)"
export APP_PUBLIC_URL="http://127.0.0.1:3000"
export SMTP_FROM="no-reply@example.test"
npm run db:seed
npm run dev
```

Open `http://127.0.0.1:3000`: the first page points to the sign-in screen (`/bejelentkezes`). Sign in with a seeded
account: after a successful sign-in the app opens the home page of the role (administrators `/admin`, teachers
`/teacher/schedule`, parents `/szulo/ertesitesek`), and a signed-in visit to the sign-in screen is sent there too. A missing or invalid setting stops startup with a message that names the setting.
`.env.example` lists every setting name, with no values. If the development watcher reports `EMFILE: too many open
files, watch`, start it with `WATCHPACK_POLLING=true npm run dev`.

Build and run the production-compatible output locally with the same environment:

```bash
npm run build
npm run start
curl http://127.0.0.1:3000/api/readiness    # {"status":"ready","marker":"waldorf-local-ready"}
```

## Test phases and quality checks

The phases run one after the other, and each one resets the schemas it uses, so no two runs share a schema at the same
time. Unit and component tests need no stack: they use injected test doubles. Only the database tests and the browser
specs use the stack.

| Phase                   | Commands                                                                                                                                                              | Schemas                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Static checks           | `npm run format:check`, `npm run lint`, `npm run typecheck`                                                                                                           | none                               |
| Stack-free tests        | `npm test` (domain, scripts and delivery tests), `npm run test:coverage` (at least 80% lines, branches and functions across all production source)                    | none                               |
| Database tests          | `npm run test:database:roles`, `test:database:stack`, `test:database:identity`, `test:database:directory`, `test:database:notifications-import`, `test:database:seed` | `public`, `worker_1` to `worker_4` |
| Shuffled database run   | `npm run test:database:shuffled` (every database test file in random order, to find hidden order dependence)                                                          | `worker_1` to `worker_4`           |
| Import timing stage     | `npm run test:database:import-timing` (the 2000-row import test alone, with one retry after 30 s; skipped in the other database groups)                               | `worker_1` to `worker_4`           |
| Build, bundle and smoke | `npm run build`, `npm run test:bundle` (the seed module and the service-role key are absent from the browser output), `npm run smoke:start`                           | none                               |
| Browser phase           | `npm run test:browser` (all three browsers), `npm run test:a11y` (only the accessibility checks)                                                                      | `worker_1` to `worker_3`           |
| Security scans          | `npm run verify:security` (privacy, secrets, SAST, no-deploy, dependency audit with high and critical blocking)                                                       | none                               |

The pieces behind these commands can be run alone: `npm run test:domain` (the node test runner over `src/`),
`npm run test:scripts` (the tooling tests), `npm run test:delivery` (the component and page tests),
`npm run test:coverage:domain` and `npm run test:coverage:delivery` (coverage of each part), `npm run verify:manifests`
(the verification contracts), `npm run verify:evidence` (the aggregate report) and `npm run verify:no-deploy` (the
no-deployment scan).

Playwright runs Chromium against `worker_1` (port 3100), Firefox against `worker_2` (3101) and mobile Chrome against
`worker_3` (3102), one project after the other, each with its own production server. A shared helper resets and seeds the
project's schema before each spec file, and the specs sign in for real with the seeded accounts. Run `npm run build`
with the stack settings loaded first, and install the browsers once with `npx playwright install chromium firefox`.
If a browser run was interrupted, make sure ports 3100 to 3102 are free and retry. Set
`VERIFY_BROWSER_PROJECTS` to a comma-separated list (for example `chromium`) to run only those projects; the evidence then
names only the browsers that ran.

`npm run verify:local` is the canonical local acceptance command. It checks the toolchain and the verification
manifests, runs formatting, lint and types, all tests, every database stage, coverage, the scans, the build, the bundle
check, the start smoke and the full browser phase, and writes SHA-bound reports under `verification/reports/`. It exits
non-zero when any mandatory local evidence is missing, stale, malformed, unsafe or failing. The stack must be running
and its settings loaded into the terminal (see above) before you run it.

`npm run smoke:start` expects an existing `.next` build, starts it on a loopback port, polls readiness, checks that the
removed demo routes answer "not found", and always stops the server. Override the port or timeout with `SMOKE_PORT` and
`SMOKE_TIMEOUT_MS`.

Current Safari desktop and mobile Safari evidence is not produced here and stays `OUTSTANDING` until recorded on a
supported Apple environment. Supabase hosted-target checks, the scheduler, e-mail provider behaviour and Vercel
preview or staging also stay `OUTSTANDING` until a separate, approved, linked-target workflow runs them. The local
command accepts no target credentials and calls no hosted target.

### CI runs

This is a public repository, so GitHub Actions minutes are free. A pull request runs `npm run verify:local`, including
the full browser phase (Chromium, Firefox and mobile Chrome); a draft pull request is checked once it is marked ready for
review. The same full check runs every Monday at 03:00 UTC and whenever the workflow is started by hand from the
**Actions** tab (**Run workflow**). A push to `main` does not repeat the validation: the squash-merged change was
validated on its pull request. Changes that touch only `aidlc/` workflow records start no run.

### CI build evidence

After a change is merged to `main`, CI rebuilds the application with build-only placeholder settings and uploads a `build-evidence-<commit>-<attempt>` Actions artifact (synthetic build only; anyone signed in to GitHub can download artifacts of a public repository). It contains
`next-build.tar.gz`, the CycloneDX `sbom.cdx.json`, `build-metadata.json` with the commit and workflow run details, and
`SHA256SUMS`. Download it from the workflow run's **Artifacts** section and run `sha256sum -c SHA256SUMS` in the
extracted directory to check the files. Evidence expires after 14 days.

These files are unsigned build records. They do not provide cryptographic provenance attestations; signed attestations
are not set up. The workflow uses ordinary Actions artifact storage.

## Deployment boundary

This repository produces Vercel-compatible Next.js build output, but it contains no deploy command, linked target,
environment token, or executable deployment workflow. Local commands must not deploy anywhere. Future eligible staging
deployment and protected manual production promotion belong to a separate, linked-target workflow after all required
gates pass.

## Real personal data

The real parent workbook must never be committed. It is listed in `.gitignore`, the privacy scan fails when a workbook
or other file with personal data is tracked, and the report
[`verification/reports/u5-workbook-and-known-limits.md`](./verification/reports/u5-workbook-and-known-limits.md) states
how the git history was cleaned and the known limits.

## AI DLC Version

[2.5.11] - 2026-07-24

## Disposable current-role database verification

Use Node24/npm11 and PostgreSQL18 tools (`psql`, `initdb`, `pg_ctl`). On macOS the approved Homebrew package is
`postgresql@18`; the harness locates `/opt/homebrew/opt/postgresql@18/bin` directly. On Linux expose PostgreSQL18's
binary directory on `PATH`. Missing tools or a different major version fail verification; checks are never skipped. CI
installs the PostgreSQL18 packages using the
[official PostgreSQL Apt instructions](https://www.postgresql.org/download/linux/ubuntu/) and disables creation of a
default package cluster before installation.

```sh
npm run test:database:roles
```

This mandatory check is also part of `npm run verify:local`. It creates only a fresh temporary cluster with a private Unix
socket, no TCP listener and invented supported-schema records. It executes the actual current-role migration and asserts
preservation, generation/repeat behavior, negative preflight, instrumented rollback, observed concurrent lock exclusion,
scoped RLS and redacted governance evidence. Each command and SQL statement has a deadline; the runner stops its owned
cluster and removes its temporary data in cleanup. It never reads deployment connection strings or uses an existing
cluster. Sandbox environments must permit PostgreSQL shared memory.

This proves actual disposable PostgreSQL behavior for the declared supported schema. It does not prove compatibility with
an unlinked deployment, issuer configuration or privileged production writer.

## License

The code of this project is released under the [MIT License](./LICENSE). The AI-DLC workflow files in `.claude/`,
`.codex/`, `.agents/` and `.aidlc-archive/` come from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows),
which is published under the MIT-0 licence. Third-party packages keep their own licences.
