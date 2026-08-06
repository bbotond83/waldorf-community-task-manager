# Reliability Design

## Idempotent Lifecycle

Every deletion or anonymization batch records a durable lifecycle state and can be safely retried after interruption. The sequence removes contact and consent-based data first, then anonymizes historical references, retaining only the minimal archived history allowed by policy. Holds pause the sequence without silently skipping the candidate.

## Audit Durability

Audit events are written transactionally with the protected action where feasible; failed secondary audit writes create an operational alert rather than a raw-data fallback. Retention and lifecycle failures are visible to authorized administrators through redacted status, preserving accountability without exposing the affected data.

Sources: `../nfr-requirements/reliability-requirements.md`; `../nfr-requirements/security-requirements.md`; `../functional-design/business-logic-model.md`.
