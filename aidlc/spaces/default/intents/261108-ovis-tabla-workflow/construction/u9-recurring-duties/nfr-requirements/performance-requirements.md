# Performance Requirements: u9-recurring-duties

Sources: NFR8 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1, C9 and C14 in `contract-summary.md`, and `technology-stack.md`. A school year holds about 12 to 20 schedules (animal care, two inspection rounds, three seasonal jobs, bottle cleaning) and, with 14 days of lead and 60 days of history, a few hundred occurrences at any moment, so the group list, the family list and the daily check are the things to measure.

## Response Times

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.1 | A group's recurring duties page, the family's recurring duties page and the duty card with its bottle-cleaning line each load in under 2 seconds on the owner's computer. | Measured against the `db:seed:large` set of 30 families with a school year of occurrences, including overdue and done ones. |
| NFR9.2 | Saving a schedule (BR144.1 removes later occurrences and creates today's) and marking an occurrence done each finish in under 2 seconds. | A database test times both on the large seed. |
| NFR9.3 | The daily check `recurring_due_check` over all active schedules finishes in under 5 seconds on the large seed, and a second run the same day finishes in under 2 seconds. | A database test times both runs. |
| NFR9.4 | Each read returns one document, so a page needs one call and no call per row; overdue occurrences older than 60 days are excluded in the read, not on the screen (BR146.3). | A test counts the calls a page makes and checks the rows returned. |
| NFR9.5 | Existing duty, rota and notice reads keep their speed with the new tables present. | The existing timing tests pass on a seed that holds schedules and occurrences. |

## Screens

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR8.1 | All text on new and changed screens is Hungarian, including refusal texts, "lejárt", "kihagyva", "Kész", "Mégsem", the notice texts and the season month names. | Reviewed in the screenshots. |
| NFR8.2 | The group duties page, the recurring duty form, the family duties page, the bottle-cleaning line and the interval number on the school calendar page are designed in Stitch first, work at phone width and by keyboard, and have no serious or critical accessibility violations. Kész and Mégsem are native buttons with visible labels, and the state (lejárt, kihagyva, kész) is shown in words as well as colour. | Browser checks in all three browsers, and the owner's screenshot comparison. |
