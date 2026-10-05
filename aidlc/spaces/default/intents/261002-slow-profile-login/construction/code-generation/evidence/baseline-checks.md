# Existing Application Baseline

## Environment and Scope

Recorded 2026-10-02 before application corrections for `261002-slow-profile-login`, on branch `fix/test-profile-login-performance`. Commands used `PATH=/opt/homebrew/opt/node@24/bin:$PATH` to select Node 24.21.0 rather than the shell's Node 26.10.0; npm is 11.19.1. Synthetic build used `APP_RUNTIME_MODE=synthetic APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1`.

The baseline used existing test files/configuration. Profile login timing is a separate developer measurement; no five-second compliance or causal claim follows from these checks. The developer waited until these CPU/browser workloads ended before timing.

## Executed Results

| Command | Result |
| --- | --- |
| `npm test` | Exit 0: 128 domain tests passed, no failures/skips; 23 delivery files / 271 tests passed |
| `npm run test:coverage` | Domain coverage floor passed; delivery stopped before execution because the declared Istanbul provider was missing locally |
| `npm install --ignore-scripts` | Restored two declared dependency packages; no package.json/package-lock.json diff; reported zero vulnerabilities |
| `npm run test:coverage:delivery` | Exit 0: lines 94.18%, branches 80.10%, functions 92.30%; existing 80% floors retained |
| `npm run build` in synthetic mode | Exit 0; production build completed |
| `npm run test:browser` | Exit 0: 96 tests passed in 56.7 seconds across Chromium, Firefox and mobile Chromium, including existing accessibility cases |

## Execution Limits and Logs

The initial browser attempt stopped while loading Firefox configuration because the sandbox denied writing its generated cache configuration outside the workspace. The exact browser command was rerun with user-approved escalation and passed. That setup failure is not counted as an application test failure.

Raw machine-local logs: `/private/tmp/slow-profile-login-baseline-tests.log`, `slow-profile-login-baseline-coverage.log`, `slow-profile-login-baseline-delivery-coverage.log`, `slow-profile-login-baseline-build.log`, and `slow-profile-login-baseline-browser.log` in the same directory. This file preserves the substantive results in the intent record; temporary logs are not durable cross-machine artifacts.
