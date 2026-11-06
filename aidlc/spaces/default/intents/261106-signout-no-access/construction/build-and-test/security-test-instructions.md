# Security Test Instructions

No new security requirement was raised for this change. The existing project scans still apply and are run in this stage.

## Commands

```bash
npm run scan:privacy
npm run scan:secrets
npm run scan:sast
npm run verify:no-deploy
npm audit --audit-level=high
```

## Notes

- The sign-out button reuses `signOutAction`, which clears the session cookies and redirects to a fixed path (`/bejelentkezes`); no address is taken from the request.
- The page shows no account data. The guidance text is a fixed Hungarian string.
- `npm audit` needs network access to the npm registry.
