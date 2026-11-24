# Observability Requirements: u8-animal-care-and-information

Sources: NFR4 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1, C8 and C9 in `contract-summary.md`, and `technology-stack.md`. The app runs only on the owner's computer, so no monitoring, alerting or SLO applies yet.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.4 | The audit action list gains `animal_calendar.saved` and `animal_slots.created`. Because each migration that adds an action drops and re-creates the whole check, the new check carries the complete current list, including every action added by earlier units up to the latest migration, and past audit events stay readable. | A test reads the list of allowed actions from the check in place before this Unit's migration, inserts one audit row of each, applies the migration, and finds every row still valid and both new actions accepted. |
| NFR4.5 | The two checks `animal_empty_slots` and `animal_fair_share` appear in the run record (`timed_check_runs`) with their outcome and counts, and a failure shows on the same screen as failed emails (C9). | A test runs each check, then forces a failure, and reads the record. |
| NFR4.6 | The four new notice kinds (`animal_empty_slots`, `animal_empty_slots_alert`, `animal_fair_share`, `animal_slot_time_changed`) appear on the super admin's delivery-problems screen (U5) when an email fails, with no address. | A test fails a delivery in the local test mailbox set-up and reads the list. |
| NFR4.7 | Each fair-share round keeps the day it was worked out, the average and the number of families reminded, so the owner can check a month's reminders without reading notices. | A test reads the round after a run. |
| NFR4.8 | A refusal names its reason in the result envelope (DUTY_FULL, DUTY_ALREADY_ASSIGNED, DUTY_INELIGIBLE, DUTY_CLOSED, DUTY_VERSION_STALE, SLOT_NOT_RELEASABLE, SLOT_GIVE_UP_TOO_LATE, REQUEST_CONFLICT, VERSION_CONFLICT, ANIMAL_TIMES_INVALID, ANIMAL_GROUP_INVALID, INFO_KEY_TAKEN, INFO_GROUP_INVALID, INFO_TEXT_INVALID and the denied refusal) so the screen can explain it and the tests can assert it. | Each refusal code has a test that asserts the code. |
| NFR4.9 | A failed read or refusal shows the existing error or denied state, never an empty list: the sign-up page says there are no slots only when the read succeeded and the year has none, and then tells a super admin to create them. | A browser or component test covers each state. |
