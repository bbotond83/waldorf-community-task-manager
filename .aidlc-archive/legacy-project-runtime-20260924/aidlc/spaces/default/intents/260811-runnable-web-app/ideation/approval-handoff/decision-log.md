# Ideation Decision Log

## Confirmed Decisions

| ID | Decision | Rationale | Source |
|---|---|---|---|
| D-01 | `260729-feature` is the authoritative product/design baseline. | The user corrected the prior demo interpretation. | [Q1] [intent] |
| D-02 | This intent implements only the missing runnable web/application delivery layer. | Prevents product redesign and closes the actual acceptance gap. | [Q1] [scope] |
| D-03 | Preserve Next.js modular monolith, Vercel, Supabase, domain modules, and privacy/authorization boundaries. | These choices were already approved and remain feasible. | [feasibility] [constraints] |
| D-04 | Deliver role-aware parent, read-only staff, and scoped administrator surfaces. | A single task page would not represent the approved application. | [scope] [wireframes] |
| D-05 | Use development-only synthetic identity selection and privacy-safe local data. | Enables reproducible local tests without real personal data. | [wireframes] [constraints] |
| D-06 | Sequence through a dependency-first walking skeleton. | Proves runtime, composition, role boundary, build/start, and browser viability before expansion. | [backlog] [feasibility] |
| D-07 | Require type, coverage, production build, start smoke, browser, accessibility, security, and dependency checks before deployment activation. | Matches affirmed practices and pre-deployment purpose. | [constraints] [backlog] |
| D-08 | Carry unresolved mockup-review details into Inception by reference to prior artifacts. | Avoids repeating settled design interviews while preserving review findings. | [wireframes] [Q4] |
| D-09 | Skip new market research and team formation. | No market, staffing, or ownership change is introduced. | [Q5] [Q6] |

## Superseded Decisions

| Decision | Superseded by | Reason |
|---|---|---|
| Build only a seeded in-memory task-board demonstration. | D-01, D-02, D-04 | It contradicted the user's intended inherited application baseline. |

## Open Delivery Evidence

- Exact mapping of inherited requirements/stories/designs to runnable routes and critical tests. [D-08]
- Local Supabase/adaptor strategy and explicit boundary between simulated local validation and real-target verification. [constraints]
- Complete administrator role-to-route matrix and staff schedule field visibility, resolved from prior access/design artifacts. [wireframes]

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [stakeholders] `../intent-capture/stakeholder-map.md`
- [feasibility] `../feasibility/feasibility-assessment.md`
- [constraints] `../feasibility/constraint-register.md`
- [scope] `../scope-definition/scope-document.md`
- [backlog] `../scope-definition/intent-backlog.md`
- [wireframes] `../rough-mockups/wireframes.md`
- [Q1]–[Q6] `approval-handoff-questions.md`
