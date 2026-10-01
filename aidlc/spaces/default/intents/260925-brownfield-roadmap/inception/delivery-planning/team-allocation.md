# Team Allocation

## Ownership Model

A Bolt normally means one build pass over a piece of work, ending in something that runs; this scope instead plans document delivery slices. A mob is a small group collaborating on one piece of work. Team Formation was excluded and the approved handoff requires no human mob for discovery. The project owner is the sole developer and final reviewer. All proposed Bolts use `aidlc-developer-agent` for AI-assisted research and document production, with the owner retaining scope and acceptance decisions.

No named team, availability, hours, implementation budget, or delivery date has been committed. This allocation describes proposed future document work; it does not start Construction or delegate work in the current session.

## Allocation and Handoffs

| Bolt | Units | Proposed drafting responsibility | Owner review | Handoff |
|---|---|---|---|---|
| B1 — Current evidence and archive assessment | U1 then U2 | `aidlc-developer-agent` | Combined baseline and archive package | Reviewed baseline, claim classifications, evidence paths, and gaps to B2 |
| B2 — Future-work recommendation | U3 | `aidlc-developer-agent` | Shared intake, both paths, scoring, and quality gates | Reusable recommendation for later work selection |

U2 consumes U1 before comparison; U3 consumes both U1 and U2. There is no Unit-level parallelism. One combined B1 review does not remove the U1-to-U2 prerequisite.

## Review Expertise and Escalation

The delivery perspective checks usable review packages and achievable handoffs. The architecture perspective checks prerequisite order, evidence boundaries, and consistency with existing module/integration contracts. These are review responsibilities, not additional staffing commitments.

Escalate contradictory current rules, unsupported readiness claims, or missing evidence to the owner with exact sources. Keep uncertain claims labeled until resolved. A proposed feature, code fix, new production connection, rule change, or deployment requires a later approved task. A production access request is not a fallback for missing evidence in this discovery pass.

For later application work, preserve current short-lived branches, `main` as base and merge target, squash merging, and applicable pre-merge gates. This document neither creates a branch nor approves a merge.

## Sources

- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/requirements-analysis/requirements.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/units-generation/unit-of-work.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/units-generation/unit-of-work-dependency.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/units-generation/unit-of-work-story-map.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/delivery-planning/delivery-planning-questions.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/approval-handoff/initiative-brief.md`
- `aidlc/spaces/default/memory/team.md`; `aidlc/spaces/default/memory/project.md`.
