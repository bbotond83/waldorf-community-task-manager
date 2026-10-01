# Decision Log

## Ideation Decisions

| ID | Decision | Status | Source |
|---|---|---|---|
| D-01 | Keep the product boundary open until reverse-engineering evidence is available. | Confirmed | [intent] [Q8] |
| D-02 | The current initiative is discovery and planning; no application code changes are in scope. | Confirmed | [Q2] [scope] |
| D-03 | Inventory archived AI-DLC artifacts and compare their claims with current code and rules. | Confirmed | [Q1] [Q3] |
| D-04 | Treat archived artifacts as historical evidence; distinguish decision-bearing artifacts from generated state/audit/runtime data. | Confirmed | [Q3] [scope] |
| D-05 | Recommend shared feature/bug intake and discovery, then separate delivery paths. | Confirmed | [Q4] [scope] |
| D-06 | Use a proposed score combining impact, risk, effort, and dependencies; calibrate it after candidates are evidence-backed. | Proposed | [Q5] [scope] |
| D-07 | Validate the highest-risk assumptions or defects first. | Confirmed | [Q6] [scope] |
| D-08 | No hard deadline or milestone constrains this initiative. | Confirmed | [Q7] |
| D-09 | Project-owner approval is sufficient for this discovery handoff; family and staff input remains open. | Confirmed for discovery; external input deferred | [Q1] |
| D-10 | Accept listed risks only for discovery; preserve the no-code/no-production boundary. | Confirmed for discovery only | [Q2] |
| D-11 | Commit to discovery only; defer implementation capacity and budget. | Confirmed | [Q3] |
| D-12 | Keep Rough Mockups skipped and defer visual validation. Q4 initially selected a revisit; Q7 and Q8 explicitly resolved the conflict in favor of keeping it skipped. | Confirmed by Q8 | [Q4] [Q7] [Q8] |
| D-13 | Make no market-validation or investment claim; proceed to Reverse Engineering. | Confirmed | [Q5] |
| D-14 | No human mob is needed for discovery; defer staffing decisions. | Confirmed | [Q6] |
| D-15 | Recommend conditional handoff to Inception for Reverse Engineering only; do not treat this as product/build investment approval. | Recommendation pending stage approval | [Q1] [Q2] [Q3] [Q5] |

## Open Items

- Family and staff workflows have not been validated; decide after the current-state investigation whether direct input is required. [Q1]
- Feasibility, constraints, and market evidence are absent because those stages were skipped; no technical or investment validation is claimed. [scope] [Q5]
- Implementation capacity, budget, and delivery staffing have not been committed. [Q3] [Q6]
- The proposed scoring formula and Must/Should/Could thresholds need calibration against evidence-backed candidates. [scope] [Q5]
- Archived claims remain unverified until compared with current code and project rules. [Q3]

## Sources

- [intent] `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/intent-capture/intent-statement.md`
- [stakeholders] `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/intent-capture/stakeholder-map.md`
- [scope] `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/scope-definition/scope-document.md`
- [backlog] `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/scope-definition/intent-backlog.md`
- [Q1]–[Q8] `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/approval-handoff/approval-handoff-questions.md`
