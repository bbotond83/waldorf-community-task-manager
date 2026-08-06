# Security Design

## Protected Evidence

Only Super Admin and Kindergarten Admin roles can view audit or lifecycle administration projections. Audit writes accept an allowlisted event schema and redaction function; raw phone numbers, message content, optional profile free text, and sensitive cancellation or swap reasons are rejected from audit payloads.

## Retention Enforcement

Lifecycle commands enforce the configured grace period and block deletion under a recorded legal or operational hold. Data access remains role- and scope-checked during archival and anonymization, with administrative interventions producing redacted immutable audit events.

Sources: `../nfr-requirements/security-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
