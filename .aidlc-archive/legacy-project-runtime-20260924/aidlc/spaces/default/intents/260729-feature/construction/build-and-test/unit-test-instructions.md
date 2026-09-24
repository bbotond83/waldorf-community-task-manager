# Unit Test Instructions

## Scope and Command

Run `npm test` for the fast suite and `npm run test:coverage` for the blocking quality gate. The suite covers access matrices, immediate revocation, directory consent, transactional signup/swap, durable notification scheduling, read-only staff views, immutable imports/conflicts, parent/admin projections, and lifecycle retention.

## Pass Criteria and Data

All tests must pass independently with no manual services. Aggregate line, branch, and function coverage must each remain at or above 80%. Every defect receives a regression test; fixtures use synthetic IDs and contain no real family/contact data.

Sources: `../family-directory/code-generation/code-generation-plan.md`; `../coordination-core/code-generation/code-summary.md`; `../privacy-audit/code-generation/code-summary.md`.
