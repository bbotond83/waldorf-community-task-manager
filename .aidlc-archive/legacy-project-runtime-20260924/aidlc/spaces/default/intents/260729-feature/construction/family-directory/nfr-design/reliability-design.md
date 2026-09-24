# Reliability Design

## Integrity

Relationship mutations use one transaction with constraints and audit write; failed writes roll back links and relevance projections together. Backups and audited change IDs support repair.

Sources: `../nfr-requirements/reliability-requirements.md`; `../functional-design/business-logic-model.md`.
