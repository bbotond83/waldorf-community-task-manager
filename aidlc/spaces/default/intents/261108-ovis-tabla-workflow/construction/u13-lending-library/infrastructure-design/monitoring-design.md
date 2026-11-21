# Monitoring Design: u13-lending-library

Sources: `observability-design.md`, `reliability-design.md` and `logical-components.md` of this Unit. Nothing is hosted, so there is no metric store, alert route or dashboard; monitoring means the three records the project already keeps. This is the platform-specific side of the observability strategy.

## Metrics and KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Failed email of a library notice | U5 delivery-problems screen, kinds `book_returned` and `book_return_due` | Any entry is shown to the super admin | A parent who asked to be told, or a leaving family, did not get the mail (NFR4.6) |
| Outcome and counts of `library_return_due` | `timed_check_runs` | A failed run is shown on the same screen | The reminder to a leaving family did not run (NFR4.7) |
| Audit entries of the library | Existing audit reader | Each super-admin action has one entry | Shows who changed a book they did not own (NFR4.1, NFR4.5) |
| Refusal code of a command | Result envelope | Not stored as a metric; asserted in tests | The screen explains the refusal (NFR4.8) |
| Timings of list, book page, borrow, return, add and daily check | Database and browser tests on the large seed | Page loads and commands under 2 seconds, daily check under 5 seconds, median of 5 runs | NFR9 targets |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| Notice email failed | A delivery of a library notice fails | Low | The super admin's delivery-problems screen |
| Daily check failed | `library_return_due` run recorded as failed | Medium | The same screen as failed emails |

No push, email or chat alert exists or is added.

## SLIs and SLOs

None: no hosted service, no availability target (`reliability-requirements.md`). The only targets are the response times above, checked by tests, not by live measurement.

## Logs and Tracing

No new log stream or trace. Expected refusals use the result envelope; unexpected errors are mapped at the application boundary as today. No log line carries a title, name or contact detail. No dashboard is added.

## When Hosting Starts

The later hosting work will need to watch the same two records (failed deliveries and timed-run outcomes) and add a real alert route; nothing in this Unit blocks that.
