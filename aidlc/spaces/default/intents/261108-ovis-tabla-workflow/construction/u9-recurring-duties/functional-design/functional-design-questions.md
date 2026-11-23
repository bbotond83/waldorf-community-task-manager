# Functional Design Questions: u9-recurring-duties

The requirements (FR9.1 to FR9.6), stories (US9.1 to US9.4), contracts (C4, C8, C9, C12, C14) and mockups settle most of this piece of work. These seven points are still open. Contains no names or contact details.

## Q1. [Product owner] How far ahead do occurrences appear, and when is someone told

A schedule counts from a fixed start and interval (AC9.1.1). The daily run creates the occurrences (contract C9). Someone has to decide how early an occurrence shows up for its owner and when the reminder goes.

A. An occurrence appears 14 days before its due date, so owners can plan. The reminder notice goes on the morning of the due date, and a second one goes 3 days after if it is still not done. Each reminder is sent once (Recommended)
B. An occurrence appears on its due date only, with one reminder that day
C. An occurrence appears 7 days before its due date, with one reminder on the due date
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] What happens to an occurrence nobody marks done

The next due date counts from the schedule, not from the last done mark (AC9.1.1). So a missed occurrence does not move the others.

A. The missed occurrence stays on the owner's list marked "lejárt" (overdue) until someone marks it done, and the next occurrence appears on its own date. A coordinator or administrator can also close it as "kihagyva" (skipped) with a short reason. Overdue ones older than 60 days are only shown in the history (Recommended)
B. A missed occurrence disappears when the next one is created, with no record
C. A missed occurrence stays overdue until marked done, with no way to skip it
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] Who sets up and changes schedules

A coordinator creates a group's recurring duties and another group's coordinator is refused (AC9.1.3). The requirements also allow a family as owner and a rota week as owner, which no coordinator belongs to.

A. Group-owned: that group's coordinators and the super admins. Family-owned and rota-week-owned: super admins only, because they are set up rarely. Parents never create schedules (Recommended)
B. As A, and a parent may also create a schedule for their own family
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] Who may mark a duty done for each owner kind

A parent marks done only what they are responsible for (AC9.2.1, AC9.2.2). The mockup says a group duty is offered to the group's members and coordinators.

A. Group-owned: any active member or coordinator of that group. Family-owned and rota-week-owned: any parent of that family. The name and time are recorded, and a mark can be undone by the same person or a coordinator or super admin within 24 hours, with a repeated click changing nothing (Recommended)
B. As A, but a done mark can never be undone
C. Group-owned: coordinators only
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] Bottle cleaning: counting the weeks, and swaps

Bottle cleaning is a recurring extra duty of the family on the water week, every fourth water week by default (AC9.3.1). Two points need a decision: what "fourth" counts, and what happens when the water week is swapped or reassigned after the cleaning duty exists.

A. It counts water-carrying weeks of the published rota, so break weeks do not count, starting from the first water week of the year. The cleaning duty belongs to the family holding that water week at the moment. If the water week changes hands, the cleaning duty moves with it (Recommended)
B. It counts calendar weeks, and the cleaning duty stays with the family it was created for even if the water week is swapped
X. Other (please specify)

[Answer]: A

## Q6. [Product owner] The starting list of regular care and seasonal jobs

A fresh install holds the animal-care periodic items with the rabbit items switched off, the playground and maintenance inspection rounds, and the three seasonal jobs (AC9.4.1 to AC9.4.3). The real list is in the spreadsheet, which stays out of the repository, so the app's starting list needs invented but realistic titles.

A. I use a short invented starting list in Hungarian: about 6 animal-care items (3 of them rabbit items, switched off), 1 inspection round each for the playground and maintenance groups (every 4 weeks, changeable), and mowing (every 2 weeks, April to October), weeding (every 3 weeks, April to September) and turning the compost (every 6 weeks, March to November). You replace titles and intervals with the real ones in the app later (Recommended)
B. You send me the real list of titles and intervals first, and I use it as the starting list
X. Other (please specify)

[Answer]: A

## Q7. [Product owner] A family or group that is removed

When a family leaves or a coordinator's grant ends, a schedule they owned or occurrences assigned to them still exist.

A. The next removal work (U14) flags them for an administrator, as it does for duties. Until then nothing is deleted. A family-owned schedule whose family has left stops creating occurrences. A group-owned schedule keeps running when its coordinator leaves, and the group's other coordinators or the super admins manage it (Recommended)
B. A schedule owned by a removed family is deleted together with its history
X. Other (please specify)

[Answer]: A
