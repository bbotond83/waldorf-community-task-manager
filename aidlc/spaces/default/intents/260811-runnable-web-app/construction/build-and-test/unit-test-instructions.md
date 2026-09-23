# Unit Test Instructions

## Upstream Coverage

Use all seven Code Generation plans and summaries as the scope inventory. Standard strategy requires focused unit tests for each owned component; the affirmed project gate additionally requires at least 80% line, branch, and function coverage across production source.

## Framework and Commands

- Existing domain tests use Node's built-in test runner: `npm run test:domain` (`src/**/*.test.ts`).
- Application, adapter, component, and verification-tool tests use Vitest: `npm run test:delivery` (`vitest.config.ts`).
- Run both through `npm test`; coverage through `npm run test:coverage`.
- Set `APP_RUNTIME_MODE=synthetic` and `APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1` for tests that exercise runtime composition.

## Coverage Focus

Prioritize explicit results, authorization-before-invocation, role/scope and field allowlists, idempotency/version conflicts, revocation, validation, failure classification, redaction, synthetic reset boundaries, fixture/manifests, and component state rendering. Preserve invented data and independent deterministic fixtures. Domain and delivery coverage reports must each meet 80% lines, branches, and functions; the aggregate production-source claim must use current executable results.
