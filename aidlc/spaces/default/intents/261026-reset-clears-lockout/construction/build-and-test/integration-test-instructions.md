# Integration Test Instructions: Password reset clears the lockout

The Minimal strategy generates no extra integration suite. Existing suites that exercise the reset path and must stay green:

```bash
npm test
npm run test:database:identity
npm run test:browser
```

`tests/integration/identity-actions.test.ts` checks that the reset action calls the clear; `tests/database/identity-lockout.test.ts` tests the database function directly. Neither depends on the order of the clear and the session removal.
