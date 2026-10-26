# Performance Test Instructions: Audit purge isolation

No separate performance suite. The performance property of this change (NFR3: one purge call deletes at most 5000 rows) is checked functionally by `tests/database/audit-purge.test.ts` (5001 aged rows give 5000, then 1). The existing housekeeping timing test (`runs within 5 seconds on a data set of 300 accounts`) in `tests/database/identity-housekeeping.test.ts` still runs and passes. A timing measurement of a very large backlog is not planned; the cap exists so that no single call has to be that large.
