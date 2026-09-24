# Quality Gates

## Blocking Checks

- `npm ci` must reproduce dependencies from `package-lock.json`.
- `npm run typecheck` must exit zero.
- `npm run test:coverage` must pass all tests and enforce at least 80% lines, branches, and functions.
- `npm audit --audit-level=high` must report no high or critical dependency vulnerabilities.
- GitHub branch protection must require the `validate` job before merge.

## Deferred Release Gates

CI success establishes source quality, not production readiness. Provisioned Supabase RLS/RPC tests, scheduler/email integration, browser/accessibility, performance, recovery, controller/DPA, EU-region configuration, and operational alert ownership remain mandatory before production release.

Sources: all unit `code-generation/code-summary.md` artifacts; `../build-and-test/build-and-test-summary.md`; `../build-and-test/build-test-results.md`.
