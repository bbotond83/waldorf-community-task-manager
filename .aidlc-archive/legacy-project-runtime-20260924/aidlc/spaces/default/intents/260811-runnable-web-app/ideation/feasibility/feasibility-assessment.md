# Feasibility Assessment

## Decision Context

The corrected [intent statement](../intent-capture/intent-statement.md) requires the application approved in `260729-feature` to become runnable and testable locally. The prior feasibility assessment, constraint register, and architecture decisions remain authoritative for product scale, privacy, Vercel hosting, Supabase services, and the Next.js modular-monolith style. [intent] [prior-feasibility] [prior-constraints] [prior-architecture]

The repository currently contains strict TypeScript domain modules and test/type-check scripts, but no Next.js entry point, web runtime dependencies, local environment contract, or development/production runtime scripts. [repository] [Q5]

## Feasibility Verdict

**Feasible with medium implementation risk.** No new product or platform choice is required. The missing work is application composition: add the approved Next.js delivery layer, connect it to existing domain contracts through explicit ports/adapters, provide Supabase-compatible configuration and local test seams, and make the result installable, buildable, startable, and browser-testable. [Q1] [Q3] [Q4] [Q6]

The highest risk is breadth rather than technology novelty. The prior intent defines parent, staff, and administrator surfaces plus authorization, import, reminder, privacy, and audit behavior. Local runnability is not satisfied by a single demo page; downstream planning must identify the smallest coherent implementation that exposes the already approved surfaces without contradicting those contracts. [intent] [Q1] [Q4]

## Conditions for Delivery

| Area | Feasibility condition | Verification |
|---|---|---|
| Web runtime | Add a Next.js application shell and supported runtime dependencies without moving domain logic into framework components. | `npm run dev`, production build, deterministic start smoke |
| Domain composition | Use existing domain modules through their public contracts and explicit infrastructure seams. | Type checks, unit/integration tests, architecture review |
| Local configuration | Document required environment variables and support synthetic local validation without real family/child data. | Fresh-clone setup and browser-flow test |
| Supabase boundary | Preserve backend/auth/database and defense-in-depth authorization decisions; local substitutes must not imply production verification. | Adapter tests plus separately tracked real-target checks |
| Product coverage | Make the parent, staff, and administrator surfaces from the prior intent available for local testing. | Critical browser flows and acceptance review |
| Deployment compatibility | Keep the build compatible with the approved Vercel target while leaving executable deployment disabled until the app and linked target exist. | Production build and later deployment-pipeline validation |

## Compliance and Platform Perspective

Local execution does not relax the inherited GDPR-aligned data-minimization, authorization, audit, retention, and EU-processing constraints. Fixtures, screenshots, logs, and local seeds must remain synthetic. Vercel and Supabase remain the approved platform boundary; AWS services and accounts are not required. [Q2] [Q6]

## Confidence and Open Items

Confidence is **medium-high** that the repository can host the intended Next.js modular monolith. Remaining uncertainty concerns implementation completeness and local Supabase strategy, not product design. Those items belong in requirements and application design as inherited-contract mapping decisions. [Q1] [Q3] [Q4]

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [prior-feasibility] `../../../260729-feature/ideation/feasibility/feasibility-assessment.md`
- [prior-constraints] `../../../260729-feature/ideation/feasibility/constraint-register.md`
- [prior-architecture] `../../../260729-feature/inception/application-design/decisions.md`
- [repository] Root `package.json` and implemented `src/` domain modules
- [Q1]–[Q6] `feasibility-questions.md`
