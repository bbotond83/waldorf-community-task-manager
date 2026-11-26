# Observability Requirements: u14-removal-and-anonymisation

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR4 and NFR11 in `requirements.md`, contract C16 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

There is no hosted monitoring in this work (`team.md`, Deployment). What an administrator needs to see is the audit trail and the flags.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.3 | The audit row of every removal and later run lets a super admin see afterwards what happened: the subject id, the outcome, and the cleared and flagged counts per step. | A test reads the audit row and checks every step is listed. |
| NFR4.4 | Flags left by a removal stay visible on their own screens (flagged duties, library, to-do list, recurring duties) until handled, and the result page shows only the items flagged because of this removal (design review R-07). | A test with a leaving family and a removed family shows only the removed family's items on its result page. |
| NFR4.5 | An unexpected database error during removal is logged by the server with the operation name and a code, never with a name or a note, and the screen shows the general error state. | A test forces an error and checks the log line and the page. |
