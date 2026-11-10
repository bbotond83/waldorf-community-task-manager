# Performance Requirements: u1-community-foundation

Sources: NFR8 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and `technology-stack.md`. Removing the group filter from parents' lists (BR4.1) means more rows per family, so those pages are the ones to measure.

## Response Times

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.1 | The working-group list, the parent's Feladatok page, the teacher's unfiltered Beosztás and the administrator's Feladatok és események each load in under 2 seconds on the owner's computer. | Measured against the `db:seed:large` set of 30 families, which exceeds the required 20. |
| NFR9.2 | A super admin's task and reminder lists include items with no group without losing today's read speed. | The existing timing tests pass, extended with community-wide tasks. |

## Screens

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR8.1 | All text on changed and new screens is Hungarian. | Reviewed in the screenshots. |
| NFR8.2 | The working-group list is designed in Stitch first, works at phone width and by keyboard, and has no serious or critical accessibility violations. | Browser checks in all three browsers, and the owner's screenshot comparison. |
