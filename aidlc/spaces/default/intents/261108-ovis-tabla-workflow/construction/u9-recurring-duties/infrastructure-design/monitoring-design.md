# Monitoring Design: u9-recurring-duties

Sources: `observability-design.md`, `reliability-design.md` and `logical-components.md` of this Unit. Nothing is hosted, so there is no metric store, alert route or dashboard; monitoring means the three records the project already keeps. This is the platform-specific side of the observability strategy.

## Metrics and KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Failed email of a recurring-duty notice | U5 delivery-problems screen, kinds `recurring_due` and `recurring_overdue` | Any entry is shown to the super admin | An owner did not hear that a duty is due or overdue (NFR4.7) |
| Outcome and counts of `recurring_due_check` | `timed_check_runs` | A failed run is shown on the same screen | Occurrences and notices for the day were not created (NFR4.6) |
| Audit entries of recurring duties | Existing audit reader | One entry per save, switch, done, undo, skip | Shows who changed a schedule or an occurrence (NFR4.1, NFR4.5) |
| Refusal code of a command | Result envelope | Not stored as a metric; asserted in tests | The screen explains the refusal (NFR4.8) |
| Timings of group page, family page, duty card, save, mark done and daily check | Database and browser tests on the large seed | Pages and commands under 2 seconds; daily check under 5 seconds with every schedule due and email mocked, second run under 2 seconds; median of 5 runs | NFR9 targets |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| Notice email failed | A delivery of a recurring-duty notice fails | Low | The super admin's delivery-problems screen |
| Daily check failed | `recurring_due_check` run recorded as failed, or one schedule recorded as failed inside a run | Medium | The same screen as failed emails |

No push, email or chat alert exists or is added.

## SLIs and SLOs

None: no hosted service, no availability target (`reliability-requirements.md`). The only targets are the response times above, checked by tests, not by live measurement.

## Logs and Tracing

No new log stream or trace. Expected refusals use the result envelope; unexpected errors are mapped at the application boundary as today. No log line carries a title, a skip reason, a name or a contact detail. No dashboard is added.

## When Hosting Starts

The later hosting work will need to watch the same two records (failed deliveries and timed-run outcomes) and add a real alert route; nothing in this Unit blocks that.
