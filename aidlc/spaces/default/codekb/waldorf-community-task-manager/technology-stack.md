# Technology Stack

Full rescan 2026-10-12 (HEAD `80bd4f4`), focused update 2026-10-27 (HEAD `5d2b484`, intent `denied-audit-ratelimit`). The focused update rewrote "Database and test stack"; the other sections are kept from 2026-10-12 and the dependency list there is known to be stale (for example `pg` is now used by the database tests; no `package.json` dependency audit was done in this run).

## Languages and runtime

- TypeScript 5.9.3, strict, ES modules, `allowImportingTsExtensions`.
- Node: `engines` `24.x`, npm `11.x`; `.nvmrc` 24; `.npmrc` `engine-strict=true`. Domain tests, scripts and database tests run through `node --experimental-strip-types`, so erasable TypeScript only.
- SQL: PostgreSQL dialect, plpgsql functions, Supabase `auth` schema.

## Database and test stack (2026-10-27)

- Local Supabase stack from `supabase/config.toml`: PostgreSQL major version 17 (port 54322), data API (port 54321) exposing schemas `public`, `worker_1`..`worker_4`, sign-in service (Auth) with a password-verification hook (`public.password_verification_hook`), mail catcher (54324/54325). Pooler, realtime, studio, storage, edge runtime and analytics are off; CLI migrations and seed are off (the project runner applies migrations).
- Started with `npm run db:start` (needs an explicit acknowledgement because the CLI stack publishes ports on all interfaces), stopped with `npm run db:stop`, migrated with `npm run db:migrate`.
- Database tests: `node:test` and `node:assert/strict` with the `pg` client (`tests/database/stack-support.ts`); npm scripts `test:database:roles`, `:stack`, `:identity`, `:directory`, `:notifications-import`, `:seed`, `:shuffled`, `:import-timing`.
- PostgreSQL features in use around the audit log: `gen_random_uuid()`, `sha256()`, `hashtextextended()` with `pg_advisory_xact_lock`, row-level security, `security definer` functions with `set search_path from current`, transaction-local settings (`set_config(..., true)`), BEFORE triggers.

## Runtime dependencies (2026-10-12)

| Package | Declared | Installed then | Use |
|---|---|---|---|
| next | 16.4.0 | 16.4.0 | App Router, server actions, route handlers |
| @next/env | 16.4.0 | 16.4.0 | `.env*` loading |
| react | latest | 19.2.8 | UI |
| react-dom | latest | 19.2.8 | UI |
| zod | latest | 4.4.3 | Validation |

Later additions (Supabase client, `pg`, e-mail library and others suggested by recent commit titles such as the nodemailer update) were not inventoried in this focused run.

## Dev tooling (2026-10-12)

vitest 4.1.11, Playwright 1.62.1 with `@axe-core/playwright`, Testing Library, jsdom, ESLint 9 with `eslint-config-next`, Prettier 3.9.6, `@types/node ^24`.

## npm scripts of note

`dev`, `build`, `start`, `test` (domain, scripts, delivery), `test:database:*` (above), `db:*` (start, stop, migrate, worker, first-super-admin, seed, seed:large, reset), `verify:local`, `lint`, `format`, `typecheck`.

## Platform and services

- Target: Vercel for hosting, Supabase for auth, Postgres and RLS.
- CI: GitHub Actions on `ubuntu-latest`, actions pinned by SHA; starts the local Supabase stack (`npm run db:start`) before `npm run verify:local` and stops it afterwards (2026-10-27 skim of `.github/workflows/ci.yml`).

## Security headers and browser policy (2026-10-12)

CSP with nonce and `strict-dynamic` (proxy), `X-Frame-Options`, `nosniff`, referrer and permissions policies.
