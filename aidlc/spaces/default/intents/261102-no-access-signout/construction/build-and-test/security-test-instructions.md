# Security Test Instructions

The change reuses the existing sign-out server action; it adds no endpoint, token, stored data or input. Checks that apply:

```bash
npm run verify:security
```

This runs the privacy scan, secret scan, SAST scan, the no-deploy scan and `npm audit --audit-level=high` (high and critical findings block).

Manual/behavioural points covered by tests: signing out ends the session and clears the cookies (existing `signOutAction` tests, plus the new browser test that lands on `/bejelentkezes`); no seeded password is used or printed by the new test.
