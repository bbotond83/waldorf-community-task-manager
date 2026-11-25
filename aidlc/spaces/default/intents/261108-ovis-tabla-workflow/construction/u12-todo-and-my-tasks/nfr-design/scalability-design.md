# Scalability Design: u12-todo-and-my-tasks

One community of about 20 families on one database; no scaling mechanism is added. Concurrency is handled by row locks in a fixed order.

## Lock order (contract C1)

family, rota week, weekend pick, change request, duty, place, checklist task, **to-do task**, book. Commands in this Unit lock only the to-do task rows (ascending id), except `todo_pull_to_event`, which locks the event row first, then the checklist rows (inside `checklist_add_task`), then the selected to-do rows ascending. No command here locks a family row, and no checklist command locks a to-do row.

| Requirement | Design |
|---|---|
| NFR5.15 | Each command takes an idempotency key and returns the stored envelope on a repeat. |
| NFR5.16 | The claim runs `select ... for update` on the task row, then checks status and claimant; the loser reads the winner's claim and answers TODO_CLAIMED. |
| NFR5.17, NFR5.18 | Every update compares `p_expected_version` after the row lock; a changed version answers VERSION_CONFLICT, a done task answers TODO_DONE. |
| NFR5.19 | The post-lock active-parent re-check plus U14's removal pair (which releases and flags an open claim under the same row lock) give either a refused claim or a cleared and flagged one. |
| NFR5.20 | `p_expected_versions` is compared per selected row after the ascending lock; overlapping pulls queue on the same ascending order and cannot deadlock. |
| NFR5.21 | A unique constraint on `todo_event_links (task_id, event_id)` plus the event lock make the second pull of the same pair a no-op returning the first result. |
| NFR5.22 | The lock-order race tests run in repeated shuffled runs next to U11's checklist commands. |

## Capacity

A list is cut at 500 tasks; a pull at 50; indexes are listed in the performance design.
