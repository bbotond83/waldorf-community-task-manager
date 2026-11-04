# Domain Design Questions

A restyle adds no data and no new logic, so the "building blocks" here are the parts of the app's look and the screens that use it. Three choices are still yours.

## Q1. [Engineering] Keep one stylesheet or split it?

All styling is in one file, `app/globals.css` (1,418 lines). The colour-token test and the new style checker both read that one file. Splitting it by area would make each file shorter but touches how every page loads its styles.

A. Keep one file, with clearly marked sections per area: shell, sign-in, parent, teacher, admin (recommended: least change, one place for the tests and the checker)
B. Split into one file per area, all loaded from the main layout
X. Other (please specify)

[Answer]: A

## Q2. [Product] What should the parent task list be called?

I checked the page behind "Saját vállalásaim". `/szulo/feladatok` already shows the family's own tasks, with a status filter, and its title today is "Családi feladatok". So no new section is needed. The only open point is the heading words, because the Stitch design calls this screen "Saját vállalásaim".

A. Keep "Családi feladatok": existing wording wins and nothing else changes (recommended)
B. Rename the heading to "Saját vállalásaim" to match Stitch (a small wording change; the tests that look for the old heading change with it)
X. Other (please specify)

[Answer]: A

## Q3. [Delivery] Which screen proves the first slice?

You check the fonts and shared look on one real screen before the flows start. Which one should it be?

A. The sign-in page plus the page frame (header and menu): the first thing everyone sees, and small (recommended)
B. The parent task list: more elements on one screen (cards, filter, status badges)
X. Other (please specify)

[Answer]: A
