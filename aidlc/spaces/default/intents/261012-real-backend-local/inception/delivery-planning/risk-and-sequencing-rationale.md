# Risk and Sequencing Rationale: Real backend, sign-in and seed data

A **Bolt** is one build pass over a piece of the work, ending in something that runs (see `bolt-plan.md`). The **walking skeleton** (Cockburn) is a thin end-to-end first slice; this plan has it off.

## Why This Order

The five units form a single chain (`unit-of-work-dependency.md`): U2 needs the stack and audit from U1, U3 needs accounts and grants from U2, U4 needs people and tasks from U3, and U5 needs every table to seed and every area to replace before synthetic mode can go. Only one topological order exists, so the order is a fact of the design, not a value judgment. No scoring model (WSJF, Reinertsen) is used; the owner chose a short risk note per Bolt instead (Q2).

No Bolt deviates from topological order.

## Risk-First Notes Inside the Chain

| Risk | Where it lands | How the plan handles it early |
|---|---|---|
| Access rules wrong (a parent seeing another family's data, contact details leaking) | B2, then B3 | Per-role policy tests come early in B2 before any data screen; B3 adds per-read-path tests; every elevated database function needs a test that it checks the caller's grants. |
| Largest unit and the cross-block functions | B3 | Functional Design splits U3 by owning block; the rule-disposition ledger records rules carried over from unused modules. |
| Blast radius of removing synthetic mode on about 40 test and about 50 source files | B5 | Every Bolt leaves a reusable real-database test helper, so B5 moves tests rather than inventing the machinery. |
| Docker or stack not available | B1 | Docker Desktop is an owner prerequisite; Construction stops at U1 if it is not ready (Q3), rather than building on mocks. |
| Personal data in the repository | B1 and B5 | The privacy scan lands in B1; the history rewrite is a manual owner step reported as an open item at the end. |
| Parallel test workers interfering | B1 and B5 | Per-worker schema mechanics are built in B1 and proved in B5 with three consecutive parallel runs. |

## Open Numbers Carried Into Construction

Session lifetime, invitation lifetime and the grant-change window are fixed in NFR Requirements of U2; the 30-family seed time budget is fixed in NFR Requirements of U5. The staged import payload policy is settled in U4 Functional Design.
