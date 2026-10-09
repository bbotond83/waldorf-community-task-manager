# Teacher Tracking Infrastructure Specification

## Deployment

| Facet | Choice | Rationale |
| --- | --- | --- |
| Compute model | Existing single Next application and process-local synthetic provider | NFR2.24; no new service or compute provisioned |
| Networking topology | Existing local HTTP/browser boundary; no new ingress/egress/VPC/subnet | Teacher redirects are fixed same origin; production remains unlinked |
| Storage strategy | Existing synthetic source repository injected at current adapter seam | NFR1.21/27/30; no durable tracking store |
| Environments | Local and existing CI executable; staging/production target unavailable | Real integration evidence must remain outstanding |
| IaC approach | No new IaC or infrastructure configuration | Existing deployment disabled until linked |
| Resource sizing | Existing local/CI execution resources, no new sizing or capacity commitment | Synthetic fixture volume is functional evidence only |

## Infrastructure Services

| Service | Role | Configuration | Notes |
| --- | --- | --- | --- |
| Existing application | Compute and browser rendering | Retain existing runtime/toolchain | NFR3.21; no topology change |
| Synthetic schedule repository | In-process source boundary | Isolated fixture copy; read port injected; separate test/operator update handle | No durable service; NFR2.22/24 and NFR1.27/30 |
| Intended existing SQL/RLS | Access enforcement | No U2 provisioning, adapter or real target changes | U1 owns policy; static tests cannot prove real enforcement |
| New cache/queue/search/CDN/DNS/load balancer | None | Not added | Current reads and no new SLA do not require these services |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
| --- | --- | --- | --- |
| Current grants/session/version policy | U1 | U2, U3 | Current scoped authorization before protected reads |
| Existing app composition and CI | Shared existing project | U1, U2, U3 | Provider injection and unchanged blocking pipeline |
| Teacher source/projection contract | U2 | U3 scenarios/cleanup | Read-only allowlist; no teacher write capability |

NFR1.22–26 and NFR1.29 are application enforcement configurations rather than new cloud resources. Keep existing secret/session/CSP controls. No operational cost estimate for unprovisioned resources is invented; there is no new recurring service design. U3's administration defect fix remains separate before release.

## Sources

[performance-design.md](../nfr-design/performance-design.md), [security-design.md](../nfr-design/security-design.md), [scalability-design.md](../nfr-design/scalability-design.md), [reliability-design.md](../nfr-design/reliability-design.md), [observability-design.md](../nfr-design/observability-design.md), [logical-components.md](../nfr-design/logical-components.md), [components.md](../../../inception/domain-design/components.md), [functional-spec.md](../functional-design/functional-spec.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md).

