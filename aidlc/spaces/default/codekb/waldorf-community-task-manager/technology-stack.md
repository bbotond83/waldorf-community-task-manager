# Technology Stack

Full rescan 2026-10-12 (HEAD `80bd4f4`), focused update 2026-10-27 (HEAD `5d2b484`, intent `denied-audit-ratelimit`), focused update 2026-11-02 (HEAD `3456409`, intent `empty-nav-after-login`; section "Web layer facts (2026-11-02)"). Revision 2 on 2026-11-02 (same intent, owner asked to also scan the audit area) re-read the audit migrations 20261012, 20261013, 20261015, 20261019, 20261044 and 20261045, `supabase/config.toml` and the database test support, `audit`, `audit-purge` and `migrations` tests; sections marked "(2026-11-02, audit re-verified)" come from it. It extended "Database and test stack" with the config facts. Focused update 2026-11-02 (HEAD `1070fd6`, intent `no-access-signout`): section "Web layer facts" refreshed from `package.json`, configs and README as read in that run. Focused update 2026-11-04 (HEAD `251c4b3`, intent `stitch-design-update`): new section "Styling and font stack (2026-11-04, after 251c4b3)"; `package.json`, `next.config.ts` and `playwright.config.ts` were skimmed again for it. The 2026-10-27 update rewrote "Database and test stack"; the other sections are kept from 2026-10-12 and the dependency list there is known to be stale (for example `pg` is now used by the database tests; no `package.json` dependency audit was done).

## Styling and font stack (2026-11-04, after 251c4b3)

Read-only; nothing installed or run.

- **Styling approach**: plain global CSS, one file, `app/globals.css` (1418 lines), imported by `app/layout.tsx`. No Tailwind, PostCSS config, Sass, CSS modules or CSS-in-JS. Theming by 18 custom properties on `:root` (16 colours, `--shadow`, `--radius`); `color-scheme: light`; no dark theme. Media features used: `max-width: 44rem` and `20rem`, `prefers-reduced-motion: reduce`. Prettier formats the CSS (the `format` and `format:check` scripts include `app`, `.prettierignore` does not exclude it, so `app/globals.css` must pass `prettier --check` with width 100); ESLint does not lint CSS and there is no Stylelint config.
- **Fonts today**: none loaded. `font-family` is set once, on `:root`: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Form controls and buttons inherit it with `font: inherit`. No `@font-face`, no `next/font`, no font file under `app/` or `public/`. `DESIGN.md` (repository root, added by `251c4b3`) states "No webfonts; keep it that way".
- **Options that fit the stack** (analysis, not a decision): Next.js 16.4.2 provides `next/font/local` (self-hosts font files at build time into `/_next/static/media`, emits an inline `@font-face` and a generated class or CSS variable; zero external requests) and plain `@font-face` in `globals.css` pointing at files under `public/fonts/` (served from `/fonts/...` on the app origin). `next/font/google` also self-hosts at build time but downloads the font from Google during the build, which the project's "self-hosted" wording and offline CI would have to accept; an external `<link>` to Google Fonts is blocked by the CSP. Vollkorn and Karla are variable fonts on Google Fonts under the SIL Open Font License; their licence files would need to be kept with the font files.
- **Security policy interplay** (`proxy.ts`): `font-src 'self'` and `style-src 'self' 'unsafe-inline'` already allow same-origin fonts and the inline `@font-face` that `next/font` emits; no CSP change is needed. `font-src` has no `data:`, so a font inlined in CSS as a `data:` URL would be blocked (`img-src` allows `data:`, `font-src` does not); keep font files external.
- **Images**: `next/image` is used for the logo (`BrandMark`, `/brand/logo.png`, `priority`); `next.config.ts` sets `images.qualities [75]` ("local brand images only"). `public/brand/cover.jpg` is unused.
- **Browser support targets**: Playwright runs Desktop Chrome, Desktop Firefox and Pixel 7 (Chromium mobile); axe-core via `@axe-core/playwright` (version `latest`).

## Languages and runtime

- TypeScript 5.9.3, strict, ES modules, `allowImportingTsExtensions`.
- Node: `engines` `24.x`, npm `11.x`; `.nvmrc` 24; `.npmrc` `engine-strict=true`. Domain tests, scripts and database tests run through `node --experimental-strip-types`, so erasable TypeScript only.
- SQL: PostgreSQL dialect, plpgsql functions, Supabase `auth` schema.

## Database and test stack (2026-10-27)

- Local Supabase stack from `supabase/config.toml`: PostgreSQL major version 17 (port 54322), data API (port 54321) exposing schemas `public`, `worker_1`..`worker_4`, sign-in service (Auth) with a password-verification hook (`public.password_verification_hook`), mail catcher (54324/54325). Pooler, realtime, studio, storage, edge runtime and analytics are off; CLI migrations and seed are off (the project runner applies migrations).
- Config details re-verified 2026-11-02: project id `waldorf-community-task-manager`; shadow database port 54320; `[db.migrations]` and `[db.seed]` disabled; `[local_smtp]` mail catcher 54324 (web) and 54325 (SMTP); Auth: access tokens 3600 s, refresh-token rotation with a 10-second reuse interval, inactivity timeout 720 h (matches the 30-day check in `current_session_is_active`), minimum password length 8 with letters and digits, no open sign-up, no anonymous sign-ins, rate limits of 30; the password-verification hook points at `public.password_verification_hook`; recovery mail template `supabase/templates/recovery.html`.
- Started with `npm run db:start` (needs an explicit acknowledgement because the CLI stack publishes ports on all interfaces), stopped with `npm run db:stop`, migrated with `npm run db:migrate`.
- Database tests: `node:test` and `node:assert/strict` with the `pg` client (`tests/database/stack-support.ts`); npm scripts `test:database:roles`, `:stack`, `:identity`, `:directory`, `:notifications-import`, `:seed`, `:shuffled`, `:import-timing`.
- Database tests also rely on direct inserts into the sign-in service's `auth.users` and `auth.sessions` tables (`stack-support.ts` `ensureAccount`), `set local role` and `request.jwt.claims` to act as `anon`, `authenticated` or `service_role`, and session-level advisory locks to serialise files per schema.
- PostgreSQL features in use around the audit log: `gen_random_uuid()`, `sha256()`, `hashtextextended()` with `pg_advisory_xact_lock`, row-level security, `security definer` functions with `set search_path from current`, transaction-local settings (`set_config(..., true)`), BEFORE triggers.

