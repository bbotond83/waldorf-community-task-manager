# Technology Stack

Versions come from committed manifest/lockfile evidence. Moving latest manifest entries are identified as such.

## Application and Runtime

| Technology | Version or requirement | Role |
|---|---|---|
| Node.js | 24.x required by package checks and .nvmrc | App, scripts, native type-stripped domain tests |
| npm | 11.x required | Install and scripts |
| Next.js | 16.3.6 | App Router, server rendering/actions, build |
| React / React DOM | 19.2.8 lockfile; manifest latest | UI |
| TypeScript | 5.9.3 lockfile; manifest ^5.9.0 | Strict source/test typing |
| Zod | 4.4.3 lockfile; manifest latest | Configuration and runtime/schema validation |
| PostgreSQL / Supabase | SQL/RLS source only | Intended persistence/auth boundary; production target unlinked |

The scan shell had Node 26.10.0 and npm 11.19.1. Node 26 is outside the enforced Node 24.x baseline; repository validation scripts reject the unsupported major.

## Testing, Lint, and Formatting

| Technology | Version | Role |
|---|---|---|
| Node node:test | Built into Node | Domain tests with experimental type stripping |
| Vitest / coverage-v8 | 4.1.11 | Unit/integration tests and V8 coverage |
| Playwright | 1.62.1 | Browser testing, Chromium/Firefox/mobile Chrome projects |
| Axe Playwright | 4.13.0 | Accessibility checks |
| jsdom | 30.0.1 | DOM test environment |
| Testing Library React | 16.3.2 | Component testing |
| ESLint | 9.39.5 | Linting |
| eslint-config-next | 16.3.0 | Next.js lint configuration |
| Prettier | 3.9.6 | Formatting |

## Languages and Formats

- TypeScript/TSX for application and tests.
- JavaScript for scripts.
- PostgreSQL SQL for the Supabase migration.
- Hungarian user-facing text and English technical identifiers are project conventions.

## Build and Configuration

The package uses Next.js scripts for dev/build/start, strict TypeScript checking, and package-lock.json lockfile version 3. Key configuration includes package.json, package-lock.json, .nvmrc, .npmrc, tsconfig.json, next.config.ts, eslint.config.mjs, vitest.config.ts, playwright.config.ts, .env.example, and .github/workflows/ci.yml.

## Workflow Tooling and Deployment

The project stamp/manifest identify AIDLC 2.10.0 on Codex. This is repository governance tooling, not the application runtime. No live Supabase database, email provider, scheduler, Vercel client, or production target is configured. GitHub Actions runs validation and provenance steps but does not deploy.
