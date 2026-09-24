# Verification Handoff Shared Infrastructure

## Sources

Derived from [security design](../../nfr-design/security-design.md) and Application Design [components](../../../../inception/application-design/components.md) and [services](../../../../inception/application-design/services.md). The unit consumes outputs from every production-code unit without owning their runtime behavior.

## Shared Contracts

Owns the fixture/profile/scenario manifest, authorization matrix, sensitive-field dictionary, evidence schema/aggregator, common browser fixtures, privacy scans, aggregate npm commands, environment example, fresh-checkout runbook, and local-versus-outstanding report. Production units supply public routes, façade contracts, test seams, and requirement/story mappings; they do not write arbitrary evidence status.

## Ownership and Isolation

Verification helpers may select synthetic profiles, reset deterministic state, observe public application results, and collect safe artifacts only when the validated synthetic runtime is active. They cannot import private repositories/adapters to force outcomes, bypass authorization, embed secrets/personal data, or activate in production composition. No external shared infrastructure is created and no deployment occurs.
