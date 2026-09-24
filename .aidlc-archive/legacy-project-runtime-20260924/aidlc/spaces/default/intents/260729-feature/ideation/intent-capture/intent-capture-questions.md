## Sources

- [desc] Initial description: "feature"
- [scope] Workflow-selected scope: `feature`.

## Q1. Business Problem

What business problem should this initiative solve?

A. A new capability users cannot currently complete
B. An inefficient or error-prone existing process
C. A compliance, safety, or reliability concern
D. A market or community opportunity
E. Not yet defined
X. Other (please specify)

[Answer]: X. Other (please specify) — Replace the Excel-based kindergarten parent-community coordination workflow with a role-based web application for families, children, school years, groups, tasks, events, signups, swaps, cancellations, notifications, dashboards, and one-time Excel migration.

## Q2. Customer and Pain

Who is the primary customer, and what pain do they experience?

A. Internal staff or volunteers
B. External customers or community members
C. A specific partner or organization
D. Multiple customer groups
E. Not yet identified
X. Other (please specify)

[Answer]: D. Multiple customer groups — Parents need an easy, mobile-friendly view of their own responsibilities; admins need to replace manual spreadsheet coordination. Read-only staff need schedule visibility without editing or parent contact access.

## Q3. Success Measures

What measurable outcome would demonstrate success?

A. Higher completion or adoption rate
B. Less time or fewer errors in a workflow
C. Improved satisfaction or feedback score
D. A specific business, operational, or compliance target
E. Not yet defined
X. Other (please specify)

[Answer]: D. A specific business, operational, or compliance target — The PRD targets at least 80% of active families logging in during the first active month, at least 70% viewing "Saját feladataim", at least 90% of new task signups occurring in the app, at least 40% lower admin coordination time, and no known role-based access-control violations in production.

## Q4. Initiative Trigger

Why is this initiative needed now?

A. A newly identified user or operational need
B. Market pressure or competitive opportunity
C. Technical debt or a reliability issue
D. Regulation, policy, or deadline
E. Not applicable or not yet defined
X. Other (please specify)

[Answer]: A. A newly identified user or operational need — The current spreadsheet workflow is fragmented, manually coordinated, error-prone, lacks reminders and granular permission controls, and does not protect parent contact details adequately.

## Q5. Stakeholders

Which stakeholder groups should be represented, and what does each care about?

A. Product or business owner
B. End users
C. Operations, support, or delivery team
D. Technical, security, or compliance stakeholders
E. Not identified
X. Other (please specify)

[Answer]: X. Other (please specify) — Parents care about clear Hungarian, mobile-friendly task coordination and privacy. Group admins and kindergarten admins care about efficient operations, assignments, workflows, imports, and notification visibility. Super admins care about organization settings, permissions, audit activity, and migration. Read-only staff care about schedule visibility without editing or contact-data access.

## Q6. Scope and Priority Authority

Who decides scope or priority, and who influences that decision?

A. A named product or business owner decides
B. A leadership group or steering committee decides
C. The delivery team decides with stakeholder input
D. Decision authority is not yet identified
E. Not applicable
X. Other (please specify)

[Answer]: D. Decision authority is not yet identified — The PRD leaves the final product owner for swap, cancellation, and privacy decisions open.

## Q7. Communication Needs

What communication or reporting cadence is required?

A. Regular weekly progress updates
B. Milestone-based updates
C. A formal reporting or approval cadence
D. No special cadence beyond normal collaboration
E. Not yet defined
X. Other (please specify)

[Answer]: E. Not yet defined — The PRD specifies event notifications and related Hungarian copy but does not set a stakeholder reporting cadence.

## Q8. Product Boundary and Scope

The workflow-selected scope is `feature`. Does it match the intended product boundary?

A. Yes — this is a bounded feature within an existing or planned product
B. No — this is a different scope; I will describe the intended boundary
C. Unsure — help me choose the scope
D. The product boundary is not yet defined
E. Not applicable
X. Other (please specify)

