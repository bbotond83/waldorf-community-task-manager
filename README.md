# Waldorf Kindergarten Community Task Manager

A responsive web application for replacing the current Excel-based kindergarten parent community coordination workflow.

## Supported local runtime

- Node.js 24.x (`.nvmrc`) and npm 11.x
- Next.js App Router modular monolith
- Privacy-safe synthetic mode for local acceptance
- No Vercel, Supabase, email-provider, staging, or production target is contacted by local startup

Select the supported tools for the current terminal. If nvm is installed:

```bash
nvm install 24
nvm use 24
```

If Node 24 is already installed through Homebrew at `/opt/homebrew/opt/node@24/bin`, use it
without installing nvm:

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
```

This PATH selection applies only to the current terminal; it does not edit shell profiles or
global machine settings. Verify the selected versions before installing or starting:

```bash
node --version                  # must report v24.x
npm --version                   # must report 11.x
npm run check:toolchain
```

Then install the locked dependencies and prepare the uncommitted synthetic environment file:

```bash
npm ci
if [ ! -e .env.local ]; then cp .env.example .env.local; fi
```

Keep an existing `.env.local`; review its configuration rather than overwriting it. The documented
local procedure uses the synthetic defaults from `.env.example`.

Install/start commands fail closed with a stable `TOOLCHAIN_*_UNSUPPORTED` code when the Node or npm
major does not match the supported baseline; configuration values are never included in that output.

The committed example uses only invented, non-secret local defaults. Never put a real family, child,
contact, credential, or production-derived value in fixtures, logs, screenshots, or evidence.

## Run locally

Start the development server on loopback:

```bash
npm run dev
```

The prehook loads the applicable environment files before validating configuration, so no separate
`APP_RUNTIME_MODE` export is needed. Without an explicit `NODE_ENV`, dev selects development files;
build and start select production files. An explicit `development`, `production`, or `test` value
uses that mode's files. Inherited environment values take precedence, followed by the mode-specific
local file, `.env.local` (except in test mode), the mode-specific file, and `.env`. Missing or invalid
effective runtime configuration still stops the command before Next starts.

If the development watcher reports `EMFILE: too many open files, watch`, enable polling for that
one command and retry:

```bash
WATCHPACK_POLLING=true npm run dev
```

This changes only the server process's watcher behavior; no machine limit or shell profile is edited.

Open `http://127.0.0.1:3000`. A successful fresh start returns HTTP 200 and shows
`Helyi tesztprofil kiválasztása`. Choose one of the five synthetic profiles to verify the Parent,
read-only Staff, Group Administrator, Kindergarten Administrator, or Super Administrator shell and
permitted navigation projection. Use `Tesztprofil váltása` to clear the current local session before
choosing another role.

For a Hungarian hands-on walkthrough and test checklist, see
[HASZNALATI_UTMUTATO_HU.md](./HASZNALATI_UTMUTATO_HU.md).

Build and run the production-compatible output locally:

```bash
npm run build
npm run start
```

The same synthetic `.env.local` is used for this local production-output check. Readiness is available
at `GET /api/readiness`; it reports only a stable status, runtime mode, and marker.

For either server, check readiness from another terminal:

```bash
curl http://127.0.0.1:3000/api/readiness
```

Expect HTTP 200 with `status: "ready"`, `mode: "synthetic"`, and `marker: "waldorf-local-ready"`.
Stop dev before starting the production server, and use Ctrl+C to stop each server after checking it.
Framework `NODE_ENV=production` is independent of application `APP_RUNTIME_MODE=synthetic`.

The default listener is loopback port 3000. For `npm run start`, nondefault `APP_HOST`/`APP_PORT`
arguments come from the inherited shell environment; loading them inside the validator does not
export them back to npm's later shell expansion.

To build a production composition in a future linked environment, set `APP_RUNTIME_MODE=production`
and provide the server-only variables named in `.env.example`. Validation checks their shape without
printing values or calling a target. The current production adapter is intentionally an unlinked slot:
Supabase authentication/RLS, persistence, scheduled jobs, providers, and Vercel execution remain
`OUTSTANDING` until their real targets are linked and exercised.

