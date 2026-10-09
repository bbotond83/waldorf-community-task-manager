# CI/CD Pipeline — U1 Current Role Foundation

## Sources

- [Security design](../nfr-design/security-design.md), SD1–SD5.
- [Logical components](../nfr-design/logical-components.md).
- [Functional specification](../functional-design/functional-spec.md).
- [Security requirements](../nfr-requirements/security-requirements.md), NFR1.1–NFR3.2.
- [Component catalogue](../../../inception/domain-design/components.md) and [contracts](../../../inception/contract-design/contract-summary.md), C1/C2/C5.
- [Delivery plan](../../../inception/delivery-planning/bolt-plan.md).
- Existing `.github/workflows/ci.yml`, `package.json` and affirmed team/project practices, read during this design.

## Pipeline Boundary

U1 is an embedded library in the existing Next.js application. Retain the existing GitHub Actions pipeline for pull requests to main and pushes to main; integrate all three Units in one release. Do not publish U1 as a separate package. Its consumers must converge before release. No additional cloud service, hosted runner tier, deployment environment or signing service is needed. The repository remains private.

### ID1: Unit Verification

The authorized serial checkpoint command is exactly `npm run typecheck && npm test`. Implement each applicable testable layer, then write and run its tests before moving to the next layer. This command establishes a Unit checkpoint, not the full release gate. A failed checkpoint stops automatic continuation; do not weaken checks, bypass tests or fabricate successful evidence.

| Gate | Required proof | Failure behavior |
| --- | --- | --- |
| Four-role policy | Domain/application/current session cases reject unknown/removed roles, invalid scopes, cross-organization access and stale versions; grant-local checks cannot combine unrelated grants | Block checkpoint |
| Retained and teacher boundaries | Teacher mutation/private-data denial; Parent family and Group admin group preservation; organization Super administrator governance | Block checkpoint |
| Conversion | Preserved identities/non-role fields, revoked/inactive behavior, duplicate effective grants, repeatability, missing-version initialization preconditions | Block checkpoint |
| Transaction | Rollback of grants/users/versions/evidence at each fault boundary; grant writer serialization and distinct active final administrator protection | Block checkpoint; preserve original state |
| Session | Removed profile rejection/fresh selection, current version resolution, signed expiry/origin/cookie checks and unavailable production mode | Block checkpoint |

SQL static inspection and injected transaction tests are separate evidence from execution on a PostgreSQL target. Neither proves actual target RLS/concurrency. Any actual database exercise must identify its disposable target and collect before/after and denial evidence; unavailable target checks remain outstanding rather than passing by inference.

### ID2: Integrated Validation and Promotion Gate

Retain CI's `validate` job with read-only `contents` permission, checkout without persisted credentials, immutable action revisions, locked `npm ci`, Node from `.nvmrc`, synthetic runtime and installed Chromium/Firefox dependencies. The existing `npm run verify:local` remains the complete integrated pipeline. Keep the 45-minute job timeout and same-ref cancellation policy. Repository scripts are the authority for the command ordering; this design does not add another competing runner.

| Integrated gate | Required behavior |
| --- | --- |
| Toolchain and static checks | Current Node 24/npm 11 baseline, strict typecheck, blocking ESLint and Prettier |
| Automated tests and coverage | Existing and new tests pass; production source meets at least 80% line, branch and function coverage |
| Build and start | Production build and deterministic start smoke succeed in synthetic mode |
| Browser and accessibility | Current critical flows, four-role selector, fresh recovery and teacher read-only navigation; no serious/critical automated accessibility violations |
| Manifest and evidence integrity | Current executable profile/action/route identifiers agree; expected failures produce no protected data or stale cached content; evidence is tied to the checked commit |
| Security | Privacy/secret scans, SAST, no-deployment boundary scan and dependency audit; high/critical dependency and SAST findings block delivery |

U2/U3 supply the later consumer/browser scenarios. U1's checkpoint cannot certify their unimplemented behavior. Preserve the user's local-only `next-env.d.ts` edit; it is not a publishable feature artifact.

