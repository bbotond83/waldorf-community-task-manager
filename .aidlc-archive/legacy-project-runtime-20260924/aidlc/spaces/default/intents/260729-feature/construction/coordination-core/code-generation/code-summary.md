# Coordination Core Code Summary

## Delivered

- `src/coordination/` provides typed task/assignment/swap contracts, a transactional coordination service, in-memory adapters, and public exports.
- Signup validates linked-family visibility, task version, and capacity before writing an active assignment.
- Confirmed two-family swaps exchange assignments atomically; unconfirmed swaps enter `admin_pending` and mark the source assignment pending.
- Successful assignment changes emit a durable `assignment.changed` event and a redacted audit record with no family, reason, or contribution details.

## Validation

- `npm test` — 18 tests passed.
- `npm run typecheck` — passed after the focused test union narrowing fix.

## Boundary

The unit consumes family-directory eligibility and does not alter access or directory source. Cancellation, contribution, allergen, route, RLS, and job-worker implementations await their owning units/application scaffold.

## Review Remediation

- Auto-approval now requires explicit confirmation identifiers for both assignment families; one-sided requests remain pending.
- Added admin-authorized pending-swap and cancellation decision seams, plus owner-scoped contribution and participant/admin allergen eligibility checks.
