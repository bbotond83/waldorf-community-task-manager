# Performance Requirements: u11-checklists-and-templates

Sources: NFR8 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1, C9 and C14 in `contract-summary.md`, and `technology-stack.md`. The biggest list is the big cleaning: about 70 tasks in nine areas plus the organiser's list, held up to three times a year. A community has about ten templates and about 30 events a year, so the event page with its checklist and the template editor are the things to measure.

## Response Times

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.5 | The event page with a full big-cleaning checklist (every task with claims and some done) loads in under 2 seconds on the owner's computer, together with U10's parts of the page. | Measured against the `db:seed:large` set of 30 families, with a big-cleaning event whose tasks are mostly taken. |
| NFR9.6 | The templates list and the template editor with the big-cleaning template each load in under 2 seconds. | Measured on the same seed. |
| NFR9.7 | Copying the big-cleaning template into an event, and saving it whole in the editor, each finish in under 2 seconds. | A database test times both on the large seed. |
| NFR9.8 | Taking, giving up and marking a task done each answer in under 1 second, so the row updates without a noticeable wait. | A database test times each on the large seed. |
| NFR9.9 | The two daily checks together finish in under 10 seconds over a school year of events, and add no measurable time to the other checks of the run. | A test times the run before and after this Unit's rows are registered. |
| NFR9.10 | `checklist_get` returns one document per event, so the page needs one call for the checklist and no call per task. | A test counts the calls the page makes. |

## Screens

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR8.3 | All text on new and changed screens is Hungarian, including refusal texts, section kinds, the closing-round text, the outside-the-event time mark, the notice titles and the "korábbi tag" mark. | Reviewed in the screenshots. |
| NFR8.4 | The checklist block, the template field on the event form, the checklist editor and the template screens are designed in Stitch first, work at phone width and by keyboard, and have no serious or critical accessibility violations. Each button names its task ("Elvállalom: Ablakok lemosása"), tips open with a native disclosure control, and results are announced through a status region. | Browser checks in all three browsers, and the owner's screenshot comparison. |
