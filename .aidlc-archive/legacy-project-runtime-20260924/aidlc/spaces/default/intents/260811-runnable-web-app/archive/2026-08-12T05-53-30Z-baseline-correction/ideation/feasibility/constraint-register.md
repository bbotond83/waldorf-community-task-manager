# Constraint Register

## Active Constraints

This register applies the approved [intent statement](../intent-capture/intent-statement.md) and the confirmed feasibility answers. [intent]

| ID | Constraint | Type | Impact | Response | Source |
| --- | --- | --- | --- | --- | --- |
| C-01 | Keep Node.js 24, npm, TypeScript, and existing domain modules | Technology | New runtime must coexist with current module and test conventions | Select a compatible TypeScript web stack and preserve module contracts | [Q3] [repo] |
| C-02 | Use seeded in-memory synthetic data only | Integration/privacy | No live database or real personal data in the local slice | Compose local adapters and deterministic seed fixtures | [Q1] [Q2] |
| C-03 | Deliver one complete task-creation browser workflow | Scope | Broader domain workflows are not required for this increment | Optimize for a thin end-to-end vertical slice | [intent] [Q4] |
| C-04 | Require no paid local services | Cost | Local startup must remain self-contained | Use repository dependencies and local process state only | [Q4] |
| C-05 | Preserve existing tests and modules | Quality | Integration cannot regress prior domain behavior | Add tests alongside code and run existing suites | [Q5] |
| C-06 | Do not require AWS for local execution | Platform | Cloud accounts cannot be startup prerequisites | Keep runtime and seed data local | [Q6] |

## Deferred Constraints

- Production persistence, authentication, deployment, and real-data compliance remain outside this focused local slice. [Q1] [Q2] [Q4] [Q6]
- The checked-in Supabase migration remains available for later production integration but is not a local runtime dependency. [Q1] [repo]

## Decision Dependencies

- Application design must choose a TypeScript browser framework compatible with the existing Node.js baseline. [Q3]
- Functional design must define the task create/list contract and visible success outcome. [intent]
