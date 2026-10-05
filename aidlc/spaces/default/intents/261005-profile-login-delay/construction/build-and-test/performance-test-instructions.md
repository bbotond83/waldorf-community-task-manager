# Performance Test Instructions

## Setup and Boundary
Run from `/private/tmp/waldorf-quality-final-261005`, verified copy with owned dependencies/output. Node 24/npm 11 via `/opt/homebrew/opt/node@24/bin` on PATH. APP_RUNTIME_MODE=synthetic; APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1; APP_PORT=4100; SMOKE_PORT=4210; CI unset. Existing server: http://127.0.0.1:3000. No dependencies changed, original server/output/browser cache reset. Snapshot .git reads original HEAD; dirty-source hashes identify tested code. Five profiles: submission through303/root and immediate correct usable business page. Exact identity/path/content/enabled controls. Every flow<=5000ms inclusive; nonfinite/negative/5001ms fail. Retain every sample/failure; workers1/retries0.

## Commands and Evidence
```sh
npx playwright test --config playwright.login-existing.config.ts tests/browser/profile-login-existing.spec.ts --project=chrome
npx playwright test --config playwright.login-performance.config.ts tests/browser/profile-login-performance.spec.ts --project=chromium
```
Existing-server30targets+15setup before canonical/isolated. No server lifecycle. Isolated20targets+10setup after canonical build on owned3800–3804. Fresh contexts cannot replace accepted original user-tab causal evidence. That source-bound evidence remains ../code-generation/native-chrome-after.md and native-chrome-retry.md. Unknown cache temperature/natural warming labelled. No load/concurrency SLO added.
