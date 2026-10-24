# Performance Requirements: U4 Notifications and Excel import

Targets on the owner's machine with the local stack running. Source: confirmed answers Q1 and Q2 in `nfr-requirements-questions.md`, NFR4 of the requirements, and the functional rules BR40.2, BR40.6, BR41.2, BR41.3, BR41.6.

| ID | Requirement | Target | Check |
|---|---|---|---|
| NFR4.10 | Upload with preview (limits, parse, match, classify, stage) of a fictitious 2000-row workbook | 10 s typical, reported; a run fails above 60 s | Timing line in the import database test and one browser timing check |
| NFR4.16 | The maximum accepted workbook (5 MB, 20000 rows) and a zip-bomb-style file: the parser and the checks finish, or refuse the file, within the 60 s ceiling and without exhausting memory; the hostile file is refused from its directory before expansion (NFR1.48) | Reported time for the maximum workbook; a run fails above 60 s | A test on the zip-bomb and 20000-row cases |
| NFR4.11 | Commit of the same workbook (re-match, apply through U3's save functions, history, audit, staged-row deletion) | 15 s typical, reported; a run fails above 60 s | Timing line in the import database test |
| NFR4.12 | Notification list, mark as read, the reminders list and the import status on the 3000-notification, 300-task data set | 300 ms typical, reported; a run fails above 1500 ms | Timing lines in the database tests |
| NFR4.13 | The lazy reminder tick (`reminder_run_due`) on 600 due jobs | 2 s typical, reported; a run fails above 10 s; it must not slow the notification list above NFR4.12 | Timing line |
| NFR4.14 | U3's use cases with the notification writes added | Stay within U3's NFR4.7 targets (500 ms typical, 1500 ms ceiling) | U3's timing test re-run |
| NFR4.15 | U2's access-check overhead after U4's tables and policies | The 200 ms ceiling of U2 NFR4.2 stays | U2's timing test re-run |

Reported targets are shown in the run output and in the unit checkpoint report; only the stated ceilings fail a run.
