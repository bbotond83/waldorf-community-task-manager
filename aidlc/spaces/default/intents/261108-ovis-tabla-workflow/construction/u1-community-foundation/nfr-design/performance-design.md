# Performance Design: u1-community-foundation

How `performance-requirements.md` is met, within `tech-stack-decisions.md` and `functional-spec.md`. No caching is added: one community's data is small, and a cache could serve a revoked right (`contract-summary.md`, C2).

## Budgets

| Requirement | Design | Measured by |
|---|---|---|
| NFR9.1 | Each list is one database call. Its budget is the existing ceiling of 1500 ms, which leaves 500 ms of the 2 seconds for the page. | Worst of the repeated runs in `tests/database/directory-timing.test.ts`, on the 30-family set, extended with the working-group list, the unfiltered schedule and the parent's whole-community list. |
| NFR9.2 | `coordination_reach_task_ids` keeps its once-per-query evaluation and adds tasks with no group for a super admin only. A new index on tasks with no group supports this. | The same test file, 1500 ms ceiling, with community-wide tasks in the data. |

## Query Shape

`duty_list` loses its membership join, so it reads every non-cancelled task of the community. The `tasks_organization` index already serves that read. `coordination_duty_view` also loses one membership lookup per row.

## Screens (NFR8.1, NFR8.2)

The working-group list follows `DESIGN.md`, uses a `workgroup-` class prefix, and is one server-rendered page per role area sharing one component. The owner compares it with its Stitch design from screenshots. Browser checks run in Chromium, Firefox and mobile Chrome, with the accessibility scan.
