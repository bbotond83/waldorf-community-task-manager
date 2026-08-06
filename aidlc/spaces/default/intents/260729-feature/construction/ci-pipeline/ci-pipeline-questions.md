# CI Pipeline Questions

## Selected Configuration

1. CI provider: GitHub Actions.
[Answer]: GitHub Actions.

2. Branch strategy: trunk-based development with short-lived branches and protected pull requests into `main`.
[Answer]: Confirmed by team rules.

3. Required merge gates: dependency installation, TypeScript check, enforced unit coverage, and high/critical dependency audit.
[Answer]: Confirmed.

4. Artifact repository: none for the domain-library MVP; the immutable git SHA and CI evidence are the artifact provenance.
[Answer]: Source commit only.

## Validation

The choices align with the Vercel/Supabase architecture and avoid publishing a package before an application scaffold exists. Production deployment remains separately gated by environment and governance evidence.

Sources: `../build-and-test/build-and-test-summary.md`; `../build-and-test/build-test-results.md`; unit `code-generation/code-summary.md` artifacts.
