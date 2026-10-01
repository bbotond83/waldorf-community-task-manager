# Requirements Analysis

## Intent Analysis

**Authoritative initial request:** “Set up an AI-DLC v2.9.0 brownfield workflow for the existing Waldorf Community Task Manager. Preserve its current implementation and project rules, reverse-engineer it, then plan the next development work from current evidence.” [desc]

This intent is a discovery and planning pass. It must describe the current project, assess archived AI-DLC evidence against current code and rules, and recommend a reusable process for later feature work and bug fixes. It does not choose a specific application change or authorize implementation. [scope]

Parents and families are the primary beneficiaries of future application work. The project owner is the sole developer and final decision maker. No product outcome metric, implementation budget, hard deadline, or next feature has been selected. [intent] [scope]

## Sources

- [desc] `aidlc/spaces/default/intents/260925-brownfield-roadmap/project-description.json`
- [scope] `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/scope-definition/scope-document.md`
- [intent] `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/intent-capture/intent-statement.md`
- [handoff] `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/approval-handoff/initiative-brief.md`
- [business-overview] `aidlc/spaces/default/codekb/waldorf-community-task-manager/business-overview.md`
- [architecture] `aidlc/spaces/default/codekb/waldorf-community-task-manager/architecture.md`
- [code-structure] `aidlc/spaces/default/codekb/waldorf-community-task-manager/code-structure.md`
- Current project practices: `aidlc/spaces/default/memory/team.md` and `aidlc/spaces/default/memory/project.md`.

The CodeKB inputs describe static observations at commit `d7995af0aacf59ff7aa75880c45cc5e0a50eda9e`; they are not current test or production-integration results.

## Functional Requirements

### FR1 — Describe the current project

The assessment shall produce an evidence-backed baseline of the repository's user-facing areas, major modules, architecture, runtime modes, verification setup, and external integration and deployment boundaries.

**Acceptance criteria**

- Given the current source and project rules, when a project capability or boundary is described, then its evidence path is cited or the claim is explicitly marked unverified or historical.
- Given the synthetic local experience and unlinked production composition, when the baseline describes runtime behavior, then it distinguishes observed local behavior from production capabilities that have not been connected or exercised.

**Source:** [scope], [business-overview], [architecture], [code-structure].

### FR2 — Assess archived AI-DLC artifacts

The assessment shall inventory the prior AI-DLC intent records and compare their decision-bearing claims with current code and current project rules. Generated runtime, audit, and hook-health data shall be identified separately from authored decisions.

**Acceptance criteria**

- Given each archived artifact, when it is inventoried, then it is classified as decision-bearing or generated and its role is recorded.
- Given an archived project claim, when current evidence is compared, then the result is classified as supported, contradicted, stale, unverified, or not applicable, with the evidence location recorded.
- Given a historical artifact or version reference, when it conflicts with current evidence, then the report records the discrepancy without rewriting the archive to make it appear current.

**Source:** [scope], [intent], [handoff].

### FR3 — Recommend shared intake and separate delivery paths

The recommendation shall define shared intake and discovery for future feature requests and bug reports, then describe separate feature and bug-fix paths that preserve the current project practices.

#### FR3.1 — Shared intake

The shared intake shall capture the requested outcome or observed defect, affected users, available evidence, impact, risk, dependencies, and unresolved assumptions before work is prioritized.

#### FR3.2 — Feature path

The feature path shall use one standard route and add analysis or review steps for high-risk or cross-cutting changes. Before implementation of every user-facing feature, the workflow shall include input from affected parents or staff. The project owner retains the final scope and priority decision.

#### FR3.3 — Bug-fix path

The bug-fix path shall establish a reproducible defect before authorizing a code fix, assess severity and affected boundaries, identify cause, and require a regression check with the fix. When a defect cannot yet be reproduced, the item remains in investigation and no code fix is authorized.

**Acceptance criteria**

- Given a feature request or bug report, when it enters the recommended process, then both start with the same evidence and impact intake before branching into their respective paths.
- Given a user-facing feature proposal, when implementation is considered, then affected-user input is recorded before implementation or the proposal remains unapproved for implementation.
- Given a defect report, when a code fix is proposed, then a reproducible case and a regression check are recorded; if reproduction is unavailable, the outcome remains investigation-only.

