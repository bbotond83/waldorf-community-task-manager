# Scalability Requirements: U4 Notifications and Excel import

Source: confirmed answers Q2, NFR3 of the requirements.

| ID | Requirement | Check |
|---|---|---|
| NFR3.12 | The unit handles a workbook of up to 5 MB and 20000 rows, 3000 notifications and 300 tasks with two reminder jobs each without tuning | A database test loads this data set (generator extended from U3's) and runs the list, tick, preview and commit functions; timings reported against NFR4.10 to NFR4.13 |
| NFR3.13 | The tables have the indexes the policies and functions need: notifications by parent and created time, by dedupe key, by task; reminder jobs by task and threshold (unique live job), by status and scheduled time; recipients by job and family; import runs by starter and status; import rows and conflicts by run; staged rows by run | A catalogue test lists the indexes and compares them with the expected list |
| NFR3.14 | Concurrency: two sign-ups at the same time create exactly one notice per parent and cause; two ticks at the same time record one attempt per due job; two super admins previewing at the same time get separate runs, and the same super admin previewing twice at the same time ends with exactly one open run (the earlier one cancelled); a double click on commit commits once | Two-connection race tests |
| NFR3.15 | The commit holds family and task locks in ascending id order, so it cannot deadlock with U3's sign-ups, swaps or archive running at the same time (U3 NFR3.8) | A two-connection test: commit against a crossing swap and an archive |
| NFR3.16 | Tests stay independent of each other and of run order; each worker has its own schema and creates the people, tasks and workbooks it needs (U1 to U3) | The shuffled run and the parallel-worker run |
| NFR3.17 | Import history grows by one run plus its rows and conflicts per upload; staged rows never outlive 7 days; notifications and jobs stay with the family until the lifecycle removes them (U3 NFR3.10 extended) | Expiry and lifecycle tests |

Load beyond the stated size is out of scope; no load test beyond NFR3.12's local check.
