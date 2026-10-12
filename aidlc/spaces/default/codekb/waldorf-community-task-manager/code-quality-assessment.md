# Code Quality Assessment

Full rescan, 2026-10-12, HEAD `80bd4f4`. Test results executed on Node 24.21.0 in this run.

## Tests, layers, and their dependence on synthetic state

| Layer | Runner | Size (executed) | Synthetic/fixture dependence |
|---|---|---|---|
| Domain unit | `node --experimental-strip-types --test` (`npm run test:domain`) | 32 files in `src/`, 258 tests, pass, about 1 s | In-memory adapters tested directly; most reusable against future database ports if ports become async |
| Vitest "delivery" | Vitest 4.1.11, jsdom | 42 files, 531 tests, pass, about 12 s: `tests/unit` 11, `tests/integration` 15, `tests/coverage` 16 | About 40 files reference synthetic modules, reset state or fixtures (list in handoff: admin-actions, admin-pages, app-entrypoints, parent-actions, synthetic-route, runtime-config-cli, teacher-routes, etc.) |
| Browser | Playwright 1.62.1; chromium, firefox, mobile-chrome (Pixel 7) | 11 spec files; about 92 `test(` declarations; 2 excluded from default (`profile-login-existing`, `profile-login-performance`); about 90 default tests x 3 projects, about 270 executions; `workers: 1`, `fullyParallel: false`, `retries: 2` in CI | Nine of eleven specs call `POST /api/synthetic/reset` in setup and sign in via the profile selector or `/api/synthetic/session`; three `webServer` entries (`npm run start`, ports 3100, 3101, 3102, health `/api/readiness`) each with `APP_RUNTIME_MODE=synthetic`, `APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1`, `APP_HOST=127.0.0.1`, `SYNTHETIC_TEST_COPIES=1`. One server per browser so each mutates its own in-memory copy; a shared database would remove that isolation |
| Database | `node:test`, `psql` CLI (`npm run test:database:roles`, step `database-roles` of `verify:local`, not in `npm test`) | 1 file, 340 lines, 9 cases | Uses `tests/database/fixtures/current-role-baseline.sql` (alias `g`), not the real first migration |
| Accessibility | `@axe-core/playwright` inside browser specs | serious/critical violations block (team rule) | Synthetic data |

Coverage: domain run requires lines, branches, functions at 80; Vitest istanbul includes `app/**`, `src/**`, `scripts/**`, `proxy.ts`, `next.config.ts` at 80/80/80 with `ProductionCoverageReporter` (`tests/coverage/support/production-coverage-reporter.ts`, honest denominator via `production-inventory.ts`: every production file must be measured). New production files (adapters, seed or reset scripts) enter the denominator.

## Lint, format, types

- ESLint 9 flat config `eslint.config.mjs`, `--max-warnings=0`; scope `app src/application src/runtime tests scripts *.config.* proxy.ts`.
- Prettier scope: `app src/application src/runtime tests scripts verification *.config.* README.md`.
- `tsc --noEmit` covers `app src tests scripts proxy.ts *.config.ts`.
- Gap: the other `src/*` modules (about 3,300 lines including all Family B and the four adapters) are outside lint and format.

## CI (`.github/workflows/ci.yml`)

Triggers: pull request and push to `main`. Job `validate` (ubuntu-latest, 45 min): env synthetic, setup-node from `.nvmrc`, `npm ci`, Playwright install, PostgreSQL 18 binaries with `create_main_cluster = false`, `npm run verify:local`. Job `build_evidence`: build, CycloneDX SBOM, build tarball, `build-metadata.json` (includes `runtimeMode`, `fixtureVersion`), SHA256SUMS, 14-day artifacts; unsigned, not cryptographic attestations. Actions pinned by SHA. No `services:` block. `npm run verify:local`: toolchain, manifests, format, lint, typecheck, tests, database-roles, coverage, security, build, smoke, browser, then evidence aggregation. `npm run smoke:start` runs `next start` on port 3210 and polls `/api/readiness`.

## Documentation

`README.md` (runtime and verification sections; marks Supabase auth/RLS, persistence, scheduled jobs, providers `OUTSTANDING`), Hungarian user guide, `verification/RUNBOOK.md` and `AUTHORIZATION.md`, PRD. Code comments are sparse but purposeful (the `globalThis` workaround, SQL comments).

## Technical debt and risks (observations)

1. R1 Migration 1 cannot be applied to real PostgreSQL (reserved word `grant`, verified on PostgreSQL 18.6); hash-pinned by `tests/unit/current-role-references.test.ts`; the database test avoids the file via a rewritten fixture.
2. R2 SQL covers about a quarter of the domain (grants, versions, evidence, four thin tables).
3. R3 Id type mismatch: uuid in SQL, slugs in TypeScript, cookie and `verification/fixtures.json`; org slug differs (`org-waldorf-local` vs `org-napsugar`).
4. R4 Synchronous ports in Family B and `IdempotencyStore`; `InMemoryAccessTransaction.run` rejects promises.
5. R5 Family B is dead code from the app's view; rules duplicated inside `SyntheticParentPort`, `SyntheticAdminPort`, `AdvancedWorkflowStore`.
6. R6 Fake behaviours: admin `assign`, `saveNotes`; fixed import preview and no parser; no reminder runner; hardcoded lifecycle/governance rows; dashboard conflicts always 0; "simulated" provider labels.
7. R7 Single-parent design: literal `parent-local` and constant `PARENT_FAMILY_SCOPE`; one global notification list.
8. R8 Session secret hardcoded, `secure` cookie false, no server-side session store, `APP_SESSION_SECRET` unused.
9. R9 Global mutable state: three `globalThis` stores and one module-level `Map` (`access-state.ts`), plus a reset route depending on them.
10. R10 Test isolation designed for in-memory state (three servers, reset endpoint).
11. R11 Evidence and CI tooling encode `runtimeMode: "synthetic"` (`scripts/verification/core.ts` throws on `record.target === "local" && record.runtimeMode !== "synthetic"`, about line 267).
12. R12 Production config demands `https://` Supabase URL; only two modes.
13. R13 Coverage denominator and lint/format scope differences for new directories.
14. R14 Environment: no container runtime, no Supabase CLI; Homebrew PostgreSQL 18 needs `LC_ALL=C`; Node 26 default vs 24 required; unix socket path limit of 103 bytes.
15. R15 AI-DLC records coupled into a unit test (`261006-simplify-user-roles` manifest).
16. R16 `proxy.ts` has no gating; `/api/*` outside matcher; `upgrade-insecure-requests` unconditional (relevant to local http).
17. Floating `latest` ranges for react, react-dom and zod.
18. SQL migration file name `20260806_access_rls.sql` lacks a time part; no `config.toml`, seed, or SQL tests; no database client library.
19. Fake-feature hooks (`scenario` hidden fields, magic ids) live in production code under `app/`.
20. Secret-like constant in source (session key) and a hardcoded fixture fingerprint.

## Quality strengths

All 789 tests (258 + 531) currently pass; enforced 80/80/80 coverage with an honest denominator; strict TypeScript; explicit result states; pinned CI actions; secret scanning and SAST per team rules; accessibility checks in the critical browser flow.
