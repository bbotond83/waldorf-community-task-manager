# CI Pipeline Configuration

## Inputs and Decisions

- CI platform: GitHub Actions, confirmed by the existing `.github/workflows/ci.yml`.
- Branch strategy: trunk-based development with short-lived branches and squash merge to `main`, from affirmed team practices.
- Artifact repositories: none. This project does not publish an npm package or deploy from this workflow.
- Attestation support: user confirmed a private/internal GitHub Enterprise Cloud repository. The trusted `main` push job creates SBOM and SLSA provenance attestations; pull-request jobs receive read-only permissions.
- Upstream inputs: all unit `code-summary.md` files, `build-and-test-summary.md`, and the resolved `build-test-results.md` handoff.

## Workflow

`.github/workflows/ci.yml` validates pull requests targeting `main` and pushes to `main`. It pins `actions/checkout`, `actions/setup-node`, and `actions/attest` to immutable commit SHAs, sets only `contents: read` on the validation job, installs Node 24.x/npm 11.x from repository metadata, installs Chromium/Firefox dependencies, and runs `npm run verify:local` with the versioned synthetic fixture.

On a successful push to `main`, a separate trusted job checks out the same commit, rebuilds the Next.js output, creates a CycloneDX SBOM from the lockfile, archives `.next` excluding its cache, and creates GitHub build-provenance and SBOM attestations. That job has OIDC/attestation permissions and never runs for pull requests. It does not upload a package, publish to a registry, contact Vercel/Supabase/providers, or deploy.

The immutable action pins were verified from the official release commits: [checkout v7.0.0](https://github.com/actions/checkout/releases/tag/v7.0.0), [setup-node v7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0), and [attest v4.2.2](https://github.com/actions/attest/releases/tag/v4.2.2). `npm sbom` emits CycloneDX from the project dependency graph per the [npm v11 documentation](https://docs.npmjs.com/cli/v11/commands/npm-sbom/).

## Existing Workflow Gap

The prior workflow only ran type checking, coverage, and `npm audit`, and used mutable `@v4` action tags. It omitted the manifest, formatting, lint, complete test/security/browser/build/smoke sequence, immutable action pins, SBOM, and provenance gates. This configuration replaces those partial checks with the full local verification command and trusted-main attestation job.
