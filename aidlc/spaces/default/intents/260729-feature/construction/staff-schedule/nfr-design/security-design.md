# Security Design

## Scoped Projection

Every schedule query uses the authenticated actor's role and authorized kindergarten/group scope before fetching data. Read-only staff receive the relevant group schedule projection only, while contact fields, optional profiles, private notes, and unrelated groups are excluded at the server and RLS layers.

## Mutation Guardrails

Schedule changes pass domain authorization and transactional validation before persistence. The UI never treats hidden fields as authorization, and blocked requests return a generic response without revealing another family's assignment details. Sensitive edits emit redacted audit events.

Sources: `../nfr-requirements/security-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
