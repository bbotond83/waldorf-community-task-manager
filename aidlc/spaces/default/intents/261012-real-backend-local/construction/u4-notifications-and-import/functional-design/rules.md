# Rules: U4 Notifications and Excel import

Source: requirements FR4.4, FR5.2, FR7.1 to FR7.3, FR8.1, FR11.1, NFR1, NFR6, the confirmed answers Q1 to Q7, ADR-001 to ADR-013, U1's rules (BR3.2 audit action list, BR3.6 idempotency), U3's design (BR31.10 hand-off list, the ReminderSetting from BR30.10, BR32.5 dashboard link, BR32.9 interim behaviour), the first architecture review of this design, and a rule-by-rule review of the old notification, durable-job, import and advanced-adapter code (the ledger at the end shows where every old rule went).

Numbering: U1 to U3 use BR1 to BR4, BR10, BR11 and BR30 to BR35, so U4 uses BR40 (Notifications), BR41 (Import), BR42 (kernel use cases, adapters and screens) and BR43 (carry-over of old rules).

Audit follows U1 BR3.2: the only audit event U4 writes is `import.commit` (one per committed or recovered run, in the commit transaction). Notifications, reminders and conflict decisions are not audited.

Callers (ADR-001, ADR-011): the functions that cross blocks are elevated functions that U4 adds to U2's catalogue with allowed callers and reason. Per-function callers: `notification_list` and `notification_mark_read`: a signed-in parent (own rows only). `reminder_list` and `reminder_retry`: admins in reach of the task's group. `reminder_plan`: called inside U3's use cases (no separate caller). `reminder_run_due(organization)`: the system caller (seed, reset, housekeeping, through U2's server-only admin access) and any signed-in member of that organization, because it is idempotent, simulated and limited to that organization's own due jobs; local use has no scheduler, so the server calls it when a parent opens the notification list, when an admin opens the reminders screen, and from housekeeping. `import_*` functions (preview, resolve, commit, mark interrupted, recover, status, cancel): the super admin who started the run (a new preview: any super admin of the organization). `import_expire(organization)`: the system caller and super admins of that organization. `dashboard_import_conflicts` (U3's function, body replaced): inside `dashboard_get`.

