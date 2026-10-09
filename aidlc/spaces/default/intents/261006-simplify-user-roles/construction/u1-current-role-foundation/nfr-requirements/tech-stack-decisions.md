# U1 Technology Decisions

## Existing Stack Retained

Use the repository's existing locked stack described by [technology-stack.md](../../../../../codekb/waldorf-community-task-manager/technology-stack.md): TypeScript strict ESM, Node 24/npm 11, current Next.js/React runtime, Zod boundary validation, existing Node/Vitest test tooling, existing relational migration artifacts and injected synthetic persistence. Dependency versions remain lockfile-derived; this stage neither upgrades nor installs packages. No SDK, database product, broker, distributed cache, signer or independently deployed service is needed for this Unit.

| Decision | Rationale and boundary |
| --- | --- |
| Existing TypeScript ports and explicit results | Current module ownership and expected failure modeling remain testable without framework dependencies in the domain. |
| Existing relational migration mechanism | Populated conversion, evidence and enforcement need one transaction; a new dedicated migration extends the baseline while preserving its historical original. |
| Snapshot transaction for fixtures; real persistence transaction for database artifact | Independent repository saves cannot establish rollback; adapters must prove their own semantics. Fixture evidence does not establish database correctness. |
| Existing current-version/session boundary | Reject missing or stale authoritative state and retain cookie/form safeguards. No new auth provider or profile alias. |
| Existing test/build/browser/security tools | Affirmed quality thresholds remain; unavailable executable targets remain pending evidence. |

These decisions implement [functional-spec.md](../functional-design/functional-spec.md), [rules.md](../functional-design/rules.md), [requirements.md](../../../inception/requirements-analysis/requirements.md) and [contract-summary.md](../../../inception/contract-design/contract-summary.md). Read installed framework documentation before writing framework code. The initial migration's incomplete activity/display schema does not justify invented active-state columns or broad raw teacher table access.

## Alternatives and Tradeoffs

Retaining existing boundaries avoids a second permission source or new infrastructure. A transaction port is a necessary adapter capability, not a deployment change. Dual-writing old/new roles or accepting aliases would retain legacy authorization and conflict with explicit current-role rejection and fresh recovery. Deleting duplicate grant rows would lose history, so deduplicate only effective access. A permissive migration fallback would obscure unsupported schemas, so block and preserve originals.

## Handoff and Evidence Limits

NFR1.1–6 govern security/transaction controls; NFR2.1–3 preserve current quality gates; NFR3.1–2 govern maintainability/localized recovery. All are specified in security-requirements.md and mapped in traceability.json. No code, tests, database execution or deployment occurred. Production remains unlinked; private CI evidence stays unsigned.
