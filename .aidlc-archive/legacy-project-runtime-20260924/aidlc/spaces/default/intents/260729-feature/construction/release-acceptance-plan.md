# Executable Release Acceptance Plan

## Fixed Test Profile

Use a seeded 30-family fixture with linked parents, group boundaries, active/archive school years, assignments, swaps, cancellations, imports, notifications, and lifecycle candidates. Execute Chrome, Safari, Firefox, mobile Safari, and mobile Chrome checks at representative mobile and desktop widths; record Pass/Fail evidence, build ID, tester, timestamp, and defect link.

## Required Release Evidence

- Run role × resource × field allow/deny cases through UI and direct API, including group-admin cross-scope denial, staff display-name-only views, contacts, reasons, optional fields, and audit history.
- Run invitation/expiry/resend/setup, login upcoming-duty notice, notification-centre read/link, task/signup/swap/cancellation decisions, contribution ownership, allergen visibility, queues/filters, and school-year archive/history journeys.
- Run keyboard and screen-reader checks for each core parent/admin flow; capture automated accessibility, API/route, and mobile responsive results.
- Measure protected reads p95 ≤500 ms, mutations p95 ≤1 second, core visible flow ≤2 seconds, monthly availability ≥99.5%, and failed-import recovery from declared start to verified restoration ≤1 hour.
- Run optional-profile consent/withdrawal, immutable preview/blocked commit, staged-publish failure, changed-row, rollback reconciliation, reminder threshold/DST/provider-acknowledgement, and final lifecycle eligibility-race drills.

## Production Gate

Production remains blocked until the controller, lawful-basis confirmation, EU provider configuration and DPAs, alert owner/backup escalation, and all required evidence above are recorded and approved.
