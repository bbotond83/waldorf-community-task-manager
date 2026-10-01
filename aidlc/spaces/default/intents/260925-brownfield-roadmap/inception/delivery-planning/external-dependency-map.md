# External Dependency Map

## Dependency Boundary

A Bolt normally means one build pass over a piece of work, ending in something that runs; here the two Bolts are proposed document delivery slices. The owner confirmed that local repository/archive evidence and owner review are sufficient for this discovery pass. No additional external API, data window, stakeholder response, or external-team handoff blocks this plan.

Family/staff input remains required before implementation of every future user-facing feature. That later gate is distinct from completing the current discovery recommendation.

## Prerequisites and Fallbacks

| Input or decision | Owner | Availability/lead time | Consumer | If unavailable or delayed |
|---|---|---|---|---|
| Local source, project rules, and recorded CodeKB | Project owner maintains repository; AI checks evidence | Local evidence; no external lead time committed | B1 / U1 | Identify missing source and confidence limits; do not assert unsupported current facts |
| Preserved archive and completed U1 baseline | Project owner maintains archive; AI inventories/compares | U1 must precede U2; no duration estimate | B1 / U2 | Record unavailable artifacts or evidence gaps; ask owner if a blocking conclusion requires more local evidence |
| Combined B1 review | Project owner | At package completion; no response-time commitment | B2 / U3 | Hold dependent recommendation conclusions pending owner review |
| Reviewed U1 and U2 evidence, current quality rules | Project owner approves; AI drafts recommendation | After B1; no external handoff | B2 / U3 | Resolve contradictions or retain explicit uncertainty; never silently drop gates |
| Final recommendation review | Project owner | At B2 completion; no deadline committed | Later work selection | Retain the draft for review; do not infer approval or select a feature/defect |

These are internal document prerequisites and reviews. There are no independent Units available for parallel delivery.

## Later Dependencies to Preserve in the Recommendation

Before implementing a user-facing feature, obtain affected-parent/staff input; the owner remains accountable for scope and priority. Before a bug fix, establish a reproducible case and a regression check. Neither later prerequisite requires contacting anyone or executing application checks in this planning pass.

Persistence, production authentication, provider/scheduler delivery, and deployment remain unlinked pending separately approved real-target verification. Potential providers or target owners, access dates, and lead times are not known and are not invented here. Any later integration or release plan must identify those dependencies and retain manual production approval and the prior immutable deployment as rollback target under current practices.

## Sources

- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/requirements-analysis/requirements.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/units-generation/unit-of-work.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/units-generation/unit-of-work-dependency.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/units-generation/unit-of-work-story-map.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/delivery-planning/delivery-planning-questions.md` — Q2.
- `aidlc/spaces/default/memory/team.md`; `aidlc/spaces/default/memory/project.md`.
