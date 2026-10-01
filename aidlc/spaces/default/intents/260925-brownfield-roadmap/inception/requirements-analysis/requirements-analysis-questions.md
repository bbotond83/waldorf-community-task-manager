# Requirements Analysis Questions

## Sources

- [desc] Initial request recorded in `project-description.json`.
- [scope] `ideation/scope-definition/scope-document.md`.
- [scope] `ideation/approval-handoff/approval-handoff-questions.md` records that this pass is discovery-only, that the project owner is the sole developer and final decision maker, and that family/staff validation remains open.
- `aidlc/spaces/default/codekb/waldorf-community-task-manager/business-overview.md`.
- `aidlc/spaces/default/codekb/waldorf-community-task-manager/architecture.md`.
- `aidlc/spaces/default/codekb/waldorf-community-task-manager/code-structure.md`.
- Current workflow practices in `aidlc/spaces/default/memory/team.md` and `project.md`.

## Context

This intent describes the current project and proposes future feature and bug-fix workflows. It does not select or implement an application change. The questions below resolve choices that the approved scope leaves open for those future workflows.

## Q1. How should the proposed feature path adapt to request size and risk?

The scope separates feature delivery from bug-fix delivery but does not set a depth rule for future features.

A. One feature route — add analysis or review steps for high-risk and cross-cutting changes.
B. Light and full routes — choose at intake using request size and risk.
C. Owner sets depth — choose the depth for each feature.
X. Other (please specify)

[Answer]: A. One feature route

## Q2. When should a future feature path require input from affected parents or staff?

The handoff deferred family and staff validation for this discovery pass, so the future workflow's validation default is still open.

A. Validate every feature — get affected-user input before implementing each user-facing feature.
B. Validate higher-risk features — get input for high-impact or uncertain changes; the owner may record a waiver.
C. Owner decides case by case — choose whether and when to ask affected users.
X. Other (please specify)

[Answer]: A. Validate every feature

## Q3. How should the future bug-fix path handle a defect that cannot yet be reproduced?

The project rules require a regression check for defects, but the approved scope does not define the route when reproduction is initially unavailable.

A. Require reproduction — keep investigation open and do not authorize a code fix until the defect is reproduced.
B. Investigation only — record evidence and risk; defer code changes until reproduction.
C. Allow evidence-based fix — require owner approval and a regression check.
X. Other (please specify)

[Answer]: A. Require reproduction

## Q4. How should the proposed priority score handle tied scores or weak estimates?

The scope defines an impact, risk, dependency-leverage, and effort score, while leaving tie-breaking and low-confidence estimates to be clarified.

A. Risk-first tie break — prioritize risk then dependency leverage; label uncertain estimates with confidence.
B. Hold for evidence — leave tied or weakly supported candidates unranked until more evidence is available.
C. Owner resolves ties — choose among tied candidates and record the rationale.
X. Other (please specify)

[Answer]: A. Risk-first tie break

## Assumptions & Open Questions

- No specific feature or defect is selected by this planning intent; candidate ranking follows the approved scope and current evidence.
- The project owner is the only developer and makes the final scope and priority decision; affected-user input for future changes is the subject of Q2.
- Production persistence, authentication, notification providers, and deployment remain unlinked in the current repository; claims about production behavior must remain conditional on future verification.
- The repository, active intent, and installed AI-DLC helper show historical version references that require reconciliation in the final current-state and archive assessment; this does not authorize rewriting archived artifacts.

## Consolidated Summary Confirmation

- [Q1] Use one standard feature path, with additional analysis or review for high-risk and cross-cutting changes.
- [Q2] Require input from affected parents or staff before implementing every user-facing feature.
- [Q3] Keep bug investigation open and do not authorize a code fix until the defect is reproduced.
- [Q4] Break priority-score ties by risk first and then dependency leverage; label uncertain estimates with confidence.

Does this all look correct before I generate the requirements artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
