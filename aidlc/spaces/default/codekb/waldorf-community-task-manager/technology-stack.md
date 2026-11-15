# Technology Stack

## Languages and Runtime

| Item | Version | Source |
|---|---|---|
| TypeScript | ^5.9.0, strict | `package.json`, `tsconfig.json` |
| SQL and PL/pgSQL | Postgres major 17 locally | `supabase/config.toml` |
| Node.js | 24.x | `.nvmrc`, `package.json` engines |
| npm | 11.x | `package.json` engines |
| CSS | One hand-written stylesheet, `app/globals.css` | |

## Application Libraries

| Library | Version | Role |
|---|---|---|
| next | 16.4.2 | App Router, server components and actions, `proxy.ts` |
| react, react-dom | 19.2.8 | UI |
| @next/env | 16.4.2 | Environment files in tooling |
| @supabase/supabase-js | 2.117.3 | Data API client |
| zod | 4.6.7 | Runtime configuration |
| nodemailer | 10.2.1 | Invitation email |
| @e965/xlsx | 0.20.3 | Workbook reader |

`@next/eslint-plugin-next` has an override replacing `fast-glob` with `tinyglobby@0.2.17`.

## Backend Services

| Service | Use | Local setting |
|---|---|---|
| Supabase Postgres | All data and business rules | Port 54322 |
| Supabase data API | `rpc` and table reads | Port 54321; schemas `public`, `worker_1` to `worker_4`; `max_rows` 1000 |
| Supabase sign-in service | Passwords, sessions, recovery email | No open sign-up; 30-day inactivity limit; password hook enabled |
| Mail catcher | Local email | Ports 54324, 54325 |
| Switched off | Storage, realtime, studio, edge runtime, analytics, pooler | `supabase/config.toml` |

## Development and Test Tools

| Tool | Version | Role |
|---|---|---|
| supabase CLI | 2.120.0 | Local stack |
| pg | 8.23.1 | Tooling and database tests |
| vitest, @vitest/coverage-istanbul, @vitest/coverage-v8 | 4.1.12 | Delivery tests and coverage |
| @playwright/test | 1.62.1 | Browser tests: Chromium, Firefox, mobile Chrome |
| @axe-core/playwright | 4.13.0 | Accessibility checks |
| stylelint, stylelint-config-standard | 18.0.0, 41.0.0 | CSS check |
| eslint-config-next | 16.3.8 | Lint rules |
| @types/nodemailer, @types/pg | 8.0.2, 8.23.1 | Types |
| @types/node | ^24.0.0 | Types |
| eslint, prettier, jsdom, @testing-library/react, @testing-library/jest-dom, @types/react, @types/react-dom | `latest` | Floating |
| PostgreSQL 18 client and server tools | 18 | Disposable role-migration check |
| Node test runner | built in | Domain, tooling and database tests |

## Infrastructure and Delivery

- **Build**: `next build`. The output is Vercel-compatible, but no deployment exists by decision.
- **CI**: GitHub Actions, actions pinned to commit hashes.
- **Build evidence**: CycloneDX SBOM, build archive, unsigned metadata and checksums, kept 14 days.
- **Fonts**: self-hosted Vollkorn and Karla in `app/fonts/`.

## Technology Choices That Constrain This Intent

- Forward-only SQL migrations are the only way to change rules.
- There is no scheduler: `pg_cron`, edge functions and external cron are not used, so timed work happens only when a person opens a page or signs in.
- Reminders have no provider. Nodemailer is available for server-side email but is used only for invitations.
- `@e965/xlsx` is a production dependency only because of the import screen. The one-off migration script may still use it, but as tooling.
- The data API's `max_rows` of 1000 and the adapters' `.limit(1000)` cap admin lists.
