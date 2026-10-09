# Unit Story Map

## Complete Story Assignment

Unit IDs/directories come from [unit-of-work.md](unit-of-work.md). Primary traceability identifies one implementing unit; additional units retain explicit acceptance-criterion ownership below. A story spanning units is complete only when all its criteria and integrated checks pass.

| Story | Primary Unit ID | Directory | Additional units | Acceptance-criterion ownership |
| --- | --- | --- | --- | --- |
| US1.1 Four current roles | U1 | u1-current-role-foundation | U2, U3 | U1: current catalog/assignment rejection and history boundary, AC1.1.1/3/4. U2: teacher route/navigation label, AC1.1.2. U3: remaining executable reference/copy cleanup. |
| US2.1 Assigned-group tracking | U2 | u2-teacher-tracking | U1 | U2: all AC2.1.1–6 query/projection/UI/recovery/current-refetch outcomes; U1 supplies current grant/session policy. |
| US2.2 Read-only enforcement | U2 | u2-teacher-tracking | U1 | U2: AC2.2.1 controls and teacher facade denial/projection/audit integration. U1: shared domain/SQL policy AC2.2.2–4; integrated U2 checks pair reading and mutation denial. |
| US3.1 Staff-to-teacher conversion | U1 | u1-current-role-foundation | U2, U3 | U1: AC3.1.1–4 conversion, state/dedup/scope and preserved identity. U2: converted teacher tracking integration. U3: final preservation fixture/scenario links. |
| US3.2 Kindergarten-admin conversion | U1 | u1-current-role-foundation | U3 | U1: AC3.2.1–4 scoped conversion, inactive/revoked/dedup and unchanged business records. U3: migrated Super administrator advanced/governance workflow integration. |
| US3.3 Current/stale sessions | U1 | u1-current-role-foundation | U2, U3 | U1: AC3.3.1–4 current resolution, invalidation, unknown-role denial and last-admin protection. U2: teacher recovery without stale records. U3: retained-role homes/workflow integration. |
| US4.1 Retained permissions | U3 | u3-retained-workflows-cleanup | U1, U2 | U3: AC4.1.1–4 Parent/Group admin/Super administrator workflow outcomes and direct advanced denials. U1: shared policy parity including intended SQL, AC4.1.5. U2: teacher direct-denial integration. |
| US4.2 Cleanup and preservation | U3 | u3-retained-workflows-cleanup | U1, U2 | U3: AC4.2.1–4 final manifests/references/archive metadata and preservation/commit exclusions. U1: AC4.2.5 populated conversion-before-constraint and rejection of invalid new grants. U2: teacher exports/routes/projection names consumed by final cleanup. |

## Local Story Work Within Units

These describe story work inside a unit, not economic sequencing between units. Maintain the affirmed test-after ordering for each testable layer: implement the layer, then write/run its tests before moving to its next layer.

- **U1:** Current-role definitions/denial (US1.1, shared US2.2/US4.1) support conversion cases (US3.1, US3.2, AC4.2.5); conversion/version outputs support session/revocation cases (US3.3). Contract Design must fix interfaces before these implementation details are generated.
- **U2:** Scoped source/projection and failure states (US2.1) support responsive/detail navigation; pair each relevant layer with read-only/privacy denial (US2.2). Teacher labeling (US1.1), migrated-session recovery (US3.1/US3.3) and bookmark compatibility are exercised through the same flow.
- **U3:** Preserve Parent, Group admin and Super administrator workflows as separate permission-case slices within US4.1, including US3.2/US3.3 integration; use completed current-role/teacher contracts for US4.2 final reference/archive cleanup and preservation checks. No story IDs are renumbered or split merely for this grouping.

## Coverage and Completion

All eight upstream story IDs appear exactly once as primary rows. U1 has primary US1.1/US3.1/US3.2/US3.3; U2 has US2.1/US2.2; U3 has US4.1/US4.2. Every unit has user outcomes and applicable tests. [traceability.json](traceability.json) targets the primary Unit IDs shown above. No row claims completed implementation.

NFR1 authorization/data integrity is embedded across the criteria and unit checks. NFR3 English development naming, Hungarian copy, maintainability and teacher accessibility apply throughout. NFR2's full coverage/build/start/browser/security evidence remains final Build and Test work after unit-local tests, with real unlinked-target checks reported outstanding. Historical evidence and the local-only next-env.d.ts edit remain preserved/excluded as required.

## Sources

[stories.md](../user-stories/stories.md), [requirements.md](../requirements-analysis/requirements.md), [components.md](../domain-design/components.md), [decisions.md](../domain-design/decisions.md), approved [units-generation-questions.md](units-generation-questions.md), [unit-of-work.md](unit-of-work.md) and [unit-of-work-dependency.md](unit-of-work-dependency.md). Deployment and economic sequencing remain Delivery Planning concerns.
