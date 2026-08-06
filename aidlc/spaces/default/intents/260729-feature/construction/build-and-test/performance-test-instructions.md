# Performance Test Instructions

## Test Profile

Use the approved 30-family fixture and named parent/admin/API flows from `construction/release-acceptance-plan.md`. Measure protected reads, mutations, visible core-flow completion, notification queue delay, and import recovery using production-like EU-hosted development infrastructure.

## Thresholds

Protected reads target p95 at or below 500 ms, mutations p95 at or below one second, and core visible flows at or below two seconds. Notification dispatch delay must stay within 60 seconds at normal load; failed-import recovery is measured from declared recovery start to verified restoration and must complete within one hour.

Sources: `../parent-experience/code-generation/code-generation-plan.md`; `../admin-experience/code-generation/code-summary.md`; `../import-migration/code-generation/code-summary.md`.
