# Unit of Work

## Decomposition Basis

This intent delivers discovery and workflow-planning documents only. It does not select an application feature or defect and authorizes no application-code, project-rule, production-integration, or deployment change. Domain Design was skipped because no new application component was selected. The Units are therefore `spec` work products, not proposed application services.

The approved decomposition has three Units: current project baseline, archive assessment, and future workflow recommendation. The archive assessment follows the baseline so its comparisons can use current repository and rule evidence. The recommendation has direct prerequisites on both the baseline and archive assessment, so the graph enforces each evidence input. The follow-up answers also settled two earlier ambiguities: the archive assessment remains one Unit; the recommendation remains one Unit containing shared intake, prioritization, and both future delivery paths.

## Unit Summary

| Unit ID | Name | Directory | Kind | Complexity | Deployment model |
|---|---|---|---|---|---|
| U1 | Project baseline | `u1-project-baseline` | `spec` | M | shared |
| U2 | Archive assessment | `u2-archive-assessment` | `spec` | L | shared |
| U3 | Workflow recommendation | `u3-workflow-recommendation` | `spec` | M | shared |

## U1 — Project Baseline

**Description:** Produce an evidence-backed description of the current Waldorf Community Task Manager, including user-facing areas, major modules, architecture, runtime modes, verification setup, and external integration and deployment boundaries.

**Responsibilities and deliverables:**

- Inventory current capabilities and map them to repository paths; distinguish implementation evidence from validated live user workflows.
- Describe the package, App Router delivery layer, runtime composition, application contracts, domain areas, injected ports, synthetic adapters, and integration seams.
- State the production boundary accurately: synthetic local behavior is evidenced; persistence, production authentication, provider/scheduler delivery, and deployment remain unlinked unless later real-target evidence changes that conclusion.
- Summarize available verification commands and configured gates without claiming that tests, builds, audits, or external integrations were run in this planning pass.
- Preserve source references and mark historical or unverified claims explicitly.

**Implementation notes and constraints:** Use the current source and rules as authoritative for current-state claims. Existing CodeKB files are static evidence at their recorded commit, not proof of current runtime behavior. Do not inspect real family or child records, contact external services, or alter application code.

**Evidence inputs:** `aidlc/spaces/default/codekb/waldorf-community-task-manager/{business-overview.md,architecture.md,code-structure.md,component-inventory.md}`, current repository source and project rules, and FR1/NFR1-NFR5 in `requirements-analysis/requirements.md`.

## U2 — Archive Assessment

**Description:** Inventory the preserved AI-DLC archive's authored decisions and generated records, then compare material historical claims with the U1 current-state baseline and current project rules.

**Responsibilities and deliverables:**

- Inventory the two archived intent records and classify decision-bearing documents separately from generated state, audit, runtime, and hook-health data.
- Compare material archived claims with current code and rules; classify each as supported, contradicted, stale, unverified, or not applicable and cite both the claim and comparison evidence.
- Preserve discrepancies and historical context. Do not rewrite archived artifacts or promote an old decision to current practice without current evidence.
- Record the AI-DLC version discrepancy across repository documentation, archived records, and the installed helper as a historical evidence issue rather than silently normalizing it.

**Implementation notes and constraints:** This Unit depends on U1 because its comparison phase needs the current baseline. Archive file counts and historical verification figures are inventory leads, not current correctness evidence. Never use real family or child data or make production calls.

**Evidence inputs:** `.aidlc-archive/legacy-project-runtime-20260924/aidlc/spaces/default/intents/`, the archived CodeKB described in the current CodeKB, current project rules, U1, and FR2/NFR1-NFR3 in `requirements-analysis/requirements.md`.

## U3 — Workflow Recommendation

**Description:** Recommend one reusable future-work process with shared intake and discovery, a distinct feature path, a distinct bug-fix path, and transparent relative prioritization.

**Responsibilities and deliverables:**

- Define shared intake for requested outcome or observed defect, affected users, evidence, impact, risk, dependencies, and unresolved assumptions.
- Define the feature path, including affected-parent or staff input before implementation of user-facing changes, explicit acceptance conditions, and the project owner's final scope and priority decision.
- Define the bug-fix path, including reproducible evidence before a code fix, severity and boundary assessment, cause analysis, and a regression check; non-reproducible defects remain investigation-only.
- Include the approved relative score `(Impact + Risk + Dependency leverage) / Effort`, with 1–5 ratings, visible uncertainty, risk-first tie handling, and early validation of high-risk unknowns.
- Carry forward applicable current quality gates as future requirements, while labeling them as required checks rather than checks performed in this intent.
- Preserve the boundary that this recommendation is not a selected backlog or implementation approval.

**Implementation notes and constraints:** This is one `spec` Unit containing the shared intake, prioritization, feature path, and bug-fix path. Do not split these into additional Units or pick a specific feature or defect. Keep production persistence, authentication, providers, and deployment described as unlinked until separately verified.

**Evidence inputs:** U1, U2, the approved scope and initiative brief, and FR3-FR4/NFR2-NFR5 in `requirements-analysis/requirements.md`.

## Shared Constraints

- All three Units produce planning documents; none is a separately deployed service.
- Keep every material project or archive conclusion traceable to an evidence path or explicitly labeled historical/unverified.
- Do not use real family or child records, contact production targets, modify application code or project rules, enable deployment, or present this plan as authorization to implement.
- Apply project quality gates in the future workflow recommendation as requirements; report no unrun verification as passed.
