# Delivery Planning Questions

These set the order of the build. A Bolt is one build pass over a piece of the work, ending in something that runs.

Inputs: `requirements.md`, `stories.md`, `mockups.md`, `components.md`, `unit-of-work.md`, `unit-of-work-dependency.md`, `unit-of-work-story-map.md`, `contract-summary.md` and `team-practices.md`.

Settled without a question, from earlier answers: one Bolt is one unit, because each piece fits a short-lived branch and becomes one commit (`team.md`, Way of Working); Bolts run one at a time (Q3 of `units-generation-questions.md`); the community conversion and then one rota come first, and the owner checks that rota before the rest is built (`team.md`, Walking Skeleton, and Q4 of `units-generation-questions.md`).

## Q1. [Product] After the first rota is checked, what order should the rest follow?

The spreadsheet can only be retired when all of it is done and hosted, so finishing a popular feature early does not free anyone from the spreadsheet. That makes reducing risk a stronger reason than early value.

A. Follow the unit numbers: directory, working groups, reminders, full rotas, swaps, animal care and information, recurring duties, events, checklists, to-do list, library, removal, migration. People and rights are settled before the features that use them (recommended)
B. Chasing first: reminders and full rotas straight after the first rota, then directory and working groups, then the rest in order. The unit list has to be reordered for this
C. Riskiest first: swaps and the removal rules as early as their prerequisites allow, then the simpler features
X. Other (please specify)

[Answer]: A

## Q2. [Delivery] Should the work be ranked with a formal scoring model?

A scoring model such as WSJF (value and urgency divided by size) helps when many people compete for priority. Here there is one owner and every piece is in version 1.

A. No scoring model: write the plain reasons for the order (recommended)
B. Yes: score each piece on value, urgency, risk and size
X. Other (please specify)

[Answer]: A

## Q3. [Delivery] Is anything else outside the build going to hold it up?

Already known: your time to review each built screen against its Stitch design; the anonymiser fix and your check of its output, needed before your trial runs of the migration script; and the kindergarten confirming that teachers may see phone and email, needed before go-live (assumption A3 in `requirements.md`).

A. Nothing else beyond those three (recommended)
X. Other (please specify)

[Answer]: A

## Q4. [Product] What worries you most about this build? (select all that apply)

The answer decides what gets the most careful checks and the earliest proof.

A. Converting to one community breaks access rules that work today
B. The fair rota draft doesn't come out fair or usable
C. Privacy: the directory or removal showing or keeping what it shouldn't
D. Swaps and weekend picks getting tangled
X. Other (please specify)

[Answer]: A
