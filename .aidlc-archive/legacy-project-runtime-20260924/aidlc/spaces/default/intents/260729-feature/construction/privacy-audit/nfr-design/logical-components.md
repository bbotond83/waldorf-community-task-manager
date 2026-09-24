# Logical Components

## Components

- **Data-policy service** evaluates role, retention, grace-period, and hold rules.
- **Lifecycle runner** executes resumable deletion and anonymization batches.
- **Audit writer** validates allowlisted event metadata and applies redaction before persistence.
- **Audit and lifecycle projection** serves authorized, scoped search and operational status views.

## Operational Interfaces

The hold registry records the reason category, actor, and expiry/review marker without copying sensitive source material. Metrics expose backlog, job age, audit-write failures, and retention completions; all summaries remain redacted.

Sources: `../nfr-requirements/tech-stack-decisions.md`; `../nfr-requirements/reliability-requirements.md`; `../functional-design/business-logic-model.md`.
