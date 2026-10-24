# Functional Design Questions: U4 Notifications and Excel import

U4 turns notifications and reminders into real stored records (delivery of email or SMS stays simulated) and builds the real Excel import: upload, preview with conflicts, resolve, atomic commit, recovery. The old code already holds most rules (reminder thresholds, the 17-sheet registry, the conflict flow, safety checks on cell contents); these questions cover only what it leaves open. Smaller choices are listed as assumptions at the end.

## Q1. Which events create a notification for a parent?

A. Sign-up confirmed; a swap request addressed to the family; a swap or cancellation decided; a place removed by an admin or by archiving the family; and the two reminders before a task.
B. Only the two reminders before a task.
C. Not yet defined.
X. Other (please specify)

[Answer]: A. Sign-up confirmed; a swap request addressed to the family; a swap or cancellation decided; a place removed by an admin or by archiving the family; and the two reminders before a task.

## Q2. Who may run an import?

A. Super admins only (the import can create or change families across the whole organization).
B. Super admins, and group admins for the rows of their own group.
C. Not yet defined.
X. Other (please specify)

[Answer]: A. Super admins only (the import can create or change families across the whole organization).

## Q3. How long is the staged import data kept?

The preview holds the workbook's rows (names, contact details), so it is personal data. Only the admin who started the import can read it.

A. Until the import is committed or cancelled, and at most 7 days; after a commit only the row counts and conflict decisions stay as history.
B. Keep everything for 90 days for investigation.
C. Not yet defined.
X. Other (please specify)

[Answer]: A. Until the import is committed or cancelled, and at most 7 days; after a commit only the row counts and conflict decisions stay as history.

## Q4. How is an imported person matched to an existing record?

A. A family is matched by the parent's email address, else by family name within the group; a match that is not exact is shown as a conflict for the admin to resolve (keep existing or use the import).
B. Every imported row creates a new record; the admin removes duplicates by hand.
C. Not yet defined.
X. Other (please specify)

[Answer]: A. A family is matched by the parent's email address, else by family name within the group; a match that is not exact is shown as a conflict for the admin to resolve (keep existing or use the import).

## Assumptions (no answer needed; tell me if one is wrong)

1. Reminder thresholds stay as today: 7 days and 24 hours before a task, one in-app notification and one simulated email record per threshold and recipient; a threshold already missed is created immediately once.
2. Recipients of reminders follow the setting from U3: the families of the assigned duties, or the group's active families.
3. Simulated delivery: each reminder job gets up to 3 attempts with the statuses queued, sent, retry scheduled and failed, all labelled as simulated; no real email or SMS is sent.
4. Interactive sheets (the directory and the cleaning, animal, water, bazaar, big-cleaning, summer-animal and festival task sheets) are imported into records; the other nine sheets are recorded as archived rows and counted (answer Q6).
5. The import tests use only a fictitious workbook with the real structure; the real workbook is never read by code or tests (FR7.2).
6. Cell contents starting with `=`, `+` or `@` are refused, files are limited in size and rows, and an optional profile is imported only with consent, as in the old rules.
7. The import runs as one transaction: a failure or interruption leaves the data as it was, and the recovery step shows what was undone.
8. The xlsx reading library is chosen in the NFR stage as an exactly pinned version that passes the dependency audit.
9. Notifications from U3's use cases are written inside those same database functions (the list kept in code for this purpose).

## Follow-up questions after the architecture review

The review found that the design needs the workbook's column structure, a decision about the archive sheets and more changes to the import screen than the upload control alone. These three answers settle them.

## Q5. How is the workbook structure defined?

A. App-defined template: the design defines the columns the import expects for the eight data sheets; the owner converts the old workbook into that template once; the fictitious test workbook follows the template.
B. The owner lists the real header names and the design matches the existing workbook.

[Answer]: A. App-defined template: the design defines the columns the import expects for the eight data sheets; the owner converts the old workbook into that template once; the fictitious test workbook follows the template.

## Q6. What does the import do with the nine archive sheets?

A. Count them only: each row is recorded as archived, the content stays in the old workbook.
B. Store the content as read-only archive records (new table and screen).

[Answer]: A. Count them only: each row is recorded as archived, the content stays in the old workbook.

## Q7. May the demo-only parts of the import screen change?

A. Yes: real run id and version, fresh idempotency keys per attempt, real result numbers, no demo selectors in production, plus the file upload; layout and wording stay.
B. No, only the file upload.

[Answer]: A. Yes: real run id and version, fresh idempotency keys per attempt, real result numbers, no demo selectors in production, plus the file upload; layout and wording stay.

## Consolidated Summary Confirmation

- Notifications: sign-up confirmed, swap request addressed to the family, swap or cancellation decided, place removed, and the two reminders.
- Import: super admins only.
- Staged import data: kept until commit or cancel, at most 7 days; afterwards only counts and decisions.
- Matching: by parent email, else family name in the group; inexact matches are conflicts for the admin.
- Workbook structure: an app-defined template for the eight data sheets; the owner converts the old workbook once; the fictitious test workbook follows the template.
- Archive sheets: counted only, content stays in the old workbook.
- Import screen: the demo-only parts change (real run id and version, fresh keys, real result numbers, no demo selectors in production) plus the file upload; layout and wording stay.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
