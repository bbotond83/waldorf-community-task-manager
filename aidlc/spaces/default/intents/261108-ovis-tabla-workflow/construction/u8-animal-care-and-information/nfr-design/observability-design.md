# Observability Design: u8-animal-care-and-information

Sources: `observability-requirements.md` and `tech-stack-decisions.md` of this Unit, `functional-spec.md`, and C1, C8 and C9 in `contract-summary.md`. The app runs only on the owner's computer: there are no metrics, traces, alerts or SLOs to design yet; what the owner and the super admin can see is listed here.

| What | Where it shows | Requirement |
|---|---|---|
| Audit actions `animal_calendar.saved`, `animal_slots.created` | The audit log; the check is re-created with the complete current list, and its test reads the old list from the live check before applying the migration | NFR4.4 |
| Daily checks `animal_empty_slots`, `animal_fair_share` | `timed_check_runs` with outcome, created and skipped; a failure shows on the super admin's delivery-problems screen with failed emails | NFR4.5 |
| Four notice kinds | The delivery-problems screen lists a failed email by kind, with no address | NFR4.6 |
| Fair-share rounds | The round row keeps the day, the average and the number of families reminded | NFR4.7 |
| Refusals | Each refusal code of NFR4.8 is returned in the C1 envelope, mapped to a Hungarian message on screen and asserted by a test | NFR4.8 |
| Failed reads | The existing error and denied states; the sign-up page's "no slots yet" state appears only on a successful empty read and tells a super admin to create slots | NFR4.9 |

Nothing in this Unit logs a family's name, a section's text or a person's contact details.
