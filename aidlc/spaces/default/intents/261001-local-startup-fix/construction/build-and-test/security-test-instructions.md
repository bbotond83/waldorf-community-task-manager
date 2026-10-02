# Replay Security Instructions

## Local Checks

Run the existing privacy, secrets, SAST and no-deploy scanners in the synthetic copy. The startup regression command asserts redacted dummy-secret errors, invalid config rejection and toolchain enforcement.

## Authorized Dependency Check

Run `npm audit --audit-level=high --registry=https://registry.npmjs.org --json` once on the final lock with Node24/npm11. Capture exit, findings and lock SHA256. High/critical findings block; perform no automatic fixes. The user explicitly selected Package + audit. No other external target, deployment or global setting change is authorized.
