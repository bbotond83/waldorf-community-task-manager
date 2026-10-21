# Unit Test Instructions: U2 Identity and access

Test strategy: Comprehensive (10 to 15 tests per component) with the 80% line, branch and function floor on all production source. Methodology: test-after (implement a layer, then write and run its tests).

## Framework and Setup

- Unit tests use the Node test runner (`node --experimental-strip-types --test`) for files under `src/` and `scripts/`; component tests use the existing Vitest configuration; database-backed tests live in `tests/database/` and run against the real local stack with the Node test runner; browser tests use the existing Playwright configuration.
- Prerequisites: Docker Desktop running (the CLI lives at `/Applications/Docker.app/Contents/Resources/bin`), Node 24 (`export PATH=/opt/homebrew/opt/node@24/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH`), and the stack started with `npm run db:start` (it writes the ignored settings files the tests read).

## Unit-Scoped Commands

Every command starts from the repository root after `export PATH=/opt/homebrew/opt/node@24/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH`. Commands checked against the files on disk on 2026-10-20.

| Scope | Command |
|---|---|
| Configuration and admin module | `node --experimental-strip-types --test src/runtime/database/config.test.ts src/identity/admin-client.test.ts` |
| Server modules (fakes) | `node --experimental-strip-types --test src/identity/*.test.ts` (accounts, admin-client, cookies, copy, crypto, events, form-state, invitations, mail, password, refresh, reset, service, session, sign-in) |
| Operator command (fake terminal) | `node --experimental-strip-types --test scripts/db/first-super-admin.test.ts` |
| All real-stack identity tests | `npm run test:database:identity` (schema, session, lockout, invitation, grants, probe, housekeeping, catalogue, operator, server, config, password-verification hook and, after Step 22, email-change guard) |
| Password-verification hook only (brute-force control) | `node --experimental-strip-types --test tests/database/identity-hook.test.ts` |
| Bundle (service-role key never reaches client output) | `npm run build && npm run test:bundle` |
| Screen components, server actions, runtime and proxy | `npx vitest run --config vitest.config.ts tests/integration/identity-screens.test.tsx tests/integration/identity-actions.test.ts tests/integration/identity-runtime.test.ts tests/integration/identity-proxy.test.ts tests/coverage/framework-entrypoints.test.ts` |
| Browser and accessibility | `npx playwright test --config playwright.config.ts tests/browser/identity.spec.ts` |

The real-stack commands need the stack running (`npm run db:start`). The first runnable command before any test is written is the configuration test command above (the runner already exists).

## Coverage Targets

At least 80% lines, branches and functions for the new production files and for all production source overall (existing `npm run test:coverage`).

## Mocking and Stubbing

- Ordering and failure handling in the server modules is unit-tested with fakes for the sign-in service client, the database client and the SMTP sender.
- Everything that depends on Postgres, row-level security, the sign-in service or the mail server runs against the real local stack; no test mocks them for those checks.
- Time-dependent rules (lockout window, session idleness, invitation expiry, housekeeping retention) use a controllable database clock or injected time, never real waiting.

## Test Data

- Tests create the accounts, grants, families and invitations they need; they do not rely on the seed (U5). Worker schemas `worker_1` to `worker_4` and the worker's account prefix isolate parallel runs.
- Fake passwords, tokens and keys are generated in the test and never written to tracked files.

## Security and Performance Tests

- Security: the four token states per table and function, the policy matrix per role, the elevated-function catalogue, the service_role privilege list, secrets absent from logs and output, invitation and grant reach per actor, two-connection races, identical responses for unknown, deactivated and active addresses, reset link single use.
- Performance (reported): sign-in time (fails above 5000 ms), session and access check overhead (fails above 200 ms), invitation function timings, probe overhead, housekeeping at 300 accounts.
