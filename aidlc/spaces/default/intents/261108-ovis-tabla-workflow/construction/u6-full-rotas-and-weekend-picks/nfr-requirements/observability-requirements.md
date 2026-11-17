# Observability Requirements: u6-full-rotas-and-weekend-picks

Sources: NFR4 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1 and C9 in `contract-summary.md`, and `technology-stack.md`. The app runs only on the owner's computer, so no monitoring, alerting or SLO applies yet.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.4 | The audit action list gains `family.standing_set` and `weekend_pick.assign`, and past audit events stay readable. | A test applies the change over an audit row of each existing kind. |
| NFR4.5 | Both events concern a community-wide item and carry no working group, so only super admins can read them. | An audit read test for a super admin and for a group administrator. |
| NFR4.6 | Each run of the three checks is recorded by the daily run with its outcome and how many notices it created and skipped, and a failed check appears on the super admin's delivery-problems screen (C9). | A test runs each check and reads its run record; a forced failure appears on the screen's list. |
| NFR4.7 | A failed email for one of this Unit's notices appears on the same screen, grouped by kind and duty, with no address. | A test fails a delivery in the local test mailbox set-up and reads the list. |
| NFR4.8 | A refusal names its reason in the result envelope (DUTY_INELIGIBLE with its reason, ROTA_SAME_WEEK_CLASH, WEEKEND_SLOT_TAKEN, WEEKEND_SLOT_NOT_PICKABLE, WEEKEND_PICK_LOCKED, WEEKEND_PICK_CLOSED, WEEKEND_PICK_NOT_NEEDED, STANDING_INVALID) so the screen can explain it and the tests can assert it. | Each refusal code has a test that asserts the code. |
| NFR4.9 | A failed read or refusal shows the existing error or denied state, never an empty list: the unpicked list says "Mindenki választott" only when the read succeeded and nothing is open. | A browser or component test covers each state. |
