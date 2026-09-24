# Runtime Foundation Technology Stack Decisions

## Sources and Gap

The approved [requirements](../../../../inception/requirements-analysis/requirements.md) require Node 24.x/npm 11.x, Vercel-compatible build output, strict TypeScript, reproducible local execution, browser/accessibility testing, and no deployment. The brownfield [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md) has TypeScript 5.9 and Node-native tests but no browser framework, build/start scripts, formatter, linter, or browser tools.

## Selected Stack

| Concern | Selection | Rationale |
|---|---|---|
| Runtime/package | Node 24.x, npm 11.x, lockfile v3 | approved/enforced baseline and existing CI compatibility |
| Language | TypeScript 5.9+, strict NodeNext/ESM | preserves current source/tests and team practice |
| Web framework | current stable Next.js App Router compatible with Node 24 and Vercel | server delivery/auth boundary, React UI, build/start output |
| UI | React version required by selected Next.js; semantic HTML + CSS modules/global tokens | small dependency surface, accessible custom components, no premature library |
| Validation | Zod (or selected equivalent with inferred TS types) at transport/config boundaries | shared explicit schemas and stable errors |
| Unit/integration | existing `node:test` retained for domain; compatible React/route test tooling added only where needed | avoids rewriting mature tests |
| Browser/a11y | Playwright with Chromium/Firefox/mobile Chrome emulation and axe integration | required critical flows and automated violation gate |
| Formatting/lint | Prettier and ESLint with Next/TypeScript config | affirmed blocking practice |
| Styling | CSS custom properties and responsive CSS, no runtime CSS-in-JS requirement | predictable SSR, reduced dependency/JS cost |

Exact dependency versions are lockfile-pinned during code generation and must support Node 24. Version selection is reversible within the contracts and verified by install/type/test/build.

## Scripts and Configuration

Required scripts: `dev`, `build`, `start`, `typecheck`, `lint`, `format:check`, `test`, `test:coverage`, `test:browser`, `test:a11y`, `smoke:start`, and aggregate `verify`. `.nvmrc` (or equivalent checked-in runtime file), `package.json.engines`, `.env.example`, and README runbook define the contract.

Synthetic defaults may live in `.env.example` only when non-secret. Production variables are documented without values. Next telemetry is disabled in deterministic CI/local evidence where required.

## Alternatives Rejected

- Vite/static client: lacks the approved server authorization/application boundary.
- Express plus separate SPA: duplicates framework/routing/build decisions and weakens Vercel alignment.
- Direct Supabase browser client: violates server authorization and unlinked-local constraints.
- New AWS services: conflict with approved Vercel/Supabase targets and add no local value.
- Replacing all Node-native domain tests: unnecessary churn; add delivery-specific tooling alongside them.

## Acceptance

A fresh checkout installs, starts dev, builds, starts production output, returns HTTP 200/readiness marker, runs all quality scripts, and performs no deployment or target call. Unsupported runtime/config fails early with stable redacted errors.
