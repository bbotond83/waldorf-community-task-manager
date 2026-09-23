# CI Pipeline Questions

## Confirmed CI Platform

What CI tool is in use?

- A. GitHub Actions — confirmed by the existing `.github/workflows/ci.yml`.
- B. AWS CodePipeline / CodeBuild.
- C. Jenkins.
- D. Other CI provider.
- X. Other (please specify).

[Answer]: GitHub Actions, discovered in the existing workflow.

## Confirmed Branch Strategy

What branch strategy should CI enforce?

- A. Trunk-based development with short-lived branches and squash merge to `main` — affirmed in team practices.
- B. GitHub Flow with long-lived feature branches.
- C. GitFlow.
- X. Other (please specify).

[Answer]: Trunk-based development, short-lived branches, squash merge to `main`, from `aidlc/spaces/default/memory/team.md`.

## Confirmed Quality Gates

Which quality gates are required before merge?

- A. Strict Node 24/npm 11 toolchain; manifests; Prettier; ESLint; strict TypeScript; unit/integration tests; ≥80% line/branch/function coverage; privacy/secret/SAST/dependency scans blocking high/critical findings; production build; start smoke; Chromium/Firefox/mobile Chrome critical flows; accessibility checks — affirmed in team practices and Build and Test artifacts.
- B. Static checks and unit tests only.
- C. Custom gate set.
- X. Other (please specify).

[Answer]: Option A, from team practices and `build-and-test-summary.md` / `build-test-results.md`; current local Firefox and npm audit environment failures remain blockers, not waived gates.

## Artifact Repository and Attestation Support

GitHub artifact attestations are available for public repositories and for private/internal repositories on GitHub Enterprise Cloud. Which applies here?

- A. Public repository; GitHub artifact attestations are available.
- B. Private/internal repository on GitHub Enterprise Cloud; attestations are available.
- C. Attestations are unavailable or the plan is unknown.
- X. Other (please specify).

[Answer]: B. Private/internal repository on GitHub Enterprise Cloud (user selected 2).
