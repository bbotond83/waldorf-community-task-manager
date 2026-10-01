# Bolt Plan

## Delivery Boundary

A Bolt is one build pass over a piece of work, ending in something that runs. In this discovery-only intent, the two Bolts below are proposed document delivery slices: their demonstrations are evidence-backed documents, not running application increments. Approval accepts this delivery plan; it does not execute the Units or authorize implementation. Construction and Operation are excluded by the current scope.

The owner confirmed two review packages: project baseline and archive assessment together, then the workflow recommendation separately. The approved three specification Units and every prerequisite remain unchanged. The scope disables the walking skeleton, the smallest runnable end-to-end implementation used to prove integrations.

## Work Streams and Coverage

| Unit | Outcome | Complexity from approved decomposition | Prerequisites | Requirements | Bolt |
|---|---|---|---|---|---|
| U1 / `u1-project-baseline` | Current project baseline | M | None | FR1; NFR1–NFR3, NFR5 | B1 |
| U2 / `u2-archive-assessment` | Archive inventory and evidence comparison | L | U1 | FR2; NFR1–NFR3 | B1 |
| U3 / `u3-workflow-recommendation` | Shared intake, feature/bug-fix paths, prioritization | M | U1 and U2 | FR3–FR4; NFR1–NFR5 | B2 |

There are three Units, two planned review packages, and three direct prerequisite edges. All four functional requirements are mapped. Complexity is relative; it is not an estimate of hours, cost, or implementation capacity.

## Implementation Sequence

Text visualization: `U1 baseline -> U2 archive assessment -> B1 owner review -> U3 workflow recommendation -> B2 owner review`.

U3 also directly consumes U1. The critical dependency chain is U1 → U2 → U3; no elapsed-time critical path is claimed because there are no duration estimates. There are no independent Units to run concurrently. Putting U1 and U2 in one Bolt creates one review package, not parallel execution. Within each Unit, inspect the highest-risk evidence early and give the three confirmed risk areas equal attention.

## B1 — Current Evidence and Archive Assessment

**Included Units:** U1 followed by U2. **Walking skeleton:** No. **Owner:** project owner, assisted by `aidlc-developer-agent` for document research and drafting. **Prerequisite:** accessible local repository, rules, and archive. **Review:** owner reviews the combined package before B2 relies on it.

**Planned work:** Establish the current baseline from source and rules; then inventory both archived intent records and compare material historical claims against that baseline. Keep authored decisions distinguishable from generated state, audit, runtime, and hook-health records. Existing CodeKB is evidence at its recorded source snapshot; refresh any claim whose current applicability matters.

**Definition of Done:**

- The baseline identifies user-facing areas, modules, architecture, runtime composition, synthetic adapters, integration boundaries, and available verification commands, with source paths for material conclusions (FR1).
- The inventory assigns every archived artifact a role and decision-bearing/generated classification. A claim register classifies material historical claims as supported, contradicted, stale, unverified, or not applicable, citing both the archive claim and current comparison evidence (FR2).
- Version references are recorded with their source and observation context; historical artifacts are preserved.
- Synthetic behavior, configured quality checks, unlinked persistence/authentication/provider/scheduler/deployment seams, and executed real-target results are distinguished. No unrun check is reported as passed.
- Evidence gaps are explicit. The owner can accept a labeled gap or request more local investigation; insufficient evidence is never converted into a supported claim.
- The package respects the discovery boundary and is reviewed by the owner before its conclusions feed B2.

**Confidence hypothesis:** Reviewing current source before historical claims will make inherited decisions assessable without falsely treating synthetic behavior or archived results as current production proof.

**Expected demonstration:** Open the capability/evidence map and archive claim register; follow a material claim to its historical source, current comparison source, classification, and uncertainty. This is a document demonstration; it requires no application session or production call.

## B2 — Reusable Future-Work Recommendation

**Included Unit:** U3, containing shared intake, prioritization, and both delivery paths. **Walking skeleton:** No. **Owner:** project owner, assisted by `aidlc-developer-agent`. **Prerequisites:** U1, U2, and B1 owner review.

**Definition of Done:**

- Shared intake captures the requested outcome or defect, affected users, evidence, impact, risk, dependencies, and unresolved assumptions (FR3.1).
- One feature route adds analysis/review for high-risk or cross-cutting changes. Every user-facing feature requires recorded affected-parent/staff input before implementation; the owner decides scope and priority (FR3.2).
- The bug-fix route requires reproduction, severity and boundary assessment, cause analysis, and a regression check. A non-reproducible defect remains investigation-only (FR3.3).
- Prioritization uses `(Impact + Risk + Dependency leverage) / Effort`, with relative 1–5 scales, confidence labels, risk-first ties followed by dependency leverage, and early validation when high-risk estimates are incomplete (FR4).
- Current quality gates are included as future requirements: formatting, linting, strict type checking, tests/regressions, 80% line/branch/function coverage, build/start smoke, critical browser/accessibility checks, security scanning, and high/critical dependency/SAST blocking. The recommendation explicitly checks whether lint and coverage boundaries include all production source (NFR4).
- Production integration and readiness limits remain explicit. Every carried-forward practice is supported by current rules or evidence, with links to B1 findings; the result is not a selected backlog or implementation approval.
- The owner can walk through a hypothetical feature and a hypothetical bug report without adding repository tooling or contacting stakeholders as part of this pass.

**Confidence hypothesis:** One shared evidence intake and distinct feature/bug-fix paths can support a sole developer while retaining user validation, reproducibility, privacy, and quality gates.

**Expected demonstration:** Trace a hypothetical feature through affected-user input and acceptance conditions, and a hypothetical defect through reproduction and regression verification. Show how uncertain estimates and equal scores are handled. Examples remain illustrative, with no invented real candidate ranking.

## Stage Configuration and Success Criteria

The current workflow ends at Delivery Planning. Reverse Engineering, Requirements Analysis, and Units Generation supplied the planning inputs; Domain Design was explicitly skipped, and no new application components were selected. User Stories, Refined Mockups, Contract Design, and Practices Discovery were excluded. Every Construction and Operation stage remains excluded. This plan changes no stage selection or execution setting.

Success for this stage means two fully specified review packages, faithful coverage of the approved Units and requirements, a valid prerequisite order, clear ownership, observable document completion checks, and explicit risks/dependencies. Actual Unit delivery, implementation staffing, verification-command authorization, release approval, and dates require later work decisions.

## Sources

- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/requirements-analysis/requirements.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/units-generation/unit-of-work.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/units-generation/unit-of-work-dependency.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/units-generation/unit-of-work-story-map.md`
- `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/delivery-planning/delivery-planning-questions.md` — Q1–Q3 and confirmed summary.
- `.codex/scopes/aidlc-waldorf-brownfield-roadmap.md`; active-space `memory/team.md` and `memory/project.md`.
