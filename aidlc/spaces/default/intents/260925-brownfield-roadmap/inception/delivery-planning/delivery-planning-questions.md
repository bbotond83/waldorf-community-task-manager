# Delivery Planning Questions

## Sources

- Approved requirements: `../requirements-analysis/requirements.md` and `../requirements-analysis/requirements-analysis-questions.md`.
- Approved Units and prerequisites: `../units-generation/unit-of-work.md`, `../units-generation/unit-of-work-dependency.md`, `../units-generation/unit-of-work-story-map.md`, and `../units-generation/units-generation-questions.md`.
- Earlier decisions: `../../ideation/scope-definition/scope-definition-questions.md` and `../../ideation/approval-handoff/approval-handoff-questions.md`.
- Scope: `.codex/scopes/aidlc-waldorf-brownfield-roadmap.md`.
- Current practices: `aidlc/spaces/default/memory/team.md` and `aidlc/spaces/default/memory/project.md`.

## Decisions Already Established

- This workflow ends with discovery and planning documents. Construction and Operation are excluded; this stage does not authorize application implementation or change their execution settings.
- Exactly three specification Units remain: project baseline, archive assessment, and workflow recommendation. The baseline precedes the archive assessment; the recommendation depends on both.
- Apply risk-first investigation within that prerequisite order. Future candidates use `(Impact + Risk + Dependency leverage) / Effort`, with relative 1–5 ratings, risk-first ties, and visible uncertainty.
- The project owner is the sole developer and final decision maker. Discovery uses owner review, with no separate human team or implementation resource commitment.
- There is no committed deadline. Production calls, real family/child data, application changes, rule changes, deployment activation, and archive rewriting are outside this pass.
- The scope disables the walking skeleton, the minimal runnable end-to-end implementation used to prove integration before a larger build.
- This plan documents proposed delivery slices and their completion checks. It does not claim the three planning outcomes have already been delivered.

## Q1. How should the three planning Units be packaged into reviewable delivery slices?

A Bolt normally means one build pass over a piece of work, ending in something that runs. Here, because the Units are specifications and Construction is excluded, the Bolt plan will describe document delivery slices for later execution. Packaging does not change the approved three Units or their prerequisite order.

A. Three slices — review the project baseline, archive assessment, and workflow recommendation separately.
B. Two slices — review baseline and archive assessment together, then review the workflow recommendation.
C. One slice — review all three outcomes as one complete planning package.
X. Other (please specify)

[Answer]: B. Two slices — review baseline and archive assessment together, then review the workflow recommendation.

## Q2. Is there any outside dependency that should block completion of the discovery and workflow recommendation?

Repository and archive evidence are available locally. Earlier decisions deferred family/staff validation for this discovery pass. If another dependency is required, identify its owner, expected availability, affected outcome, and fallback if it is delayed; production access remains outside the approved scope.

A. No additional outside dependency — use local evidence and project-owner review, labeling unresolved facts.
B. Additional evidence or stakeholder input is required — describe the dependency and who owns it.
X. Other (please specify)

[Answer]: A. No additional outside dependency — use local evidence and project-owner review, labeling unresolved facts.

## Q3. Which risk should receive the most attention within the approved baseline-first, archive-second order?

You already chose risk-first sequencing. This question identifies where to concentrate early evidence checks without reordering dependent Units or changing the requirement to assess all three outcomes.

A. Misstating current readiness — distinguish synthetic behavior, unlinked production integrations, and configured checks from proven results.
B. Carrying stale archive decisions forward — identify contradictions between historical records and current code or rules.
C. Producing an impractical future process — make the feature and bug-fix paths usable by the sole developer while preserving quality gates.
D. Give these risks equal attention; record evidence gaps as they are found.
X. Other (please specify)

[Answer]: D. Give these risks equal attention; record evidence gaps as they are found.

## Assumptions & Open Questions

- The three Unit-level prerequisites remain authoritative regardless of Bolt packaging.
- The chosen review packaging will determine proposed completion checkpoints and document demonstrations, not application runtime checks.
- No additional outside dependency is required; local evidence and project-owner review suffice, with unresolved facts labeled.
- Readiness claims, stale archive decisions, and process practicality receive equal attention within the approved prerequisite order.
- No Construction verification command is being proposed or authorized in this scope, which excludes Construction.

## Consolidated Summary Confirmation

- [Q1] Use two proposed document delivery slices: project baseline and archive assessment together, then the workflow recommendation separately. Preserve the three approved Units and their prerequisites.
- [Q2] Use local repository and archive evidence plus project-owner review; no additional outside dependency is required. Label unresolved facts.
- [Q3] Give equal attention to overstated readiness, stale historical decisions, and an impractical future process. Keep risk-first evidence checks within the baseline-first, archive-second order.
- [prior] Preserve the approved prioritization formula and requirements for future feature and bug-fix paths.
- [scope] Produce a planning package only; Construction and Operation remain excluded. The plan does not authorize implementation or claim that its proposed work has been completed.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
