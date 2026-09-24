# Performance Design

## Administrative Workflows

Administrative lists use indexed, scope-filtered server queries with pagination and explicit filters rather than loading all families, tasks, or audit records into the browser. Commands such as role changes, imports, and task edits return promptly and delegate longer work to their domain jobs, keeping core admin screens visible within two seconds.

## Verification

Exercise dashboard, family search, assignment maintenance, import launch, and audit search under the 30-family MVP profile. Capture protected-read p95, command p95, render-ready time, and error rates; protected reads target 500 ms p95 and mutations one second p95.

Sources: `../nfr-requirements/performance-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
