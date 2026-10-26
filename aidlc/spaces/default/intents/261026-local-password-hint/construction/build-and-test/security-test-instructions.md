# Security Test Instructions: Local password hint

- The guard is not weakened: the accepted and refused passwords are unchanged (existing assertions in `scripts/db/local-guard.test.ts`).
- The message never echoes the refused password or the stored hash (new test).
- Repository scans: `npm run verify:security` (privacy, secret and SAST scans, no-deploy check, `npm audit --audit-level=high`).
