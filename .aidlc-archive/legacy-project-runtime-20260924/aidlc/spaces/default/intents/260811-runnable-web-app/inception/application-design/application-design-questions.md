# Application Design Questions

## Resolved Architecture Decisions

The answers below preserve the approved `260729-feature` architecture and adapt it to the current intent's full local-runtime requirement. They are grounded in the current requirements, stories, CodeKB architecture/component inventory, existing source exports, refined mockups, and affirmed team practices.

## Q1 — Architectural Style

Which application boundary should the runnable product use?

- A. Next.js modular monolith with server-side delivery adapters over the existing framework-independent domain modules. *(Recommended)*
- B. New microservices.
- C. Client-only direct data access.
- X. Other (please specify)

[Answer]: A — Preserve the approved modular monolith and add the missing browser, route, composition, and application-contract layers. **Mode:** chat; inherited and confirmed by the current full-app intent.

## Q2 — Local and Production Composition

How should local synthetic execution coexist with the future production composition?

- A. One application contract with environment-selected synthetic adapters locally and Supabase/provider adapters in linked environments. *(Recommended)*
- B. A separate throwaway local application.
- C. Production credentials required locally.
- X. Other (please specify)

[Answer]: A — Use one UI/application boundary; explicit composition selects privacy-safe synthetic adapters locally and production adapters only when configured. **Mode:** chat; grounded in FR-LR-02 through FR-LR-06 and NFR-LR-05.

## Q3 — Component Boundaries and Ownership

How should new code integrate with the existing modules?

- A. Preserve module ownership and add application façades/view models without moving domain rules into routes or UI. *(Recommended)*
- B. Merge all modules into page components.
- C. Rewrite the domain as framework-specific services.
- X. Other (please specify)

[Answer]: A — Existing modules keep their records and business rules; delivery code calls explicit application ports and authorized projections. **Mode:** chat; grounded in CodeKB and team practices.

## Q4 — Communication and Background Work

Which communication patterns apply?

- A. Synchronous in-process commands/queries for user requests and durable idempotent events/jobs for reminders, lifecycle, and import recovery. *(Recommended)*
- B. Browser timers and synchronous work only.
- C. Network RPC between every module.
- X. Other (please specify)

[Answer]: A — Preserve approved synchronous orchestration plus durable asynchronous follow-up; synthetic mode provides deterministic in-memory equivalents. **Mode:** chat; inherited from ADR-03 and current requirements.

## Q5 — Authorization and Error Mapping

Where should authorization and failure translation occur?

- A. Server application boundary enforces UX-AUTH/FR-LR-14, delegates domain policy, returns explicit result states, and later adds Supabase RLS as defense in depth. *(Recommended)*
- B. Hide controls in the browser only.
- C. Depend exclusively on database policy.
- X. Other (please specify)

[Answer]: A — UI receives already-authorized view models; direct routes/actions repeat the same policy; infrastructure errors are mapped to privacy-safe explicit states. **Mode:** chat; grounded in requirements, refined mockups, and existing AccessService.

## Q6 — UI Component Structure

How should the browser application map the approved refined mockups?

- A. Role-aware route groups and shared semantic components consuming typed screen-state view models. *(Recommended)*
- B. One generic dashboard for all roles.
- C. Duplicate independent apps for each role.
- X. Other (please specify)

[Answer]: A — Use a shared AppShell/state vocabulary with parent, staff, administrator, invitation/auth, import, governance, and lifecycle route groups. **Mode:** chat; grounded in approved refined mockups.

## Q7 — Deployment Boundary

What deployment capability belongs to this architecture stage?

- A. Produce Vercel-compatible build output but invoke no deployment and keep executable deploy workflows disabled. *(Recommended)*
- B. Deploy to production during local verification.
- C. Add an AWS runtime alongside Vercel.
- X. Other (please specify)

[Answer]: A — This intent is local-only; future linked staging/production follows the approved protected promotion policy. AWS services are not introduced because Vercel/Supabase are the approved targets. **Mode:** chat; grounded in FR-LR-13/13a and team practices.

## Consolidated Summary Confirmation

The application design will preserve the Next.js modular monolith, add one typed delivery/application boundary and composition root, select synthetic adapters locally versus linked production adapters by explicit configuration, retain domain module ownership, use synchronous request orchestration plus durable jobs/events, enforce authorization and error mapping server-side, map the complete role-aware refined UX, produce Vercel-compatible output, and deploy nowhere in this intent. Does this all look correct before I generate the artifacts?

- A. Looks correct. *(Recommended)*
- B. Request changes.
- X. Other (please specify)

[Answer]: A — Looks correct. **Mode:** chat; confirmed by the user.

## Sources

- `../requirements-analysis/requirements.md`
- `../user-stories/stories.md`
- `../refined-mockups/mockups.md`
- `../refined-mockups/interaction-spec.md`
- `../practices-discovery/team-practices.md`
- `../../../codekb/waldorf-community-task-manager/architecture.md`
- `../../../codekb/waldorf-community-task-manager/component-inventory.md`
- `../../../260729-feature/inception/application-design/decisions.md`
