# Intent Backlog

## Prioritization Basis

This delivery backlog derives from the corrected [intent statement](../intent-capture/intent-statement.md), [feasibility assessment](../feasibility/feasibility-assessment.md), and [constraint register](../feasibility/constraint-register.md). Product capabilities remain governed by the approved `260729-feature` scope and backlog; the items below are delivery-layer proto-units only. [intent] [feasibility] [constraints] [prior-backlog]

## Must-Have Proto-Units

| ID | Proto-unit | Value | Dependencies | Sequence | Source |
|---|---|---|---|---|---|
| PB-01 | Next.js runtime and local configuration foundation | Makes the repository installable, developable, buildable, and startable as a web app. | Existing package and TypeScript baseline | 1 | [Q1] [Q2] |
| PB-02 | Application composition and synthetic local adapters | Connects existing domain ports to a reproducible privacy-safe runtime. | PB-01, existing `src/` contracts | 1 | [Q1] [Q2] [constraints] |
| PB-03 | Shared role-aware Hungarian application shell | Establishes navigation, layout, authentication context, responsive behavior, and common states. | PB-01, PB-02 | 2 | [Q2] [Q3] |
| PB-04 | Parent experience surfaces and critical responsibility workflow | Makes the approved parent journey locally testable. | PB-02, PB-03 | 3 | [prior-backlog] [Q2] |
| PB-05 | Read-only staff schedule surface | Makes the approved staff visibility boundary locally testable. | PB-02, PB-03 | 3 | [prior-backlog] [Q2] |
| PB-06 | Administrator operations and approval surfaces | Makes the approved administrative coordination journey locally testable. | PB-02, PB-03 | 3 | [prior-backlog] [Q2] |
| PB-07 | Browser, accessibility, build/start, and coverage verification | Produces the evidence required before deployment activation. | PB-01–PB-06 | 4 | [Q2] [Q5] |
| PB-08 | Local-run documentation and environment example | Makes setup reproducible for the requester and future contributors. | PB-01–PB-07 | 4 | [Q2] [Q5] |

## Should-Have Proto-Units

| ID | Proto-unit | Value | Dependencies | Sequence | Source |
|---|---|---|---|---|---|
| PB-09 | Secondary inherited workflow and edge-state coverage | Broadens fidelity beyond the critical acceptance paths. | PB-04–PB-06 | After critical flows | [prior-backlog] |
| PB-10 | Visual refinement against the approved design system | Improves consistency after functional and accessibility correctness. | PB-03–PB-06 | After critical flows | [Q4] |

## Explicit Non-Backlog

The prior product's approved capabilities are specifications consumed by these delivery units, not candidates to be redesigned. Product deferrals remain unchanged: native apps, SMS/WhatsApp, payments, automatic rotation, new ongoing completion tracking, live Excel synchronization, and unrelated integrations. [intent] [prior-backlog]

## Dependency Topology

`PB-01 → PB-02 → PB-03 → {PB-04, PB-05, PB-06} → PB-07 → PB-08`

`PB-09` and `PB-10` follow the critical role surfaces and cannot displace the Must-Have path. [Q3] [Q4]

## Value Stream

`Runnable foundation → domain composition → shared role shell → parent/staff/admin acceptance surfaces → verified local application → documented handoff`

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [feasibility] `../feasibility/feasibility-assessment.md`
- [constraints] `../feasibility/constraint-register.md`
- [prior-backlog] `../../../260729-feature/ideation/scope-definition/intent-backlog.md`
- [Q1]–[Q5] `scope-definition-questions.md`