**Source:** [scope], [intent], [handoff], current project practices.

### FR4 — Prioritize candidate work transparently

The recommendation shall rank evidence-backed future candidates using the approved relative score:

`Priority score = (Impact + Risk + Dependency leverage) / Effort`

Each dimension uses a relative 1–5 rating. A higher effort lowers the score. The score supports ranking and does not replace project-owner judgment. Validate high-risk assumptions or defects early, including when effort or score is not yet known. For tied scores, prioritize risk first, then dependency leverage; label uncertain estimates with confidence.

**Acceptance criteria**

- Given evidence-backed feature or defect candidates, when they are ranked, then the documented formula and relative 1–5 scale are applied consistently and assumptions are visible.
- Given tied scores, when candidates are ordered, then risk is considered first and dependency leverage second; low-confidence estimates are labeled.
- Given a high-risk unresolved assumption or defect, when its numeric score is incomplete, then early validation may proceed without inventing a final rank.

**Source:** [scope], requirements-analysis Q4.

## Non-Functional Requirements

### NFR1 — Evidence traceability

Every material current-state or archive conclusion shall point to a repository, project-rule, or archived-artifact location. Claims without sufficient evidence shall be labeled unverified, stale, or historical rather than stated as current fact.

### NFR2 — Privacy and integration boundaries

The discovery pass shall not inspect real family or child records, contact external services, access production targets, or claim that an integration is verified unless it has been exercised against its real target under a later approved task.

### NFR3 — Preserve the planning boundary

This intent shall not modify application code, enable deployment, connect production services, or rewrite archived artifacts to change their historical meaning. The recommendation shall not be presented as approval for implementation or as a selected product backlog.

### NFR4 — Carry current project quality gates into the recommendation

The proposed future workflows shall include applicable current project gates: strict type checking; tests and regression coverage; the affirmed 80% line, branch, and function coverage floor; production build and start smoke; critical browser-flow and accessibility checks; blocking lint and formatting; and high/critical dependency and SAST findings. The recommendation shall call out that current lint and coverage globs do not cover every production area, so configured checks must be verified against the full source boundary. These are required future gates, not claims that they passed during this static assessment.

### NFR5 — Production-readiness accuracy

The recommendation shall retain the current boundary that persistence, production authentication, scheduler/provider delivery, and deployment remain unlinked. It shall not call the project production-ready based on synthetic local behavior or partial SQL/RPC scaffolding.

## Constraints

- The approved scope is discovery and workflow planning only; no application feature or defect is selected for implementation.
- The project owner is the only developer, makes the final scope and priority decision, and has not committed implementation capacity or a deadline.
- The installed AI-DLC helper is version 2.10.0. Older version references in the repository and archive remain evidence to reconcile, not a reason to rewrite historical artifacts.
- The package requires Node.js 24.x. The scan environment observed Node.js 26.x, and no tests, builds, installs, audits, or application sessions were run for this assessment.

## Assumptions

- Future features that change parent or staff workflows will seek input from affected users before implementation, as selected in requirements-analysis Q2.
- A future bug fix will not proceed to code change until the defect is reproducible, as selected in requirements-analysis Q3.
- The priority score is a relative decision aid; evidence quality and risk-first sequencing remain visible when numeric estimates are uncertain.
- Static CodeKB observations are an input to the project baseline, not runtime proof or current acceptance-test evidence.

## Out of Scope

- Selecting or implementing a specific feature or bug fix.
- Changing application source, project rules, CI workflows, or production integrations as part of the product work in this intent.
- Using real family or child data or making production calls.
- Treating archived decisions or verification results as current without checking their claims against present evidence.

## Open Questions

- The project owner's specific product interests and measurable success criteria for the next application change remain undefined.
- The future priority scale will need calibration against evidence-backed candidates and actual effort estimates.
- Production persistence, authentication, provider, and deployment targets require separate decisions and real-target verification before production claims can be made.
- Historical AI-DLC version references in the README, earlier intent records, and current installation need to be reconciled in the archive assessment while preserving the original records.
