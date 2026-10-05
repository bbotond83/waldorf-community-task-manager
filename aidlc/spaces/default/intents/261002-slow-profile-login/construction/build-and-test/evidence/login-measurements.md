# Build and Test login measurements

## Individual samples

| Runtime | Profile | First ms | Switch ms | Result |
|---|---|---:|---:|---|
| development | parent-local | 333.9 | 157.3 | PASS |
| development | staff-local | 319.1 | 107.5 | PASS |
| development | group-admin-local | 313.5 | 112.6 | PASS |
| development | kindergarten-admin-local | 351.9 | 163.3 | PASS |
| development | super-admin-local | 347.8 | 137.9 | PASS |
| production | parent-local | 62.1 | 50.7 | PASS |
| production | staff-local | 59.6 | 46.4 | PASS |
| production | group-admin-local | 65.8 | 56.9 | PASS |
| production | kindergarten-admin-local | 81.7 | 67.5 | PASS |
| production | super-admin-local | 99.8 | 66.7 | PASS |

## Preparation

Fresh supported Node24 processes and browser contexts per profile. Development uses unique empty dedicated output; production uses the prebuilt synthetic bundle. Timing begins at browser submit and ends at correct greeting and usable role navigation. Every sample is evaluated individually. No reset/session warming, no retries. Raw timings and server output are in login-performance-report.json.
