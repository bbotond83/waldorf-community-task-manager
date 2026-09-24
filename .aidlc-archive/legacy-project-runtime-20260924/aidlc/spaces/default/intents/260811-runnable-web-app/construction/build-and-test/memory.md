# Build and Test Memory

## Interpretations
- 2026-09-23T12:18:33Z — The npm audit TLS failure means dependency status is unverified, not a passing audit. Privacy, secret, SAST, and no-deploy scans passed independently, but do not substitute for dependency advisories.

## Deviations
- 2026-09-23T12:18:33Z — Ran verification commands individually instead of `npm run verify:local` because that aggregate script deletes existing `.verification/evidence` and `.verification/logs`. Existing evidence was preserved while equivalent checks were run directly.
- 2026-09-23T12:18:33Z — Stopped the clean browser rerun after Firefox launch failed in both sandboxed and unsandboxed attempts with a plugin-container permission error. Chromium passed 32 cases; the complete suite could not refresh Firefox or mobile Chrome results.

## Tradeoffs
- 2026-09-23T12:18:33Z — Preserved existing verification evidence and reported current environment blockers explicitly rather than overwriting the evidence directory or treating stale results as current.

## Open questions
- 2026-09-23T12:18:33Z — Can the host's npm registry certificate chain and Firefox plugin-container permissions be corrected or supplied by a CI environment so the dependency audit and complete browser matrix can be rerun?
