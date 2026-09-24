# Risk and Sequencing Rationale

## Evidence Base

The rationale uses approved [requirements](../requirements-analysis/requirements.md), [stories](../user-stories/stories.md), [mockups](../refined-mockups/mockups.md), [components](../application-design/components.md), [units](../units-generation/unit-of-work.md), [DAG](../units-generation/unit-of-work-dependency.md), [story map](../units-generation/unit-of-work-story-map.md), and [team practices](../practices-discovery/team-practices.md).

## Heuristic

Hybrid walking-skeleton-first plus lightweight WSJF. Scores use `(user/business value + time criticality + risk reduction) / relative size`, each numerator factor 1–5 and size 1–5. Scores explain the economic path but never override dependencies.

| Bolt | Value | Time | Risk reduction | Size | Score | Rationale |
|---|---:|---:|---:|---:|---:|---|
| 1 Skeleton | 5 | 5 | 5 | 5 | 3.0 | proves the missing browser/composition/build boundary and unlocks all UI work |
| 2 Staff | 3 | 3 | 4 | 2 | 5.0 | small privacy boundary with high negative-test value; parallel-safe after skeleton |
| 3 Admin Core | 5 | 4 | 5 | 5 | 2.8 | unlocks advanced admin and proves the largest everyday operational surface |
| 4 Admin Advanced | 4 | 3 | 5 | 5 | 2.4 | contains import/recovery/revocation/lifecycle risk but depends on admin core |
| 5 Verification | 5 | 5 | 5 | 4 | 3.75 | aggregates acceptance only after complete surfaces exist |

## Risk Treatment

- **Architecture/composition risk:** Bolt 1 proves actual Next.js integration rather than extending prose.
- **Authorization/privacy risk:** every Bolt includes positive/negative field/route/action cases; Bolts 2–4 deepen role-specific coverage.
- **Scope-loss risk:** story manifest and inherited story mapping gate Bolt 5.
- **Recovery/idempotency risk:** Bolt 4 exercises import, job, approval, revocation, and lifecycle terminal/retry states.
- **False release claim:** Bolt 5 separates synthetic PASS from linked-target OUTSTANDING and verifies no deployment.

## Dependency Compliance

Bolt 1 bundles the foundation and its first consumer into a walking skeleton. Bolts 2 and 3 depend only on Bolt 1 and can run concurrently. Bolt 4 follows Bolt 3. Bolt 5 follows all. No dependency is violated and no topological edge is reversed.