```yaml
rules:
  # ---------------- BR40: Notifications ----------------
  - id: BR40.1
    statement: "A notification is written in the same transaction as the event that causes it, for the right parents"
    category: constraint
    applies_to: "Notifications, Coordination (the use cases of U3's hand-off list)"
    trigger: "any use case in the table of BR40.9"
    logic: "IF a U3 use case completes THEN, in its transaction, one Notification per linked parent of the right families is inserted as BR40.9 lists (answer Q1); the dedupe_key keeps an idempotent replay from creating a second notice and lets a genuine repeat (sign up again after cancelling) create a new one; a family with no linked parent gets nothing now and is not backfilled when a parent is linked later (reminders for future tasks are planned per family, so the parent sees the next ones created after linking); IF a notice cannot be written THEN the whole use case rolls back"
    violation: "the use case fails as a whole; nothing is half-written"
    source: "FR5.2, FR4.4 (answer Q1; closes U3 BR31.10)"
  - id: BR40.2
    statement: "A parent sees only their own notifications, newest first, with a complete display mapping"
    category: authorization
    applies_to: Notifications
    trigger: "a parent opens the notification list"
    logic: "IF the reader's account is linked to a Parent THEN the list contains that parent's notifications only, newest first, each with a Hungarian title built from the kind and the task title, a link to the task or request page, the read state, and the two display fields mapped as in the table below; the empty state when there are none; an account with no linked parent gets the empty state (the interim answer of U3 BR32.9 ends); a notification of another parent is never returned or counted. Display mapping (the existing NotificationModel keeps its fields and values): `timing`: for reminder_7d / reminder_24h the value is '7-day' / '24-hour', but 'stale' when the job is stale or the task's current start differs from task_starts_at, and 'cancelled' when the job is cancelled or the task is cancelled; for event notices the value is 'cancelled' when the task is cancelled or the swap request they are about was withdrawn, else 'within-threshold'. `providerStatus`: for reminders, by job status: sent -> 'simulated-sent'; queued, retryable, retrying -> 'simulated-retry'; terminal, stale, cancelled -> 'simulated-cancelled'; for event notices always 'simulated-sent' (the in-app notice itself is stored). Known limit, accepted: the existing list shows 'Közeli időpont' and a simulated-provider line for event notices too; changing that text would be a further screen change and is left to the owner"
    violation: "none: another parent's rows are simply absent"
    source: "FR8.1, FR5.2"
  - id: BR40.3
    statement: "A parent can mark only their own notification as read, and doing so twice is harmless"
    category: authorization
    applies_to: Notifications
    trigger: "a parent opens or marks a notification"
    logic: "IF the notification belongs to the reader's parent THEN read_at is set once (a repeat keeps the first time) and the link to follow is returned; OTHERWISE the result is denied and nothing is changed; the table policy allows updating read_at on own rows only and nothing else"
    violation: "denied result"
    source: "FR8.1 (carries over the old mark-as-read behaviour)"
  - id: BR40.4
    statement: "Reminders are planned at 7 days and 24 hours before a task for the right families, and a missed threshold is created immediately once"
    category: policy
    applies_to: "Notifications (reminder_plan)"
    trigger: "an assignment is created or moved, a task start changes, or the reminder setting changes"
    logic: "IF reminders are enabled in the organization's ReminderSetting (U3 BR30.10) AND the task is open and has not started THEN, per threshold (7d, 24h), one ReminderJob exists for the task (unique live job): scheduled_for is the task start minus 7 days or 24 hours (instants in UTC, so daylight-saving changes need no local-time arithmetic); IF that moment has passed THEN scheduled_for is now (created immediately, once); its ReminderRecipients are the families of the setting: recipient-duty means the families holding a non-removed assignment on the task, recipient-group means the active families of the task's group; recipients are added and removed as assignments change (BR40.5); a job with no active recipient is cancelled; no job exists for a started, closed or cancelled task"
    violation: "none: planning is idempotent"
    source: "FR8.1 (ported from the notification service; setting from U3)"
  - id: BR40.5
    statement: "Changes to tasks, places, events, settings and families keep the jobs and recipients right"
    category: policy
    applies_to: Notifications
    trigger: "the use cases in the table of BR40.9"
    logic: "IF a task start changes THEN its live jobs become stale and new jobs are planned for the new start; IF a task is cancelled, or closed because its event was cancelled, THEN its live jobs become cancelled; IF an assignment is removed THEN that family's recipient row becomes removed (recipient-duty setting) and a job without active recipients is cancelled; IF a swap exchange runs THEN each exchanged assignment's family is removed from the old task's recipients and added to the new task's (re-planning both tasks); IF the reminder setting is switched off THEN all live jobs become cancelled, and switched on or its recipient scope changed THEN jobs are re-planned for upcoming tasks; IF a family is archived, deleted or anonymized THEN its recipient rows become removed; stale and cancelled jobs and removed recipients are kept as history and never run"
    violation: "none"
    source: "FR8.1 (ported from cancelDuty, extended to the U3 use cases)"
  - id: BR40.6
    statement: "Due reminder jobs are run with a simulated delivery, up to three attempts"
    category: policy
    applies_to: "Notifications (reminder_run_due)"
    trigger: "the lazy tick of the server, the reminders screen, the seed and housekeeping call the function"
    logic: "IF a queued or retrying job is due (scheduled_for not after now) and its task has not started THEN one ReminderAttempt is recorded with a simulated outcome (success, or failure when a test seam asks for it), the job becomes sent on success; on a simulated failure it becomes retryable (attempt 1 or 2) or terminal (attempt 3); at the FIRST run of a job, for each linked parent of each active recipient family one in-app Notification of kind reminder_7d or reminder_24h is created (idempotent by dedupe_key), even when that first attempt failed; a parent linked later is not backfilled (BR40.1); running the function twice does the same as once; no address, message text or real delivery exists anywhere; the only caller rule is in the callers paragraph above"
    violation: "none: delivery is simulated and labelled so"
    source: "FR8.1 (ported from the durable jobs; the retry limit is assumption 3)"
  - id: BR40.7
    statement: "An admin in reach can retry a retryable reminder as one action"
    category: authorization
    applies_to: "Notifications (reminder_retry)"
    trigger: "the admin retries a reminder on the reminders screen"
    logic: "IF the actor reaches the task's group (super admin, or group admin of that group) AND the job (one per task and threshold, so one row on the screen) is retryable AND the sent version equals the stored one THEN the job becomes retrying (version increased) and the next run records the attempt for all its recipients at once; a job that is not retryable gives the conflict REMINDER_NOT_RETRYABLE; a stale version gives the invalidated result REMINDER_STALE; no audit event"
    violation: "denied, conflict or invalidated result"
    source: "FR4.4, FR5.5 (carries over the old retry codes)"
  - id: BR40.8
    statement: "The reminders screen lists one row per task and threshold for admins in reach, with counts only"
    category: authorization
    applies_to: Notifications
    trigger: "an admin opens the reminders list"
    logic: "IF the actor is an admin THEN the jobs of tasks in reach are listed (optionally filtered by status), one row per job, with title (task title and threshold), status, attempt, correlation id (no person or family id), the label 'Szimulált kézbesítés' and a recipient summary that is the count of active recipient families ('3 kijelölt család', or 'Nincs aktív címzett'), never names or addresses; the empty state when none"
    violation: "denied for other roles"
    source: "FR4.4, FR8.1"
  - id: BR40.9
    statement: "Every use case in U3's hand-off list has a decided notification and job behaviour"
    category: constraint
    applies_to: "Notifications, Coordination"
    trigger: "the use cases below run"
    logic: "The behaviour per use case (answer Q1; 'jobs' means BR40.4 and BR40.5): duty_sign_up -> sign_up_confirmed to the signing family's parents; jobs: add the family as recipient. assignment_assign -> sign_up_confirmed to the family's parents; jobs: add recipient. assignment_remove -> place_removed to the family's parents; jobs: remove recipient. swap_request -> swap_requested to the other family's parents; no job change. swap_respond (confirmed and applied) -> swap_decided to the parents of both families; jobs: the exchange of BR40.5. swap_respond (declined) -> swap_decided to the requester's parents; no job change. swap_withdraw -> no new notice; the earlier swap_requested notice reads as 'cancelled' (BR40.2) because its request was withdrawn. cancellation_request -> none (admins are not notified in U4); no job change. swap_decide / cancellation_decide -> swap_decided / cancellation_decided to the parents of every family involved; jobs: exchange or remove recipient. family_archive -> place_removed for each removed assignment goes to no one (the archived family's parents are archived); jobs: remove the family's recipients and cancel empty jobs. family_restore -> none. task_save -> if the start changed: jobs stale and re-planned; if the task is cancelled: jobs cancelled; no notices. event_save -> if the event is cancelled: the closed tasks' jobs are cancelled. settings_save (reminder setting) -> jobs per BR40.5. lifecycle_run -> delete the family's notifications of its parents and its recipient rows (deleted, not kept as history, so no personal link remains). A test runs every entry of `NOTIFICATION_USE_CASES` and these extra functions and checks the table (BR42.5)"
    violation: "the test fails and blocks the unit"
    source: "FR5.2, FR4.4 (closes U3 BR31.10; review finding)"
  # ---------------- BR41: Import ----------------
  - id: BR41.1
    statement: "Only a super admin can use the import"
    category: authorization
    applies_to: "Import (all import functions)"
    trigger: "any import preview, resolve, commit, recover, status, cancel"
    logic: "IF the actor is a super admin of the organization THEN the operation may proceed (on a run only the super admin who started it, BR41.7); OTHERWISE denied; group admins, teachers and parents get the denied result and see nothing of any run (answer Q2); a super admin of another organization sees nothing"
    violation: "denied result"
    source: "FR7.1 (answer Q2)"
  - id: BR41.2
    statement: "An uploaded workbook is checked before anything is staged"
    category: validation
    applies_to: Import
    trigger: "a super admin uploads a file"
    logic: "The checks run in this order, on the bytes, before and while parsing: the file is a readable .xlsx (a ZIP with the workbook parts), else IMPORT_MALFORMED; the file is at most 5 MB, the ZIP's declared uncompressed size is at most 50 MB, no sheet declares more than 20000 rows and the whole workbook not more than 100000, else IMPORT_OVERSIZED (the limits are checked from the file's own directory before anything is expanded); all 17 registered sheets exist, else IMPORT_MISSING_SHEET; each interactive sheet's header row (row 1) has exactly the columns of the template in 'Workbook template' below, else IMPORT_MISSING_HEADER; any cell longer than 10000 characters, or a text cell that starts with =, + or @ in a column that is not a phone column, gives IMPORT_UNSAFE_CELL; formulas are never evaluated and macros never run (cells are read as data only, a formula cell counts as unsafe); a phone cell may start with + and must match the phone rule of U3 (digits, spaces, + at the start, dash, 6 to 20 characters), otherwise the phone value is dropped and counted in the row's warning count (the row still imports); the optional profile text is staged only when the consent column says 'igen', otherwise it is dropped and counted; nothing is staged when any of the first five checks fails; the server action receives the file as bytes (never a path) and the Next.js server-action body limit is raised to 6 MB in the app configuration"
    violation: "conflict result; no run is created"
    source: "FR7.1, FR7.3 (carries over the old validation rules; changed for phone numbers and size limits)"
  - id: BR41.3
    statement: "The preview classifies rows and binds a fingerprint and the matched record versions to the staged data"
    category: calculation
    applies_to: Import
    trigger: "the workbook passed BR41.2"
    logic: "IF the workbook is valid THEN one ImportRun (status previewed; step 4 when conflicts exist, otherwise 5) is created with the staged rows, an ImportRow per row (outcome staged, or conflict), for each matched row the matched record's type, id and version (BR41.4), the changed-row summary ('Boróka csoport: 2 módosítás'), the totals and a SHA-256 fingerprint of the staged rows in a fixed order; a second preview by the same super admin cancels their earlier uncommitted run first (one open run per super admin and organization); the screen receives the run id, the run version, the fingerprint, the changed rows, the conflicts, the step, the totals and the file name"
    violation: "none"
    source: "FR7.1 (ported from ImportService.createPreview)"
  - id: BR41.4
    statement: "A person is matched to an existing record by an ordered decision table; unclear cases are conflicts"
    category: policy
    applies_to: Import
    trigger: "the directory sheet and the task sheets are classified"
    logic: "Directory sheet, for each family group of rows (rows with the same Csoport and Család): step 1, count the existing parents in the organization whose contact email equals one of the group's emails (case-insensitive). 1 family hit -> update of that family; 2 or more different families -> conflict 'Több egyező család.'; 0 hits -> step 2: count existing families with exactly this name in the group. 1 -> if the group's rows carry no email, or the existing family has no email, an update of that family; if both have emails and they differ -> conflict 'Az elem már létezik.'; 2 or more -> conflict 'Több egyező család.'; 0 -> create a new family. Two or more workbook groups that resolve to the same existing family -> every one after the first is a conflict 'Ismétlődő sor a fájlban.'. Task sheets: the group is found by name in the active school year (not found -> conflict 'Ismeretlen csoport.'); the task is matched by group, title and start (found -> update, else create); the assigned family is found by exact name in the group (not found -> conflict 'Ismeretlen család.'). The matching reads contact emails inside one super-admin function only, so no email appears in the conflict list (answer Q4)"
    violation: "none: ambiguity becomes a conflict"
    source: "FR7.1 (answer Q4)"
  - id: BR41.5
    statement: "Each conflict is resolved with keep-existing or use-import, on a current run"
    category: validation
    applies_to: Import
    trigger: "the super admin chooses a resolution"
    logic: "IF the run is previewed or confirmed AND the sent run version equals the stored one AND the conflict belongs to the run AND the resolution is keep-existing or use-import THEN the conflict is resolved, the run version increases (the response carries the new version, so the next resolution uses it), and when no conflict is open the run becomes confirmed (step 5); a stale or missing run gives the invalidated result IMPORT_PREVIEW_STALE; an unknown conflict or resolution gives the conflict IMPORT_CONFLICT_UNRESOLVED; use-import on a 'Ismeretlen csoport.' or 'Ismeretlen család.' conflict is refused with IMPORT_CONFLICT_UNRESOLVED (nothing to import into), only keep-existing (skip) is allowed there"
    violation: "invalidated or conflict result; nothing is changed"
    source: "FR7.1 (carries over the old resolve rules)"
  - id: BR41.6
    statement: "A commit is bound to the fingerprint, re-checks every match, needs every conflict resolved and a confirmation, and is one transaction"
    category: constraint
    applies_to: "Import (import_commit)"
    trigger: "the super admin confirms the commit"
    logic: "IF the run is previewed with no open conflict, or confirmed, AND the presented fingerprint equals the stored one (else IMPORT_FINGERPRINT_CHANGED) AND no conflict is open (else IMPORT_CONFLICT_UNRESOLVED) AND confirmation 'yes' is present (else IMPORT_CONFIRMATION_REQUIRED) THEN, in ONE transaction: every row is matched again; IF a row's match differs from the one recorded at preview (a record was added, changed, archived or its version moved) THEN nothing is applied, the run returns to previewed with the changed rows as new conflicts and the conflict IMPORT_MATCH_CHANGED is returned; otherwise the rows are applied through U3's save functions with the recorded expected versions, each with its own derived idempotency key (the run id and the source key hashed), locking families and tasks in ascending id order (U3 NFR3.8); keep-existing rows change nothing, use-import rows overwrite; ImportRow outcomes are set (created, updated, skipped, archived); the run becomes committed with imported and skipped counts, ONE audit event import.commit with the counts is written, the staged rows are deleted (BR41.8); any failure rolls back everything including the run's status; a commit of a run that is already committed or recovered is refused as IMPORT_PREVIEW_STALE; the commit is idempotent for the same idempotency key. The transaction is meant for one school's import (thousands of rows), so holding row locks for its short duration is accepted"
    violation: "conflict or invalidated result; the data is exactly as before"
    source: "FR7.1, FR7.3, NFR6 (ported from ImportService.commit; review findings)"
  - id: BR41.7
    statement: "Staged workbook rows are readable only by the super admin who started the run"
    category: authorization
    applies_to: "Import (ImportStagedRow)"
    trigger: "any read or delete of ImportStagedRow"
    logic: "IF the reader's account equals the run's started_by_account_id AND is a super admin of the organization THEN the rows are visible to the import functions of that run and may be deleted by them; the system expiry and reset (BR41.8) may also delete them; OTHERWISE no row is visible, not to other super admins, group admins, teachers, parents, the service-role key or a signed-out request; no list, status or conflict function returns staged payload; a policy test per role covers the table and every import function"
    violation: "rows are absent; no error reveals that they exist"
    source: "FR7.1, NFR1 (answer Q3; settles the open design-review item on the staged payload)"
  - id: BR41.8
    statement: "Staged rows are deleted after commit, cancel or at most 7 days"
    category: policy
    applies_to: Import
    trigger: "commit, cancel, expiry, housekeeping, reset"
    logic: "IF a run is committed, recovered or cancelled THEN its staged rows are deleted in the same transaction; IF a run is previewed, confirmed or interrupted and older than 7 days (expires_at) THEN `import_expire` marks it expired and deletes its staged rows (called by housekeeping, seed, reset, and when the import screen opens; callers in the callers paragraph); the long-term history keeps the run, the ImportRow outcomes and the ImportConflict rows with labels only, and no names, emails or phone numbers (answer Q3)"
    violation: "none"
    source: "FR7.1, NFR1 (answer Q3)"
  - id: BR41.9
    statement: "An interrupted commit leaves the data as it was, and recovery resumes it"
    category: constraint
    applies_to: "Import (import_mark_interrupted, import_recover)"
    trigger: "the connection or server fails during a commit, then the admin opens recovery"
    logic: "IF a commit fails with a retryable failure THEN the database has rolled back (BR41.6) and the run is exactly as before; the adapter then calls `import_mark_interrupted(run)` in a separate small transaction (precondition: the caller started the run and its status is previewed or confirmed; effect: status interrupted, step 6); IF that marking also fails THEN the run simply stays previewed or confirmed, and the admin can run the commit again (it is idempotent) - nothing is lost; IF the admin chooses the recovery action 'resume' on an interrupted run THEN the commit is re-run from the staged rows with the same fingerprint and the result is recovered (step 7) with the final counts; any other action gives IMPORT_RECOVERY_ACTION_INVALID; recovery on a run that is not interrupted, or whose staged rows have expired, gives IMPORT_RECOVERY_NOT_AVAILABLE; the admin can instead cancel the run (staged rows deleted); a test makes the commit fail by an injected client error (adapter) and by a row set that makes a U3 save function fail midway (database), and proves the data is unchanged"
    violation: "conflict result"
    source: "FR7.3 (ported from the old recovery flow; review findings)"
  - id: BR41.10
    statement: "Seventeen sheets are registered; eight are imported into records, nine are recorded as archived rows and counted"
    category: constraint
    applies_to: Import
    trigger: "classification and commit"
    logic: "IF a sheet is interactive (the parent directory sheet and the cleaning, weekend animal, water, bazaar, big-cleaning, summer animal and festival task sheets) THEN its rows are imported into Directory and Coordination records; IF a sheet is read-only archive THEN every non-empty row is recorded as an ImportRow with outcome archived and its content is not copied (answer Q6; the content stays in the workbook outside the app); archived rows are counted in skipped_rows; the registry table lists each sheet's destination and named owner process (finance, library, water test, workgroups, animals, maintenance, garden), as the old registry did"
    violation: "none"
    source: "FR7.1 (ported from LEGACY_DESTINATIONS; answer Q6)"
  - id: BR41.11
    statement: "The import is tested with a fictitious workbook only"
    category: constraint
    applies_to: "Import, tests"
    trigger: "tests and the privacy scan"
    logic: "IF a test needs a workbook THEN it uses a workbook generated from the template below (all 17 sheets, fictitious names, including a '+36' phone, an invalid phone, a consent mark, duplicates and ambiguous matches) stored under the test fixtures or generated in the test; no code path reads `source-materials/`, the real workbook is never opened by code, tests or the seed, and the privacy scan fails if a workbook with personal data is tracked (FR11.1)"
    violation: "the scan or a path-guard test fails"
    source: "FR7.2, FR11.1"
  - id: BR41.12
    statement: "The dashboard counts the open import conflicts"
    category: calculation
    applies_to: "ApplicationKernel (dashboard_import_conflicts)"
    trigger: "an admin opens the dashboard"
    logic: "IF the actor is a super admin THEN the count is the number of ImportConflicts with no resolution in runs that are previewed, confirmed or interrupted; for other admins it is zero; U4 replaces the body of U3's existing function `dashboard_import_conflicts` (called by `dashboard_get`), so there is one function for the count, and inverts U3's marker test into a test of the real count"
    violation: "none: this is a read"
    source: "FR4.4"
  - id: BR41.13
    statement: "The import status covers every run state and the screen can always start a new upload"
    category: constraint
    applies_to: "Import (import_status)"
    trigger: "the import screen opens"
    logic: "IF the super admin has a run THEN `import_status` returns the latest run that is previewed, confirmed, interrupted, committed or recovered, with the model state mapped as: previewed with open conflicts -> 'conflicts'; previewed without conflicts -> 'preview'; confirmed -> 'confirmed'; committed -> 'committed'; interrupted -> 'interrupted'; recovered -> 'recovered' (the states 'selected', 'validated' and 'rolled-back' of the model are not produced: selection and validation happen on the upload step, and rollback does not exist, ledger N16); cancelled and expired runs are not returned, so the screen shows the upload form; after committed or recovered the result step stays visible and carries a link to start a new upload, which creates a new preview and supersedes the finished run on screen"
    violation: "none: this is a read"
    source: "FR7.1 (review finding)"
  # ---------------- BR42: kernel use cases, adapters and screens ----------------
  - id: BR42.1
    statement: "The adapters replace the interim port for notifications, import and reminders"
    category: constraint
    applies_to: "ApplicationKernel, all U4 blocks"
    trigger: "U4's adapters are built"
    logic: "IF U4's adapters are built THEN the parent port operations listNotifications and markNotificationRead and the admin operations reminders.list, reminders.retry, import.preview, import.status, import.resolve, import.commit and import.recover (plus a cancel) each call one named database function in the production composition and return the existing result states and codes (BR42.3); governance, lifecycle and settings stay as U3 left them; the interim port of U3 is removed from the production path; the synthetic composition keeps its demo store until U5; the adapter derives the run id and run version from the preview model and sends them with every later call, and builds a fresh idempotency key per attempt (as U3's freshKey does)"
    violation: "a contract test fails and blocks the unit"
    source: "FR4.1, FR4.4"
  - id: BR42.2
    statement: "The import screen changes only where a real import needs it; the other screens keep their text and behaviour"
    category: constraint
    applies_to: WebApp
    trigger: "U4's screens are built"
    logic: "IF the import screen is built THEN in production mode these are the ONLY changes (answer Q7), everything else keeps markup, copy and test ids (NFR7): the first step offers a file input for the .xlsx workbook (accept .xlsx, hint 5 MB) with Hungarian messages for the new codes; the preview model gains `runId`, `runVersion` and the file name (shown on the 'Forrás' line instead of the demo fixture id); the resolve, commit and recovery forms send the real run id and run version (no constant '1' or 'run-waldorf-v1'); every attempt sends a fresh idempotency key; the confirm text and the result panel show the real counts of the outcome (no fixed '3 engedélyezett változást' or '3 elem módosult', no fixed 'Szimulált adatbázishatás' sentence); the DeveloperDetails scenario selects and the `scenario` payload field are not rendered or sent in production mode; the result step has a 'new upload' link (BR41.13); new codes get Hungarian messages; every new control is Hungarian, keyboard operable and passes the automated accessibility scan (WCAG 2.2 AA); synthetic mode is unchanged; browser tests cover a run with two conflicts and a second import after a first"
    violation: "the browser, contract or accessibility test fails"
    source: "FR7.1, NFR5, NFR7 (answer Q7)"
  - id: BR42.3
    statement: "Every operation keeps the result states and codes the screens already map"
    category: constraint
    applies_to: ApplicationKernel
    trigger: "an adapter returns a result"
    logic: "IF an operation fails for a business reason THEN it returns exactly one of: import: conflict IMPORT_MALFORMED, IMPORT_OVERSIZED, IMPORT_MISSING_SHEET, IMPORT_MISSING_HEADER, IMPORT_UNSAFE_CELL, IMPORT_FINGERPRINT_CHANGED, IMPORT_CONFLICT_UNRESOLVED, IMPORT_CONFIRMATION_REQUIRED, IMPORT_MATCH_CHANGED, IMPORT_RECOVERY_NOT_AVAILABLE, IMPORT_RECOVERY_ACTION_INVALID, invalidated IMPORT_PREVIEW_STALE; reminders: conflict REMINDER_NOT_RETRYABLE, invalidated REMINDER_STALE; notifications: denied for another parent's notification; the new codes IMPORT_UNSAFE_CELL and IMPORT_MATCH_CHANGED get Hungarian messages; unexpected failures map once to retryable or terminal as in U3 BR32.4; a code-by-code contract test covers the table"
    violation: "the contract test fails"
    source: "FR4.2"
  - id: BR42.4
    statement: "Every U4 table and function is covered by a policy test per role and listed in the elevated catalogue"
    category: constraint
    applies_to: "Notifications, Import, ApplicationKernel"
    trigger: "U4's tables and functions are created"
    logic: "IF a table or function is created THEN a database test proves, for each caller (parent whose notification it is, another parent, teacher, group admin of the group, group admin of another group, the super admin who started the run, another super admin, a member of another organization, the system caller, signed-out, deactivated), what it can read and change, including that a parent never sees another parent's notification and nobody but the starting super admin sees staged rows; every function is in U2's catalogue with its allowed callers and reason (callers paragraph)"
    violation: "the policy or catalogue test fails and blocks the unit"
    source: "NFR1, FR3.3"
  - id: BR42.5
    statement: "The hand-off list from U3 is complete and tested"
    category: constraint
    applies_to: "Coordination, Notifications"
    trigger: "U4's tests run"
    logic: "IF U3's exported `NOTIFICATION_USE_CASES` lists the use cases that change a family's assignments THEN a database test runs each of them and the extra functions of BR40.9 and asserts the notices and job changes of the table in BR40.9 exist afterwards, and that a use case that fails writes none; the unit test of the list stays and is extended to the extra functions"
    violation: "the test fails and blocks the unit"
    source: "FR5.2 (closes U3 BR31.10)"
  # ---------------- BR43: carry-over ----------------
  - id: BR43.1
    statement: "Every rule of the old notification, durable-job and import code has a recorded disposition"
    category: policy
    applies_to: "all U4 blocks"
    trigger: "U4's code is complete"
    logic: "IF a rule in the old code appears in the ledger below THEN it is kept (with the rule that now holds it and the test that proves it), changed (reason given), moved or dropped with a reason; when all rows of a module are proven and nothing else imports it, `src/notifications` and `src/import-migration` and their tests are deleted in U4; the notification part of `src/parent-web` and the import and reminder parts of `src/admin-advanced` are still the synthetic composition's code and stay until U5 removes synthetic mode (same coexistence as U3)"
    violation: "the unit's verification blocks when a ledger row has no proof"
    source: "FR4.3, ADR-008"
```

