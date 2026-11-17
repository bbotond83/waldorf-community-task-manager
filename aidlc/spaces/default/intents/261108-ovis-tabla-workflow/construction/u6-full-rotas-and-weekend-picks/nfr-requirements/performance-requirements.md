# Performance Requirements: u6-full-rotas-and-weekend-picks

Sources: NFR8 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C9 in `contract-summary.md`, and `technology-stack.md`. A published plan now holds four rotas: about 200 rota weeks and about 400 duties a year (three weekly duties and five weekend duties per week), so the planning page, the overview and publishing are the things to measure.

## Response Times

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.1 | The school-year page with standings and flagged duties, the planning page with four rotas, the rota overview, a duty card with its weekend part, and the unpicked list each load in under 2 seconds on the owner's computer. | Measured against the `db:seed:large` set of 30 families with a published four-rota plan of a full school year. |
| NFR9.2 | Making a draft of four rotas and publishing the plan each finish in under 5 seconds for a full school year. | A database test times both on the large seed. Publishing creates about 400 duties and places in one transaction (BR62.4). |
| NFR9.3 | Each of the three checks (`weekend_picks_reminder`, `weekend_picks_alert`, `rota_week_reminder`) finishes in under 2 seconds. | A database test times each on the large seed with a published plan. |
| NFR9.4 | Today's task lists, the sign-up list and the duty reminders keep their read speed once weekend duties exist; they leave rota and weekend duties out (BR65.5). | The existing timing tests pass on a seed that holds a published four-rota plan. |
| NFR9.5 | The eligibility check (BR60.2) adds no noticeable delay to sign-up, manual assignment or a swap. | The existing timing tests for those commands pass unchanged. |

## Screens

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR8.1 | All text on new and changed screens is Hungarian, including the refusal texts, the reasons for an empty week, the warnings and the card texts for front garden, water carrying and the weekend duties. | Reviewed in the screenshots. |
| NFR8.2 | The changed school-year page, planning page, overview and duty card, and the new unpicked list, are designed in Stitch first, work at phone width and by keyboard, and have no serious or critical accessibility violations. The weekend picker is a group of native radio buttons with a legend, and a disabled row says why in text. | Browser checks in all three browsers, and the owner's screenshot comparison. |
