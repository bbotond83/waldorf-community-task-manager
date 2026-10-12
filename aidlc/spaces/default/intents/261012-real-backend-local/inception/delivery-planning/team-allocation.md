# Team Allocation: Real backend, sign-in and seed data

A **Bolt** is one build pass over a piece of the work, ending in something that runs (see `bolt-plan.md`). A **mob** is the group of specialist roles that builds a Bolt together.

No team formation ran for this plan (the classic plan skips it), so every Bolt is built by the developer agent working with the AI-DLC specialist roles that the stages call for. The owner is the sole human: they decide at every gate and checkpoint.

| Bolt | Unit | Owner | Specialists called in by the stages |
|---|---|---|---|
| B1 | U1 local platform and audit | aidlc-developer-agent | aidlc-aws-platform-agent (infrastructure design), aidlc-devsecops-agent (privacy scan, secrets) |
| B2 | U2 identity and access | aidlc-developer-agent | aidlc-architect-agent (design), aidlc-devsecops-agent (sessions, access rules) |
| B3 | U3 directory and coordination | aidlc-developer-agent | aidlc-architect-agent (rules by owning block), aidlc-quality-agent (policy tests) |
| B4 | U4 notifications and import | aidlc-developer-agent | aidlc-quality-agent (failure-injection tests) |
| B5 | U5 seed and test migration | aidlc-developer-agent | aidlc-quality-agent (full suite, coverage), aidlc-pipeline-deploy-agent (CI) |

There is one team, so there is no Program Board. Bolts are built one after another in one session; no unit is owned by a separate team. Staffing can be changed at the gate.