## Workbook template (answer Q5)

The workbook structure is app-defined. The owner converts the old workbook into this template once, by hand; the fictitious test workbook is generated from it (BR41.11). Row 1 of each interactive sheet holds exactly these header texts, in this order; further rows are data; empty rows are ignored; dates and times are written `YYYY-MM-DD HH:mm` in Budapest time; the consent column holds `igen` or `nem`.

| Sheet | Columns (row 1) | Meaning |
|---|---|---|
| Szülők elérhetősége | Csoport, Család, Szülő neve, E-mail, Telefon, Helység, Gyermek neve, Opcionális profil, Hozzájárulás | One row per parent or child; rows with the same Csoport and Család form one family; a row with a Szülő neve is a parent (with its E-mail, Telefon, Helység, and Opcionális profil only if Hozzájárulás is `igen`), a row with only a Gyermek neve is a child; the group is created or found by name in the active school year |
| The seven task sheets (Kinti - benti takarítás 2025-26, Állatos hétvégi beosztás 2025-2, Vízhordás 2025-26, Gödöllői Bazár 2025, Nagytakarítás, Állatos beosztás 2025 Nyári szü, Nyárünnep 2026) | Csoport, Esemény, Feladat, Kategória, Kezdés, Befejezés, Helyszín, Létszám, Család | One row per task and assigned family; rows with the same Csoport, Feladat and Kezdés are one task (Esemény optional: an event of that title and group is found or created; Kategória free text; Létszám the capacity 1 to 50; Helyszín defaults to a dash; Család optional: the assigned family by exact name in the group, one row per family up to the capacity) |
| The nine archive sheets | none required | Only the sheet name must exist; every non-empty row is counted and recorded as archived (BR41.10) |

