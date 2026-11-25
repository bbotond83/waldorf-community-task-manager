# Monitoring Design: u12-todo-and-my-tasks

Sources: `observability-design.md`, `reliability-design.md` and `logical-components.md` of this Unit. Nothing is hosted, so there is no metric store, alert route or dashboard; monitoring means the records the project already keeps.

## Metrics and KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Failed email of a change notice or deadline reminder | U5 delivery-problems screen, kinds `todo_changed` and `todo_due` | Any entry is shown to the super admin | A claimant or helper was not told (NFR4.22) |
| Outcome, counts and failed tasks of the deadline check | `timed_check_runs` | A failed run, or a failed task in the detail, is shown on the same screen | A reminder was not created (NFR4.21) |
| Audit entries of to-do actions | Existing audit reader | One entry per audited action of BR189.3 | Shows who freed a claim, undid a done mark, pulled tasks or applied a removal (NFR4.17, NFR4.20) |
| Refusal code of a command | Result envelope | Not stored as a metric; asserted in tests | The screen explains the refusal (NFR4.23) |
| Timings of the list, task page, My tasks, management page, claim, done, pull and the daily check | Database and browser tests on the large seed | Pages under 2 seconds; claim, done and undo under 1 second; pull of 50 under 2 seconds; the daily run under 10 seconds | NFR9 targets |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| Notice email failed | A delivery of one of the two new kinds fails | Low | The super admin's delivery-problems screen |
| Daily check failed | A run recorded as failed, or one task recorded as failed inside a run | Medium | The same screen |

No push, email or chat alert exists or is added. A day without `npm run timed:run` leaves no record; the next run catches up. An alert for a missed run belongs to the hosting work.

## SLIs and SLOs

None: no hosted service, no availability target (`reliability-requirements.md`). The only targets are the response times above, checked by tests.

## Logs and Tracing

No new log stream or trace. Expected refusals use the result envelope; unexpected errors are mapped at the application boundary as today. No log line carries a task topic, note, name or contact detail. No dashboard is added.

## When Hosting Starts

The hosting work will watch the same two records, add a real alert route, and call `migration_load_todo` for real data once; nothing in this Unit blocks that.
