# NFR Requirements Questions: U4 Notifications and Excel import

The functional design is approved by review. These questions set the measurable targets for speed and size. Smaller points are listed as assumptions at the end.

## Q1. How fast must the import and the notification screens be on the owner's machine?

A. Upload with preview of a typical workbook (up to 2000 rows) within 10 seconds typical, the commit within 15 seconds typical, the notification list and the reminders list within 300 ms typical, all reported; a run fails only above 60 seconds for the preview and commit, and above 1500 ms for the lists.
B. Twice as slow everywhere, reported only.
C. Not yet defined.
X. Other (please specify)

[Answer]: A. Upload with preview of a typical workbook (up to 2000 rows) within 10 seconds typical, the commit within 15 seconds typical, the notification list and the reminders list within 300 ms typical, all reported; a run fails only above 60 seconds for the preview and commit, and above 1500 ms for the lists.

## Q2. What size must U4 handle without special tuning?

A. A workbook up to 5 MB and 20000 rows (the upload limits of the design, with a typical workbook far smaller), 150 families with up to 20 notifications each (3000 notifications), and 300 tasks with two reminder jobs each.
B. Ten times that.
C. Not yet defined.
X. Other (please specify)

[Answer]: A. A workbook up to 5 MB and 20000 rows (the upload limits of the design, with a typical workbook far smaller), 150 families with up to 20 notifications each (3000 notifications), and 300 tasks with two reminder jobs each.

## Assumptions (no answer needed; tell me if one is wrong)

1. Security targets follow U2 and U3: staged rows, notifications and import runs are protected by row-level policies and tested per role; no secrets or personal data in logs; no personal data in the import history; the workbook is read as data only (no formula evaluation, no macros), with limits checked before expansion.
2. Accessibility: the changed import screen meets WCAG 2.2 AA with the automated check, keyboard operable, Hungarian copy.
3. Reliability: every use case is one transaction; an interrupted commit leaves the data as it was; migrations apply repeatably on a fresh database and on every worker schema.
4. Observability: expected failures are result codes; unexpected failures are logged once at the boundary with an event code and no personal data, as in U2 and U3; the import writes the single `import.commit` audit event.
5. Technology: one small, read-only xlsx library, chosen at code generation as an exactly pinned version that must pass the dependency audit (high and critical block) and must not evaluate formulas; the parser runs on the server only and never reaches client code (bundle test).
6. Import-created assignments (a question the design review left open): the commit suppresses parent notices for imported assignments (a burst of sign-up confirmations at import would be noise) and plans reminder jobs only.

## Consolidated Summary Confirmation

- Speed: preview 10 s and commit 15 s typical for a 2000-row workbook, lists 300 ms typical, reported; fail above 60 s (import steps) and 1500 ms (lists).
- Size: a 5 MB / 20000-row workbook, 3000 notifications, 300 tasks with two reminder jobs each.
- Imported assignments send no parent notices; only reminder jobs are planned.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