## Quality and walking-skeleton checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run smoke:start
npm run test:browser
npm run test:a11y
npm run verify:security
npm run verify:local
```

`npm run verify:local` is the canonical local acceptance command. It enforces Node 24/npm 11,
validates the versioned authorization/sensitive-field/fixture/scenario contracts, runs formatting,
lint, strict type checking, all tests and 80% line/branch/function coverage, privacy/secret/SAST/
dependency/no-deploy scans, the production build and loopback smoke, then the full Chromium,
Firefox, and mobile-Chrome suite. It writes SHA-bound reports under `verification/reports/` and exits
non-zero when any mandatory local evidence is missing, stale, malformed, unsafe, or failing.

`npm run smoke:start` expects an existing `.next` production build, starts it on a configurable
loopback port, polls readiness/root, verifies the Hungarian entry marker, and always terminates the
child process. Override its isolated port or timeout with `SMOKE_PORT` and `SMOKE_TIMEOUT_MS`.

Playwright covers current Chromium, Firefox, and mobile-Chrome emulation against the most recent
production build, so run `npm run build` before the browser commands. Install browser binaries once
with `npx playwright install` if the local machine does not already have them. Current Safari
desktop and mobile-Safari smoke evidence is not produced by this local scaffold and remains an
explicit release blocker/outstanding item until recorded on a supported Apple environment.

## Profile login timing regression

The session form rotates the signed HttpOnly cookie and redirects through a full document
navigation. It does not clear the browser's entire HTTP cache: Chromium can defer the redirect
while processing `Clear-Site-Data`, causing a long wait even after the server responds.
Protected pages remain dynamically authorized and return private, no-store responses in production builds.

These opt-in suites measure actual form submission through immediate navigation to each role's
usable main page, including successful content and enabled controls, with a 5000 ms limit:

```bash
npx playwright test --config playwright.login-existing.config.ts tests/browser/profile-login-existing.spec.ts --project=chrome
npx playwright test --config playwright.login-performance.config.ts tests/browser/profile-login-performance.spec.ts --project=chromium
```

The first command requires an already-running synthetic server at `http://127.0.0.1:3000`
and installed Chrome. It records 30 target selections/switches plus 15 source setup attempts
without starting, stopping or resetting that server. Its fresh Chrome contexts do not reproduce
the user's existing browser state; original-tab evidence must be collected separately when a
reported delay depends on that state. The second command owns isolated development/production
servers and is supplemental evidence. Both record failed samples before asserting; neither runs
as part of the canonical suite. Do not reset the affected browser cache to hide a reported delay.

## Fresh-checkout local acceptance

Select Node 24/npm 11 using either current-terminal route in **Supported local runtime**, then use
the lockfile and preserve any existing local environment file:

```bash
node --version                   # must report v24.x
npm --version                    # must report 11.x
npm run check:toolchain
if [ ! -e .env.local ]; then cp .env.example .env.local; fi
npm ci
npx playwright install chromium firefox
npm run verify:local
```

The verification runner binds evidence to the checked-out Git SHA, Node/npm versions,
`waldorf-local-v1` fixture, and `waldorf-scenarios-v1` manifest. It creates only ignored temporary
logs/evidence in `.verification/`; review the committed human/machine reports in
`verification/reports/`. To repeat just one boundary, use `npm run verify:manifests`,
`npm run verify:security`, `npm run smoke:start`, or `npm run test:browser`.

If a prior browser command was interrupted, stop that local `next start` process, make sure ports
3100–3102 are free, rerun `npm run build`, and retry the browser command. Every Playwright project
has its own production-server process and deterministic reset, which prevents mutation state from
leaking between Chromium, Firefox, and mobile-Chrome. Failure screenshots/traces are synthetic-only
and are privacy-scanned by the aggregate command.

Safari desktop and mobile Safari use the same critical smoke inventory: local entry/navigation, one
Parent signup, Staff read plus denial, one Administrator approval, validation/focus/keyboard checks,
and serious/critical accessibility review. Record those results on a supported Apple environment;
until then both rows remain `OUTSTANDING`. Supabase authentication/RLS/transactions, scheduler and
email-provider behavior, and Vercel preview/staging must likewise be rerun only in a future approved
linked-target workflow. This local command does not accept target credentials, call those targets,
or deploy.

## Deployment boundary

This repository now produces Vercel-compatible Next.js build output, but this intent contains no
deploy command, linked target, environment token, or executable deployment workflow. Local commands
must not deploy anywhere. Future eligible staging deployment and protected manual production
promotion belong to a separate, linked-target workflow after all required gates pass.

## Product direction

- Code and technical artifacts: English
- User-facing UI: Hungarian
- MVP: users, families, children, school years, groups, tasks, events, signups, swaps, cancellations, notifications, and one-time Excel import

## AI DLC Version

[2.5.11] - 2026-07-24
