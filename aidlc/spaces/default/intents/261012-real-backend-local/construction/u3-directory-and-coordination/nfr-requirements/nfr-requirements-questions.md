# NFR Requirements Questions: U3 Directory, settings and coordination

The functional design is approved by review. These questions set the measurable targets for speed, size, data kept and concurrency. Smaller points are listed as assumptions at the end.

## Q1. How fast must the main screens and actions be on the owner's machine?

A. Task lists and detail pages within 300 ms typical and an action (sign-up, swap, approval, save) within 500 ms typical, reported; a run fails only above 1500 ms for any of them.
B. Within 1000 ms for everything, reported only.
C. Not yet defined.
X. Other (please specify)

[Answer]: A. Task lists and detail pages within 300 ms typical and an action (sign-up, swap, approval, save) within 500 ms typical, reported; a run fails only above 1500 ms for any of them.

## Q2. What size must this unit handle without special tuning?

A. Up to 150 families, 10 groups, 300 tasks per school year and 1500 assignments in total, with the indexes the lists and policies need; no load test beyond small local timing checks.
B. Up to 600 families and 6000 assignments.
C. Not yet defined.
X. Other (please specify)

[Answer]: A. Up to 150 families, 10 groups, 300 tasks per school year and 1500 assignments in total, with the indexes the lists and policies need; no load test beyond small local timing checks.

## Q3. How long are removed assignments and closed requests kept?

A. Kept as history while the family exists, and removed with the family by the lifecycle (delete or anonymize); no separate cleanup.
B. Removed 12 months after they end by a housekeeping function.
C. Not yet defined.
X. Other (please specify)

[Answer]: A. Kept as history while the family exists, and removed with the family by the lifecycle (delete or anonymize); no separate cleanup.

## Q4. How hard must the race test for the last free place be?

A. A database test with 20 parallel sign-ups for 5 places, run on every build, must end with exactly 5 places taken and no duplicate for any family; plus a two-browser test for the last place.
B. Only a two-connection test.
C. Not yet defined.
X. Other (please specify)

[Answer]: A. A database test with 20 parallel sign-ups for 5 places, run on every build, must end with exactly 5 places taken and no duplicate for any family; plus a two-browser test for the last place.

## Assumptions (no answer needed; tell me if one is wrong)

1. Security targets follow U2: contact details, notes and the schedule are protected by row-level policies and tested per role; no secrets or real personal data in logs or tracked files; all functions are in the elevated catalogue.
2. Accessibility: the new swap pages and the extended admin forms meet WCAG 2.2 AA with the automated check, keyboard operable, Hungarian copy.
3. Reliability: every use case is one transaction; a failed call leaves no partial data; migrations apply repeatably on a fresh database and on every worker schema.
4. Observability: expected failures are result codes; unexpected failures are logged once at the boundary with an event code and no personal data, as in U2.
5. Technology: no new libraries; PostgreSQL functions and policies plus the existing server code.

## Consolidated Summary Confirmation

- Speed: lists and details 300 ms typical, actions 500 ms typical, reported; fail above 1500 ms.
- Size: 150 families, 10 groups, 300 tasks per year, 1500 assignments; no special tuning.
- History: removed assignments and closed requests stay with the family until the lifecycle removes it.
- Race test: 20 parallel sign-ups for 5 places on every build, plus a two-browser test.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
