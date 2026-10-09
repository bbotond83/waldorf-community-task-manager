# Teacher Tracking Scalability Design

## Request Isolation

NFR1.27: pass immutable current session/scope and validated range into the read boundary. Return a fresh immutable projection per request; no actor-specific state is kept in shared renderers. Runtime may share the synthetic repository, while tests create an isolated repository per case and independently control data updates. Interleaved actor/group reads prove no data reuse or authority bleed.

## Deployment and Capacity

NFR2.24: retain one application process and existing composition/provider boundaries. No cache tier, queue, partition, autoscaler, cloud resource or new durable store is introduced. A 31-day range and one group bound requests; no measured throughput/record capacity is claimed. Existing source scanning of the tiny synthetic fixture is adequate for local behavior only. A production adapter later needs separately approved target capacity and bounded indexed reads; production remains unavailable here. No new recurring resource cost is forecast.

## Sources

[performance-requirements.md](../nfr-requirements/performance-requirements.md), [security-requirements.md](../nfr-requirements/security-requirements.md), [scalability-requirements.md](../nfr-requirements/scalability-requirements.md), [reliability-requirements.md](../nfr-requirements/reliability-requirements.md), [observability-requirements.md](../nfr-requirements/observability-requirements.md), [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md), [functional-spec.md](../functional-design/functional-spec.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md).

