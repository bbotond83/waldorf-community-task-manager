# Staff Web CI Design

## Sources

Implements [performance design](../../nfr-design/performance-design.md), [security design](../../nfr-design/security-design.md), [logical components](../../nfr-design/logical-components.md), Application Design [components](../../../../inception/application-design/components.md) and [services](../../../../inception/application-design/services.md), and [business logic](../../functional-design/business-logic-model.md).

## Checks

Run strict type checking, ESLint, Prettier, unit/integration tests, and the repository-wide 80% line/branch/function coverage gate. Staff browser checks cover list/filter/detail, loading/empty/retryable/terminal/denied states, permitted and forbidden group/row/field/direct requests, next-request revocation, redaction, Chromium/Firefox/mobile behavior, axe, keyboard, focus, 200% zoom/card layout, touch targets, and the two-second fixture target. Production build and deterministic local start smoke are mandatory.

## Boundary

Synthetic authorization and data evidence is labelled as local. Supabase RLS, real persistence, Safari desktop/mobile, and hosted-target evidence remain explicitly outstanding until linked and executed. Secret scanning, SAST, and dependency scanning block high and critical findings. The pipeline contains no deployment job.
