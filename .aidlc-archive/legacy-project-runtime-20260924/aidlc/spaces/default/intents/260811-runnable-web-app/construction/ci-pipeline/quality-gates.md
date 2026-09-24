# CI Quality Gates

## Required Before Merge

The `CI / Validate` status must pass for every pull request targeting `main`:

1. Node.js 24.x/npm 11.x, lockfile install, synthetic runtime configuration, and all 39 versioned verification scenarios.
2. Prettier, ESLint with zero warnings, strict TypeScript, manifest validation, and complete domain/delivery unit and integration suites.
3. At least 80% line, branch, and function coverage across production source.
4. Privacy, secret, SAST, no-deployment, and dependency checks. High/critical findings block merge.
5. Production build and deterministic loopback start/readiness smoke.
6. Critical browser suite in Chromium, Firefox, and mobile Chrome, including serious/critical axe gates, keyboard/focus checks, privacy/authorization boundaries, and two-second local synthetic targets.
7. Fail-closed evidence aggregation; only executed local scenarios may be PASS. Safari and linked-target scenarios remain OUTSTANDING until actually exercised.

The single `npm run verify:local` command runs the ordered checks and writes per-run evidence on the clean GitHub runner. Main-branch protection should require the `CI / Validate` status before squash merge.

## SBOM and Provenance

Only after `CI / Validate` succeeds on a push to `main`, the `SBOM and build provenance` job rebuilds that commit, creates a CycloneDX SBOM, archives the Next.js output without build cache, and attests both provenance and SBOM through GitHub. The job is isolated from pull-request code and receives OIDC and attestation write permissions only on trusted main pushes. It creates no npm package, registry publication, deployment, or hosted target call.

## Known Local Verification Limitations

The current workstation could not complete `npm audit` because the npm registry certificate chain failed validation and could not launch Firefox's Playwright plugin container. These checks remain hard gates in CI; no local waiver is encoded. The recorded current browser result covers Chromium only, while Firefox/mobile Chrome and the current dependency advisory result need successful CI execution. Earlier generated evidence is not treated as a substitute for the current run.
