# Initiative Brief

## Recommendation

**Go to Inception.** Complete the application approved in `260729-feature` by adding its missing locally runnable Next.js delivery layer, preserving existing domain boundaries, Vercel/Supabase architecture, product roles, Hungarian UX, privacy constraints, and quality gates. [intent] [scope] [Q1]

## Problem and Outcome

The repository contains implemented TypeScript domain modules but cannot be started and exercised as the approved web application. The required outcome is a reproducible local web runtime through which the requester can test parent, read-only staff, and scoped administrator surfaces before deployment activation. [intent] [stakeholders] [feasibility]

## Investment Context

This intent introduces no new market hypothesis or product positioning. It completes delivery of an already approved product investment, so Market Research and Team Formation were conditionally skipped. [Q3] [Q5] [Q6]

## Feasibility and Risks

The work is feasible with medium implementation risk. Technology decisions are established; risk concentrates in mapping the breadth of inherited workflows into a framework delivery layer without bypassing domain authorization/privacy boundaries or claiming local substitutes as real Supabase verification. [feasibility] [constraints] [Q2]

Key mitigations are a dependency-first walking skeleton, explicit ports/adapters, synthetic local data, role-aware route enforcement, production build/start/browser checks, accessibility verification, and separately tracked real-target validation. [feasibility] [constraints] [backlog]

## Scope Boundary

In scope: Next.js runtime and scripts; local configuration; privacy-safe synthetic adapters; shared Hungarian application shell; parent, staff, and administrator surfaces; critical inherited workflows; production build/start; tests, coverage, browser and accessibility checks; and local-run documentation. [scope] [backlog]

Out of scope: product redesign, platform replacement, UI-local duplication of domain logic, real personal data in local fixtures, premature deployment activation, and features deferred by the prior product scope. [scope] [constraints]

## Concept and Design Handoff

The corrected wireframes link directly to the approved prior rough/refined designs and specify local identity entry, role navigation, critical role flows, shared states, and accessibility behavior. The product reviewer exhausted two iterations with remaining requests for deeper administrator detail routes, staff schedule field/privacy definitions, identity dependency-failure states, and exhaustive admin route mapping. Inception must resolve those by tracing to prior requirements, stories, functional designs, and access contracts—not through a new product redesign. [wireframes] [Q4]

## Delivery Plan

1. Establish runtime, package scripts, environment contract, and synthetic local composition. [backlog]
2. Prove the walking skeleton: browser, domain composition, role boundary, production build, deterministic start, and one critical flow. [backlog] [constraints]
3. Deliver shared shell and parent, staff, and scoped administrator surfaces. [scope] [backlog]
4. Integrate critical workflows and edge states through existing domain contracts. [scope] [feasibility]
5. Pass type, test/coverage, build/start, browser, accessibility, security, and dependency gates; document fresh local setup. [constraints] [backlog]

## Team and Governance

Current AI-DLC roles and affirmed team practices remain sufficient. The requester/product owner retains scope and acceptance authority through stage gates. No new staffing or budget decision is introduced. [stakeholders] [Q3] [Q6]

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [stakeholders] `../intent-capture/stakeholder-map.md`
- [feasibility] `../feasibility/feasibility-assessment.md`
- [constraints] `../feasibility/constraint-register.md`
- [scope] `../scope-definition/scope-document.md`
- [backlog] `../scope-definition/intent-backlog.md`
- [wireframes] `../rough-mockups/wireframes.md`
- [Q1]–[Q6] `approval-handoff-questions.md`
