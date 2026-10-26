# Integration Test Instructions: Worker local-only guard

The Minimal strategy generates no extra integration suite. The real-stack tests that prepare worker schemas through `setupWorker` must stay green; they run against the real local stack with the default password, so they pass the guard:

```bash
node --experimental-strip-types --test tests/database/worker.test.ts
npm run test:database:stack
npm run test:database:seed
npm run test:database:identity
npm run test:database:directory
npm run test:database:notifications-import
```

CI runs all of the database groups on a throwaway stack. No CI workflow calls `db:worker` directly.
