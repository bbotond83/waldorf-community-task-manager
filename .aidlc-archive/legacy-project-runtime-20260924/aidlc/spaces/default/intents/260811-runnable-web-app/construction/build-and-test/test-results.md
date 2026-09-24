# Build and Test Results

## Run Context

- Status: executed; partial blockers recorded below.
- Runtime: Node.js 24.21.0 / npm 11.19.1; synthetic fixture `waldorf-local-v1`.
- Scope: integrated verification across all seven Code Generation units.
- Upstream artifacts: every unit's `code-generation-plan.md` and `code-summary.md`.
- Existing `.verification/evidence` and `.verification/logs` are preserved; the aggregate `verify:local` script clears these directories before running.

## Results

| Check | Result | Details |
|---|---|---|
| Toolchain | PASS | `npm run check:toolchain`; supported Node/npm baseline. |
| Manifests | PASS | `npm run verify:manifests`; 39 scenarios validated. |
| Format / lint / typecheck | PASS | Prettier, ESLint (zero warnings), strict TypeScript. |
| Unit and integration tests | PASS | 128 domain tests and 67 delivery tests passed. |
| Coverage | PASS | Domain: 93.51% lines, 85.16% branches, 90.67% functions. Delivery: 94.59% lines, 95.34% branches, 91.30% functions. Both exceed 80%. |
| Security scans | PARTIAL | Privacy (58 files), secrets (564), SAST (177), and no-deploy (177) scans passed. `npm audit --audit-level=high` failed before receiving advisories: npm registry TLS issuer certificate validation failed, both sandboxed and unsandboxed. Dependency vulnerability status is unverified in this run. |
| Production build | PASS | Next.js 16.3.0 compiled and emitted all Parent, Staff, admin, root, readiness, and synthetic routes. |
| Start smoke | PASS | `SMOKE_START_OK: waldorf-local-ready`; loopback child process cleaned up. |
| Browser / accessibility / performance | PARTIAL | Current clean run passed 32/32 Chromium cases, including axe and timing assertions. Firefox launch timed out after 180 seconds because macOS denied the Playwright plugin-container process, including on an unsandboxed retry. Mobile Chrome was not reached. The earlier Code Generation summary records 96/96 across all three projects, but this stage did not refresh it. |

## Outstanding Evidence

Safari desktop/mobile and real Supabase authentication/RLS/persistence, scheduler/provider delivery, and Vercel preview/staging remain OUTSTANDING; this stage did not contact those targets. Current Firefox browser evidence and the npm dependency audit remain blocked by local environment certificate/process permissions.
