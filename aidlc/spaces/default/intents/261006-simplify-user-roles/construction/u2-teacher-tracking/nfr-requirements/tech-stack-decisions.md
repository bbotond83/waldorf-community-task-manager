# Teacher Tracking Technology Decisions

## Decisions

| ID | Decision | Rationale and constraints |
| --- | --- | --- |
| NFR3.21 | Retain existing strict TypeScript, single Next/React app, module ports and constructor injection. | Brownfield change; no new package/service or production adapter. Read installed framework documentation before code. Source scan versions are historical evidence; lockfile/installed packages govern implementation. |
| NFR3.22 | Use English teacher module/route names and Hungarian Óvónő UI; retain Budapest date presentation and 44rem responsive parity. | Current naming and usability requirements; same projected fields and explicit absence text in table/cards/detail. |
| NFR3.23 | Preserve native keyboard/filter behavior and existing focus/announcement result mapping; resolve mappings explicitly before code. | Critical browser flow must have zero serious/critical automated accessibility violations plus keyboard checks. No new interaction library. |
| NFR2.27 | Retain affirmed test-after ordering and existing Node/Vitest/Playwright/Axe/coverage and CI tools. | Implement each testable layer, then its tests before advancing. Keep production inventory current; no lowered gate. |

## Backend and Infrastructure Boundary

Intended SQL policy exists; linked backend/SDK/production teacher adapter remains unavailable. Process-local synthetic runtime proves local behavior only. Preserve disabled executable deployment until linked, tested-SHA provenance, immutable promotion/rollback and manual production approval. No stack upgrade or dependency install is authorized by this design.

## Sources

[functional-spec.md](../functional-design/functional-spec.md), [rules.md](../functional-design/rules.md), [requirements.md](../../../inception/requirements-analysis/requirements.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md), [technology-stack.md](../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

