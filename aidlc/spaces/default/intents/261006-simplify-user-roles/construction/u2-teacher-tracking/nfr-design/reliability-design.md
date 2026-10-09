# Teacher Tracking Reliability Design

## Existing Outcome Mapping

NFR1.29 and NFR2.25 preserve the ApplicationResult envelope. The following identifiers are observed in src/application/results.ts, facade-pipeline.ts, authorization.ts and staff-facade.ts; logical tracking state validation-error maps to the existing envelope state validation.

| Outcome | Envelope state and result code | Presentation | Focus / announcement | Action and data |
| --- | --- | --- | --- | --- |
| List success | success / SUCCESS | APP-SUCCESS | #fo-tartalom / polite | entries allowlist only |
| Detail success | success / SCHEDULE_ENTRY_READY | APP-SUCCESS | #fo-tartalom / polite | one allowlisted entry |
| Authorized empty list | empty / EMPTY | APP-EMPTY | #fo-tartalom / polite | clear filters; no data or create action |
| Invalid filter | validation / VALIDATION_FAILED; range field VAL-DATE-RANGE | APP-VALIDATION | #hibajelzes / assertive | labeled correction; no data |
| Scope/absent-detail denial | denied / AUTHORIZATION_DENIED | APP-DENIED | #hozzaferes-megtagadva / assertive | generic panel; no data |
| Invalid session mode | denied / INVALID_SESSION_MODE | APP-DENIED | #hozzaferes-megtagadva / assertive | existing session recovery; no data |
| Stale authorization | invalidated / AUTHORIZATION_VERSION_STALE | APP-INVALIDATED | #fo-tartalom / assertive | current selection/sign-in recovery; no data |
| Source invalidation | invalidated / STATE_INVALIDATED | APP-INVALIDATED | #fo-tartalom / assertive | safe recovery; no data |
| Retryable dependency | dependency-failure-retryable / DEPENDENCY_RETRYABLE | APP-DEPENDENCY-RETRYABLE | #fo-tartalom / assertive | user retry with safe filters and existing retry metadata; no data |
| Unexpected/malformed dependency | dependency-failure-terminal / UNEXPECTED_DEPENDENCY_FAILURE | APP-DEPENDENCY-TERMINAL | #fo-tartalom / assertive | later guidance; no data |
| Unsupported detail recovery outcome | dependency-failure-terminal / SCHEDULE_RECOVERY_UNAVAILABLE | APP-DEPENDENCY-TERMINAL | #fo-tartalom / assertive | later guidance; no data |

Current empty detail passthrough must normalize to generic denial because no entry exists in its authorized result. A success with zero entries must normalize to empty before rendering. Preserve the existing codes above; do not expose another wrapper or a new task status state machine. Session-layer redirects occur before protected rendering. Any unsupported outcome becomes a no-data terminal error.

## Resilience and Data Integrity

NFR1.29: failures/loading discard prior projection. Source mismatch denies without partial rows; malformed source or unclassified thrown error is terminal. Existing synthetic classifier identifies explicitly retryable/terminal scenario failures; no automatic retry, deadline, circuit breaker or successful fallback is added to an in-process port. Retry starts a new authorization/read.

NFR1.30: reads/failed reads/denied writes cannot change groups, tasks or assignments. Source update capability is a separately held test/operator handle, never part of teacher read port. Query and refetch preserve existing schedule ids, group ids and dates. U2 adds no durable store, backup requirement or event history. Real target recovery is outstanding.

## Sources

[performance-requirements.md](../nfr-requirements/performance-requirements.md), [security-requirements.md](../nfr-requirements/security-requirements.md), [scalability-requirements.md](../nfr-requirements/scalability-requirements.md), [reliability-requirements.md](../nfr-requirements/reliability-requirements.md), [observability-requirements.md](../nfr-requirements/observability-requirements.md), [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md), [functional-spec.md](../functional-design/functional-spec.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md).

Bounded source evidence: src/application/results.ts, facade-pipeline.ts, authorization.ts, staff-facade.ts, validation.ts and src/staff-web/synthetic-staff.ts. Existing paths are evidence; future teacher filenames are implementation-plan choices.

