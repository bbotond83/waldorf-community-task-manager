# Performance Test Instructions: Worker local-only guard

No performance suite. The guard adds one read-only identity query per `db:worker` run. The worker timing tests in `tests/database/worker.test.ts` (setup targets of 10 s) still run and pass.
