# Performance Requirements: U3 Directory, settings and coordination

Targets on the owner's machine with the local stack running. Source: confirmed answers Q1 and Q2 in `nfr-requirements-questions.md`, NFR4 of the requirements, and the functional rules BR31.2, BR31.3, BR31.11, BR32.5 and BR33.3.

| ID | Requirement | Target | Check |
|---|---|---|---|
| NFR4.6 | Parent task list and task detail (`duty.list`, `duty.get`), the admin lists and the teacher schedule, each on the 150-family data set | 300 ms typical, reported; a run fails above 1500 ms | Database function time on the 150-family, 300-task, 1500-assignment data set in the database tests, and one browser check of the parent task list page (rendered page time, same data set, reported only) |
| NFR4.7 | Actions: sign-up, swap request and answer, cancellation request, approval decision, record and task saves, settings save | 500 ms typical, reported; a run fails above 1500 ms | Timing lines in the database tests |
| NFR4.8 | The dashboard counts and the lifecycle list on the 150-family data set | 500 ms typical, reported; fails above 1500 ms | Timing lines |
| NFR4.9 | The access checks of U2 (NFR4.2) still hold after the placeholder-table rewrite | The 200 ms ceiling of U2 NFR4.2 stays; the U2 timing test is re-run | The U2 database timing test, re-run |

Reported targets are shown in the run output and in the unit checkpoint report; only the 1500 ms ceilings and U2's inherited ceilings fail a run. The sign-in budget of 5000 ms (NFR4) is unchanged.