## Web layer facts (2026-11-02, refreshed after 1070fd6)

Read from `package.json`, config files and the source (no install or run). Declared: `next` 16.4.2, `react` `latest`, `react-dom` `latest`, `zod` `latest`, `@supabase/supabase-js` 2.117.3, `typescript` ^5.9, `vitest` 4.1.12 (+ jsdom, `@testing-library/react`, jest-dom), `@playwright/test` and `@axe-core/playwright`, ESLint with `eslint-config-next` (core-web-vitals and typescript), Prettier. Used APIs: App Router server components and actions, `next/navigation` `redirect`, `next/headers` `cookies`, React 19 `useActionState`, `useFormStatus`, `cache`; `server-only` guards on `app/_identity`. `proxy.ts` is Next 16's request proxy file (the former middleware). Session cookies are plain httpOnly cookies holding the sign-in service's tokens. Integration tests mock `next/headers`, `next/navigation` and `server-only` in Vitest; browser specs use Playwright against the local Supabase stack with one schema per browser project. (2026-11-04: `package.json` also declares `@e965/xlsx` 0.20.3, `@next/env` 16.4.2 and `nodemailer` 10.2.1 as runtime dependencies; `next` and `@next/env` are pinned to 16.4.2, `react`, `react-dom`, `zod`, `@axe-core/playwright` and `@playwright/test` are `latest`.)

Quality tooling and commands (handoff, from `package.json` and README; not executed):
- Formatter and linter: Prettier (`.prettierrc.json`: width 100, double quotes, semicolons, trailing commas), ESLint with `--max-warnings=0`; `npm run format:check`, `npm run lint`, `npm run typecheck` (`next typegen && tsc --noEmit`).
- Tests: `npm test` (domain, scripts, delivery), `npm run test:delivery` (Vitest "delivery" project, jsdom, setup `tests/setup.ts`, `tests/unit`, `tests/integration`, `tests/coverage`), `npm run test:coverage` (istanbul over `app/**`, `src/**`, `proxy.ts`; thresholds 80% lines, branches and functions; the domain part has the same floors), `npm run test:browser` / `npm run test:a11y` (need `npm run build`, the local stack and the seeded schemas; `VERIFY_BROWSER_PROJECTS=chromium` narrows the run). (2026-11-04: `test:a11y` runs `playwright test --grep @a11y`; the browser servers are started by Playwright with `npm run start`.)
- Local run: `npm run db:start`, load `.env.database.local`, export `APP_SESSION_SECRET`, `APP_PUBLIC_URL`, `SMTP_FROM`, `npm run db:seed`, `npm run dev`, open `http://127.0.0.1:3000` (`WATCHPACK_POLLING=true` if the watcher reports `EMFILE`).
- CI: `.github/workflows/ci.yml`, job `validate` runs `npm run verify:local` (all browsers), second job builds the SBOM and unsigned build evidence.

## Runtime dependencies (2026-10-12)

| Package | Declared | Installed then | Use |
|---|---|---|---|
| next | 16.4.0 | 16.4.0 | App Router, server actions, route handlers |
| @next/env | 16.4.0 | 16.4.0 | `.env*` loading |
| react | latest | 19.2.8 | UI |
| react-dom | latest | 19.2.8 | UI |
| zod | latest | 4.4.3 | Validation |

Later additions (Supabase client, `pg`, e-mail library and others suggested by recent commit titles such as the nodemailer update) were not inventoried in this focused run. (2026-11-04: `package.json` now declares `next` 16.4.2, `@next/env` 16.4.2, `@supabase/supabase-js` 2.117.3, `nodemailer` 10.2.1, `@e965/xlsx` 0.20.3, with `react`, `react-dom` and `zod` still `latest`.)

## Dev tooling (2026-10-12)

vitest 4.1.11, Playwright 1.62.1 with `@axe-core/playwright`, Testing Library, jsdom, ESLint 9 with `eslint-config-next`, Prettier 3.9.6, `@types/node ^24`.

## npm scripts of note

`dev`, `build`, `start`, `test` (domain, scripts, delivery), `test:database:*` (above), `db:*` (start, stop, migrate, worker, first-super-admin, seed, seed:large, reset), `verify:local`, `lint`, `format`, `format:check`, `typecheck`, `test:coverage`, `test:browser`, `test:a11y`.

## Platform and services

- Target: Vercel for hosting, Supabase for auth, Postgres and RLS.
- CI: GitHub Actions on `ubuntu-latest`, actions pinned by SHA; starts the local Supabase stack (`npm run db:start`) before `npm run verify:local` and stops it afterwards (2026-10-27 skim of `.github/workflows/ci.yml`).

## Security headers and browser policy (2026-10-12)

CSP with nonce and `strict-dynamic` (proxy), `X-Frame-Options`, `nosniff`, referrer and permissions policies. `form-action 'self'` confirmed in `proxy.ts` (2026-11-02, handoff). Full directive list re-read 2026-11-04: see "Styling and font stack" above and `api-documentation.md`.
