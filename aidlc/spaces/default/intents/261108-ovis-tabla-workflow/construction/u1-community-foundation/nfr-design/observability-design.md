# Observability Design: u1-community-foundation

How `observability-requirements.md` is met, following `functional-spec.md`, `tech-stack-decisions.md` and C1 in `contract-summary.md`. The app runs only on the owner's computer, so the audit log is the only observability this Unit needs. Metrics, tracing and alerting wait for the hosting work.

## Design

| Requirement | Design |
|---|---|
| NFR4.3 | The audit table is not touched by the clean start, and its action list keeps `import.commit`. A test checks a row of each kind survives. |
| NFR4.4 | `identity_scope_group` and the command functions set the audit group from the item: its working group, or empty for a family or community-wide item. The existing admin audit policy then gives the right readers. |
| NFR4.5 | The working-group page handles success, empty, denied and error as separate states, as the other list pages do. |
