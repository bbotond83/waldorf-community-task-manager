## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u2-first-rota-slice/nfr-requirements/reliability-requirements.md > NFR11.1 | NFR11.1 says archiving a family that holds rota places keeps working and the places stay as history. The functional design says the opposite: BR25.1 lists "archiving a family that holds a place" among the functions that refuse a rota duty with DUTY_ROTA_MANAGED, and functional-spec.md line 170 says archiving such a family is refused until U7 and U14. The pass criterion ("a lifecycle test archives a family that holds rota places") cannot be written both ways, and NFR3.5 also lists refusing every change function. | Rewrite NFR11.1 to match BR25.1: archiving a family that holds a rota place is refused with DUTY_ROTA_MANAGED, and the test asserts that refusal. Or, if the owner wants archiving to keep working, record that as a change to BR25.1 and the functional spec. | New |
| R-02 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u2-first-rota-slice/nfr-requirements/tech-stack-decisions.md > Notices row; reliability-requirements.md > NFR11.2; reliability-requirements.md > NFR7.4 | The notices decision says today's notices table gets "one added kind" (rota_published). The table in supabase/migrations/20261036_notifications_schema.sql does more than limit kinds. It limits target_type to 'task' or 'change_request', and makes task_id and task_starts_at NOT NULL. BR23.4 uses the plan as the target, and a plan has no single task or start time. NFR11.2 also says notices "without a task" are ignored by the reminder tick, but a notice cannot be stored without a task today. The structure change in NFR7.4 does not name these changes. | State the real structure change for notices: a new target type, task_id and task_starts_at nullable for this kind (or a defined value), the kind check, and the dedupe key. Add a pass criterion that a rota notice can be stored, and a test that the reminder tick and the lifecycle read tolerate it. Correct the "one added kind" wording and NFR11.2. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u2-first-rota-slice/nfr-requirements/scalability-requirements.md > NFR5.5 | The lock order here puts the plan row and the week rows between the family rows and the task rows. The team lock order is family, then task, then assignment rows. This is derived from BR22.4 and flagged there as a note for C1, but the NFR does not say it extends the team rule. | Say in NFR5.5 that this adds a step to the team lock order, and that other callers (U7 swaps) must follow it. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u2-first-rota-slice/nfr-requirements/security-requirements.md > NFR3.3 | The pass criterion says a parent gets "the same result as with none" when reading a plan, but BR22.5 makes the planning functions refuse a non-super-admin with a denied refusal. Only the overview returns nothing_published. The criterion mixes the two. | Split the criterion: planning functions return denied the same way with or without a draft; the overview returns nothing_published. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u2-first-rota-slice/nfr-requirements/observability-requirements.md > NFR4.4 and NFR4.5 | The claim that the audit action list is a constrained list that needs extending was not visible in the migrations checked. The "only super admins read it" claim for community-wide audit events is not tied to the existing audit read function. | Name the object that holds the action list and the audit read policy, so the test in Code Generation knows what to change. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round
