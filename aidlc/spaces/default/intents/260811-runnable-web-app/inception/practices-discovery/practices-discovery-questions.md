# Practices Discovery Interview

## Q1. Way of Working

Which practice should govern branches and merges?

- A. Keep trunk-based development, short-lived branches, squash merges to `main`, and require green automated checks before merge
- B. Keep the current branch model without adding an explicit merge-gate rule
- C. Adopt a different branching or merge model
- D. Not yet decided
- E. Not applicable
- X. Other

[Answer]: A. Keep trunk-based development, short-lived branches, squash merges to `main`, and require green automated checks before merge

## Q2. Walking Skeleton

Which walking-skeleton stance should remain affirmed?

- A. Keep the scope-dependent stance and use a gated first Bolt for this feature to prove browser, composition, build, and smoke-test boundaries
- B. Always run a gated walking skeleton for every scope
- C. Never run a separate walking-skeleton ceremony
- D. Decide independently for each intent without a standing scope rule
- E. Not yet decided
- X. Other

[Answer]: A. Keep the scope-dependent stance and use a gated first Bolt for this feature to prove browser, composition, build, and smoke-test boundaries

## Q3. Testing Posture

Which durable testing and quality posture should apply?

- A. Write tests in the same change; require regression tests for defects; enforce 80% line/branch/function coverage across all production source; block on typecheck, tests, production build, start smoke, critical browser flow, zero serious/critical accessibility violations, and high/critical dependency findings
- B. Retain only the current affirmed 80% line-coverage and green-CI baseline; treat other checks as intent-specific
- C. Use a no-regression coverage rule instead of fixed thresholds
- D. Define each quality gate later
- E. Not yet decided
- X. Other

[Answer]: A. Write tests in the same change; require regression tests for defects; enforce 80% line/branch/function coverage across all production source; block on typecheck, tests, production build, start smoke, critical browser flow, zero serious/critical accessibility violations, and high/critical dependency findings

## Q4. Deployment

How should deployment intent reconcile continuous delivery with manual production approval?

- A. Automatically build and deploy eligible changes to staging; require protected manual approval before immutable production promotion; keep deployment workflows disabled until a deployable app and linked target exist
- B. Continuously deploy directly to production after automated checks with no manual approval
- C. Keep all staging and production deployments manual
- D. Defer the deployment practice until a target exists
- E. Not yet decided
- X. Other

[Answer]: A. Automatically build and deploy eligible changes to staging; require protected manual approval before immutable production promotion; keep deployment workflows disabled until a deployable app and linked target exist

## Q5. Code Style and DevSecOps

Which combined engineering convention should be affirmed?

- A. Adopt Prettier and ESLint as blocking checks; keep English identifiers and Hungarian user copy; preserve module ports/injection and colocated tests; map expected failures to explicit results and unexpected infrastructure errors at the application boundary; add CI secret scanning and SAST with high/critical blocking, pin actions immutably, and add SBOM/attestation when a deployable artifact exists
- B. Adopt only Prettier and ESLint now; defer the other conventions and security gates
- C. Preserve current code shape without new style or security tooling
- D. Select different tools or conventions
- E. Not yet decided
- X. Other

[Answer]: A. Adopt Prettier and ESLint as blocking checks; keep English identifiers and Hungarian user copy; preserve module ports/injection and colocated tests; map expected failures to explicit results and unexpected infrastructure errors at the application boundary; add CI secret scanning and SAST with high/critical blocking, pin actions immutably, and add SBOM/attestation when a deployable artifact exists
