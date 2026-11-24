# Monitoring Design: u8-animal-care-and-information

Sources: `observability-design.md`, `reliability-design.md`, `security-design.md` and `logical-components.md` of this Unit, with `performance-design.md` for the timing targets. Nothing is hosted, so there is no metric store, alert route or dashboard; monitoring means the records the project already keeps.

## Metrics and KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Failed email of an empty-slot message, day-before alert, fair-share reminder or start-time notice | U5 delivery-problems screen | Any entry is shown to the super admin | A family or coordinator did not learn of an empty slot or a change (NFR4.6) |
| Outcome and counts of `animal_empty_slots` and `animal_fair_share` | `timed_check_runs` | A failed run is shown on the same screen | Empty slots or reminders were not sent (NFR4.5) |
| Fair-share round of the month | The round row: day, average, families reminded | One row per month of the school year | The owner can check the month's reminders without reading notices (NFR4.7) |
| Audit entries of calendar saves and slot creation | Existing audit reader | One entry per command, and per denied attempt | Shows who moved or created many families' slots (NFR4.1, NFR4.3) |
| Refusal code of a command | Result envelope | Asserted in tests | The screen explains the refusal (NFR4.8) |
| Timings of the sign-up page, fair-share list, information page, commands, slot creation and daily checks | No timing test exists in this Unit. The nine database test files check behaviour, not speed, and no `animal-timing.test.ts` was built. The owner checks the pages by hand in the screenshot review | Pages and commands under 2 seconds, slot creation under 10, time change and daily checks under 5 (NFR9 targets) | Gap recorded after review: nothing blocks the merge if a target is missed. The owner decides whether a timing file like `library-timing.test.ts` is added in a later piece of work; until then the targets are unenforced |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| Notice email failed | A delivery fails | Low | The super admin's delivery-problems screen |
| Daily check failed | `animal_empty_slots` or `animal_fair_share` recorded as failed | Medium | The same screen |

The empty-slot alert of BR85.4 is a product notice to people, not a monitoring alert. No push, email or chat alert for operators exists or is added.

## SLIs and SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| None for a hosted service | — | Nothing is hosted; the only targets are the response times above, checked by tests on each pull request |

## Logs and Tracing

No new log stream or trace. Expected refusals use the result envelope; unexpected errors are mapped at the application boundary as today. No log line carries a family name, a section's text or contact details. No dashboard is added.
