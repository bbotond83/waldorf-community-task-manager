# Unit Test Instructions: u14-removal-and-anonymisation

## Framework Setup

- Existing runners, no new dependency: Node's test runner for `src/` and `tests/database/`, Vitest for screens and actions, Playwright for the browser.
- Database tests need the local stack (`npm run db:start`) and the local settings loaded from `.env.database.local`.

## Run This Unit's Tests

Database (available from the first database step; add each file as it is written):

```bash
node --experimental-strip-types --test --test-concurrency=1 tests/database/removal-commands.test.ts tests/database/removal-duties.test.ts tests/database/removal-texts.test.ts tests/database/removal-races.test.ts tests/database/removal-reads.test.ts tests/database/removal-lifecycle.test.ts
```

Data and application layers:

```bash
node --experimental-strip-types --test src/data/removal.test.ts src/application/removal-facade.test.ts
```

Screens and actions:

```bash
npx vitest run --config vitest.config.ts tests/integration/removal.test.tsx
```

Browser:

```bash
npx playwright test --config playwright.config.ts tests/browser/removal.spec.ts tests/browser/removal-timing.spec.ts
```

Existing tests changed by this Unit are run by their exact file paths in the step that changes them.

## Coverage and Targets

- Line, branch and function coverage stay at 80% or more (`vitest.config.ts`); the threshold is not changed.
- Coverage does not see SQL, so each database rule gets the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two people at once.
- Preview, removal, result page and later run each take under 2 seconds on the large seed's busiest family.

## Fixed List Per Database Function

| Function | Cases that do not apply, and why |
|---|---|
| `parent_remove`, `family_archive`, `lifecycle_run` | All six apply |
| `family_restore` | All six apply; its existing tests are reused |
| `removal_preview`, `removal_flagged_items` | Outdated screen and repeated click: reads write nothing; two at once: they take no locks |
| Removal steps and internal reads | Refused and out of reach: shown by no role being able to call them; the other cases through the commands |

## Mocking and Test Data

- Database tests act as the real database roles and signed-in accounts; nothing in the database is mocked.
- Adapter, facade and action tests use fake ports, including a session-ending step that fails.
- All families, people and texts are invented. Every test address or phone number is added to `scripts/verification/privacy-allowlist.json`.
- A failing step and a failing audit write are forced inside a test transaction, never by changing the migration.
