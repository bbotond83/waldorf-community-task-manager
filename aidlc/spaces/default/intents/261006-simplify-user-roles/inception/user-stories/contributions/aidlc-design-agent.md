**Collaborator:** aidlc-design-agent

## Contribution

Round 1 independent review of stories.md, personas.md and the completed planning question against approved requirements.md, team-practices.md and the current business/component inventory. No sibling contribution was read. These suggestions refine observable outcomes within settled requirements; they introduce no new role, permission, screen or product question.

### Persona and workflow fidelity

The four functional personas accurately preserve the approved boundaries. Óvónő is an observer within assigned groups; former staff and kindergarten administrators are migration contexts rather than additional personas. The workflow organization follows the human's choice and makes the teacher's viewing experience distinct from migration and administrative responsibilities. Keep these definitions and the explicit limits on demographic/research claims.

### Integrable refinements

1. **US2.1 / AC2.1.2 — distinguish legitimate emptiness from access failure.** Add: “Given an authorized schedule has no matching items, the view shows the existing understandable empty state; given no assigned-group access or a denied group request, it shows the existing no-access/denied state rather than suggesting there are no tasks in an unauthorized group.” This makes the existing FR6/FR7 explicit-state requirement observable without leaking group existence, counts or names. No create-task action should appear in either teacher state.
2. **US2.1 — make NFR3's interface outcome explicit.** Suggested additional criterion: “Given the teacher tracking flow and its role/navigation labels, when operated with the keyboard and inspected through the existing critical-flow accessibility check, then existing navigation remains operable, role/control names identify Óvónő consistently, and the flow has no serious or critical automated accessibility violations.” Full execution proof remains in Build and Test as already declared for NFR2; this is an acceptance outcome, not a claim of execution or a new tooling requirement.
3. **US3.3 / AC3.3.2 — clarify the existing recovery outcome.** When rejection requires reauthentication, specify that the existing sign-in/session-expiry state is presented with a way to sign in again, and protected content is not displayed from the stale session. Retain the permitted refresh-or-reject alternatives; do not invent a forced logout policy or a new migration notice.

These are small draft refinements, not competing product judgments or unresolved source-knowledge disputes. They can be integrated by the lead without asking the human to revisit approved choices. Owner/assignee absence, long-lived historical labels, private-field exclusion, unavailable mutation controls and current-status refresh already have clear observable criteria.

## Positions

- AGREE: Four functional personas and workflow organization — they match confirmed roles and the selected review structure without unsupported persona assumptions.
- AGREE: Teacher tracking and read-only/privacy boundaries — owners, assignments, current status, missing data and crafted requests are covered within assigned groups.
- AGREE: Explicit organization-scoped kindergarten-admin-to-super-admin conversion — the deliberate governance expansion is accurately retained from the approved requirement.
- AGREE: Preserve business groups, record ownership and historical evidence — cleanup is confined to current role vocabulary and permissions.
- OBJECT: US2.1 does not explicitly distinguish an authorized empty schedule from denied/no-group access — classification: draft defect; refine AC2.1.2 using existing explicit states so teachers are not misled about unauthorized work.
- OBJECT: NFR3 accessibility is stated globally but lacks a concrete teacher-flow criterion — classification: draft defect; add the proposed criterion to make the approved usability outcome directly reviewable.
- AGREE: Stale-session refresh or reauthentication alternatives — adding the existing recovery state is a nonblocking clarity refinement, with no new product decision needed.
