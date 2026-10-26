# Requirements: Local password hint

## Intent analysis

`db:seed` and `db:reset` refuse any database whose connection password is not the Supabase CLI's default local password (a guard against touching a hosted database through a loopback tunnel). A developer who started their local stack with a custom database password gets the message "The database connection does not use the local stack's default password, so it is not the local stack; nothing was changed." with no way forward. This work adds one sentence that says what the limit is and what to do.

Origin: finding R-10 of the U1 review; group B4 of `follow-ups/minor-findings-plan.md`.

## Functional requirements

- **FR1** The refusal message explains the limit.
  - **FR1.1** The message thrown by `assertLocalStackPassword` (`scripts/db/local-guard.ts`) keeps its current text and adds one short sentence: `db:seed` and `db:reset` work only with the Supabase CLI's default local database password, so a stack started with a custom password cannot be seeded or reset; restart the stack with the default password.
  - **FR1.2** The message contains no password, no hash and no part of the connection address.
  - **FR1.3** The check itself (what is accepted and refused) and the error step (`guard`) are unchanged.
- **FR2** The README line about the password check (section "Seed, large seed and reset") carries the same hint.
- **FR3** `follow-ups/minor-findings-plan.md` marks B4 done.

## Non-functional requirements

- **NFR1** Security: the guard is not weakened; no new way to pass it.
- **NFR2** Verifiability: a unit test in `scripts/db/local-guard.test.ts` shows the refused-password message contains the hint and leaks no password or hash.
- **NFR3** Quality gates: strict type check, lint, format check, unit tests pass; coverage stays at or above 80%.

## Constraints

- No new dependency. The `db:worker` address check (finding B5) is a separate change.

## Assumptions

- "Use the hosted tooling for that database" is not stated in the message: the repository has no hosted tooling for these commands, so the only way forward named is restarting the stack with the default password.

## Out of scope

- Making the commands work with a custom password; the guard's purpose is to refuse anything but the default.

## Open questions

None.
