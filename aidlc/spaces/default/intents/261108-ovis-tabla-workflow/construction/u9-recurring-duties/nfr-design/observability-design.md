# Observability Design: u9-recurring-duties

Sources: `observability-requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1, C8 and C9 in `contract-summary.md`. The app runs only on the owner's computer, so no monitoring, alerting, SLO or tracing is designed.

## Approach

This Unit reuses what the app already has: the audit table and its reader, U5's check-run record and delivery-problems screen, and the result envelope. It adds no new reader, table or log.

| Need | Design | Requirement |
|---|---|---|
| Who did what | Five new audit actions: schedule saved, schedule switched on or off, occurrence marked done, undone, skipped; plus the removal action of BR152.1. Each is added to the audit action list with a migration that keeps older rows readable. Rows hold the actor and opaque ids only | NFR4.4, NFR4.5 |
| Did the daily check run | `recurring_due_check` is registered in U5's registry, so each run (created, skipped, outcome, error code) shows on the super admin's check-runs screen; a failing run shows there | NFR4.6 |
| Did a notice fail | The kinds `recurring_due` and `recurring_overdue` and the target type `recurring_duty` are registered in U5's registries; a failed email appears on the delivery-problems screen with no address, as any kind does | NFR4.7 |
| Why was I refused | Refusal codes in the envelope: RECURRING_CLOSED, RECURRING_UNDO_TOO_LATE, VERSION_CONFLICT, validation field names and the denied refusal. Each has a test that asserts the code | NFR4.8 |
| Failed read shown as empty | A failed read or refusal shows the existing error or denied state; a list says "no duties" only when the read succeeded and found nothing | NFR4.9 |

## Correlation

The idempotency key of a command and the audit row's ids are the trail for a single action; the check-run record is the trail for a daily run. No correlation id beyond these is added.

## Tests

The audit migration is tested over an audit row of each existing kind; each new action has an audit read test; a forced check failure is read from the run list; a forced delivery failure is read from the problems list; each refusal code is asserted; and a browser or component test covers the error, denied and empty states.
