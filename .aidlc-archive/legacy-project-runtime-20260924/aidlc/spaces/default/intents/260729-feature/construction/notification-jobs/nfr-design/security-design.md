# Security Design

## Data Boundaries

Jobs persist recipient and template references rather than email addresses or rendered content. The worker resolves contact data only while invoking the approved EU-compliant email adapter. Provider responses, message bodies, raw addresses, and sensitive task context are excluded from logs and audit events.

## Access Controls

Scheduler and worker credentials are server-only and authenticated. Delivery-status APIs return redacted, scope-filtered projections to authorized administrators; normal parents and read-only staff cannot inspect another family's delivery history. Dead-letter actions require the same administrative scope and emit a redacted audit event.

Sources: `../nfr-requirements/security-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
