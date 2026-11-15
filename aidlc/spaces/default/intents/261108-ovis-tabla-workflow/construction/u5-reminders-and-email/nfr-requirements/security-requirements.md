# Security Requirements: u5-reminders-and-email

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR1, NFR3, NFR4, NFR10 and NFR11 in `requirements.md`, contracts C1, C2, C8, C9 and C16 in `contract-summary.md`, ADR-006 and ADR-007, `technology-stack.md`, and the answers in `nfr-requirements-questions.md` (Q1). Contains no names or contact details.

## Authentication

Sign-in and sessions do not change. The daily run, the claim step and the outcome step are reached only by the server's own service access, never by a signed-in or anonymous session. The timed command reads its service credential from the environment and never from the repository.

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.1 | `timed_checks_run_system`, the email claim and the outcome record are granted to the service role only and deny every other caller, super admins included (BR51.7, BR52.1). | The catalogue test lists each function's grants; "out of reach" tests as a parent, teacher, coordinator and super admin. |
| NFR3.2 | `notice_send` is callable only inside the database by feature functions, not by a signed-in session directly, and checks that every named parent belongs to the caller's community (BR50.1). | A test calls it directly as a parent and as a super admin and is refused; a test names a parent of another community and gets no notice. |
| NFR3.3 | The delivery-problems list and Try again are super admin only; coordinators get a denied refusal, never an empty list (BR54.1, BR54.3). | The fixed-list "out of reach" test for each role. |
| NFR3.4 | A parent reads and marks read only their own notices; another parent's or a missing notice gives the same denied result (BR50.5). | "Out of reach" test with two parents, comparing the two results. |
| NFR3.5 | Rights revoked while signed in apply at the next request: a deactivated account sees no notices and its queued emails are cancelled at claim (BR51.2). | A test deactivates the account with an email queued and finds it cancelled, with no address returned. |
| NFR3.6 | Every new function starts with `revoke all` and an explicit `grant execute`, pins its search path, and grants no table write right; signed-in accounts keep read-only table rights. | The catalogue test lists each function's grants and search path. |
| NFR3.7 | The notice kind, notice target and timed-check registries are written only by migration files; no function or role can add a row at run time, and a registered name is used only as a quoted identifier when a facts function is called. | A test tries to insert as each role and is refused; a test registers a name containing a quote and finds no injection. |
| NFR3.9 | The facts functions and the check functions are not executable by signed-in or anonymous roles; the database calls them as its own owner, and a facts function checks that the reading parent may see the item. | The NFR3.6 catalogue test lists their grants; a direct call as a parent is refused. |
| NFR3.8 | `verification/authorization-matrix.json`, `role-policy.ts`, `authorization.ts` and navigation change together when the screen moves to super admins only, and every role is walked through the screen. | Evidence is in the Unit's test results before merge. |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.1 | The seed, fixtures and tests use invented people and invented addresses only, each added to `scripts/verification/privacy-allowlist.json`. | Secret scanning and the privacy check stay green. |
| NFR1.2 | No table stores an email address, an email's text or a mail server's reply. The address is returned by the claim for that send only (BR51.2, ADR-007). | A test dumps every new table after a send and finds no address or text. |
| NFR1.3 | The delivery-problems screen and its list function return no address, parent name or family name (BR54.2). | A test lists failures for an email that failed and searches the result for each. |
| NFR1.4 | Event lines for a failed send carry opaque ids and an error class, never an address or the mail server's text. | A test fails the mailer and reads the emitted line. |
| NFR1.5 | Email records and their tries are deleted 90 days after they finish; daily-run and check records 30 days after the run; by the daily run's own housekeeping check (answer Q1). Notices are not affected. | A housekeeping test ages each kind past its limit and finds it gone; a younger one stays. |
| NFR1.6 | Removal deletes the parent's notices, emails and tries and marks the family's reminder recipients removed (BR56.1, NFR11). It takes the delivery row locks in ascending id. An email already handed to the mail server is accepted as unavoidable: it may arrive once, names no other person (NFR10.1), and its late outcome is ignored because its row is gone (BR51.5). No later email is sent. | Tests for parent and family removal, one with a claim held: the rows are gone, the late outcome changes nothing, and no second send happens. |
| NFR1.7 | The mail adapter drops error text (NFR7.11), and the retention step is the registered check `housekeeping`, which relies on once keys and job state only, never on run or check records, so pruning cannot cause a resend. A failed email is pruned 90 days after its last try even if never retried. | A test prunes records and runs the daily checks again and finds no new notice. |

## Email

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR10.1 | An email holds the notice title, the item name, its date, a link and the automatic-email line, and no other person's or family's name or contact details (BR55.1, BR55.2). | An integration test reads each email in the local mail catcher and searches for another family's details. |
| NFR10.2 | Every email has one recipient, and no copy or hidden copy. | The same test reads the headers. |
| NFR10.3 | The link is built from the app's public address and opens only after sign-in; it carries no token and no personal data. | A test reads the link and opens it signed out. |
| NFR10.4 | Every facts function added by a later unit is covered by a shared test that checks its output for another person's or family's data. | The shared test runs over every registered target type. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.1 | Try again writes no audit event, as today; daily runs are recorded in the run and check tables, not the audit log (see observability-requirements.md). | A test finds no audit event after either. |

## Threat Considerations

| Threat | Control |
|---|---|
| A parent or coordinator starts a run or claims emails | Service role only (NFR3.1) |
| A feature names parents of another community to read their notices | `notice_send` checks the community (NFR3.2) |
| An email leaks another family's details through an item name | Facts functions return only the item's own facts, with a shared test (NFR10.4) |
| Addresses pile up in logs or tables | Never stored or logged (NFR1.2, NFR1.4) |
| A registry name is steered into a different function | Registries are migration-only and names are quoted (NFR3.7) |
| Emails are sent to a removed or deactivated person | Claim cancels and returns no address (NFR3.5, NFR1.6) |
