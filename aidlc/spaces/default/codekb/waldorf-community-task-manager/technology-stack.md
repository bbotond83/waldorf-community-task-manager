# Technology Stack

Full rescan, 2026-10-12, HEAD `80bd4f4`.

## Languages and runtime

- TypeScript 5.9.3, strict, ES modules, `allowImportingTsExtensions` (imports use `.ts`/`.tsx`).
- Node: `engines` `24.x`, npm `11.x`; `.nvmrc` 24; `.npmrc` `engine-strict=true`; `preinstall` runs `scripts/validate-toolchain.mjs`. Machine default `node` is v26.11.1; Node 24.21.0 and npm 11.19.0 are at `/opt/homebrew/opt/node@24/bin`.
- Domain tests and scripts execute through `node --experimental-strip-types`, so erasable TypeScript only (no enums, namespaces, parameter properties).
- SQL (PostgreSQL dialect with Supabase `auth` schema assumptions).

## Runtime dependencies (exactly five)

| Package | Declared | Installed | Use |
|---|---|---|---|
| next | 16.4.0 | 16.4.0 | App Router, server actions, route handlers |
| @next/env | 16.4.0 | 16.4.0 | `.env*` loading in `scripts/validate-runtime-config.ts` |
| react | latest | 19.2.8 | UI |
| react-dom | latest | 19.2.8 | UI |
| zod | latest | 4.4.3 | Validation, profile id enum |

Not installed (checked in `node_modules`): pg, postgres, supabase SDK, drizzle, prisma, kysely, knex, xlsx, exceljs, jose, bcrypt, argon, nodemailer, pglite. No database client, auth library, ORM, migration tool, spreadsheet parser, e-mail library or scheduler.

## Dev tooling

vitest 4.1.11 (istanbul and v8 coverage providers), Playwright 1.62.1 with `@axe-core/playwright`, Testing Library, jsdom 30, ESLint 9.39.5 with `eslint-config-next`, Prettier 3.9.6 (`printWidth 100`, double quotes, trailing commas `all`), `@types/node ^24`. Several `latest` ranges rely on the lockfile `package-lock.json` for reproducibility.

## npm scripts of note

`dev`, `build`, `start` (with `predev`/`prebuild`/`prestart` config validation), `test`, `test:domain`, `test:database:roles`, `smoke:start`, `verify:local` (12 steps), `verify:manifests`, `lint`, `format`, `typecheck`.

## Platform and services

- Target (per rules and README, not wired): Vercel for hosting, Supabase for auth/Postgres/RLS.
- Database engine used today: only a disposable PostgreSQL 18 cluster in tests (Homebrew `postgresql@18` 18.6_1 at `/opt/homebrew/opt/postgresql@18/bin`; requires `LC_ALL=C`/`LANG=C`).
- CI: GitHub Actions on `ubuntu-latest`, actions pinned by SHA; installs PostgreSQL 18 binaries without a service.
- Container tooling on the machine: none (`docker`, `podman`, `colima`, `lima`, OrbStack, Supabase CLI all absent).
- Machine: macOS Darwin 27.0.0, arm64, 48 GiB RAM, about 15 GiB free disk.

## Security headers and browser policy

CSP with nonce and `strict-dynamic` (proxy), `X-Frame-Options`, `nosniff`, referrer and permissions policies (`next.config.ts`); session cookie HMAC-SHA256 via Node crypto.

## Environment variables

`APP_RUNTIME_MODE`, `APP_SYNTHETIC_FIXTURE_VERSION`, `APP_HOST`, `APP_PORT`, `SYNTHETIC_TEST_COPIES`, `APP_LOGIN_TEST_DIST_DIR`, `NODE_ENV`; production slots `APP_SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. `.env.local` exists locally (gitignored) with synthetic defaults.
