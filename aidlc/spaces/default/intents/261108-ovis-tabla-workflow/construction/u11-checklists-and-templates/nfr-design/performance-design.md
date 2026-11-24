# Performance Design: u11-checklists-and-templates

How the targets in `performance-requirements.md` are met, following `functional-spec.md` and `tech-stack-decisions.md`. A big-cleaning list of about 70 tasks and a few hundred claims a year fit set-based statements on one database; no cache is added.

## Reads

| Requirement | Design |
|---|---|
| NFR9.5, NFR9.10 | `checklist_get` returns one document: the checklist head, sections in position order, each with its tasks in position order, each task with its claims (C6 names joined once) and done mark, plus the caller's rights and the deadline. One query with ordered aggregates; indexes on `checklist_sections (checklist_id, position)`, `checklist_tasks (section_id, position)` and `checklist_claims (task_id)`. The event page calls U10's read and this one, two calls in all, with no call per task. |
| NFR9.6 | `template_list_admin` returns rows with a task count from one grouped query; `template_get` returns the template with its sections and tasks as one document, indexed on `template_sections (template_id, position)` and `template_tasks (section_id, position)`. |

## Writes

| Requirement | Design |
|---|---|
| NFR9.7 | `checklist_copy_template` copies with two `insert ... select` statements (sections, then tasks joined to the new section ids), filtering summer-only tasks in the select. `template_save` deletes the template's sections and tasks and inserts the new ones in two statements under the template lock. |
| NFR9.8 | A claim, give-up, done or undo touches one task row and one claim row under two short locks (scalability design), with no scan of the event. |
| NFR9.9 | The two daily checks each run one query over planned events in the window (indexed on `events (starts_at)` and `events (signup_deadline)` where set), then one `notice_send` per due event. The unclaimed check finds free tasks with one `exists` over `checklist_tasks` joined to claim counts for the due events only. |

## Screens

| Requirement | Design |
|---|---|
| NFR8.3 | Hungarian text lives with the screens; the new refusal codes, section kinds, closing-round text and time mark go into the existing code-to-message table. |
| NFR8.4 | Screens are designed in Stitch first and use new `checklist-` classes. Each button's accessible name includes the task title; tips use a native `details` element; results are announced through the existing status region. |

## Budget

A school year holds under 30 events and a few thousand checklist rows at most. Every read stays far inside the 2-second target and is checked on the large seed.
