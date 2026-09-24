# Security Design

## Staging Controls

Only authorized administrators can create, view, resolve, or commit an import. The server validates file type and size, parses content in an isolated worker, and stores the import and source hash with the administrator's scope. Preview endpoints reveal only scoped normalized records and conflict fields.

## Commit Controls

The commit command rechecks authorization and validates the immutable preview version. Source files and transient row values follow the retention policy; audit events contain import IDs, counts, and redacted summaries rather than raw workbook contents or contact values.

Sources: `../nfr-requirements/security-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
