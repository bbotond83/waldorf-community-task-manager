# Technology Decisions: U1 Local platform and audit

Existing stack kept: Next.js 16, React, strict TypeScript, Node 24 with npm 11, Vitest, the Node test runner and Playwright, ESLint and Prettier. Source: `technology-stack.md` in the code knowledge base and the earlier decisions (Docker Desktop, ADR-005, ADR-013).

| ID | Decision | Rationale |
|---|---|---|
| NFR2.1 | Local stack: Supabase local development stack through Docker Desktop (Postgres, sign-in service, mail catcher) | Same pieces as the hosted application; the owner confirmed Docker Desktop (requirements Q1) |
| NFR2.2 | Tooling scripts are TypeScript run with the existing `node --experimental-strip-types` pattern in `scripts/` | Matches the existing verification scripts; no new runtime |
| NFR2.3 | The database client in the app is the Supabase JavaScript client with a pinned version, plus a small type-safe wrapper owned by the kernel | Same client the hosted app will use; the wrapper keeps adapters behind the ports |
| NFR2.4 | Migrations are plain SQL files applied by an in-repository runner that substitutes the schema name | Needed for per-worker schemas (BR1.5); the Supabase command-line tool alone cannot do this |
| NFR2.5 | Secret and privacy scans extend `scripts/verification/scan-artifacts.ts` (no new external tool) | Confirmed answer Q4; fewer moving parts |
| NFR2.6 | CI starts the database as a service container and runs the database-backed tests; deployment workflows stay disabled; actions stay pinned to immutable revisions | Team rules |
| NFR2.7 | Required checks before the unit completes: strict type check, lint, format check, tests, production build, coverage of at least 80% lines, branches and functions on all production source, and the new database tests | Team rules and NFR2 |
| NFR8.1 | Identifiers, schema names, scripts and technical documentation are English; U1 adds no user-facing copy | NFR8 |
| NFR3.5 | Seed-independent tests: U1's database tests create what they need and do not rely on the seed | Keeps U1 testable before U5 |

New dependencies are added only as exact pinned versions and must pass the existing dependency audit (high and critical findings block).
