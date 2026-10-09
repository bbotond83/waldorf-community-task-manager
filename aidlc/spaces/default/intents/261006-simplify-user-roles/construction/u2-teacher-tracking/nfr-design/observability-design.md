# Teacher Tracking Observability Design

## Safe Diagnostics

NFR1.28: use existing shared authorization audit/result correlation; emit only established controlled actor/scope identifiers, safe operation and outcome classification. Never attach raw source records, display names, credentials/cookies, financial/allergen/contact sentinels or raw query strings to diagnostics. Error details remain server-safe; browser receives existing localized presentation code. Do not invent successful read audit events or deploy a telemetry platform where the shared port does not support them.

## Verification Provenance

NFR2.26: retain actual command/result/threshold/fixture mode/tested-SHA evidence. Separately label static intended SQL, synthetic runtime, actual local DB and real target RLS checks. Unlinked target remains outstanding. Private SBOM/archive/checksum evidence remains explicitly unsigned with existing 14-day policy. No new dashboard, sampling/retention/alert policy or availability SLI is designed; CI reports and safe local diagnostics remain the evidence surfaces.

## Sources

[performance-requirements.md](../nfr-requirements/performance-requirements.md), [security-requirements.md](../nfr-requirements/security-requirements.md), [scalability-requirements.md](../nfr-requirements/scalability-requirements.md), [reliability-requirements.md](../nfr-requirements/reliability-requirements.md), [observability-requirements.md](../nfr-requirements/observability-requirements.md), [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md), [functional-spec.md](../functional-design/functional-spec.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md).

