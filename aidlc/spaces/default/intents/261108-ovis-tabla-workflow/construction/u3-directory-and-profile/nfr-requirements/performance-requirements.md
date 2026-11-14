# Performance Requirements: u3-directory-and-profile

Sources: NFR8 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and `technology-stack.md`. The directory is the one list page to measure: one card per family, each with its parents, and children where allowed.

## Response Times

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.1 | The directory, "Fiókom" and the administrator's records screen each load in under 2 seconds on the owner's computer. | Measured against the `db:seed:large` set of 30 invented families. |
| NFR9.2 | The directory function returns all cards in one call, with each field decided in the database, and stays under 2 seconds for 20 invented families (the target size) as the functional spec states. | A database test times the call as a parent, a teacher and a super admin. |
| NFR9.3 | The directory search runs over the cards already received and sends no further request (BR30.9). | A browser test types in the search box and sees no network call. |
| NFR9.4 | The new read rules do not slow today's lists: task, reminder and records lists keep their speed. | The existing timing tests pass on the large seed. |

## Screens

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR8.1 | All text on new and changed screens is Hungarian, including refusal and email texts. | Reviewed in the screenshots and the email texts. |
| NFR8.2 | The directory, "Fiókom", the email-confirmation page and the changed records screen are designed in Stitch first, work at phone width and by keyboard, wrap long names, and have no serious or critical accessibility violations. | Browser checks in all three browsers, and the owner's screenshot comparison. |
