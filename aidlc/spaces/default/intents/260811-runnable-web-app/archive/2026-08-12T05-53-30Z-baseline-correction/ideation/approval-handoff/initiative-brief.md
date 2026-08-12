# Initiative Brief

## Evidence Base

This brief compiles the approved [intent statement](../intent-capture/intent-statement.md), [stakeholder map](../intent-capture/stakeholder-map.md), [scope document](../scope-definition/scope-document.md), [intent backlog](../scope-definition/intent-backlog.md), [feasibility assessment](../feasibility/feasibility-assessment.md), [constraint register](../feasibility/constraint-register.md), and [rough wireframes](../rough-mockups/wireframes.md). [intent] [stakeholders] [scope] [backlog] [feasibility] [constraints] [wireframes]

## Intent and Problem

The repository contains a tested TypeScript domain library but no runnable browser application. The initiative adds a focused local integration surface so a developer can start the app, inspect seeded community tasks, create a task, and see it immediately in the list. [intent]

## Stakeholder and Approval

The developer is the primary first-version customer; the requester owns scope and stage approvals, while product, parents, and staff influence usability and Hungarian-language clarity. [stakeholders]

The requester confirmed the intent, accepted the delivery risks, committed implementation capacity for this workflow, and approved the rough experience. [Q1] [Q2] [Q3] [Q4]

## Market Validation

External market validation is not applicable because this is an internal integration feature without external positioning or a build-vs-buy decision. [Q5]

## Feasibility and Risks

The feature is feasible with low-to-medium delivery risk on the existing Node.js 24, npm, and TypeScript baseline. It uses synthetic in-memory data, no AWS, no paid services, and no production personal data. [feasibility] [constraints]

Key mitigations are to preserve existing domain tests, isolate the browser-facing task contract, keep persistence explicitly local, and verify configuration changes across old and new test paths. [feasibility] [constraints]

## Scope Boundary

**Must Have:** one-command local startup, deterministic seeded tasks, Hungarian task creation with validation, visible success and recovery states, automated verification, and documentation. [scope] [backlog]

**Should Have:** responsive polish and a reset action when they do not displace Must Have work. [scope] [backlog]

**Excluded:** live Supabase or AWS, real data, production authentication/persistence/deployment, and broader workflows such as signup, swaps, cancellations, notifications, administration, and import. [scope] [constraints]

## Concept

The approved concept is a warm, responsive one-page task board with task-list-first hierarchy and an always-visible inline form. It specifies mobile and desktop layouts, deterministic field rules, loading/empty/success/error states, keyboard flow, and WCAG 2.1 AA intent. [wireframes] [Q4]

## Delivery Shape

One implementation stream proceeds in dependency order: runtime foundation, task/store contract, browser flow, automated verification, and documentation. A separate mob or staffing plan is not required. [backlog] [Q3] [Q6]

## Recommendation

**GO — proceed to Inception.** The initiative has a confirmed customer and scope, feasible technical boundary, acknowledged risks, committed implementation capacity, and an approved user-experience concept. [Q1] [Q2] [Q3] [Q4]

## Open Items

- Select the TypeScript web framework and exact application adapter boundary during Inception. [feasibility] [constraints]
