# Integration Test Instructions: Audit purge isolation

The Minimal strategy generates no extra integration suite. The behaviour of this change is database behaviour, and its tests already run against the real local stack (they are the integration level for this change):

```bash
node --experimental-strip-types --test tests/database/audit-purge.test.ts tests/database/identity-housekeeping.test.ts tests/database/migrations.test.ts tests/database/identity-catalogue.test.ts
npm run test:database:identity
npm run test:database:seed
```

CI runs the full database groups (`database-stack`, `database-identity`, `database-directory`, `database-notifications-import`, `database-seed`, `database-shuffled`) on a throwaway stack.
