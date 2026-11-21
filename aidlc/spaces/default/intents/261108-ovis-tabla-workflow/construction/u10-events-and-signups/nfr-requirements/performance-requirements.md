# Performance Requirements: u10-events-and-signups

Sources: NFR8 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1 and C14 in `contract-summary.md`, and `technology-stack.md`. A school year holds about 30 events, each with up to 10 notices, 20 roles, a few dozen sign-ups (up to 10 per parent) and up to 20 offers per parent, so the events list and the event page are the things to measure.

## Response Times

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.1 | The events list (with and without "Korábbi események"), the event page with its notices, roles, sign-ups and food offers, and the group page's events section each load in under 2 seconds on the owner's computer. | Measured against the `db:seed:large` set of 30 families with a school year of events, each with sign-ups and offers. |
| NFR9.2 | Saving an event with its notices (BR103) and cancelling an event with its open tasks (BR118.1) each finish in under 2 seconds. | A database test times both on the large seed; the cancelled event has the most open tasks in the seed. |
| NFR9.3 | Today's task lists, the sign-up list and the duty reminders keep their read speed; sign-ups and food offers are not duties and are read by none of them (BR111.1). | The existing timing tests pass on a seed that holds events with sign-ups and offers. |
| NFR9.4 | Each read returns one document, so the page needs one call and no call per row. | A test counts the calls a page makes. |

## Screens

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR8.1 | All text on new and changed screens is Hungarian, including refusal texts, the closed-event text, the allergen wording, the category names and the "korábbi tag" mark. | Reviewed in the screenshots. |
| NFR8.2 | The events list, event page and event form are designed in Stitch first, work at phone width and by keyboard, and have no serious or critical accessibility violations. The three allergen ticks are native checkboxes with visible labels, and the past-events switch is a native control with a label. | Browser checks in all three browsers, and the owner's screenshot comparison. |
