# Functional Design Questions: U3 Directory, settings and coordination

U3 moves the people, structure, tasks, sign-ups, swaps and cancellations from the in-memory demo into the real database. The old code already contains most rules; these questions cover only the rules it leaves open or that need your decision. Smaller choices are listed as assumptions at the end.

## Q1. How does a swap between two families get approved?

Today's code: a swap is applied at once when both families confirm it; an admin is only involved when one side has not confirmed.

A. Keep that: both families confirm, the swap is applied without an admin. The admin decides only swaps that stay unconfirmed.
B. Every swap needs the admin's approval, even when both families agree.
C. Not yet defined.
X. Other (please specify)

[Answer]: A. Keep that: both families confirm, the swap is applied without an admin. The admin decides only swaps that stay unconfirmed.

## Q2. Until when can a family sign up for a task?

A. Until the task starts.
B. Until 24 hours before the task starts.
C. No limit while the task has free places.
D. Not yet defined.
X. Other (please specify)

[Answer]: A. Until the task starts.

## Q3. Until when can a family ask to cancel an assignment?

Every cancellation is decided by the group admin (or super admin).

A. Until the task starts.
B. Until 48 hours before the task starts; later cancellations go to the admin by other means.
C. No limit.
D. Not yet defined.
X. Other (please specify)

[Answer]: A. Until the task starts.

## Q4. May one family take several places on the same task?

A. No: one place per family per task.
B. Yes, up to the number of free places.
C. Not yet defined.
X. Other (please specify)

[Answer]: A. No: one place per family per task.

## Q5. What happens to a family's future assignments when the family is archived?

A. The future assignments are removed and the places become free again; past assignments stay as history.
B. All assignments stay as they are; the admin removes them by hand if needed.
C. Archiving is refused while the family still has future assignments.
D. Not yet defined.
X. Other (please specify)

[Answer]: A. The future assignments are removed and the places become free again; past assignments stay as history.

## Assumptions (no answer needed; tell me if one is wrong)

1. The design is split by owning block as the units plan says: Directory and Settings first, then Coordination, each with its own rules, so the review can follow them.
2. A parent's contact details (email, phone) are visible to the parent themself, to the other parents of the same family (answer Q8) and to the admins in scope of that family; never to other families' parents or teachers (FR3.4).
3. Tasks and assignments keep today's version check: a change based on stale data is refused with a "changed in the meantime" message and the screen reloads.
4. Task categories, capacity rules, the teacher-schedule date window and the optional-profile consent rule are carried over from the existing modules unchanged.
5. Audit stays as U1 decided: only role changes, approvals (swap and cancellation decisions), imports and lifecycle actions are audited (FR3.5); other edits are not. The notification records come in U4, so U3 only marks the places where U4 will hook in, with a test.
6. Every old rule is listed in a rule-disposition table (kept, moved, or dropped with the reason) so nothing is lost silently.

## Follow-up questions after the architecture review

The review found that the current screens cannot do two things the design assumed. These three answers settle them.

## Q6. How are swaps handled, given the current screens cannot pick another family's task and the other family has no screen to confirm?

A. The admin decides all swaps; no screen changes.
B. Add the missing screens: a parent picks a partner task, and the other family confirms or declines. This is a change to the requirement that screens stay the same, approved here by the owner.

[Answer]: B. Add the missing screens: a parent picks a partner task, and the other family confirms or declines. This is a change to the requirement that screens stay the same, approved here by the owner.

## Q7. The admin forms send only a title and a type, but real records need more (capacity, start time, group, dates, the family to assign). What should we do?

A. Extend the admin forms with the missing fields.
B. Keep the forms and fill the rest with defaults.

[Answer]: A. Extend the admin forms with the missing fields.

## Q8. May a parent see the email and phone of the other parent in the same family?

A. No: only the parent's own details and admins in reach.
B. Yes, within the same family.

[Answer]: B. Yes, within the same family.

## Consolidated Summary Confirmation

- Swaps: applied at once when both families confirm; the admin decides only unconfirmed swaps. New screens let a parent pick a partner task and let the other family confirm or decline (a change to "screens do not change", approved).
- Sign-up: open until the task starts.
- Cancellation requests: possible until the task starts; the admin decides each one.
- Places: one per family per task.
- Archiving a family: its future assignments are removed and the places freed; past ones stay as history.
- Admin forms: extended with the fields real records need (capacity, start time, group, dates, family to assign).
- Contact details: visible to the parent, the other parents of the same family, and admins in reach.
- Audit: unchanged from U1 (roles, approvals, imports, lifecycle only).

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