### ID3: Private Build Evidence

The existing `build_evidence` job depends on successful validation and rebuilds the checked commit in synthetic mode using locked dependencies. Preserve its read-only permission and 15-minute timeout. Produce the CycloneDX SBOM, Next.js build archive excluding build cache, `build-metadata.json` with `signed: false` and commit/run/runtime/fixture identity, and SHA256 checksums. Upload through the existing pinned artifact action with missing files treated as an error and private retention of 14 days.

These records are explicitly unsigned. Checksums establish file consistency, not signer identity. Do not restore GitHub attestation calls, make the repository public, add write/OIDC permissions for attestation, or introduce a signing platform as part of this role change. No evidence artifact contains session tokens, credentials or unrestricted personal data.

### ID4: Deployment Strategy and Migration Ordering

Deployment workflows remain disabled until a deployable application and linked target project satisfy the existing deployment prerequisites. This change does not link a target or execute a live migration. Preserve the existing immutable Vercel promotion/prior-deployment rollback strategy when authorized deployment resumes; production requires protected manual approval. The tested commit is the available provenance identity, not a claim of a live deployment.

| Release step | Required condition |
| --- | --- |
| Integrate providers and consumers | U1/C1/C2/C5 and U2/U3 current names, permissions and manifests delivered together; no independently authorizing obsolete role remains |
| Package migration | Add a new migration alongside the historical baseline; inventory all accepting session/version paths and grant writers; validate supported schema, scope shapes and issuer assumptions |
| Prepare a real target, when separately authorized | Verify backup/recovery, maintenance or equivalent writer exclusion, migration privilege and authoritative session-version boundary; do not infer these from local fixtures |
| Execute conversion explicitly | Writer-exclusive transaction locks before preflight; preserve all non-role identity/history fields; convert supported grants; invalidate changed subjects once; record restricted redacted evidence; replace permissive policies/helpers and enforce four-role constraints atomically |
| Verify before promotion | Real target role/scope/action/field denials, version invalidation, final-administrator protection and conversion repeatability; any unsupported scope/schema/issuer fails before partial promotion |
| Promote application | Only the integrated current-role build after required target evidence and protected approval; fresh sign-in/selection for removed synthetic profile IDs |

No request-time conversion or automatic retry is allowed. Missing-version initialization to 2 is allowed only under Functional Design's known baseline and universal authoritative-lookup preconditions. Unknown accepting issuer semantics block conversion; presented tokens never initialize versions.

### ID5: Rollback and Secrets

A pre-commit conversion failure rolls back grants, versions, users where represented, evidence and policy/constraint changes together. A repeated completed conversion changes nothing. The previous application deployment alone cannot reverse converted grants or version invalidation. Do not deploy a previous artifact that relies on removed roles after conversion. After a committed conversion, prefer a compatible forward fix; any data restoration requires a separately reviewed recovery plan based on the actual target backup and current writes. Never decrement versions or reactivate revoked grants to restore access.

CI validation/build evidence needs no production database credentials. Preserve existing secret/configuration handling, synthetic mode/origin/session protections and redaction; do not print secrets or supply synthetic credentials as a production fallback. Privileged migration execution is isolated from browser requests and ordinary authenticated users. Conversion evidence is transaction-bound, organization-scoped for authorized governance reads, and not client-writable. Runtime logs/results expose only safe codes and allowlisted redacted metadata.

## Resource and Cost Impact

No new infrastructure resource is provisioned for U1. Retain existing CI compute, cache and 14-day evidence retention. Pipeline usage may vary with test workload; no unsupported cost estimate, hosting capacity, SLA or monitoring alert target is asserted. Shared application/database responsibilities remain in the logical component design.

## Assumptions & Open Questions

None. Real target execution and deployment are outstanding evidence and authorization boundaries, not assumed completed work. No application tests, builds, browser checks or migrations ran during this design.
