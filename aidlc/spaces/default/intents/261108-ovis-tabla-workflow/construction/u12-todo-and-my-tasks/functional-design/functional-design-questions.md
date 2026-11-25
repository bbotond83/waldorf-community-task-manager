# Functional Design Questions: u12-todo-and-my-tasks

The requirements (FR14.1 to FR14.8, FR15.1, FR15.2), stories (US2.4, US14.1 to US14.3, US15.1), contracts (C8, C14, C15, C16, C17), the mockups and U9's and U11's finished designs settle most of this piece of work. These six points are still open. Contains no names or contact details.

## Q1. [Product owner] A pulled task that is finished at the work day

When a coordinator pulls open to-do tasks into an event's checklist (AC14.3.1), the to-do task stays on the list with its status unchanged. The contract left open whether it becomes done when the checklist task is marked done (open point C15). The checklist side must not know about to-do tasks, so an automatic link would change U11.

A. The two stay independent in what they store. The to-do task shows "Felvéve az eseményre: [cím]" and, when the checklist task is done, "Az eseményen kész". A manager of the task then closes it with one press of Kész. Nothing is changed behind anyone's back (Recommended)
B. Fully independent: the to-do task shows nothing about the event and is closed by hand
C. Automatic: marking the checklist task done also marks the to-do task done (needs a change to U11's checklist functions and breaks "the checklist knows nothing about to-do tasks")
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Who may claim a task, and who may change a claimed one

A to-do task is owned by a working group or by one family, for example the kitchen-garden tasks owned by the back-garden family (FR14.2). Parents claim a task and mark it done; teachers only read (FR14.5, AC14.2.3). A task has one claimant (the contract's `claimedBy`).

A. A group-owned task may be claimed by any parent with a family. A family-owned task may be claimed only by a parent of that family. One person per task. Only the claimant and the owner's administrators may change the status and note, give the task back or mark it done. Administrators can also free a claim (Recommended)
B. As A, but any parent of the claimant's family may also update, give back and mark done, so the family can carry on when the claimant is away
C. As A, but a family-owned task needs no claim: any parent of that family can update and mark it done directly
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] How the status moves with claiming and finishing

The status is open, in progress, done or postponed, with a note (FR14.3). The done mark records who and when (AC14.2.2). The requirements do not say whether claiming changes the status.

A. Claiming an open task sets it to "in progress"; giving the claim back returns an "in progress" task to open. Postponed and done are set on purpose (postponed with a note; done through Kész). Undoing done, by whoever marked it or an administrator, returns the task to "in progress" if it has a claimant, else open. Every change is a history row (Recommended)
B. The status is only ever set by hand, claiming does not change it; done still records who and when
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] Notices about to-do tasks

Notices can concern to-do tasks (FR17.4). The mockup lists "To-do task assigned or changed". The daily run can also send a reminder.

A. Two notices. When an administrator changes or frees a task you claimed, you get "A teendő módosult: [cím]" at once. When a claimed task is not done, has a deadline and the deadline is within three days, the claimant gets one reminder on the first daily run in that window (a new one only if the deadline is moved). Nothing is sent for new tasks (Recommended)
B. Only the change notice, no deadline reminder
C. As A, and the working group's members also hear when a new task is added to their group's list
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] What "My tasks" lists

The page shows the duties assigned to the family and the tasks the parent claimed, and no open tasks to browse (FR15.1, FR15.2). Duties already come from the rota, weekend and animal-care places and from U9's recurring duties; claimed to-do tasks are new. Event checklist tasks (U11) are also claimed by one person and marked done.

A. Family duties, recurring duties and the parent's claimed to-do tasks, grouped "Ezen a héten", "Később" and "Nincs dátum", each with Kész. Checklist tasks taken at an event stay on the event page and are not repeated here (Recommended)
B. As A, and the parent's checklist tasks for events that have not ended are listed too, with a link to the event
X. Other (please specify)

[Answer]: A

## Q6. [Product owner] The coordinator's management page

The mockup gives a coordinator one page per group with the tabs Események, Teendők, Ismétlődő feladatok and Sablonok (US2.4). Events (U10), recurring duties (U9) and templates (U11) already have their own lists and editors; today the group page links to them.

A. The page `/szulo/munkacsoportok/[id]/kezeles` has the four tabs. Teendők holds the group's to-do list with add, edit and free-a-claim. The other three tabs show that group's items and open the existing editors, which stay where they are; the temporary links on the group page are replaced by this page. Only the group's coordinators and super admins see it (Recommended)
B. As A, and the three existing editors are rebuilt inside the tabs (larger; moves U9, U10 and U11 screens)
X. Other (please specify)

[Answer]: A
