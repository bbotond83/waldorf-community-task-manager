# Performance Requirements: u2-first-rota-slice

Sources: NFR8 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and `technology-stack.md`. A published plan holds about 40 duties, one per school week, so the overview and the duty card are the pages to measure.

## Response Times

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.1 | The administrator's rota page, the school-year page, the parent's rota overview and a duty card each load in under 2 seconds on the owner's computer. | Measured against the `db:seed:large` set of 30 families with a published plan of a full school year. |
| NFR9.2 | Making a draft and publishing a plan each finish in under 5 seconds for a full school year. | A database test times both on the large seed. Publishing creates about 40 duties and places in one transaction (BR23.2). |
| NFR9.3 | Today's task lists and reminder lists keep their read speed once rota duties exist; they leave rota duties out (BR24.4). | The existing timing tests pass on a seed that holds a published plan. |

## Screens

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR8.1 | All text on new and changed screens is Hungarian, including refusal texts and the fixed indoor-cleaning card text. | Reviewed in the screenshots. |
| NFR8.2 | The school-year page, the rota page, the parent's overview and the duty card are designed in Stitch first, work at phone width and by keyboard, and have no serious or critical accessibility violations. | Browser checks in all three browsers, and the owner's screenshot comparison. |
