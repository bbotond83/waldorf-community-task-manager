# CI Pipeline Memory

## Interpretations
- 2026-09-23T12:37:38Z — The existing GitHub Actions workflow was materially incomplete despite being present. The stage therefore updates it rather than treating presence as adequacy; project quality gates and team practices determine required checks.

## Deviations
- 2026-09-23T12:37:38Z — Attestation writes run only on trusted pushes to `main`, not on pull requests. This keeps OIDC/attestation write permissions away from untrusted PR code while preserving the user-confirmed GitHub Enterprise Cloud attestation path.

## Tradeoffs
- 2026-09-23T12:37:38Z — The attestation job rebuilds the exact validated Git SHA in a separate, trusted job instead of passing an artifact from the untrusted PR validation job. This avoids granting elevated permissions to PR workflows and keeps the tested source revision traceable.

## Open questions
- 2026-09-23T12:37:38Z — Confirm GitHub branch protection requires `CI / Validate` and whether the repository's Enterprise Cloud settings allow artifact attestations for the project.
