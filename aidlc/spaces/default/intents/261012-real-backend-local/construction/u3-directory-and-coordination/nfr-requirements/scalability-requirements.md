# Scalability Requirements: U3 Directory, settings and coordination

Source: confirmed answers Q2, Q3 and Q4, NFR3 of the requirements.

| ID | Requirement | Check |
|---|---|---|
| NFR3.5 | The unit handles up to 150 families, 10 groups, 300 tasks per school year and 1500 assignments in total without tuning | A database test loads this data set and runs the list, schedule and dashboard functions, timings reported against NFR4.6 to NFR4.8 |
| NFR3.6 | The tables have the indexes the policies and functions need: memberships by family and by group, parents by family and by account, assignments by task, by family and by status, tasks by group and start time, change requests by assignment and by status, events by group and time | A catalogue test lists the indexes and compares them with the expected list |
| NFR3.7 | Concurrency: 20 parallel sign-ups for 5 places end with exactly 5 places taken and no family with two places; a two-browser test shows the second parent the first parent's sign-up | A database race test on every build and a browser test (BR31.3) |
| NFR3.8 | Two parallel swap exchanges touching the same assignment never exchange it twice and never deadlock; every writer that updates several tasks (swap exchange, family archive, task cancellation, lifecycle) locks tasks in ascending task-id order (BR31.4) | A two-connection test with crossing swaps and a crossing archive-versus-swap test |
| NFR3.11 | Two parallel attempts to link the same account to a parent, or two parents to the same account, end with exactly one link (BR30.3) | A two-connection race test |
| NFR3.9 | Tests stay independent of each other and of run order; each worker uses its own schema and creates the families, tasks and people it needs (U1, U2) | The shuffled run and the parallel-worker run are kept in the unit's checks |
| NFR3.10 | Removed assignments and closed requests stay with the family and are removed by the lifecycle only; no separate cleanup job exists (answer Q3) | A lifecycle test checks that they are deleted or anonymized with the family and that no other function removes them |

Load beyond the stated size is out of scope; no load test beyond NFR3.5's local check.
