# Performance Design: u12-todo-and-my-tasks

How the targets in `performance-requirements.md` are met, following `functional-spec.md` and `tech-stack-decisions.md`. A few hundred tasks with short histories fit set-based statements on one database; no cache is added.

## Reads

| Requirement | Design |
|---|---|
| NFR9.11, NFR9.17 | `todo_list` returns one document: the visible tasks with owner label, claimant display name (C6 joined once), status, deadline and the "Lejárt" flag, cut at 500 with a note. `todo_get` returns the task with its history and event links as one document. Indexes on `todo_tasks (status, deadline)`, `todo_tasks (owner_group_id)`, `todo_tasks (owner_family_id)`, `todo_tasks (claimant_parent_id)`, `todo_task_history (task_id, at)` and `todo_event_links (task_id)`. |
| NFR9.12, NFR9.17 | `my_tasks_get` calls the existing duty read, U9's `recurring_my_occurrences` and one query over the family's claimed tasks, and returns one document sectioned by week boundary. The page makes one call. |
| NFR9.13, NFR9.17 | The management page calls the C14 list functions and `todo_list_for_group`, one document per tab; no call per task. |

## Writes

| Requirement | Design |
|---|---|
| NFR9.14 | A claim, give-back, update, done mark or undo touches one task row, one history row and at most one notice, under one short row lock (scalability design). |
| NFR9.15 | `todo_pull_to_event` locks the event row, then creates the checklist tasks through `checklist_add_task` (which locks the checklist rows), then locks the selected to-do rows once, ascending, and checks their versions, and writes the links with one `insert ... select`; at most 50 tasks per call. |
| NFR9.16 | The deadline check runs one query over open tasks whose deadline falls in the window (index above) and sends one `notice_send` per due task not yet sent; it does no per-task read beyond that row. |

## Screens

| Requirement | Design |
|---|---|
| NFR8.5 | Hungarian text lives with the screens; the new refusal codes, status names, empty and no-match states, "Lejárt", "Az eseményen kész" and "korábbi tag" go into the existing code-to-message table. |
| NFR8.6 | Screens are designed in Stitch first and use new `todo-` classes. Each button's accessible name includes the task topic; results are announced through the existing status region. |

## Budget

A school year holds a few hundred tasks and about a thousand history rows. Every read stays far inside the 2-second target and is checked on the large seed.
