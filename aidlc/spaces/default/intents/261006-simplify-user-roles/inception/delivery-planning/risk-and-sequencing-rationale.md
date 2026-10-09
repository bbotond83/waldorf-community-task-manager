# Risk and Sequencing Rationale

## Delivery Heuristic

A Bolt is one build pass over a piece of work, ending in a verifiable result. Use a **risk-first approach**, addressing authorization and conversion uncertainty before consumers depend on it, within the approved U1 -> U2 -> U3 graph. The human selected three milestones and the integrated release; no alternate dependency order is available and no numeric ranking is fabricated. This applies the risk-driven incremental-delivery heuristic described in the delivery planning guide, rather than introducing a new scoring exercise.

| Bolt | Why this milestone matters | Observable confidence outcome |
| --- | --- | --- |
| B1 / U1 | Promotion, revoked-state preservation, unknown-role denial and stale sessions are the largest permission risks | Populated conversion/current-session tests preserve scope/state and reject stale/unknown access; no partial transaction |
| B2 / U2 | Existing schedule lacks required tracking fields; projection mistakes can fabricate ownership or leak identities | Explicit source provenance and changed-record refetch work, with allowed/denied group and sensitive-field cases |
| B3 / U3 | Cleanup can silently break retained roles, archive coverage or executable evidence | Persona permission cases and complete manifest/reference/preservation checks remain coherent |

There is no deviation from the dependency graph. B1 is an embedded foundation with no end-to-end skeleton claim; the classic scope disables that ceremony. Serial unit-first execution and separate checkpoints support focused feedback without separate production releases. Grouping three milestones is the user's choice; one combined milestone was offered and not selected.

## Risk Register

| Risk | Likelihood | Impact | Mitigation / owner / evidence |
| --- | --- | --- | --- |
| Removed/unknown role falls through to allowed behavior | Medium | High | U1 explicit exhaustive rejection and shared domain/application/intended-SQL permission cases; U3 final reference integrity |
| Revoked/inactive grants reactivate or scope expands during conversion | Medium | High | U1 explicit mapping/preflight, preserved grant identity/state, transactional version/audit, duplicate/repeat fixtures; unsupported shape blocks |
| Kindergarten-admin promotion accidentally grants another organization | Medium | High | U1 retain organization; U3 migrated-user wrong-organization and governance tests; promotion itself was explicitly approved |
| Old profile cookies authorize stale roles | Medium | High | U1 reject removed IDs/version mismatch; fresh selection/sign-in; U2 no stale protected UI |
| Teacher owner/status inferred from coordinator or unrelated fixtures | High | High | U2 explicit source fields and same-scope provenance; no guessed joins; backing-record change/refetch evidence |
| Teacher sensitive data appears in hidden response/DOM | Medium | High | U2 response allowlist, denied-row exclusion and direct-request privacy tests in both responsive views |
| Legacy redirect preserves unsafe input or broadens grant | Medium | High | U2 fixed same-origin namespace, encoded ID, whitelisted validated filters and full destination authorization |
| Shared-file edits alter a previous unit's policy behavior | Medium | Medium | Serial integration and ownership table in team-allocation; full checkpoint tests after each unit |
| Cleanup deletes actual groups/owners or import sheet coverage | Medium | High | U3 identity/content and archive coverage checks; distinguish metadata from business ownership and preserve history |
| Missing local toolchain/browser/database prevents checks | Medium | Medium | Inspect available runtime/check prerequisites before execution; report blocked checks honestly, no fabricated PASS; see external dependency map |
| Synthetic evidence mistaken for real RLS/provider/deployment proof | Medium | High | Separate evidence categories; linked target stays outstanding; no live operation implied |

## Stop and Recovery Criteria

Stop a unit checkpoint on failed approved checks or required verification failures; fix through the declared implementation/review path before dependents proceed. Unexpected source/schema contradictions affecting an approved contract require a documented revision rather than guessed data or permission expansion. Keep migration failures atomic and rerunnable after remediation. Do not assume app rollback reverses changed grants; live rollout/reversal is separate target work.

Final integrated release requires the existing full quality/security/accessibility gates, not only checkpoint type/tests. No deadline, response-time SLA, new provider or deployment prerequisite is invented. Guard settings stay the user's switches, and their current relaxed setting is preserved.

## Sources

[requirements.md](../requirements-analysis/requirements.md), [stories.md](../user-stories/stories.md), [mockups.md](../refined-mockups/mockups.md), [components.md](../domain-design/components.md), [unit-of-work.md](../units-generation/unit-of-work.md), [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md), [unit-of-work-story-map.md](../units-generation/unit-of-work-story-map.md), [contract-summary.md](../contract-design/contract-summary.md), [team-practices.md](../practices-discovery/team-practices.md), [delivery-planning-questions.md](delivery-planning-questions.md), [bolt-plan.md](bolt-plan.md) and [team-allocation.md](team-allocation.md). No execution evidence was produced in planning.
