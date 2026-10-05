# Build Instructions

## Setup
Run from `/private/tmp/waldorf-quality-final-261005`, verified copy with owned dependencies/output. Node 24/npm 11 via `/opt/homebrew/opt/node@24/bin` on PATH. APP_RUNTIME_MODE=synthetic; APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1; APP_PORT=4100; SMOKE_PORT=4210; CI unset. Existing server: http://127.0.0.1:3000. No dependencies changed, original server/output/browser cache reset. Snapshot .git reads original HEAD; dirty-source hashes identify tested code. For a new copy use locked `npm ci`; installed dependencies already present. Chrome and Playwright browsers required.

## Build and Verification
`npm run verify:local` executes toolchain, manifests, format, lint, types, full tests, coverage, security, production build, smoke and full browser once each. Capture combined/per-command logs. Build output stays in snapshot .next. Exit0 and local checks pass. Six external scenarios remain outstanding, outside this bugfix. Never lower80% floors; never kill a foreign server for port conflicts.
