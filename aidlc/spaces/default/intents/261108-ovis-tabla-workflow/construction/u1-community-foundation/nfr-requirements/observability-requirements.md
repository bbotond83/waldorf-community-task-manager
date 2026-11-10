# Observability Requirements: u1-community-foundation

Sources: NFR4 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1 in `contract-summary.md`, and `technology-stack.md`. The app runs only on the owner's computer, so no monitoring, alerting or SLO applies yet.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.3 | Past audit events stay readable after the structure change, and the audit action list keeps `import.commit` (BR7.1). | A test applies the change over an audit row of each kind. |
| NFR4.4 | An audit event about a working group's item carries that group, so its administrator can read it; an event about a family or a community-wide item carries none, so only super admins can. | Audit read tests for both cases. |
| NFR4.5 | A failed read or refusal shows the existing error or denied state, never the "Még nincs munkacsoport." empty state. | A browser or component test covers each state. |
