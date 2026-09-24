# Units Generation Questions

## Q1 — Boundary Strategy

How should this intent decompose work around the existing domain library?

- A. Define delta units for shared runtime/application contracts and vertical role surfaces; reuse existing modules in place. *(Recommended)*
- B. Recreate each existing domain module as a new unit.
- C. Use one undifferentiated application unit.
- X. Other (please specify)

[Answer]: A — Preserve existing domain ownership and create only the missing delivery/composition/application delta units. **Mode:** chat; grounded in approved Application Design and CodeKB.

## Q2 — Granularity

Which unit granularity best supports testable implementation?

- A. Seven cohesive units: runtime foundation, application façades, parent web, staff web, administrator core web, administrator advanced web, verification/handoff. *(Recommended)*
- B. One unit per route.
- C. One unit for the entire repository.
- X. Other (please specify)

[Answer]: A — Seven units keep role flows testable without page-level fragmentation. **Mode:** chat; inferred from the complete route inventory.

## Q3 — Dependency Topology

How should independent work be represented?

- A. Strict acyclic dependencies with explicit parallel sets; no economic implementation order in this stage. *(Recommended)*
- B. Force every unit into one chain.
- C. Leave dependencies implicit.
- X. Other (please specify)

[Answer]: A — Publish a cycle-free topology; Delivery Planning will choose sequencing. **Mode:** chat; required by the stage contract.

## Q4 — Integration Contracts

Which contracts connect units?

- A. Shared ApplicationResult/screen models, authorization IDs, role façade ports, events/jobs, and scenario manifest. *(Recommended)*
- B. Shared raw database records.
- C. Direct imports between UI route groups.
- X. Other (please specify)

[Answer]: A — Units integrate only through approved application/domain ports and redacted event/evidence contracts. **Mode:** chat; grounded in Application Design.

## Q5 — Deployment Model

How are the units deployed?

- A. Embedded libraries/UI/packaging in one Next.js modular-monolith artifact; no deployment in this intent. *(Recommended)*
- B. Independently deployed services.
- C. Separate local and production applications.
- X. Other (please specify)

[Answer]: A — One build artifact with mutually exclusive runtime compositions; target deployment remains future work. **Mode:** chat; grounded in ADR-01/02/05.

## Decomposition Plan Approval

Proposed plan: seven units — `runtime-foundation` (packaging), `application-facades` (library), `parent-web` (ui), `staff-web` (ui), `admin-core-web` (ui), `admin-advanced-web` (ui), and `verification-handoff` (packaging). Dependencies are acyclic: all role UIs depend on runtime/application contracts; advanced admin also depends on admin core; verification depends on every runtime/UI unit. Independent parent, staff, and admin-core work is represented as parallel-capable topology. Approve this decomposition plan?

- A. Approve Plan. *(Recommended)*
- B. Revise Plan.
- X. Other (please specify)

[Answer]: A — Approve Plan. **Mode:** chat; confirmed by the user.

## Sources

- `../application-design/components.md`
- `../application-design/component-methods.md`
- `../application-design/services.md`
- `../application-design/component-dependency.md`
- `../application-design/decisions.md`
- `../requirements-analysis/requirements.md`
- `../user-stories/stories.md`
