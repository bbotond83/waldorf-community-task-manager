# Functional Design Questions: u10-events-and-signups

The requirements, stories, contracts, mockups and earlier answers settle most of this piece of work. These six points are still open. Contains no names or contact details.

## Q1. [Product owner] More than one sign-up on the same event

A parent signs up for an event and writes a note about how they help (AC11.2.1). Some people help in more than one way, for example "I will set up the stalls on Friday" and "I will bake a cake".

A. A parent can add several sign-ups to one event, each with its own note and optional date and time. Each can be changed or withdrawn by the parent until the event ends (Recommended)
B. A parent has one sign-up per event. To say more, they edit the note
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Finding last year's event and its tale

The events list shows upcoming events (mockup). The year's tale must still be with the event when it is viewed next year (AC11.3.2), so someone has to be able to open an event that has finished.

A. The events list gets a "Korábbi események" (past events) switch that shows finished events, newest first, for every parent and teacher; the tale is on each event's page (Recommended)
B. Past events are shown only to administrators and coordinators, in their management screens
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] When does the app tell people about an event

Event notices are mentioned in the mockups only as the lead-time notice that the checklists work adds later. This work still has to show one real notice that links to an event (AC17.1.1 and AC17.1.6). Which changes should tell people?

A. A new event tells every parent for a community event, or the members of the working group for a group event. A cancelled event tells every parent who has a sign-up or a food offer on it, and every family holding one of its tasks. A change of dates or place tells the same people as a cancellation (Recommended)
B. Only a cancellation tells people; a new event is simply visible in the list
C. A new event and a cancellation tell the same people as in A; a change of dates or place tells nobody
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] Other organisers of an event

Today an event's organisers are the coordinators of its working group, or the super admins for a community event. The organiser's checklist and the alerts about unclaimed tasks later go to the organisers (the checklists work, FR13.1). The contracts left it open whether an event can name more organisers.

A. No. The organisers are always the group's coordinators, or the super admins for a community event. A role such as game master is only shown on the event and gives no extra rights (Recommended)
B. A role can be marked "organiser" for a parent who has an account. That parent then also sees the organiser's list and gets its alerts, but cannot edit the event
X. Other (please specify)

[Answer]: B

## Q5. [Product owner] The three fixed notes on an event

An event today has three fixed text notes: allergens, what to bring and food. The requirements ask for notices shown at the top of the event, such as "bring your own cup and plate" and an allergen notice (FR11.4).

A. Replace the three notes with one list of notices on the event: up to 10, each up to 300 characters, shown in order at the top. The allergen notice is one of them, written by the organiser (Recommended)
B. Keep the three fixed notes and add the free list beside them
X. Other (please specify)

[Answer]: A

## Q6. [Developer] The event tasks that exist today

Today an event can have tasks with a number of places; families sign up for a place, may add a short note, can swap and can be refused by the leaving and new family rule. The checklists work (a later piece) adds a new kind of task that is claimed. The sign-up with a note in this work is a separate, event-wide sign-up.

A. Keep today's event tasks as they are, with their places, notes and swaps, beside the new sign-up. They only gain the new community-wide event scope. The checklists work decides later what happens to them (Recommended)
B. Retire today's event tasks in this work: no new ones can be made, and the old screens go. The sign-up with a note and the checklists then replace them
X. Other (please specify)

[Answer]: A
