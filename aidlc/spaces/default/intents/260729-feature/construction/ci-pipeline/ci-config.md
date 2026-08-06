# CI Configuration

## Workflow

`.github/workflows/ci.yml` runs on every pull request and every push to `main` using Node.js 24. It installs from the lockfile, runs TypeScript validation, executes the enforced coverage suite, blocks high/critical dependency vulnerabilities, and records the tested git SHA. Permissions are read-only and no production secrets are required.

## Branch and Artifact Model

Short-lived branches merge into protected `main` after all required checks pass. The tested source commit is the MVP artifact; no npm package or archive is published. A future Next.js bundle or Vercel deployment must reference the same passing SHA and cannot weaken these gates.

Sources: all unit `code-generation/code-summary.md` artifacts; `../build-and-test/build-and-test-summary.md`; `../build-and-test/build-test-results.md`.
