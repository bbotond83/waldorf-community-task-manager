# User Stories Plan and Questions

## Story plan

- **Personas:** parent; working-group coordinator; teacher; administrator (super admin).
- **Format:** "As a [persona], I want [goal], so that [benefit]", INVEST, with Given/When/Then acceptance criteria and explicit authorization, privacy and audit outcomes.
- **Priority:** MoSCoW for each story. Every identified gap is in version 1, so priorities mainly separate what is essential from what can be trimmed if needed. The formal build order is decided in Delivery Planning.

The product lead's review of the requirements left some rules that a story cannot be tested without. The questions below settle the ones that are yours to decide.

## Q1. [Product owner] How the stories are grouped

Stories can be organised in different ways. The grouping decides how they map onto the later build pieces.

A. By feature area, following the building blocks of the gap analysis (rotas, sign-up, events, to-do list, and so on) (Recommended)
B. By person (everything a parent does, everything a teacher does)
C. By workflow from start to end
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Children's names when a family's parents choose differently

The tick box that shares a full profile is per parent, but the children belong to the whole family. If one parent ticks it and the other does not, are the children's names shown to other parents?

A. Shown only when every parent of the family has ticked it (Recommended, the safest for children's data)
B. Shown next to the parent who ticked it
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] Front garden during school breaks

Weekend duties depend on who is on duty that week. Your description of tab 3 says the weekend family has three openings or closings in a break "when there is no indoor cleaning", which implies the front-garden family still picks one. Does the front-garden duty run during school breaks?

A. Yes, front garden runs every week, breaks included, so in a break week the front-garden family picks one and the weekend family does three (Recommended)
B. No, front garden also pauses in breaks, so nobody picks and the weekend family does all four
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] This year's rotas when the app goes live

The one-off migration loads the directory, the to-do list and the books. The app goes live only after the separate hosting work. What about the rotas in the spreadsheet at that moment?

A. Don't migrate them; the administrator plans the remaining weeks in the app (Recommended, since planning a year is built in)
B. Migrate the remaining weeks from the spreadsheet too
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] A family marked leaving or new after it already has duties

A family can be marked as leaving when it already holds duties after the changeover date (or as new when it holds duties before it). What should happen to those duties?

A. They are flagged and the administrator is told, who reassigns them; the family keeps them until then (Recommended)
B. They are removed at once and become open for the administrator to fill
C. The change is refused until the duties are moved
X. Other (please specify)

[Answer]: A

## Q6. [Product owner] Today's app data when groups become working groups

Today's tasks, events, places, memberships and admin roles all belong to kindergarten groups. Is there any data in your running app that you want to keep?

A. No, it's all test data; start clean from the new structure with fresh invented data (Recommended)
B. Yes, keep it and convert it (please say what under Other)
X. Other (please specify)

[Answer]: A

## Q7. [Product owner] How empty-slot warnings are sent

There are about 500 animal-care slots a year. Three days before an empty slot every family is notified. How should those warnings arrive?

A. At most one message per family per day, listing all the empty slots coming up (Recommended)
B. One message per empty slot
X. Other (please specify)

[Answer]: A

## Q8. [Product owner] The numbers behind "fair"

The yearly draft and the fair-share reminder need a rule that can be checked.

A. In a yearly draft, no two full-year families differ by more than one week per rota; for sign-ups, the average is over families active that school year, part-year families count in proportion to their weeks, and a family below it gets at most one reminder a month (Recommended)
B. The same, but a reminder every two weeks
X. Other (please specify)

[Answer]: A
