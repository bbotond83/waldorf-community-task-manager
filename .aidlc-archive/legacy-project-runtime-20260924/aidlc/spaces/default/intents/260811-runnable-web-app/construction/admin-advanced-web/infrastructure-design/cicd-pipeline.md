# Administrator Advanced Web CI Design

## Sources

Implements [performance design](../../nfr-design/performance-design.md), [security design](../../nfr-design/security-design.md), [logical components](../../nfr-design/logical-components.md), Application Design [components](../../../../inception/application-design/components.md) and [services](../../../../inception/application-design/services.md), and [business logic](../../functional-design/business-logic-model.md).

## Checks

Run strict type checking, ESLint, Prettier, focused route/component/façade tests, and the 80% line/branch/function coverage gate. Exercise every import step plus malformed/missing-sheet/fingerprint/conflict/stale/duplicate/interrupted/recovery cases; reminder status/retry classification/idempotency; governance authority/last-admin/self-lockout/stale/next-request-revocation; lifecycle eligible/blocked/stale/duplicate/dependency outcomes; recipient/settings validation; role/scope/field/direct-request negatives; XSS/redaction/secret scans; Chromium/Firefox/mobile Playwright; axe, keyboard, focus, zoom, touch targets; two-second measurements; production build and deterministic start smoke.

## Merge and Evidence Boundary

All checks pass before merge and evidence references requirement, story, matrix, fixture, scenario, and synthetic-mode identifiers. High/critical dependency and SAST findings block delivery. Real Supabase transactions/RLS/session invalidation, scheduled jobs, provider delivery/idempotency, Safari desktop/mobile, and hosted targets remain `OUTSTANDING`. No deploy job or target secret is added.
