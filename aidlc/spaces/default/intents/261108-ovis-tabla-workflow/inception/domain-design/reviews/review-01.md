## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-08T15:48:24Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/domain-design/components.md > component Identity, entities Account and RoleGrant | Nothing links a sign-in Account to a Parent. Account has only email and status, and no reference to Parent. Every privacy rule (sharing consent, teacher read, family-scoped duties, "see only what's mine") needs the signed-in person's Parent and Family, so the central access path has no stated owner or link. RoleGrant has a scope attribute but no reference to WorkingGroup, so the working-group admin scope has no declared target either. | Add a reference from Account (or RoleGrant) to Parent, and one from RoleGrant to WorkingGroup. Say in the Identity or Community behaviour which component owns the Account-to-Parent resolution that the database access helpers use. | New |
| R-02 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/domain-design/components.md > Identity depends_on, entity Invitation, entity RoleGrant | The component call graph is acyclic, but the data references run the other way. Invitation references Parent (owned by Community), and RoleGrant is scoped to a working group, yet Identity does not depend on Community or WorkingGroups. Community and WorkingGroups both depend on Identity. That makes a data-level cycle (Identity to Community to Identity, Identity to WorkingGroups to Identity) that the Rationale does not call out. It also affects how Lifecycle removes a person, and how role grants are created and ended when membership changes. | Either record the deliberate data-level cycle with an ADR (references are ids only and the calls stay one-way), or add the missing depends_on edges and symmetric dependents entries. Update the diagram and summary table to match. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/domain-design/components.md > component Events (behaviour and entities) | Events describes sign-ups with a note and an optional date and time (US11.2), but no sign-up entity is declared. Only Event, EventRole and FoodOffer exist. Events also has no depends_on Community, though sign-ups and offers belong to a family or parent. Lifecycle's "anonymise offers and sign-ups" has nothing to act on. | Add an EventSignup entity owned by Events, with a reference to Parent or Family, or state which existing entity carries the sign-up. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/domain-design/components.md > component WorkingGroups, entity WorkingGroupMembership | The responsibilities include "which parents coordinate which group", and the behaviour says a coordinator must be a member. WorkingGroupMembership has no coordinator attribute and no other entity records it. | Add a coordinator attribute to WorkingGroupMembership, or declare a separate coordinator entity. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/domain-design/components.md > entities Duty, RecurringSchedule, ReminderJob, SlotCalendar, TodoTask | Several links named in the behaviour are missing from the references. Duty has no reference to Event or RotaWeek, although "event tasks are duties" and "published weeks become duties". RecurringSchedule can be owned by a family or by the family on a rota week, but it references only WorkingGroup. ReminderJob has no reference, although reminders target a family or parent. AnimalCareSignup's slots have no link to their calendar. TodoTask history is stated but has no entity. A developer would have to guess these links. | Add the missing references, or note in the Duties and RecurringDuties behaviour that these are added in Functional Design. Add a history entity for TodoTask, or drop the claim. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual well-formedness check of the YAML catalogue | Component names are unique. Every named component is declared. No self-dependency. depends_on and dependents are symmetric across all 18 components. Each entity has one owner and an identifier. Every reference resolves to an entity under its owned_by component. The call graph is acyclic. | Passes the stage's structural rules. The only cycle is at the data-reference level, covered by the second Major finding. |
| traceability.json against stories.md | All 52 USx.y headings in stories.md appear in upstream_ids and in coverage, each with status OK and a declared component target. | Complete. |
| decisions.md ADR structure | ADR-001 to ADR-009 each have Context, Decision, Consequences and Alternatives Rejected. | Meets the inception rule. |

### Summary

The decomposition is sound and implementable. The call graph is acyclic and symmetric, ownership is clean, and traceability is complete. Weigh two points before approving. The Account-to-Parent link, which the privacy model depends on, is missing. The Identity data references run against the call direction without being declared. The Minor entity gaps can be fixed here or left to Functional Design.
