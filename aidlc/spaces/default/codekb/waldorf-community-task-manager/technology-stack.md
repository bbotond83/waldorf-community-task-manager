# Technology Stack

## Languages and Runtime

| Technology | Declared/observed version | Use |
|---|---|---|
| TypeScript | `^5.9.0`, locked `5.9.3` | All application/domain source and tests |
| Node.js | 24 in CI | Native ESM runtime, type stripping and test runner |
| ECMAScript | ES2024 target | Compiler target |
| SQL | PostgreSQL/Supabase dialect | Migration, RPC functions and RLS policies |
| npm | lockfile v3; scan run with npm 11.19 | Package installation and scripts |

The package is private ESM version `0.1.0`. TypeScript uses strict checking, NodeNext modules/resolution, `noEmit`, `allowImportingTsExtensions`, and `skipLibCheck`.

## Libraries and Frameworks

There are no runtime npm dependencies. Development dependencies are:

- `typescript` 5.9.3
- `@types/node` 24.13.3
- `undici-types` 7.18.2 transitively through `@types/node`

No React, Next.js, Vite, Express, Fastify, CSS framework, schema-validation library, Supabase JavaScript SDK, browser-test framework, component library, logger, metrics library or database client is installed.

## Testing and Quality Tooling

Tests use Node's native `node:test` runner through `node --experimental-strip-types`. Coverage uses Node's experimental coverage support with 80% thresholds for lines, branches and functions. Type safety is checked with `tsc --noEmit`. Dependency vulnerability checking uses `npm audit --audit-level=high`.

No linter, formatter, mutation testing, browser testing, accessibility testing, visual regression, SQL/RLS testing or performance tool is configured.

## Data and Infrastructure

The repository includes a Supabase-oriented PostgreSQL migration, but no Supabase project configuration, SDK, generated client types, local stack command or linked environment is present. The SQL relies on `auth.uid()` and security-definer RPC functions.

GitHub Actions uses `actions/checkout@v4` and `actions/setup-node@v4` on Ubuntu. No application artifact, container, hosting adapter, infrastructure-as-code or executable deployment workflow exists. Project guardrails identify Vercel promotion as the future release strategy, but correctly prohibit executable deployment configuration until a deployable application and linked target exist.

## Build and Run Capability

Available scripts are `test`, `test:coverage`, and `typecheck`. There is no `dev`, `start`, or `build` script, bundler configuration, emitted package, root entry, HTML document, static asset directory, environment template or development setup guide. Consequently, the technology stack supports a domain library test loop but not a runnable web application.

## Stack Implications for Active Intent

Adding a browser delivery edge requires an explicit framework/bundler decision or a deliberately minimal browser-native setup. That decision should preserve strict TypeScript, keep production dependencies small, add build/start smoke evidence and browser-focused tests, and avoid implying that the partial Supabase schema is connected. Security-sensitive real data must remain out of the synthetic local harness.

