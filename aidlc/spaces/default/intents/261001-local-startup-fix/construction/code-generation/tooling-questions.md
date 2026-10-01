# Coverage Tooling and Registry Exception

## Context

The approved retry reached an invalid V8 coverage report. All independent checks pass, but the complete 80/80/80 coverage gate remains unverified. The concrete proposal is recorded in tooling-amendment.md: add @vitest/coverage-istanbul pinned 4.1.11, update package.json/package-lock.json and switch vitest.config.ts to Istanbul, retaining integrity checks and thresholds. Package availability has not been queried. Existing Plan Approval remains recorded for this attempt.

## Decision

Which npm registry exception should apply?

- A — Package + audit: authorize the documented package installation/provider amendment and read-only npm audit against the npm registry.
- B — Package only: authorize the documented package installation/provider amendment; dependency audit remains unverified.
- C — Offline hold: allow no registry access; preserve the blocked coverage gate and current evidence.
- X — Other: specify a different tooling or scope decision.

No production integration, deployment, global setting change or automatic audit fix is included.

[Answer]: Package + audit

Exact user reply: `- **Package + audit**`
