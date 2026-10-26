# Unit Test Instructions: Password reset clears the lockout

## Test framework and setup

Node's built-in test runner (`node --experimental-strip-types --test`) with the shared fakes in `tests/support/identity-fakes.ts` (fake admin port, fake sign-in service, recording events). No database or network is needed.

## Command for this change (scoped to the file it touches)

```bash
node --experimental-strip-types --test src/identity/reset.test.ts
```

Type, lint and format checks: `npm run typecheck`, `npm run lint`, `npm run format:check`.

## What the tests prove (Minimal strategy: one test per requirement)

- FR1.1, FR2.3: on full success the clear call comes first, then `sessions_remove`, with unchanged arguments; the tokens and account id are returned.
- FR1.2: when ending the other sessions fails, the clear call was already made (before the removal attempts) and the result, sign-out and `follow_up_failed` event are unchanged.
- FR1.3: a failed clear result leaves a reset successful and the session removal still runs.
- NFR1, FR2.1 (review R-02): no clear call on a rejected code, a rejected password rule or a failed password update; and when both the clear and the session removal fail, the terminal result is unchanged.
- FR2.2: `reset_used` is emitted only on full success.

## Coverage

At least 80% lines, branches and functions across production source (`npm run test:coverage`); `reset.ts` is already fully covered and stays so.

## Mocking and test data

Handlers on the fake admin port record calls in order and return the envelopes the tests choose; no real service is called.
