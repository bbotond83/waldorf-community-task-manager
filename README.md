# Waldorf Kindergarten Community Task Manager

A responsive web application for replacing the current Excel-based kindergarten parent community coordination workflow.

## Supported local runtime

- Node.js 24.x (`.nvmrc`) and npm 11.x
- Next.js App Router modular monolith
- Privacy-safe synthetic mode for local acceptance
- No Vercel, Supabase, email-provider, staging, or production target is contacted by local startup

Install the supported runtime, then create the uncommitted local environment file:

```bash
nvm use
npm install
cp .env.example .env.local
```

Install/start commands fail closed with a stable `TOOLCHAIN_*_UNSUPPORTED` code when the Node or npm
major does not match the supported baseline; configuration values are never included in that output.

The committed example uses only invented, non-secret local defaults. Never put a real family, child,
contact, credential, or production-derived value in fixtures, logs, screenshots, or evidence.

## Run locally

Start the development server on loopback:

```bash
npm run dev
```

Open `http://127.0.0.1:3000`. A successful fresh start returns HTTP 200 and shows
`Helyi tesztprofil kiválasztása`. Choose one of the five synthetic profiles to verify the Parent,
read-only Staff, Group Administrator, Kindergarten Administrator, or Super Administrator shell and
permitted navigation projection. Use `Tesztprofil váltása` to clear the current local session before
choosing another role.

Build and run the production-compatible output locally:

```bash
npm run build
npm run start
```

The same synthetic `.env.local` is used for this local production-output check. Readiness is available
at `GET /api/readiness`; it reports only a stable status, runtime mode, and marker.

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

## Fresh-checkout local acceptance

Use the exact supported toolchain and lockfile:

```bash
nvm install 24
nvm use 24
npm --version                    # must report 11.x
cp .env.example .env.local
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
