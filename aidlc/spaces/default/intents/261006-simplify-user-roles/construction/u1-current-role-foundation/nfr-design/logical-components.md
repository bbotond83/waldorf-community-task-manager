# U1 Logical Security Components

## Component Inventory and Ownership

This is an embedded slice of the existing application, consistent with [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md), [security-requirements.md](../nfr-requirements/security-requirements.md), [functional-spec.md](../functional-design/functional-spec.md) and [contract-summary.md](../../../inception/contract-design/contract-summary.md). Logical ownership remains the shared domain catalogue; no new independently deployed process or database product is proposed.

| Existing component / internal responsibility | Pattern | Shared resource and failure domain | Blast radius and isolation |
| --- | --- | --- | --- |
| Access / current role and permission evaluation | Exhaustive allowlist and grant-local scope checks (SD1) | Current policy definitions used by existing consumers | Policy changes affect four roles; parity tests cover domain/application/runtime and intended persistence. Invalid input denies its request. |
| Access / grant transaction and converter | Locked atomic state changes (SD2) | Grant rows, subject versions and redacted evidence | A conversion transaction may cover all legacy grants; any failure rolls all back. Normal protected mutation locks its organization authority and related versions. |
| Access / evidence writer and persistence adapter | Allowlisted restricted append (SD3) | Transaction-bound evidence, existing history | Evidence failure prevents conversion commit; no sensitive successful fallback. Historical rows remain untouched. |
| Runtime / profile and session resolver | Current identifiers, signature/version validation (SD4) | Existing signed local cookie and current profile/grant state | Stale subject cannot render protected content. Production unavailability stays isolated from synthetic authority. |
| Application / authorization/result/navigation adapter | Explicit no-data failure envelope (SD1/SD4) | Current policy matrix and current version port | Invalidated/denied request cannot reach protected provider; consumers retain established localized states. |
| Existing persistence migration artifact | Transactional constraint/policy replacement (SD1/SD2/SD3) | Current relational baseline, no live linked database | Privileged offline artifact needs supported schema; unsupported rows/issuers block. Fixture proof cannot establish target RLS. |
| Existing verification tools | Layer tests and integrated delivery gates (SD5) | Shared executable and test manifests | Unit changes remain serial; final coverage/build/browser/security checks span all Units. |

## Interaction and Infrastructure Handoff

Web/session input -> Runtime current resolver -> Application scoped policy -> Access decision -> existing permitted provider. Grant conversion -> Access transaction -> adapter-owned grants/version/evidence/enforcement -> commit or complete rollback. There are no circular dependencies or external retry loops in this slice. U2 consumes current access for read-only projection/routes; U3 consumes current policy/conversion fixtures for retained workflows. They do not write Access state directly.

Infrastructure Design must preserve this transaction/privilege/evidence boundary and the existing executable. U1 needs migration artifacts and test adapters rather than a new cloud resource, endpoint, broker, cache, monitoring stack or independently deployed library. Production linkage, live migration, database backup/promotion and real-target verification remain outside current execution authorization; app rollback alone never reverses converted grants or restores obsolete permission semantics.

## Sources and Status

Concrete controls are SD1–SD5 in security-design.md; traceability.json maps all 11 detailed NFRs. These are design dependencies and required verification, not implementation, provisioned resources or measured results. Preserve ports, English technical names, Hungarian copy, history and local-only next-env.d.ts.
