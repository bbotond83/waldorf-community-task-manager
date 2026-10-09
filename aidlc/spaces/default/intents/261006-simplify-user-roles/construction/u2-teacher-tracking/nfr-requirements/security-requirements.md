# Teacher Tracking Security Requirements

## Authentication and Authorization

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| NFR1.22 | Resolve current active teacher grants and authorization version for every list/detail/retry; require matching organization and group before source access. | No-grant, wrong-group, cross-organization, revoked/inactive and stale-session cases expose no records/names/counts; a source spy records zero calls for pre-query denial. |
| NFR1.23 | Teacher requests cannot mutate schedule, task, assignment, approval, import or governance state. | UI has no mutation controls; forged direct commands independently deny and preserve before/after data through shared U1 enforcement. |
| NFR1.24 | Explicit field projection is identical in table/cards/detail and excludes sourceRecordId, organization metadata, finance, allergens, private contact and unrelated fields. | Inject extra sensitive sentinel fields and wrong-scope rows; verify absence in result/HTML/hidden markup and no partial success for mismatched scope. |
| NFR1.25 | Bookmark redirects use fixed same-origin successors, one encoded id segment and whitelisted validated group/date context; destination reauthorizes. | Test unknown/host/return parameters, malformed/ambiguous context, encoded separators and unauthorized groups. No cookie creation or protected data in compatibility response. |
| NFR1.26 | Source display strings and filter inputs remain untrusted; preserve contextual text/URL escaping and safe error envelopes. | Malicious title/name/status/id sentinels do not create executable markup, inject a destination or reveal stack/raw records. |

## Data Protection and Threats

Names and assignments are confidential application data. Credentials/session material are restricted; financial, allergen and private contact fields remain excluded even when present upstream. U2 adds no durable store, telemetry provider, retention policy or legal compliance certification. Retain existing secret/session/transport controls; production target checks remain outstanding.

| Threat | Control and test |
| --- | --- |
| Spoofing/elevation | Current session and scoped grants, direct mutation denial; NFR1.22/23 |
| Tampering | Strict filters and source scope/shape validation; NFR1.24/25/26 |
| Information disclosure | Allowlist and generic no-data outcomes; NFR1.24/26 |
| Repudiation | Shared existing authorization audit and safe diagnostic identifiers; observability NFR1.28 |
| Resource exhaustion | Bounded date/group query and explicit user retry; NFR2.22 |

No new legal framework, policy period, residency mandate or external audit claim is inferred from generic reference guides.

## Quality and Release Dependencies

NFR2.23: Blocking lint, strict typecheck, unit/integration tests, production coverage at least 80% for lines/branches/functions, build, deterministic start smoke, critical browser flow, secret/SAST/dependency scanning are retained. High/critical security findings and serious/critical automated accessibility violations block delivery. Current reports are authoritative. Real DB/RLS validation is distinct from synthetic/static policy evidence.

Functional Design review gaps require a concrete source/fixture mapping, update seam and existing result/presentation/focus mapping before implementation. NFR Design must provide those details without changing reviewed behavior; declared component ownership resolves to KindergartenTeacherTracking. U1's mixed-organization administration finding remains an independent before-release obligation for U3.

## Sources

[functional-spec.md](../functional-design/functional-spec.md), [rules.md](../functional-design/rules.md), [requirements.md](../../../inception/requirements-analysis/requirements.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md), [technology-stack.md](../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

