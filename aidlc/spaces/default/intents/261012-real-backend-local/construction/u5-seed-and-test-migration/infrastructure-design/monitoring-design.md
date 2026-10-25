# Monitoring Design: U5 Seed and test migration

The environment is local, so monitoring means result lines and tests, not dashboards. U5 follows the pattern of `db:worker` (one result line with a duration) and of U2 to U4 (expected failures are result codes; unexpected ones are logged once with an event code and no personal data).

## Metrics and KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Small seed duration | The result line of `db:seed` and its timing test | 60 s, the test fails above it (NFR4.17) | Developers wait for it before every test run |
| Reset duration | The result line of `db:reset` and its timing test | 30 s, fails above it (NFR4.17) | Same |
| 30-family seed duration | The result line of `db:seed:large` and its timing test | 120 s, fails above it (NFR4.18) | Demonstration set |
| Sign-in time on seeded data | The new sign-in timing test | 5000 ms, fails above it (NFR4.19) | Existing login budget |
| Browser suite duration | The verification report | Reported only, estimate 30 to 40 minutes (NFR4.20) | Plans the CI job time limit |
| Coverage | `npm run test:coverage` | 80% lines, branches, functions (NFR2.28) | Team floor |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| Seed or reset refused | The guard sees a non-loopback address or a database that is not the local stack | Blocking | The command's plain refusal line, the developer |
| Seed failed | A failure inside the seed transaction; nothing is written (NFR3.19) | Blocking | A result line with an event code, no personal data |
| Timing limit exceeded | A timing test above its limit | Blocking in the verification chain | The test report |
| Synthetic leftover | The deletion test finds a removed name or route | Blocking | The test report |
| Audit purge missed | The clock-controlled purge test fails | Blocking | The test report |

## SLIs and SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| Seed repeatability (a second seed changes nothing) | 100% of runs | Every verification run |
| Failed seed leaves no data | 100% of injected failures | Every verification run |
| Three browser runs in a row without interference | 3 of 3 green | Before the unit completes |
| Seed, reset and sign-in within their limits | 100% of timing tests | Every verification run |

## Logs and tracing

Seed, reset and the timing tests print one line per run: the command, the outcome (success, refusal or failure with an event code), the duration, and the target. They print no passwords, no keys and no personal data (NFR6.29); a scan of the output with fictitious values proves it. No tracing is added. Unexpected failures are logged once with an event code through the existing tooling error path of `scripts/db/common.ts`.
