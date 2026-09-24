# Admin Core CI Design

## Sources

Implements [performance design](../../nfr-design/performance-design.md), [security design](../../nfr-design/security-design.md), [logical components](../../nfr-design/logical-components.md), Application Design [components](../../../../inception/application-design/components.md)/[services](../../../../inception/application-design/services.md), and [business logic](../../functional-design/business-logic-model.md).

## Checks

Type/lint/format, focused route/component tests, façade integration, table-driven role/scope/field negatives, approval seven outcomes, duplicate/idempotency, responsive keyboard/focus/zoom, Playwright Chromium/Firefox/mobile, axe, two-second fixture measurement, coverage, and redaction/security scans.

## Merge Gate

All checks pass before squash merge. Evidence references story/requirement/matrix/fixture/scenario IDs. No deploy job or target secret is added.

