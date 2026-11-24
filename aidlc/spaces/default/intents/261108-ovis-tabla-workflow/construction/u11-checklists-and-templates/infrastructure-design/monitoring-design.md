# Monitoring Design: u11-checklists-and-templates

Sources: `observability-design.md`, `reliability-design.md` and `logical-components.md` of this Unit. Nothing is hosted, so there is no metric store, alert route or dashboard; monitoring means the three records the project already keeps. This is the platform-specific side of the observability strategy.

## Metrics and KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Failed email of a lead-time notice or unclaimed-task alert | U5 delivery-problems screen, kinds `event_lead_time` and `checklist_unclaimed` | Any entry is shown to the super admin | Families or organisers were not told (NFR4.14) |
| Outcome, counts and failed events of the two daily checks | `timed_check_runs` | A failed run, or a failed event in the detail, is shown on the same screen | A notice or alert was not created (NFR4.13) |
| Audit entries of checklists and templates | Existing audit reader | One entry per audited action of BR170.3 | Shows who removed a template, a claim or a done mark (NFR4.9, NFR4.12) |
| Refusal code of a command | Result envelope | Not stored as a metric; asserted in tests | The screen explains the refusal (NFR4.15) |
| Timings of the event page, template screens, copy, claim and the daily checks | Database and browser tests on the large seed | Pages under 2 seconds; claim and done under 1 second; both checks together under 10 seconds | NFR9 targets |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| Notice email failed | A delivery of one of the two new kinds fails | Low | The super admin's delivery-problems screen |
| Daily check failed | A check run recorded as failed, or one event recorded as failed inside a run | Medium | The same screen as failed emails |

No push, email or chat alert exists or is added. A day on which the owner does not run `npm run timed:run` leaves no record; the next run catches up on every due notice (see the daily-run registry row of `infrastructure-specification.md`), and an alert for a missed run belongs to the hosting work.

## SLIs and SLOs

None: no hosted service, no availability target (`reliability-requirements.md`). The only targets are the response times above, checked by tests, not by live measurement.

## Logs and Tracing

No new log stream or trace. Expected refusals use the result envelope; unexpected errors are mapped at the application boundary as today. No log line carries a task title, a note, a typed name or a contact detail. No dashboard is added.

## When Hosting Starts

The later hosting work will need to watch the same two records (failed deliveries and timed-run outcomes), add a real alert route, and call the starting-template install once; nothing in this Unit blocks that.
