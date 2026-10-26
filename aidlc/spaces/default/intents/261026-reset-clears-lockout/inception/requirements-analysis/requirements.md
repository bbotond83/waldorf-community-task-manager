# Requirements: Password reset clears the lockout

## Intent analysis

After five failed sign-ins an account is locked for a while (up to 15 minutes). A person who is locked out usually asks for a password reset. `completePasswordReset` (`src/identity/reset.ts`) changes the password, ends the account's other sessions, and only then clears the failed-attempt counter (`sign_in_attempt_clear`). If ending the other sessions fails (three tries), the function returns before the clear. The person is told to sign in with the new password, but the lockout is still in force, so they may be refused for up to 15 minutes.

This work clears the counter as soon as the password has changed, so the lockout is gone in both outcomes.

Origin: finding R-12 of the U2 review; group B2 of `follow-ups/minor-findings-plan.md`.

## Functional requirements

- **FR1** The lockout is cleared whether or not the other sessions could be ended.
  - **FR1.1** `completePasswordReset` calls `sign_in_attempt_clear` immediately after the password update succeeded and before it removes the other sessions, with the same arguments as today (the keyed hash of the normalised email, and the user id).
  - **FR1.2** When ending the other sessions then fails after the three tries, the result, the sign-out of the new session and the `follow_up_failed` event are exactly as today (`dependency-failure-terminal` with `RESET_SESSIONS_NOT_ENDED`), and the lockout is already cleared.
  - **FR1.3** A failure of the clear call itself (a failed result or an exception from the admin call that the port reports as a result) does not change the outcome of the reset: it stays best-effort, as today.
- **FR2** Nothing else changes.
  - **FR2.1** The order before the password update is unchanged: the password rule is checked first, then the code is exchanged, so a rejected password never spends the link and no attempt is cleared when the password update failed.
  - **FR2.2** The `reset_used` event is emitted only on full success, as today.
  - **FR2.3** On full success the reset still returns the new session tokens and the account id.
- **FR3** The accepted limit is recorded: when ending the other sessions fails, those sessions can stay open until they expire (up to 30 days). It is written in `follow-ups/minor-findings-plan.md` under B2 with the repository owner (Botond) named as owner of the risk, and B2 is marked done there.

## Non-functional requirements

- **NFR1** Security: clearing the counter happens only after the password was changed through a valid one-time link; it is never reachable without that.
- **NFR2** Privacy: no new data is logged or returned; the call carries the same keyed hash and user id as today.
- **NFR3** Verifiability: the behaviour is covered by colocated unit tests (`src/identity/reset.test.ts`) with the existing fakes.
- **NFR4** Quality gates: strict type check, lint, format check and the unit tests pass; coverage of production source stays at or above 80%.

## Constraints

- No new dependency, no database change.
- Hungarian user-facing messages and result codes are unchanged.
- The existing success-path test asserts the call order (`sessions_remove` first, then the clear); it is updated to the new order, which is the intended change.

## Assumptions

- The admin port reports failures as results rather than throwing; the existing success path already ignores the clear call's result, and the change keeps that. A test shows that a failed clear leaves the outcome unchanged.
- The 30-day figure is the sign-in service's refresh-token lifetime as recorded in the follow-up plan.

## Out of scope

- Retrying the clear or reporting its failure to the person.
- Ending the other sessions in some other way (the session-removal retries stay at three).
- Other follow-up findings (B3 onward); each has its own branch.

## Open questions

None.
