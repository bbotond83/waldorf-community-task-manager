# Monitoring Design: u7-swaps-and-duty-changes

Sources: `observability-design.md`, `reliability-design.md`, `security-design.md` and `logical-components.md` of this Unit, with `performance-design.md` for the timing targets. Nothing is hosted, so there is no metric store, alert route or dashboard; monitoring means the records the project already keeps.

## Metrics and KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Failed email of a swap or duty notice | U5 delivery-problems screen, the five new kinds and the existing ones | Any entry is shown to the super admin | A family did not learn of a swap, reversal or reassignment (NFR4.6) |
| Outcome and counts of `swap_expiry` | `timed_check_runs` | A failed run is shown on the same screen | Pending requests did not end when their duty started (NFR4.7) |
| Audit entries of administrator actions | Existing audit reader | One entry per reassignment, reversal and cancellation decision, and per denied attempt | Shows who changed a family's duty (NFR4.1, NFR4.3) |
| Refusal code of a command | Result envelope | Asserted in tests | The screen explains the refusal (NFR4.8) |
| Timings of candidate list, swaps page, swap list, commands and daily check | Database and browser tests on the large seed | Pages and commands under 2 seconds, daily check under 5 seconds, median of 5 runs | NFR9 targets |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| Notice email failed | A delivery fails | Low | The super admin's delivery-problems screen |
| Daily check failed | `swap_expiry` recorded as failed | Medium | The same screen |

No push, email or chat alert exists or is added.

## SLIs and SLOs

None: no hosted service. The only targets are the response times above, checked by tests.

## Logs and Tracing

No new log stream or trace. Expected refusals use the result envelope; unexpected errors are mapped at the application boundary as today. No log line carries a reason, name or contact detail. No dashboard is added.
