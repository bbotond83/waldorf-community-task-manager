# Risk and Sequencing Rationale

## Heuristic

Walking-skeleton-first validates the authorization, data, route, and UI path before features. Subsequent ordering is a risk/value hybrid: volatile assignment/reminder and operational-admin paths precede migration and lifecycle operations, while independent branches may parallelize after stable foundations.

## Risks

- Authorization/privacy failure: mitigate in Bolt 1 and 3 with negative tests.
- Reminder/retry reliability: mitigate in Bolt 2 with durable-job drills.
- Workbook identity/recovery: mitigate in Bolt 4 with fixtures and rollback drill.
- Retention/audit errors: mitigate in Bolt 5 with lifecycle scenarios.
