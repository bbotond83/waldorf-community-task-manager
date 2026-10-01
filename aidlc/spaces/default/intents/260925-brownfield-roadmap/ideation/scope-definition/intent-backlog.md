# Intent Backlog

## Prioritization Basis

This backlog contains discovery and workflow-planning deliverables only. All three are Must-have because they directly satisfy the approved request; they are sequenced risk-first, with current-project evidence established before archive claims are assessed and the workflow recommendation finalized. No feature or bug-fix implementation is selected. [request] [Q1] [Q2] [Q3] [Q6]

For future product candidates, the proposed relative score is `(Impact + Risk + Dependency leverage) / Effort`, with each dimension rated 1–5. Score evidence-backed work only; investigate the highest-risk uncertainty first. Must/Should/Could thresholds remain provisional until the team confirms its priorities. [Q5] [Q6]

## Must-Have Proto-Units

| ID | Proto-unit | Value and completion evidence | Dependencies | Sequence | Source |
|---|---|---|---|---:|---|
| PB-01 | Describe the current application and its user workflows | A source-linked baseline of the repository structure, major user flows, project rules, runtime and quality gates, and current integration/deployment boundaries. Mark documentation claims that still need code-level verification. | None | 1 | [request] [intent] |
| PB-02 | Inventory and assess archived AI-DLC artifacts | Cover both archived intent records; distinguish decision-bearing artifacts from generated state/audit/runtime data; compare relevant claims with current code and rules; record each finding as supported, contradicted, stale, unverified, or not applicable. | PB-01 | 2 | [Q1] [Q3] |
| PB-03 | Recommend a custom feature and bug-fix workflow | Define shared intake/discovery, risk-first triage, the combined prioritization score, distinct feature and bug-fix paths, shared verification/release gates, and remaining decisions. | PB-01, PB-02 | 3 | [Q4] [Q5] [Q6] |

## Should-Have Proto-Units

| ID | Proto-unit | Value | Dependencies | Sequence | Source |
|---|---|---|---|---:|---|
| PB-04 | Add reusable intake and triage checklists to the recommendation | Makes the proposed shared front door easier to apply consistently; leave implementation of templates or automation for a later approved task. | PB-03 | After PB-03 | [Q4] [Q5] |

## Could-Have Proto-Units

| ID | Proto-unit | Value | Dependencies | Sequence | Source |
|---|---|---|---|---:|---|
| PB-05 | Score an evidence-backed candidate list | Provides a ranked next-work list once reverse engineering and archive reconciliation identify viable candidates and the team confirms scoring priorities. | PB-01, PB-02, team-priority clarification | Later | [intent] [Q5] [Q6] |

## Explicit Non-Backlog

- Implementing an application feature or fixing a particular defect in this workflow. [Q2]
- Treating archived decisions as current without comparison against code and rules. [Q3]
- Changing deployment targets, linking external production services, or using real family/child data. [readme]
- Building intake automation before the proposed process is reviewed and approved. [Q2]

## Dependency Topology

`PB-01 -> PB-02 -> PB-03 -> PB-04`

`PB-01 + PB-02 + confirmed team priorities -> PB-05`

The risk-first check is embedded in PB-01 and PB-02: investigate high-risk assumptions and boundary claims before ranking implementation candidates. [Q6]

## Value Stream

`Current-state evidence -> archived-artifact comparison -> shared intake and triage design -> feature or bug-fix delivery path -> common verification and release decision`

## Assumptions & Open Questions

- No specific application change is chosen yet; the current product boundary remains open pending reverse engineering. [intent]
- The project owner or development team's priorities are not yet recorded; confirm them before final scoring weights and thresholds are adopted. [intent] [Q5]
- The backlog's scoring formula and Must/Should/Could rules are recommendations for review, not affirmed project policy. [Q5]
- The archive includes generated state and runtime records; the artifact review must identify which files express durable decisions before drawing conclusions. [Q3]

## Sources

- [intent] `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/intent-capture/intent-statement.md`
- [request] User request and confirmed scope-summary answers in this workflow.
- [Q1]–[Q7] `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/scope-definition/scope-definition-questions.md`
- [readme] `README.md`
- [archive] `.aidlc-archive/legacy-project-runtime-20260924/aidlc/spaces/default/intents/`
