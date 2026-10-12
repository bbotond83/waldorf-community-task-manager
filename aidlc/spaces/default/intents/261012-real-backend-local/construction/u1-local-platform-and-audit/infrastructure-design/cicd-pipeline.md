# CI/CD Pipeline: U1 Local platform and audit

The existing workflow `.github/workflows/ci.yml` (job `validate`, which today installs the PostgreSQL 18 tools with no running cluster and runs `npm run verify:local`) is extended; no deployment workflow is created or enabled. Source: answer Q4, NFR requirements, and the team rules (immutable action revisions, blocking checks, private evidence records).

## Files That Change

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | Remove the `APP_RUNTIME_MODE: synthetic` and fixture environment values (synthetic mode goes in U5; U1 only adds the new step and keeps the old values until then); add a step before `Run the complete local verification pipeline` that starts the stack (see below) and a final step that stops it |
| `scripts/verification/run-local-verification.ts` | Add the database stage (migrate, database tests including the default-schema run) after the existing stages |
| `scripts/verification/scan-artifacts.ts` | Extend the privacy and secret scans (BR11.1, NFR1.6, NFR1.7) |
| `package.json` | Add the pinned Supabase CLI development dependency and the scripts `db:start`, `db:stop`, `db:migrate` |

## Stages

1. **Install** with Node 24 and npm 11 (existing toolchain check); the installed CLI binary is the pinned one.
2. **Static checks**: strict type check, lint, format check.
3. **Scans**: secret scan and privacy scan (extended scripts), dependency audit (high and critical block), SAST, no-deployment check.
4. **Start the stack**: `npm run db:start`, the same command and configuration as on the owner's machine. The container images are pulled on a cold runner; the 90-second target of NFR4.1 applies to a warm local machine. In CI the target is reported only, and the step has its own 10-minute timeout; layer caching of the images is added only if the cold pull exceeds it.
5. **Coexistence with the existing PostgreSQL 18 step**: the existing step installs client and server binaries without a cluster, for the migration test of `test:database:roles`, which starts its own temporary cluster on its own port. The stack's database runs in a container on its own port, so there is no clash; the stack's Postgres major version is the one the CLI ships and is checked once to match the version the existing role-migration test uses, with a note if it differs.
6. **Migrate and test**: apply the migrations (default schema), run the unit, component and database-backed tests including the worker-schema tests and a run against the default schema (BR10.4), with coverage at or above 80% for lines, branches and functions.
7. **Build and start smoke**: production build and the existing start smoke.
8. **Browser and accessibility checks**: existing critical flow and axe checks (unchanged by U1).
9. **Stop the stack** (always runs, even after a failure).
10. **Evidence**: existing private evidence records (SBOM, synthetic build archive, unsigned metadata, checksums) kept as private Actions artifacts for 14 days.

## Stage to Gate Mapping

| Stage | Blocks merge when |
|---|---|
| Static checks | Any error or warning |
| Scans | Any finding (secrets, tracked personal data, high or critical dependency or SAST finding) |
| Start the stack | The stack does not become healthy, or a published port is not loopback-only |
| Migrate and test | A migration fails, a test fails, or coverage is under 80% |
| Build and start smoke | The build or the smoke fails |
| Browser and accessibility | A failure or a serious or critical accessibility violation |

## Deviation From the NFR Wording

NFR2.6 in `nfr-requirements/tech-stack-decisions.md` says CI starts the database "as a service container". The confirmed answer to question Q4 (same stack, same command) supersedes that wording: CI starts the stack with the CLI in a step, not as a GitHub service container, because the stack has several containers. The NFR file stays as reviewed; this design records the refinement.

## Deployment Strategy, Rollback and Promotion

Not applicable: no deployment workflow exists. Rollback of a bad merge is a revert on `main`. Local recovery from a bad migration is a reset (NFR6.3).

## Secrets Management in CI

The stack uses the CLI's well-known local defaults (not secrets, see the key table in the specification); CI holds no other database secrets. The session secret for test servers is generated per run. Actions stay pinned to immutable revisions. Nothing is printed that contains the service-role key (NFR1.13).
