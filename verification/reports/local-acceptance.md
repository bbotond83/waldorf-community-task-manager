# Local Acceptance Report

- Git SHA: `71a3b5f8d74be036b10571690e439d865fb5d664`
- Fixture: `waldorf-local-v1`
- Manifest: `waldorf-scenarios-v1` (SHA-256 `261ffedec4261ac5754e0c965d70a9a58c0ec126c5d92f9618178f1b3ad116be`)
- Generated from evidence completed at: `2026-10-01T08:13:45.144Z`
- Results: 33 PASS, 0 FAIL, 6 OUTSTANDING

| Scenario | Target | Result | Tool | Artifact |
|---|---|---|---|---|
| LOCAL-AUTH-CONTRACT | local | PASS | `npm run verify:manifests` | `.verification/logs/manifests.log` |
| LOCAL-FRESH-START | local | PASS | `npm run smoke:start` | `.verification/logs/smoke.log` |
| LOCAL-SYNTHETIC-IDENTITY | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-ROLE-SHELL | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-PARENT-DUTIES | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-PARENT-REQUESTS | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-PARENT-NOTIFICATIONS | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-PARENT-A11Y-RECOVERY | local | PASS | `npm run test:a11y` | `.verification/logs/browser.log` |
| LOCAL-INVITATION-AUTH | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-EVENT-NOTES | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-STAFF-SCHEDULE | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-ADMIN-RECORDS | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-ADMIN-ARCHIVE | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-ADMIN-TASKS | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-ADMIN-ASSIGNMENTS | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-ADMIN-APPROVAL | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-IMPORT | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-REMINDER-MONITORING | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-PRIVACY-LIFECYCLE | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-GOVERNANCE-REVOCATION | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| LOCAL-SHARED-VALIDATION | local | PASS | `npm test` | `.verification/logs/tests.log` |
| LOCAL-SECURITY-PRIVACY | local | PASS | `npm run verify:security` | `.verification/logs/security.log` |
| LOCAL-QUALITY-BROWSER | local | PASS | `npm run verify:local` | `.verification/logs/aggregate.log` |
| LOCAL-HANDOFF-NO-DEPLOY | local | PASS | `npm run verify:no-deploy` | `.verification/logs/security.log` |
| NFR08-INVITATION-EXPIRY-RESEND | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| NFR08-UPCOMING-DUTY | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| NFR08-NOTIFICATION-CENTRE | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| NFR08-QUEUES-FILTERS | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| NFR08-SCHOOL-YEAR-ARCHIVE | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| NFR08-ROLE-RESOURCE-FIELD-PARITY | local | PASS | `npm run verify:manifests` | `.verification/logs/manifests.log` |
| NFR08-IMPORT | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| NFR08-REMINDERS | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| NFR08-LIFECYCLE-RECOVERY | local | PASS | `npm run test:browser` | `.verification/logs/browser.log` |
| SAFARI-DESKTOP-SMOKE | linked-target | OUTSTANDING | `manual Safari runbook` | `.verification/logs/outstanding.log` |
| SAFARI-MOBILE-SMOKE | linked-target | OUTSTANDING | `manual mobile Safari runbook` | `.verification/logs/outstanding.log` |
| TARGET-SUPABASE-AUTH-RLS | linked-target | OUTSTANDING | `future linked-target suite` | `.verification/logs/outstanding.log` |
| TARGET-SUPABASE-PERSISTENCE | linked-target | OUTSTANDING | `future linked-target suite` | `.verification/logs/outstanding.log` |
| TARGET-SCHEDULER-PROVIDER | linked-target | OUTSTANDING | `future linked-target suite` | `.verification/logs/outstanding.log` |
| TARGET-VERCEL-PREVIEW-STAGING | linked-target | OUTSTANDING | `future approved deployment workflow` | `.verification/logs/outstanding.log` |
