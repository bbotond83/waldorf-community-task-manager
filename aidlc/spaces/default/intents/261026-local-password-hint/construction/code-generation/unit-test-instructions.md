# Unit Test Instructions: Local password hint

## Test framework and setup

Node's built-in test runner (`node --experimental-strip-types --test`). The guard tests use no database: the password check is a pure function of the connection address.

## Command for this change (scoped to the file it touches)

```bash
node --experimental-strip-types --test scripts/db/local-guard.test.ts
```

Type, lint and format checks: `npm run typecheck`, `npm run lint`, `npm run format:check`.

## What the tests prove (Minimal strategy: one test per requirement)

- FR1.1, FR1.3: a refused password throws a `ToolingError` with step `guard` and a message that contains the hint (the commands work only with the default local password; restart the stack).
- FR1.2: the message contains none of the refused passwords and no hash.
- The accepted default password still passes (existing assertions).

## Coverage

At least 80% lines, branches and functions across production source; `local-guard.ts` stays covered.

## Mocking and test data

None. The test passes made-up connection addresses with invented passwords.
