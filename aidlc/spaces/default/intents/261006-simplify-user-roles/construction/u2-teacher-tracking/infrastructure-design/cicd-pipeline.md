# Teacher Tracking CI/CD Pipeline

## Build and Test Sequence

1. Use existing pinned toolchain/lockfile and CI actions; no dependency upgrade or new delivery provider.
2. Apply affirmed test-after ordering within each U2 testable layer; preserve colocated tests and source inventory.
3. Run existing blocking format/lint, strict typecheck, unit and integration suites, then combined production coverage.
4. Build the production app, run deterministic start smoke and the critical browser flow with accessibility/keyboard checks. Preserve existing configured performance checks.
5. Run existing dependency, secret and SAST checks. Collect actual reports, fixture/runtime mode and tested SHA.
6. Only eligible linked targets may deploy to staging through the existing pipeline. This change leaves executable deployment disabled while target is unlinked.
7. Production promotion requires the protected manual approval and an immutable deployment; retain prior deployment as rollback target. This is existing policy, not execution evidence.

## Stage-to-Gate Mapping

| Stage | Gate | NFR configuration |
| --- | --- | --- |
| Format/lint/typecheck/tests | All green | NFR2.23/27 |
| Combined coverage | At least 80% each for production lines/branches/functions | NFR2.23 |
| Build/start | Successful production build and deterministic smoke | NFR2.23 |
| Critical browser/accessibility | Functional pass, zero serious/critical Axe findings, keyboard usable | NFR3.22/23 |
| Performance | Existing configured executable acceptance retained | NFR2.21 |
| Security | No high/critical dependency/SAST or detected secret findings | NFR2.23 |
| Integration evidence | Distinguish static/synthetic/actual local DB/real target checks | NFR2.26; no invented real-target success |

## Promotion, Rollback and Secrets

Retain Vercel immutable promotion/prior-deployment rollback policy; U2 changes no release strategy. No deployment is performed. Secrets remain in existing controlled runtime/CI environment, never source, artifacts or diagnostics. No new secret, rotation schedule, environment or cloud account is required. Current SBOM, build archive, SHA256 checksums and commit/run metadata remain private, explicitly unsigned and retained under existing 14-day policy. Keep local-only next-env.d.ts out of source claims/commits and preserve historical evidence.

## Handoff and Outstanding Evidence

Source mapping and exact result/focus mappings are supplied by consumed logical-components.md and reliability-design.md. Code plan must pin invalid-filter encoding and safe redirect behavior, update executable teacher consumers and source inventory, and retain current-role recovery. U1's scope-selection defect is still a U3 release obligation. Integrated build/browser/security/coverage and real target checks have not run in this design.

## Sources

[performance-design.md](../nfr-design/performance-design.md), [security-design.md](../nfr-design/security-design.md), [scalability-design.md](../nfr-design/scalability-design.md), [reliability-design.md](../nfr-design/reliability-design.md), [observability-design.md](../nfr-design/observability-design.md), [logical-components.md](../nfr-design/logical-components.md), [components.md](../../../inception/domain-design/components.md), [functional-spec.md](../functional-design/functional-spec.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md).

