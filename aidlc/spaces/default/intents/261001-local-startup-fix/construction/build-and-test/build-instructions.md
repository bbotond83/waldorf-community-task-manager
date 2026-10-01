# Replay Build Instructions

## Prerequisites

Use Node24/npm11 through current-process Homebrew PATH. Installed dependencies/browsers only; npm registry exception permits read-only audit, not fixes. Contributor env files are never copied. Preserve every80/80/80 floor and the complete production inventory.

## Commands

Run `python3 /Users/dev/Development/waldorf-community-task-manager/aidlc/spaces/default/intents/261001-local-startup-fix/construction/build-and-test/evidence/replay-1/verification-runner.py acceptance` from the workspace root using the absolute script path. The runner copies all manifest paths and cloned installed dependencies, prepares synthetic .env.local, then runs `npm run check:toolchain`, `npm run build`, actual `npm run dev` and `npm run start`, and `npm run smoke:start`. Current-process WATCHPACK_POLLING=true is the documented host fallback. Verify readiness JSON and root marker without mode exports.
