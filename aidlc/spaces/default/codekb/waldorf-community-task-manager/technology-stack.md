# Technology Stack

Static synthesis of the revalidated 2026-10-06 developer scan for `261006-simplify-user-roles`, Standard depth, branch `feature/simplify-user-roles`, observed HEAD `0dce0567f18dc72e46aa88d87e5626708b08bc7d`. Full repository breadth with partial deep coverage. No application changes, tests, builds, browser sessions, migrations or target calls were performed.

## Languages and Build Tools

TypeScript/TSX, SQL, JSON and Markdown. One ESM npm package; Node 24.x/npm 11.x, strict ES2024/bundler/no-emit configuration and engine/toolchain checks. Domain ports and synthetic adapters run within one Next.js app.

## Frameworks and Libraries

Versions below are read from the lockfile, not inferred from `latest` ranges or newly installed:

| Dependency | Resolved version | Purpose |
| --- | --- | --- |
| Next.js / `@next/env` | 16.3.6 | Web server, App Router, environment loading |
| React / React DOM | 19.2.8 | Components and action state |
| Zod | 4.4.3 | Runtime environment/profile validation |
| TypeScript | 5.9.3 | Strict static contracts |
| Node types | 24.13.3 | Node API typing |
| Vitest / coverage packages | 4.1.11 | Delivery and combined production coverage |
| Playwright | 1.62.1 | Chromium/Firefox/mobile Chrome; opt-in installed Chrome timing |
| Axe Playwright | 4.13.0 | Serious/critical accessibility gate |
| ESLint | 9.39.5 | Blocking lint |
| eslint-config-next | 16.3.0 | Framework lint rules |
| Prettier | 3.9.6 | Formatting |
| jsdom | 30.0.1 | Integration rendering environment |
| source-map-js | 1.2.2 | Transitive source maps; recently patched lockfile |

Most direct runtime/dev dependencies use `latest`; reproducibility relies on `npm ci` and lockfile. No live vulnerability audit was run during this scan.

## Runtime, Integration and Verification Tools

Node crypto signed local sessions, nonce CSP, App Router server rendering/actions. Intended Supabase SQL/RPC port with no installed SDK or linked target; process-local synthetic provider/persistence. Node tests, Vitest/Istanbul, Testing Library/jsdom, Playwright browsers/Axe and opt-in installed Chrome timing. Immutable CI action revisions. CycloneDX SBOM plus unsigned private build evidence retained 14 days. Vercel immutable promotion/rollback is affirmed policy; executable deployment is disabled until linked.
