# Performance Test Instructions: IPv6 coverage of the stack exposure check

No performance requirement applies beyond NFR3: each probe keeps the existing 1500 ms timeout and the number of probes grows only with the number of IPv6 addresses (a few per machine). There is no load or benchmark test for this change. The measured duration of the unit-scoped command (about 0.1 s for 32 tests) is reported in `test-results.md`.
