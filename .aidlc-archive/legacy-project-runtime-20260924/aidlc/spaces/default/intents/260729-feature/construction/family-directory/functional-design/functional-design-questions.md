# Family Directory Functional Design Questions

## Q1 — Family Relationship Updates

How should parent/child/family link changes be handled?

- A. Authorized scoped admins change links transactionally; affected visibility recalculates immediately and audits redact details. *(Recommended)*
- B. Permit asynchronous reconciliation only.
- C. Allow every linked parent to change every relationship.
- X. Other (please specify)

[Answer]: A — Authorized scoped admins change links transactionally; affected visibility recalculates immediately and audits redact details.
