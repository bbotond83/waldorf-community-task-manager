# Functional Design Questions: u11-checklists-and-templates

The requirements (FR12.1 to FR12.8, FR13.1 to FR13.6), stories (US12.1 to US12.3, US13.1), contracts (C8, C9, C13, C14, C15, C16), the mockups and the spreadsheet review (tabs 8, 9, 11, 13, appendices C to F) settle most of this piece of work. These eight points are still open. Contains no names or contact details.

## Q1. [Product owner] What happens to today's event tasks

Today an administrator can attach a task to an event on the "Feladatok és események" screen. Such a task has a number of family places, and families sign up, swap and cancel there like on any duty. The events work (U10) kept them as they are and left the decision to this piece. The new checklist tasks are claimed by one person and marked done, which is what the mockups show on the event page. Running both on one event would give parents two different ways to help with the same event.

A. The checklist replaces them. From now on a task can no longer be attached to an event on the "Feladatok és események" screen, and the event page shows only the checklist. Tasks not linked to an event stay exactly as they are. The local data is invented and gets reset, so no old event task needs converting (Recommended)
B. Keep both: an event can have today's tasks with family places and a checklist
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] How many people can take one checklist task

The summer festival review says one person per game station, but the flower gate is "a task with a time and several makers". The requirements say a person claims a task and their name is shown (FR12.2, AC12.1.1).

A. A task has a number of helpers, 1 by default, set in the template or on the event (for example 4 for the flower gate). Each helper claims for themselves and their name shows; once it is full, the next person is told it is taken (AC12.1.2). Any helper can mark the task done, and the app records who and when (Recommended)
B. Always exactly one person per task; the flower gate becomes several tasks
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] Claiming, letting go and undoing

Who may claim, and how a mistake is fixed, is not written down yet. Event participation is voluntary and counts towards nothing (FR11.12).

A. Any parent with a family may claim; a teacher may not. A claim may carry a note (for example how many rag rugs the family took home, FR13.6) and, when the task's time matters, a chosen date and time (FR11.11). The claimer can give the task up until it is done. An organiser can remove anyone's claim, mark a task done at the closing round, and type a name for a helper without an account (FR11.10). A done mark can be undone by whoever marked it or by an organiser. The leaving and new family rule does not apply, because a checklist task is not a duty. A sign-up deadline is shown but blocks nothing, as for sign-ups in U10 (Recommended)
B. As A, but claiming is refused after the sign-up deadline
C. As A, but the leaving and new family rule also applies to checklist tasks
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] The organiser's checklist and the teachers' part

The big-cleaning organiser has their own list (send the notice, check the deadline, the closing round), seen by organisers only (FR13.1). The festival descriptions also list what the teachers do, such as making the spiral and the fir gate (FR12.8). Teachers cannot change anything in the app.

A. Each template section is one of three kinds: "Szülők" (claimable by parents), "Szervezők" (shown and claimable only by the event's organisers) or "Óvónők" (shown to everyone as information, with nothing to claim). The event copies each section with its kind. The organisers are the coordinators of the group, the super admins for a community event, and parents whose role is marked "Szervező" (U10) (Recommended)
B. Only two kinds, parents and organisers; the teachers' part is written into the template as an event notice instead
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] Who manages which templates, and which ones an organiser can start from

Super admins manage all templates and coordinators their own group's (FR12.4, AC12.2.2). A removed template is hidden and an administrator can restore it (AC12.2.3).

A. A template is either a community template (managed by super admins) or a group template (managed by that group's coordinators and the super admins). Whoever may edit a template may also remove and restore it. When creating an event, a super admin may start from any active template; a coordinator may start from community templates and their own group's templates. The starting templates are community templates (Recommended)
B. As A, but a coordinator may only start from their own group's templates
X. Other (please specify)

[Answer]: A

## Q6. [Product owner] When the lead-time notice and the unclaimed-task alert go out

The event already stores a lead time of 1 to 60 days and a sign-up deadline (U10). A big cleaning defaults to two weeks (AC13.1.2), and organisers hear about unclaimed tasks three days before the deadline, once (AC13.1.3). The daily run sends both (contract C9).

A. The template carries a default lead time (14 days for the big cleaning, none for the others), copied into the event and changeable there. The notice goes once, on the first daily run on or after that day, while the event is still planned and has not started, to everyone the event is for. The unclaimed-task alert goes once, on the first daily run from three days before the deadline until the deadline, only if a parents' task still has free places, to the organisers. If the deadline is moved, a new alert may go for the new date. Neither goes for an event with no lead time or no deadline (Recommended)
B. As A, but without a deadline the unclaimed-task alert goes three days before the event starts
X. Other (please specify)

[Answer]: A

## Q7. [Product owner] Changing an event's own checklist after it was created

An event keeps its own copy of the template (ADR-005), so the copy can be adjusted for that one event.

A. "Start from template" is offered only when the event is created. Afterwards the event's managers may add, edit and reorder tasks and sections on the event while it is open. A task that someone has claimed or marked done cannot be deleted until its claims are removed; editing it keeps the claims. A finished or cancelled event's checklist is read-only (Recommended)
B. As A, and a manager may also add a whole template's tasks to an existing event later
X. Other (please specify)

[Answer]: A

## Q8. [Product owner] The starting templates

A fresh install must hold big cleaning, ship repair and one template for each festival (AC12.3.3). The spreadsheet review already holds their content without personal data: the big-cleaning areas and tasks with the "NYÁRON" marks (appendix C), the tips and organiser's list (appendix D), the ship tasks with priorities and tools (appendix E), and the festival tasks with the parents' and teachers' parts (appendix F).

A. I use that content as written, in Hungarian: the ten big-cleaning areas as sections with their tasks, the summer-only marks and the tips from appendix D attached to the matching tasks, and the organiser's list as an organisers' section; the ship tasks with their priorities and tools, all unclaimed; and eight festival templates (Szent Mihály, Szent Márton, Szent Miklós, Spirál járás, Húsvét, Pünkösd, Gyermekek búcsúnapja, Búcsúzás/nyárünnep), where a festival with no listed task starts empty. You change them in the app later (Recommended)
B. Only big cleaning and ship repair now; the festival templates are added by hand in the app
X. Other (please specify)

[Answer]: A
