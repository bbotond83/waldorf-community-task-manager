# Scope Definition

## Scope Basis

This corrective scope applies the approved [intent statement](../intent-capture/intent-statement.md), [feasibility assessment](../feasibility/feasibility-assessment.md), and [constraint register](../feasibility/constraint-register.md). It inherits the product boundary of `260729-feature`; it does not re-prioritize that product backlog. [intent] [feasibility] [constraints]

## In Scope

- A Next.js application runtime in the repository root, including supported dependencies and documented `dev`, `build`, and `start` commands. [Q1] [Q2]
- Local configuration and privacy-safe synthetic data/adapters sufficient to exercise the application without real family or child data. [Q2] [constraints]
- A role-aware Hungarian application shell and routes that make the previously approved parent, read-only staff, and administrator surfaces available locally. [Q1] [Q2] [prior-scope]
- Integration of those surfaces with existing domain-module public contracts and explicit application/infrastructure seams. [Q1] [feasibility]
- The critical inherited workflows needed to validate the application before deployment: access/role boundary, parent responsibility management, staff schedule visibility, administrator coordination/approval, and the visible states defined by prior stories/mockups. [Q2] [prior-scope] [prior-backlog]
- Responsive and WCAG 2.2 AA-aligned behavior for critical flows, using Hungarian copy and existing locale/time/data rules. [prior-scope] [constraints]
- Automated type checking, unit/integration coverage, production build, deterministic start smoke, critical browser-flow checks, and accessibility verification. [Q2] [constraints]
- Fresh-clone local-run documentation and example environment configuration. [Q2] [Q5]
- Vercel-compatible production output while leaving executable deployment activation to later workflow stages and linked-target validation. [Q5] [constraints]

## Out of Scope

- Changing the approved product boundary, personas, domain rules, privacy model, Vercel target, or Supabase backend/auth/database decision. [intent] [constraints]
- Replacing the existing domain modules with UI-local business logic. [feasibility] [constraints]
- Using real family or child data for local fixtures, screenshots, logs, or tests. [constraints]
- Activating production deployment before local quality gates pass and a Vercel target is linked. [Q5] [constraints]
- Features already deferred by the prior scope: native apps, SMS/WhatsApp, payments, automatic rotation, new ongoing completion tracking, live Excel synchronization, and unrelated integrations. [prior-scope]

## Prioritization

| Priority | Delivery capability | Rationale | Source |
|---|---|---|---|
| Must | Runtime, package scripts, configuration, and application composition | Nothing can be exercised locally without it. | [Q1] [Q2] |
| Must | Role-aware shell plus parent, staff, and administrator surfaces | Preserves the approved application's audience and navigation boundary. | [Q1] [Q2] |
| Must | Critical inherited workflows wired through domain contracts | Distinguishes the application from a static prototype. | [Q2] [feasibility] |
| Must | Build/start/browser/accessibility/coverage verification | Establishes pre-deployment evidence. | [Q2] [constraints] |
| Must | Local setup documentation and safe fixtures | Makes runnability reproducible. | [Q2] [Q5] |
| Should | Secondary UI states and lower-frequency inherited workflows | Improves acceptance breadth after the walking skeleton. | [prior-scope] [prior-backlog] |
| Could | Additional visual refinement beyond approved mockup fidelity | May follow functional and accessibility correctness. | [Q4] |

## Delivery Boundary

Delivery is dependency-first: runtime/configuration, application composition, shared role-aware shell, parent/staff/admin surfaces, critical workflow integration, then quality evidence and documentation. The walking skeleton must prove the browser, domain composition, production build, deterministic start, and one critical role-aware flow before expansion. [Q3] [Q4]

No new calendar deadline is introduced. The hard ordering constraint is that local validation completes before executable Vercel deployment is activated. [Q5]

## Value Stream

`Install and configure → start locally → enter role-aware Hungarian app → exercise inherited workflows → run production and browser checks → approve for deployment activation`

The value stream ends with reproducible pre-deployment evidence, not with another design-only handoff. [Q1] [Q2] [Q5]

## Success Boundary

- A fresh checkout can install dependencies and start the local application from documented commands. [Q1] [Q2]
- Parent, staff, and administrator surfaces are reachable through the shared role-aware application shell. [Q1] [Q2]
- Critical workflows use existing domain contracts and expose success, validation, authorization, empty, loading, and failure states defined by prior artifacts. [Q2] [feasibility]
- Type checks, tests and coverage, production build, start smoke, critical browser flow, and accessibility gates pass. [Q2] [constraints]
- The output remains compatible with the approved Vercel/Supabase architecture. [constraints] [Q5]

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [feasibility] `../feasibility/feasibility-assessment.md`
- [constraints] `../feasibility/constraint-register.md`
- [prior-scope] `../../../260729-feature/ideation/scope-definition/scope-document.md`
- [prior-backlog] `../../../260729-feature/ideation/scope-definition/intent-backlog.md`
- [Q1]–[Q5] `scope-definition-questions.md`
