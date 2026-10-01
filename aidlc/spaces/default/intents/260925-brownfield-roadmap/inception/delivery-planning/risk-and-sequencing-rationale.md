# Risk and Sequencing Rationale

## Decision and Alternatives

A Bolt normally means one build pass over a piece of work, ending in something that runs. This plan uses two document delivery slices because the scope contains specifications and excludes Construction. The owner selected B1 for the baseline plus archive assessment, followed by B2 for the workflow recommendation.

The sequencing heuristic is risk-first investigation within prerequisite order, consistent with the approved scope and Boehm's risk-driven planning principle. The three confirmed concerns receive equal attention; this does not assign them identical measured probabilities or invent a risk ranking. U1 establishes current evidence, U2 compares history against it, and U3 uses both. No topological deviation is proposed.

| Alternative | Consequence | Disposition |
|---|---|---|
| Three review packages, one per Unit | Earlier independent owner feedback on the baseline; more separate reviews | Not selected in Q1 |
| Two packages, baseline/archive then recommendation | One coherent evidence review before designing the future process; U1 still precedes U2 | Selected in Q1 |
| One complete package | Fewest package reviews; errors in evidence may be discovered after drafting the recommendation | Not selected in Q1 |

Parallel baseline and archive Units are not an alternative under the approved three-Unit graph. Only internal research tasks may overlap without consuming unavailable evidence. The walking skeleton, a minimal runnable end-to-end integration proof, is disabled by this scope.

## Risk Register

Likelihood has not been measured; entries below are planning concerns, not demonstrated defects. Equal attention comes from Q3.

| Risk | Likelihood | Potential consequence | Mitigation and review evidence |
|---|---|---|---|
| Synthetic behavior or configured checks are presented as production proof | Unmeasured | Incorrect security, privacy, reliability, or release decisions | B1 separates source facts, configured gates, historical results, and real-target evidence; retain explicit unlinked integration boundaries |
| Stale archive decisions are adopted as current practice | Unmeasured | Inconsistent requirements, rules, or implementation assumptions | B1 inventories artifact roles and classifies material claims with archive and current evidence links; preserve discrepancies |
| The future process is too cumbersome for a sole developer | Unmeasured | Unusable intake or unnecessary work; quality gates bypassed in practice | B2 uses one shared intake, distinct feature/bug-fix paths, and illustrative walk-throughs; retain all current gates |
| Evidence changes or is incomplete | Unmeasured | Conclusions lose their source basis | Record source snapshot/context; refresh material current claims; label gaps instead of inventing support |
| The planning package is mistaken for implementation approval | Unmeasured | Unapproved application, integration, or deployment changes | State the document-only boundary in every package and distinguish planned outcomes from completed work |

No real family/child records or production calls are needed. Missing live evidence remains an explicit limitation rather than an invitation to obtain production access.

## Prioritization Method and Limits

For evidence-backed future candidates, preserve the approved relative score:

`Priority score = (Impact + Risk + Dependency leverage) / Effort`.

Each dimension uses 1–5 ratings. Impact represents user benefit or harm prevented; Risk represents exposure such as privacy, security, data integrity, and reliability; Dependency leverage represents other work unblocked; Effort represents relative work required. The additive numerator gives the three benefit dimensions equal numeric coefficients; effort is the divisor. This is the owner's selected formula, not a replacement formal scoring model.

Break tied scores by risk, then dependency leverage. Label uncertain ratings with confidence and validate high-risk unknowns early even when a complete numeric score is unavailable. Owner judgment remains final. This plan assigns no product candidate scores and invents no cost, timing, or benefit ratings for U1–U3; their prerequisites already enforce one permitted Unit order.

## Go/No-Go Conditions

B1 is ready for B2 when the owner can review a traceable baseline, complete artifact inventory, material claim classifications, and explicit gaps. Conflicting evidence must be visible and must not be stated as settled current fact. Request further investigation when an unresolved finding prevents a sound recommendation.

B2 is ready for owner acceptance when both future paths can be followed in illustrative examples, all FR1–FR4 outcomes are represented by the planned packages, applicable gates are retained, and no implementation or production-readiness claim exceeds the evidence. The delivery plan's approval completes this planning workflow; actual delivery of its proposed Units remains a separate work decision.

## Sources

- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/requirements-analysis/requirements.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/units-generation/unit-of-work.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/units-generation/unit-of-work-dependency.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/units-generation/unit-of-work-story-map.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/delivery-planning/delivery-planning-questions.md` — Q1 packaging, Q2 outside dependencies, Q3 equal risk attention.
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/scope-definition/scope-document.md` — risk-first choice and prioritization formula.
