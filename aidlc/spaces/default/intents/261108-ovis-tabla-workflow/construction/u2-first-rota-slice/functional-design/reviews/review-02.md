## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u2-first-rota-slice/functional-design/entities.md > Duty constraints ("no working group"); functional-spec.md > Conversion of Existing Code (`tasks` row) | The design says a rota duty has no working group, and C4 allows a null working group. But `tasks.group_id` is NOT NULL in `20261026_coordination_schema.sql`, and the row-level-security reach checks (`has_core_scope(organization_id, group_id)`, `coordination_task_reached`) are keyed on it. The conversion table adds `origin_kind` and `origin_id` but never makes `group_id` nullable. Publishing cannot insert a rota duty as designed. A teacher's schedule entry (BR24.4) would also be invisible, because the reach check has no group to test. | State how the nullable group is handled: make `group_id` nullable and say how the reach helpers and policies treat a duty with no group (and what the teacher schedule needs), or give rota duties a defined community-level group. Add the chosen change to the conversion table. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u2-first-rota-slice/functional-design/traceability.json > coverage AC5.1.1, AC5.1.2 | AC5.1.3 is marked N/A (U6), but AC5.1.1 (four rotas) and AC5.1.2 (the part-year share) are marked OK even though the spec admits that only indoor cleaning and full-year families are delivered here. The map is not fully truthful. | Mark both as partial with the remainder named as delivered by U6, or add a note in the target text, in the same style as the N/A rows. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u2-first-rota-slice/functional-design/rules.md > BR22.4, functional-spec.md > W5 step 3 | The C1 lock steps are family, rota week, ..., duty, place. The design locks "plan row then week rows", and the plan row is not a listed step. W5 locks families, then the plan, then the weeks, then creates duties and places. The order is plausible, but the plan row's position is not pinned in the contract and BR22.4 and W5 word it differently. | State that the plan row is taken as the first lock of the rota week step, ascending by id, and use the same wording in BR22.4 and W5. Record it as a contract note for C1. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u2-first-rota-slice/functional-design/entities.md > notifications conversion; functional-spec.md > Conversion of Existing Code (`notifications` row) | In `20261036_notifications_schema.sql`, `task_id` and `task_starts_at` are NOT NULL and the `kind` and `target_type` lists are closed checks. The conversion names the relaxation, but a developer has to guess the rest: the new `dedupe_key` format, and how today's task-based lookups (the `notifications_task` index and the stale-reminder tests) treat rows with no task. | Specify the new dedupe key format (kind, plan, parent) and say that the task lookups and the reminder tick ignore rows with a null task. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u2-first-rota-slice/functional-design/rules.md > BR21.2, BR20.1 | RotaWeek rows are created once at draft time for every school week. The design does not say what happens if the school year's dates are edited while a draft exists, which would leave missing or surplus rows. | Either refuse changing the year dates while a plan exists, or say the draft rows are reconciled. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round
