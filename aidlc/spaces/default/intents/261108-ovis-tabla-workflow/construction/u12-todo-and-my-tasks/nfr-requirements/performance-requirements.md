# Performance Requirements: u12-todo-and-my-tasks

Sources: NFR8 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1, C9 and C14 in `contract-summary.md`, and `technology-stack.md`. The list holds the spreadsheet's to-do tasks, some tens to a few hundred including done ones. My tasks combines three sources (duties, recurring duties, claimed tasks) in one read.

## Response Times

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.11 | The to-do list (default view, and with done and later tasks shown) and a task page with its history each load in under 2 seconds. | Measured against the `db:seed:large` set of 30 families with a few hundred tasks, a third done. |
| NFR9.12 | My tasks loads in under 2 seconds for a family with duties, recurring duties and claimed tasks. | Measured on the same seed. |
| NFR9.13 | The coordinator's management page loads in under 2 seconds with all four tabs' lists. | Measured on the same seed. |
| NFR9.14 | Claiming, giving back, updating, marking done and undoing each answer in under 1 second. | A database test times each on the large seed. |
| NFR9.15 | Pulling 50 tasks into an event finishes in under 2 seconds. | A database test times it on the large seed. |
| NFR9.16 | The deadline check adds under 1 second to the daily run and finishes in under 10 seconds together with the other checks over a school year. | A test times the run before and after this Unit's row is registered. |
| NFR9.17 | `todo_list`, `todo_get` and `my_tasks_get` each return one document, so a page needs one call and none per task. | A test counts the calls each page makes. |

## Screens

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR8.5 | All text on new and changed screens is Hungarian, including refusal texts, status names, the empty and no-match states, the "Lejárt" mark, the event-link texts, the notice titles and "korábbi tag". | Reviewed in the screenshots. |
| NFR8.6 | The to-do list, task page, My tasks, management page, task form and pull list are designed in Stitch first, work at phone width and by keyboard, and have no serious or critical accessibility violations. Each button names its task ("Elvállalom: csap javítása") and results are announced through a status region. | Browser checks in all three browsers, and the owner's screenshot comparison. |