## Summary

| Group | Rules |
|---|---|
| Notification creation, list, mark read, reminders (plan, change, run, retry, list), per-use-case behaviour | BR40.1 to BR40.9 |
| Import: access, upload checks, preview, matching, resolve, commit, staged-data privacy and expiry, interruption, sheets, fictitious data, dashboard, status | BR41.1 to BR41.13 |
| Adapters, screen changes, codes, policy tests, hand-off list | BR42.1 to BR42.5 |
| Carry-over of the old rules | BR43.1 |

## Rule Disposition Ledger (ADR-008)

Status: **kept**, **changed** (reason given), **moved**, **dropped** (reason given).

| # | Old rule (where) | Status | Now held by | Proof |
|---|---|---|---|---|
| N1 | Two thresholds, 7 days and 24 hours, offsets from the due instant (notification service) | kept | BR40.4 | threshold test |
| N2 | A missed threshold is created immediately once; no job for a started task (notification service) | kept | BR40.4 | missed-threshold test |
| N3 | Job identity = duty, revision, threshold, recipient; a repeat creates nothing (notification service, store) | changed | BR40.4 (one live job per task and threshold; recipients as child rows; dedupe_key on notices) | idempotency test |
| N4 | Instants only, no local-time arithmetic across daylight-saving changes (notification service) | kept | BR40.4 | DST test |
| N5 | Privacy-safe status: no address in the status (notification service) | kept | BR40.6, entities | scan test |
| N6 | Cancel the duty's jobs when the duty changes (notification service, durable jobs) | kept | BR40.5, BR40.9 | change tests |
| N7 | Due jobs are dispatched, success sent, failure retry scheduled, attempts counted (durable jobs) | changed | BR40.6 (up to 3 attempts, terminal after) | attempt tests |
| N8 | Paired in-app notification and queued email record per threshold (notification service) | changed | BR40.6 (notice created at the job's first run; the email is a simulated attempt) | run test |
| N9 | Parent notification list and mark-as-read, only the fixture parent (parent adapter) | changed | BR40.2, BR40.3 (real, per parent; interim empty state ends) | policy tests |
| N10 | Reminder list, status filter, retry codes REMINDER_NOT_RETRYABLE and REMINDER_STALE (advanced adapter) | kept | BR40.7, BR40.8 | code tests |
| N11 | Reminder fixtures and 'stale' sample jobs (advanced adapter) | dropped | synthetic data; real jobs replace them | none needed |
| N12 | Preview bound to an immutable fingerprint; changed rows reported (import service) | kept | BR41.3, BR41.6 | fingerprint test |
| N13 | Stale preview rejected without publishing (import service) | kept | BR41.6 | stale test |
| N14 | Optional profile import needs consent (import service; `containsOptionalProfile` and `consentGranted` flags) | changed | BR41.2 (the consent column `igen`; the flags become the dropped-profile count) | consent test |
| N15 | Stage and publish together; no duplicate commit (import service) | kept | BR41.6 | atomic and duplicate tests |
| N16 | Rollback of a committed import reconciles visibility; the `rolled-back` state (import service, status labels) | dropped | no rollback screen or requirement exists; interruption is covered by BR41.9 and a bad import is corrected by a new import; the model state is not produced (BR41.13) | reason recorded |
| N17 | 17 required sheets, hostile cell values blocked, row-count limit (import service) | changed | BR41.2 (adds the phone exception, size and uncompressed limits) | validation tests |
| N18 | Sheet destinations and owners (LEGACY_DESTINATIONS) | kept | BR41.10, SheetRegistryEntry | registry test |
| N19 | Conflict resolution only by an authorized person and only when open (import service) | kept | BR41.1, BR41.5 | policy tests |
| N20 | Open conflicts block commit (import service) | kept | BR41.6 | commit test |
| N21 | Import codes IMPORT_* and the seven-step progress (advanced adapter) | kept | BR41.3, BR41.5, BR41.6, BR41.9, BR42.3 | code-by-code contract test |
| N22 | Recovery 'resume' after an interrupted commit (advanced adapter) | kept | BR41.9 | recovery test |
| N23 | Scenario switches such as malformed, oversized, interrupted (advanced adapter) | dropped | demo hooks; real files and a failure-injecting database client (adapter test) and a failing row set (database test) replace them (BR41.9) | none needed |
| N24 | Staged data policy (open from the design review) | changed | BR41.7, BR41.8 (starter-only, deleted after commit, 7 days) | policy and expiry tests |
| N25 | Pending-request context used by the parent screens (notification-context) | kept | BR40.2 and U3's swap list | existing screen tests |
| N26 | Delivery guarantee labels `at_least_once` and `provider_idempotent` on the old status (notification service) | dropped | no provider exists; delivery is simulated and labelled so | reason recorded |
| N27 | Row flag `changed` (import row) | kept | BR41.3 (computed by the classification) | classification test |

Risks recorded: the staged payload is personal data and relies on the policy test of BR41.7; the reminder tick is lazy (no scheduler locally) and runs when the server, the reminders screen, the seed or housekeeping calls it; event notices share the existing list's timing and provider labels, a known cosmetic limit (BR40.2); the archive sheets' content stays in the old workbook (answer Q6).
