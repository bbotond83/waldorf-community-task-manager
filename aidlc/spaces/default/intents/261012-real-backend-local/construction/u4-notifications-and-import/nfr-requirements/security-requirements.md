# Security Requirements: U4 Notifications and Excel import

Source: NFR1 of the requirements, rules BR40.1 to BR40.9 and BR41.1 to BR41.13, U2's and U3's security requirements, and the design review.

| ID | Requirement | Check |
|---|---|---|
| NFR1.43 | A parent reads and marks only their own notifications; other parents, teachers, admins and signed-out requests get none of them, and an admin cannot read a parent's notification list (BR40.2, BR40.3) | A policy test per role over the table and `notification_list` and `notification_mark_read` |
| NFR1.44 | Only the super admin who started an import run can read or delete its staged rows; no other super admin, admin, parent, teacher, the service-role key or a signed-out request (BR41.7) | A role matrix test over `ImportStagedRow` and every import function, including a second super admin |
| NFR1.45 | Only super admins can use any import function; group admins, teachers and parents are denied and see nothing of runs (BR41.1) | Role tests per function |
| NFR1.46 | The import history (runs, rows, conflicts) and the conflict list hold no names, emails, phone numbers or notes: row labels and reasons come from a closed list (BR41.4, entities) | A leftover search over the history tables after an import with fictitious personal values, and a shape test of the conflict list |
| NFR1.47 | Staged rows are deleted after commit, recovery, cancel and expiry, and at most 7 days after upload (BR41.8) | Expiry test with a controllable clock and a search of the staged table after each path |
| NFR1.48 | The uploaded workbook is treated as hostile: read as bytes, never a path; formulas not evaluated, macros never run; size and row limits checked from the file's own directory before expansion; text cells starting with =, + or @ refused except phone cells; cells over 10000 characters refused (BR41.2) | Tests with a zip-bomb-style file, a formula cell, an over-long cell, a '+36' phone and a malformed file; the parser never runs in the browser (bundle test) |
| NFR1.49 | The xlsx library is one exactly pinned version that passes the dependency audit (high and critical block); it is imported only by server code; the bundle scan proves it is not in client output | Dependency audit, bundle test (extends U2's) |
| NFR1.50 | The real workbook is never read: no code path reads `source-materials/`, tests use generated fictitious workbooks only, and the privacy scan fails if a workbook with personal data is tracked (BR41.11, FR11.1) | A path-guard test and the existing privacy scan |
| NFR1.51 | Every U4 function is security definer, pins its search path, is not executable by anon, checks its caller as the callers paragraph of the rules says and is on the elevated-function catalogue (BR42.4); the system-caller functions accept only the system caller or the stated members | U2's catalogue test and a caller test per function |
| NFR1.52 | The service-role key gets no table rights on any U4 table and may execute only the functions the callers paragraph names for the system caller | U2's privilege test, extended |
| NFR1.53 | Cross-organization isolation: no U4 function reads or returns another organization's notifications, jobs, runs or staged rows | Two-organization tests per function |
| NFR1.54 | The commit cannot overwrite newer edits or create duplicates: every row is re-matched inside the transaction and a changed match applies nothing (BR41.6) | Tests that change, add and archive a record between preview and commit |
| NFR1.55 | Personal data stays out of logs and the single audit event: `import.commit` carries counts and the run id only (U1 BR3.2); no names, emails or file contents | Output scan with fake personal data for every server action and an audit-details shape test |
| NFR1.56 | The lifecycle (U3 BR35) removes the family's notifications and reminder recipients with no personal link left | U3's completeness search extended to the U4 tables |
| NFR1.57 | Notification titles and links are built from ids and fixed Hungarian text; user-entered text (task titles, names) is escaped on screen; a hostile task title cannot inject markup into the list | A markup-injection test on the notification list and the reminders list |

Threat considerations: reading another parent's notices (NFR1.43), reading or tampering with staged personal data (NFR1.44, NFR1.47), hostile workbooks (NFR1.48, NFR1.49), real personal data entering the repository (NFR1.50), forged or racing commits (NFR1.54, NFR3.14).
