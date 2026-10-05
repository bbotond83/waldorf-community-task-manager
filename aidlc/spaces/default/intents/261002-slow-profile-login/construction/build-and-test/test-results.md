# Build and Test results

## Execution environment

Apple M4 Pro, macOS Darwin27.0.0, Node24.21.0/npm11, Chromium151.0.7922.34. Synthetic fixture version waldorf-local-v1. Production build prepared before timing. Commands used supported Node24 PATH. No sources or upstream reviewed artifacts were corrected in this stage.

## Executed checks

| Check | Passed | Failed | Skipped | Evidence |
|---|---:|---:|---:|---|
| Domain coverage tests |128|0|0|evidence/coverage.log|
| Delivery coverage tests |411|0|0|evidence/coverage.log|
| Focused runtime unit command |23|0|0|evidence/unit.log|
| Focused route/shell integration command |15|0|0|evidence/integration.log|
| Dedicated performance browser cases |10|0|0|evidence/login-performance-report.json|
| Existing focused browser critical flow |9|0|0|Console result:9 passed15.6s across Chromium/Firefox/mobile; full suite also retained|
| Full existing browser suite |96|0|0|evidence/browser.log|

The focused23+15 tests are included in411 delivery tests; the focused9 browser tests are included in the full browser suite. They must not be added again to aggregate counts. Ten performance cases each contain two required samples, totaling20 required individually passing timings. Some setup selections are also asserted, without replacing required samples.

## Quality and coverage

Synthetic build, strict typecheck, lint, formatting, deterministic startup smoke and privacy/secrets/SAST/no-deploy/dependency scans passed with exit0. Audit:zero vulnerabilities. Domain coverage93.51% lines/85.16% branches/90.67% functions. Delivery94.19% lines/80.17% branches/92.30% functions. All80% floors remain enforced. Raw logs under evidence/.

## Performance and retained concerns

Development first313.5–351.9ms, switches107.5–163.3ms; production first59.6–99.8ms, switches46.4–67.5ms. Every sample <=5000ms. Timing measures real submit/POST/redirect/home ready state, with fresh development cache/process/context per profile and fresh built-server process/context. See evidence/login-measurements.md and JSON for all20. Boundary tests reject5001/nonfinite/negative values.

The original reported slowdown remains unreproduced (accepted Code Generation R-01). Production baseline cache metadata is inaccurate in its upstream JSON (accepted R-02); actual prebuilt production preparation is documented here and in test instructions. Generated next-env.d.ts imports remain changed from development type output to production type output and are omitted from the upstream manifest; the upstream summary's clean-diff statement is inaccurate (accepted R-03). These are retained open findings, not fixed in this stage. No performance speedup or production integration verification is claimed.

## Target Verification Matrix

See build-and-test-summary.md for the complete finalized source inventory and per-target evidence. All eight target rows are finalized Met. Full existing browser suite passed96 cases with0fail0skip; evidence/browser.log. Aggregate645 distinct executable cases passed (128domain+411delivery+96existing browser+10performance), excluding repeat focused executions.
