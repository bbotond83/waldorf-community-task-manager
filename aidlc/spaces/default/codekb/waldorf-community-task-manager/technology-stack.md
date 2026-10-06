# Technology Stack

## Languages and Required Runtime

TypeScript, React TSX and SQL; strict TypeScript configuration. Required application toolchain: Node **24.x**, npm **11.x**, with `.nvmrc`, engine declarations and engine-strict enforcement. The scanning shell reported Node **26.10.0** / npm **11.19.1**; the existing server's runtime was not checked. This discrepancy is not a demonstrated login-delay cause.

## Frameworks and Libraries

Versions are direct lockfile resolutions observed in the developer scan, not a claim of current releases or security status.

| Technology | Resolution | Purpose |
|---|---|---|
| Next.js / `@next/env` | 16.3.6 | App Router/server rendering and environment loading |
| React / React DOM | 19.2.8 | User interface |
| Zod | 4.4.3 | Input/runtime validation |
| TypeScript | 5.9.3 | Static checking |
| ESLint | 9.39.5 | Blocking lint |
| eslint-config-next | 16.3.0 | Next web-vitals/TypeScript rules |
| Vitest | 4.1.11 | Delivery/component tests and Istanbul coverage |
| Playwright | 1.62.1 | Browser and login timing checks |
| axe Playwright | 4.13.0 | Browser accessibility checks |
| Prettier | 3.9.6 | Formatting |
| jsdom | 30.0.1 | Component test environment |

Node native test runner covers domain tests; Testing Library supports component tests. Next APIs in this repository use asynchronous cookies/params; consult installed Next documentation before implementing changes.

## Data and Delivery Technologies

Local application state uses in-memory synthetic stores and Node crypto signed sessions. SQL defines proposed Supabase/PostgreSQL tables/RLS/RPCs; no external backend SDK was found in application dependencies. GitHub Actions supplies checks, SBOM and provenance. Vercel immutable promotion/prior-deployment rollback is the affirmed release strategy, but no linked target or executable deployment workflow was verified.
