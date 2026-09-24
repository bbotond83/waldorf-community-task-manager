# Application Facades Code Summary

## Outcome

Implemented the transport-neutral strict-TypeScript application boundary under `src/application/`. Delivery can now consume versioned authorization, explicit application results, session/role façades, privacy-safe view models, idempotency, redacted events, and evidence through public ports. The library has no React, Next.js, HTTP, cookie, environment, database-client, provider-client, or concrete adapter dependency.

## Files

- `src/application/contracts.ts`, `results.ts`: exhaustive application state/result union, retry invariant, session/authorization/event/evidence and role-view contracts.
- `src/application/authorization.ts`: executable versioned matrix, scope/field checks, Staff read-only enforcement, explicit Group Administrator import denial, navigation, and next-request authorization-version invalidation.
- `src/application/validation.ts`, `projection.ts`, `facade-pipeline.ts`: stable normalization errors, fixed authorize-before-invoke pipeline, exhaustive domain outcome mapping, terminal-by-default adapter classification, and immutable allowlisted projection.
- `src/application/idempotency.ts`, `evidence.ts`: duplicate/fingerprint/pending/retry coordination, privacy-minimized application events, and synthetic `PASS` versus linked-target `OUTSTANDING` evidence.
- `src/application/session-facade.ts`, `parent-facade.ts`, `staff-facade.ts`, `admin-facade.ts`: injected public application ports for the approved identity, Parent, Staff, administrator core/import/reminder/governance/lifecycle surfaces.
- `src/application/index.ts`: stable public barrel.
- `src/application/*.test.ts`: colocated Standard-strategy contract tests, including malicious/faulting ports and isolation checks.
- `src/runtime/types.ts`, `src/runtime/synthetic/composition.ts`, `src/runtime/production/composition.ts`, `src/runtime/synthetic/profiles.ts`: minimal runtime consumption of public application authorization/navigation ports; production remains fail-closed and unlinked.
- `package.json`: application sources added to blocking lint and format scopes.

## Key Decisions

- Authorization uses stable named rows and checks role, scope, action, resource, requested fields, runtime-mode consistency, and authorization version before a domain port can run.
- Expected outcomes are explicit union states. Unknown faults are terminal unless an injected reviewed classifier marks them retryable; raw exception text never crosses the boundary.
- Consequential commands validate an idempotency key and expected version. Same-key/same-input returns the terminal result, same-key/different-input conflicts, and retryable dependency results may re-enter with the original key.
- Role façades depend on narrow transport-neutral ports rather than persistence contracts. Existing domain modules remain owners of rules, aggregates, repositories, and transactions.
- Staff exposes queries only. Its models structurally omit contacts, optional profile values, protected reasons, and mutations.
- Evidence produced by local deterministic execution may be `PASS`; linked Supabase/RLS/provider/Vercel targets remain `OUTSTANDING` regardless of local outcome.

## Verification

- Prettier check: PASS.
- ESLint: PASS, zero warnings.
- Strict TypeScript: PASS.
- Domain/application tests: PASS, 88 tests.
- Delivery integration tests: PASS, 26 tests.
- Domain/application aggregate coverage: PASS — 94.64% lines, 87.41% branches, 90.86% functions.
- Delivery coverage: PASS — 94.59% lines, 95.34% branches, 91.30% functions.
- Production compiler/build: PASS via `APP_RUNTIME_MODE=synthetic SYNTHETIC_FIXTURE_VERSION=2026.08.1 npx next build`.
- Package `npm run build`: environment-blocked before compilation because the current host is Node 26.7.0 while the approved package contract requires Node 24.x. The direct Next.js production build passed, so no application build defect was observed.

## Deviations and Outstanding Evidence

- The deterministic start-smoke command was not run from this unit because the package prestart gate rejects the host's unsupported Node 26 before starting. Re-run the normal `npm run build` and `npm run smoke:start` on Node 24.x.
- No real target, provider, database, package publication, deployment workflow, or deployment action was created or invoked. Supabase/RLS/provider/Vercel evidence remains `OUTSTANDING` by design.
