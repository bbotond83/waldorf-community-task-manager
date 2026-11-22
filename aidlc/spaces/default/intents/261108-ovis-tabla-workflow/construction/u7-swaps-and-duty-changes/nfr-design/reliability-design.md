# Reliability Design: u7-swaps-and-duty-changes

Sources: `reliability-requirements.md` and `tech-stack-decisions.md` of this Unit, `functional-spec.md` and `rules.md`, and C5, C8, C9, C11 and C16 in `contract-summary.md`.

## Transaction Design

- **Applying a swap (NFR7.1).** One function, one transaction: lock pass, checks, `place_exchange`, places back to active, `rota_adjust_picks_after_change`, request applied with applied versions read last, notices queued. Any failure raises and rolls everything back. Email sending is U5's later step, so a failed email never undoes the swap; the in-app notice stays.
- **Reassignment and reversal (NFR7.2).** The same shape; the cancelled swap and its notices are part of the same transaction.
- **Approving a cancellation (NFR7.3).** Order inside the transaction: request to approved, `place_release`, `rota_adjust_picks_after_change` with no family, notice, audit. Because the request is no longer open when `place_release` runs, it is never marked withdrawn.

## Database Guards (NFR7.4)

Table checks on `change_requests`: swap rows carry target place, duty, family and version; cancellation rows carry none; reason at most 500 characters; `approved` only for a cancellation; `applied` and `reversed` only for a swap; applied versions set exactly when the status is applied or reversed. A test tries each as the database owner.

## Time Design (NFR7.5)

Duty starts are stored as timestamps; "started" means start time at or before the moment of the call, which functions take as `now()` and the daily check takes as a parameter, so tests can set the moment around clock changes.

## Migration Design (NFR7.6)

One new forward-only migration: adds the columns and statuses, raises the stored versions of open swaps whose source is swap_pending by one (and marks their target place swap_pending, raising its version too, and stores that), keeps old approved swaps as history, rewrites the functions, adds `place_add`, changes `coordination_withdraw_requests` to return both places, applies the C11 delta, registers notice kinds and the check, revokes `swap_decide`, drops the policy `change_requests_read` and revokes `select` on `change_requests` from signed-in accounts, and adds the read `cancellation_list` that replaces the approvals screen's direct table read. A test applies it over a seeded database and compares rows.

## Daily Check Design (NFR7.7)

The check is registered in U5's registry without editing U5's functions; a failure is recorded in `timed_check_runs` and the other checks still run; a second run the same day finds nothing open to end.

## Testing Design (NFR6.1 to NFR6.4)

- Coverage thresholds unchanged.
- A test plan with one row per rule (BR70 to BR77) and the six fixed cases, each cell naming a test or "nem értelmezhető" with its reason.
- New database test files are added to their `test:database:*` script and the shuffled run; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended.
- `place_add`, the C11 no-family change, the expiry check and the removal pair are tested directly as the database owner; U6's pick tests run unchanged.

## Removal and Existing Behaviour (NFR11.1, NFR11.2)

- The removal pair ends a removed family's open requests (other place back to active, other family told), clears the reason of that family's requests and the removed person's ids, and returns counts only.
- The existing kernel swap tests are kept; expectations that Q1 (no group check) and Q4 (no admin approval) change are updated and named in the pull request.

## Verification Gate (NFR7.8)

`npm run verify:local` with the local settings loaded, green in all three browsers.