[Answer]: A. Yes — this is a bounded feature within an existing or planned product. The workflow-selected `feature` scope matches the requested MVP web application.

## Q9. Assignment Identity Visibility

May parents and read-only staff see parent display names on task assignments, while email addresses and phone numbers remain admin-only?

A. Parents and staff may see display names only
B. Parents may see display names; staff may not
C. Only admins may see assigned-parent identities
D. Visibility differs by task or group and needs a later rule
E. Not yet defined
X. Other (please specify)

[Answer]: B. Parents may see display names; staff may not.

## Q10. Reminder Schedule

Which upcoming-task reminder schedule should the MVP use?

A. 7 days before only
B. 24 hours before only
C. Both 7 days and 24 hours before
D. Admin-configurable schedule from the MVP
E. Not yet defined
X. Other (please specify)

[Answer]: C. Both 7 days and 24 hours before.

## Q11. Swap and Cancellation Approval

Which approval model should the MVP use for swaps and cancellations?

A. Admin or authorized organizer approval is required for both
B. A parent-to-parent swap may auto-approve; cancellations require approval
C. Both may auto-approve under defined conditions
D. The model differs by task type and needs a later rule
E. Not yet defined
X. Other (please specify)

[Answer]: B. A parent-to-parent swap may auto-approve; cancellations require approval.

## Q12. Assignment Ownership

When a family has multiple parents, how should an assignment be owned in the MVP?

A. Assignments belong to one specific parent user only
B. Assignments belong to a family; any linked parent may act
C. Assign to one parent, but allow a linked parent to request a change
D. Support both models per task, with an admin choice
E. Not yet defined
X. Other (please specify)

[Answer]: B. Assignments belong to a family; any linked parent may act.

## Q13. Excel Import Contract

What should define the supported one-time Excel import format?

A. The current spreadsheet is the authoritative supported format
B. Admin maps spreadsheet columns to an import template during preview
C. Provide a documented import template; unsupported sheets require manual preparation
D. Support a small set of named spreadsheet formats
E. Not yet defined
X. Other (please specify)

[Answer]: B. Admin maps spreadsheet columns to an import template during preview.

## Q14. Decision Influencers

Who should influence final product decisions after the final decision-maker is identified?

A. Parents, group admins, kindergarten admins, and read-only staff
B. Parents and kindergarten admins only
C. Kindergarten admins and super admins only
D. The final decision-maker decides without a formal influencer group
E. Not yet defined
X. Other (please specify)

[Answer]: A. Parents, group admins, kindergarten admins, and read-only staff.

## Q15. Parent Contact Privacy

Which contact-data visibility rule should the MVP enforce?

A. Email addresses and phone numbers are visible to admins only; parents may see assignment display names and read-only staff may not
B. Parents may see contact details for assigned families; read-only staff may not
C. Contact-data rules need a later privacy decision
D. Not yet defined
X. Other (please specify)

[Answer]: A. Email addresses and phone numbers are visible to admins only; parents may see assignment display names and read-only staff may not.

## Q16. MVP Exclusions

Which boundaries are explicitly outside the MVP?

A. Native mobile apps, SMS/WhatsApp notifications, payments, automatic rotation, task completion tracking, and live Excel synchronization
B. No explicit exclusions are confirmed yet
C. I will provide a different list
D. Not yet defined
X. Other (please specify)

[Answer]: A. Exclude native mobile apps, SMS/WhatsApp notifications, payments, automatic rotation, task completion tracking, and live Excel synchronization.

## Assumption Confirmation

The following unresolved items are retained as open questions in the intent artifacts:

1. The final decision-maker for scope, priority, swap, cancellation, and privacy decisions is not yet identified. [Q6]
2. A stakeholder reporting cadence is not yet defined. [Q7]

A. Accept assumptions
B. Convert to follow-up questions

[Answer]: A. Accept assumptions
