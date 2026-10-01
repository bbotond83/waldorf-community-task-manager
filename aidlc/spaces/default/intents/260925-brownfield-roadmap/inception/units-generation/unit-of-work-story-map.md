# Unit of Work Story Map

## Story Availability

No `stories.md` was produced because User Stories is skipped in this scope. The requirements analysis defines FR1-FR4, so this map assigns every functional requirement directly to its implementing planning Unit. These are document-planning assignments, not application implementation commitments.

## Functional Requirement Mapping

| Requirement | Outcome | Unit ID | Construction directory |
|---|---|---|---|
| FR1 — Describe the current project | Evidence-backed project baseline | U1 | `u1-project-baseline` |
| FR2 — Assess archived AI-DLC artifacts | Archive inventory and evidence comparison | U2 | `u2-archive-assessment` |
| FR3 — Recommend shared intake and separate delivery paths | Future workflow recommendation | U3 | `u3-workflow-recommendation` |
| FR4 — Prioritize candidate work transparently | Future workflow recommendation and relative scoring method | U3 | `u3-workflow-recommendation` |

## Non-Functional Requirement Coverage

| Requirement | Applicable Unit(s) | Coverage |
|---|---|---|
| NFR1 — Evidence traceability | U1, U2, U3 | Cite evidence paths; label unsupported, historical, or unverified claims |
| NFR2 — Privacy and integration boundaries | U1, U2, U3 | No real family/child data or production calls; do not claim an integration is verified without real-target evidence |
| NFR3 — Preserve the planning boundary | U1, U2, U3 | No application changes, production connections, deployment, archive rewriting, or implementation authorization |
| NFR4 — Carry current project quality gates into the recommendation | U3 | Record the applicable quality checks as future gates, not as completed verification |
| NFR5 — Production-readiness accuracy | U1, U3 | Keep persistence, authentication, provider/scheduler, and deployment boundaries explicit and unlinked pending evidence |

## Work Order Within Each Unit

- **U1:** Inspect current source and project rules; map user-facing areas and module boundaries; establish runtime and integration status; record verification setup and evidence limitations.
- **U2:** Inventory both archived intent records; distinguish authored decision artifacts from generated records; select material claims; compare each with U1 and current rules; classify and cite discrepancies.
- **U3:** Define shared intake; define feature and bug-fix paths; apply the approved scoring formula and tie/uncertainty rules; carry project gates and scope limits into the recommendation.

## Coverage Verification

- All four functional requirements are assigned to at least one Unit.
- Every Unit has at least one functional requirement assignment.
- No user-story IDs are expected or invented for this scope.
- The dependency order is U1 -> U2 -> U3; the requirements-to-Unit mapping agrees with the dependency artifact.
