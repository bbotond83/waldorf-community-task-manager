# Code Summary: Local password hint

## Files created or modified

- Modified `scripts/db/local-guard.ts`: the message of `assertLocalStackPassword` gains one sentence (the seed and the reset work only with the Supabase CLI's default local database password; restart the stack with the default password). The check and the error step are unchanged.
- Modified `scripts/db/local-guard.test.ts`: one new test (the hint is in the message; neither the refused password nor the stored hash is echoed).
- Modified `README.md`: the password-check line carries the same hint.
- Modified `aidlc/spaces/default/intents/261012-real-backend-local/follow-ups/minor-findings-plan.md`: B4 marked done.

## Key implementation decisions

- The sentence names only the default-password rule and the way out; it contains no password, hash or address.
- The message text is the user-facing contract of the tool, so the test matches its two key phrases rather than the whole sentence.

## Test coverage summary

`scripts/db/local-guard.test.ts`: 18 tests, 18 passed; against the previous `local-guard.ts` the new test fails (17 passed, 1 failed). Type check, lint and format pass. Full suite and coverage are run in Build and Test.

## Tests written but not executed in this stage

None.

## Deviations from the plan

None.
