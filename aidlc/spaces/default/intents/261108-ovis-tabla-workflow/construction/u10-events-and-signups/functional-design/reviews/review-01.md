## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-17T14:11:19Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/functional-design/rules.md > BR110.1 and BR116.1 (against BR118.1 and functional-spec.md W4 step 4, W7 step 6, W9 step 2) | The withdraw rules for a sign-up and a food offer say the event must be open, so a cancelled or finished event refuses withdrawal with EVENT_CLOSED. The workflows and BR118.1 say a parent may still withdraw their own sign-up or offer on a cancelled event, and W4 step 4 says the same for a finished one. A developer cannot tell which to build. | Decide whether a parent may withdraw on a cancelled and on a finished event. Then make BR110.1, BR116.1, BR118.1 and W4, W7 and W9 say the same thing. Withdraw is the only command exempt from the open check, so state that in the rules. | New |
| R-02 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/functional-design/entities.md > EventRole constraints (against rules.md BR124.1, BR124.2) | The entity says exactly one of parentId and personName is set. BR105.1 says never neither. BR124.1 clears parentId on removal and BR124.2 clears personName, so a role then holds neither. The data rule would block the removal it is meant to support. | Change the EventRole constraint and BR105.1 so that "neither" is a valid state after removal, shown as korábbi tag. Keep "never both", and keep "exactly one" only for roles that are saved or edited by a caller. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/functional-design/rules.md > BR124.2 and functional-spec.md > Commands and reads table | BR124.2 says the removal screen lists the typed names of roles that do not match exactly. The preview in C16 returns only counts, and the function table has no read that lists those names or tells a super admin which roles hold typed names. U14 has nothing to call to build that list. | Add a super-admin-only read function that lists typed-name roles with event and role, with its access rule and denied refusal. Name it in the function table and in the C16 delta. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/functional-design/rules.md > BR122.1 (against contract-summary.md C1 locks) | BR122.1 says every command locks the event row first. The C1 lock steps are family, rota week, weekend pick, change request, duty, place, checklist task, to-do task, book, and the event is not among them. The design does not say where the event sits relative to the family step. The contract delta list does not mention C1. Event tasks are shared with duty commands from other units, so a wrong position could deadlock. | Add the event to the C1 lock order as a step, or state that sign-up and offer commands never lock a family and that duty commands never lock the event. Record it in the contract delta list. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/functional-design/rules.md > BR117.2 and BR118.1 | Reopening a cancelled event sends nothing. The once key for the cancellation is the event id, so a second cancellation after a reopen would also stay silent. People told "Esemény elmarad" are never told it is back. | Decide whether a reopen sends a notice. At minimum, make the cancellation once key include the event version so a second cancellation tells again. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/functional-design/rules.md > BR100.1, BR107.1, BR117.2 | The design never says whether a manager may change a finished event. BR107.1 lets the tale be saved at any time. BR117.2 only says a finished event sends nothing. event_save on a finished event is unspecified. | State which fields stay editable after the end. For example, allow the tale and roles, and refuse date and status changes. | New |
| R-07 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/functional-design/functional-spec.md > Conversion of Existing Code (teacher schedule function) | The teacher schedule will show "the name of the event's oldest role". It is unclear whether that is the role name or its person, and whether a typed name or a parent who shares nothing may be shown to a teacher. | Say what is shown to a teacher, and apply the C6 and BR105.2 visibility rules to it. | New |
| R-08 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/functional-design/rules.md > BR104.1 and BR119.1 | event_list is used twice: once with no argument for every reader, and once with a group id for the coordinator page (C14), each with different access and columns. | Give the reader list a different name, or document the two signatures and their access rules as one function with a clear refusal behaviour. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual cross-check of traceability.json targets against rules.md | PASS | Every BR id named in coverage and reverse exists. All 18 ACs have an entry, and all 25 AC11 and AC17 criteria checked have a rule that really enforces them. |
| YAML structure (entities.md, rules.md) | PASS by reading | Blocks are well formed, with unique ids and consistent keys. No tool was run. |
| Q1 to Q6 carry-through | PASS | Q1 (10 sign-ups), Q2 (past switch), Q3 (notices to the A recipients), Q4 (organiser mark, no edit right), Q5 (notice list), Q6 (tasks kept) appear consistently in entities, rules and spec. |
| Allergen link check | PASS | BR115.1 and the entity limit allergen data to three ingredient ticks on a dish, with no link to a child or health. Notices and audit entries never carry them. Free-text notices could still contain such a link, but that is outside this design's control. |
| Technology leak check | PASS with note | The rules contain no SQL or framework code. Function and file names appear only in the conversion section and in contract-derived names. |

### Summary

The design is implementable and agrees with C8, C10, C13, C14 and C16 and with the owner's answers. Two Major points should be settled before building: the withdraw rules contradict the workflows on cancelled and finished events, and the removal rules leave a role with neither a parent nor a typed name, which the entity constraint forbids. The remaining points are Minor.
