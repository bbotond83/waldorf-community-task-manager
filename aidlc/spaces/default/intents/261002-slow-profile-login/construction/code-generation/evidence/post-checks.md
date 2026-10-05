# Post-change quality checks

## Environment and commands

Commands used Node 24.21.0 through `/opt/homebrew/opt/node@24/bin` on the same workspace. Global checks ran after the isolated timing suite, avoiding measurement contention.

- `npm run test:coverage`: passed; 128 domain tests and 411 delivery tests. Domain floor passed. Delivery coverage: 94.19% lines, 80.17% branches, 92.30% functions.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- `npm run typecheck`: passed after final implementation and build.
- `npm run build`: passed in synthetic mode.
- `npm run smoke:start`: passed (`SMOKE_START_OK: waldorf-local-ready`).
- `npm run verify:security`: privacy, secrets, SAST and no-deploy checks passed; audit found zero vulnerabilities.
- Scoped application `git diff --check`: passed. Whole-workspace check reports existing Markdown hard-break whitespace in the completed reverse-engineering component inventory; that upstream output was not modified.

## Browser checks

Dedicated login performance suite passed 10 cases and 20 required individual first/switch samples; details are in `post-timings.json` and `post-performance-report.json`. Standard browser suite passed 96 tests across Chromium, Firefox and mobile Chromium, including accessibility, in 54.8 seconds.

Full local console logs are retained at `/private/tmp/slow-profile-login-final-{coverage,lint,format,typecheck,build,smoke,security,browser}.log`. This durable summary records exit results; temporary logs are supplemental.
