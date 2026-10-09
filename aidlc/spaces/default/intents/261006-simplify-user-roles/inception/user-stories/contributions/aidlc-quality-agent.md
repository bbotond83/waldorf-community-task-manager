**Collaborator:** aidlc-quality-agent

## Contribution

### Execution Context

This contribution was completed in the primary conversation under the quality persona after the user explicitly selected `Run it here`. Two native delegation attempts failed with `agent thread limit reached`. It is not an independent delegated quality pass, and it is not claimed as mutually blind: the primary conversation has already integrated designer/developer findings. The quality persona and role knowledge were loaded; the settled requirements, personas, completed questions, current story draft, traceability and affirmed practices provide the review basis. No tests, browser sessions, source changes or live-target calls were performed.

### Testability and Coverage

The eight workflow stories provide observable positive and negative outcomes. Current catalog checks cover the exact four supported categories and rejection of unknown/removed identifiers. Teacher scenarios pair permitted assigned-group tracking with group-filter denial, sensitive-field exclusion, missing owner/assignment states and direct mutation rejection. The integrated distinction between authorized emptiness and denied access avoids misleading assertions. Accessibility has a concrete teacher-flow criterion without claiming execution.

| Story | Fixture/assertion design for later implementation |
| --- | --- |
| US1.1 | Enumerate the four current categories and their profile/home presentation. Submit old and unknown values through normal assignment/selection; assert no grant/session and no privileged fallback. Historical references must be excluded from the live-catalog assertion. |
| US2.1 | Seed authorized group A and unauthorized group B with distinguishable private sentinel fields. Assert exact projected tracking fields, not only visible labels. Cover absent owner, absent assignment, authorized empty result, no-group denial, crafted B filter, invalid filter and dependency failure separately. Refetch after a changed status. |
| US2.2 | Parameterize create/edit/delete/assign/approve requests; assert both denied outcome and unchanged business snapshots. Inspect rendered controls separately. Intended SQL policy comparisons require their own evidence and are not proved by browser control hiding. |
| US3.1 | Active, revoked/inactive, already-equivalent and repeat-run staff grants, with multiple group boundaries. Assert current teacher scope, preserved state/history and unchanged linked records. |
| US3.2 | Active, revoked/inactive, existing equivalent and repeat-run kindergarten-admin grants for organization A with separate B fixtures. Assert the approved governance expansion only within A, no activation of revoked grants and no duplicate effective access. |
| US3.3 | Fresh sessions for every supported role; old-role migrated sessions; revoked/mismatched authorization versions; unknown-role requests; final-super-admin removal attempt. Refresh and reject are permitted alternatives, but every case must assert no access via stale role data and valid recovery on rejection. |
| US4.1 | Use table-driven role/scope/operation rows with positive own-family/group/organization examples and matching denied rows. Preserve parent personal-data/notification operations while denying organization advanced administration. Plan persona slices if implementation is too large for one delivery slice. |
| US4.2 | Compare pre/post group/record identity and ownership snapshots. Verify archive-owner metadata separately from task owners. Use populated legacy-grant schema fixtures to exercise conversion-before-constraint, repeated conversion and new obsolete/unknown grant rejection. Static checks, local fixture execution and real database evidence must be distinguished. |

All FR1–FR15 have coverage targets; NFR1 denials/integrity are represented in story criteria, and NFR3 labels/explicit states/accessibility are observable. Deferring NFR2 execution proof to `build-and-test` is appropriate: the stories must not invent test counts, measured coverage or real RLS verification. Use affirmed test-after ordering and existing 80% line/branch/function and critical-flow accessibility gates.

### Refinements and Limits

Compound criteria should become separate parameterized scenarios during test planning without renumbering their AC IDs. US4.1 needs explicit persona-sized implementation slices at Delivery Planning, consistent with the developer's sizing recommendation; its present permission-preservation outcome is reviewable with distinct fixtures. These are implementation/test-planning refinements, not new product choices.

The fallback reduces reviewer independence and must remain disclosed at the human gate. No unresolved requirement ambiguity or additional story defect is identified after the integrated UX and populated-schema refinements. The separate product-lead advisory check remains required.

## Positions

- AGREE: Four personas, eight workflow stories and all Must Have priorities follow the approved requirements and organization answer.
- AGREE: Teacher tracking criteria cover scoped reading, private-field projection, missing data, denial, recovery, status refetch and accessibility within the existing schedule.
- AGREE: Active/inactive, repeat-run and duplicate-equivalent migration fixtures make the approved staff and kindergarten-admin conversions testable without claiming a live migration.
- AGREE: The populated-schema criterion and FR13 mapping cover conversion-before-constraint and refusal of new obsolete/unknown persisted grants.
- AGREE: Preserve the distinction between archive ownership metadata and actual task/business owners.
- AGREE: Defer measured verification proof to Build and Test while retaining the affirmed gates; independent fixture/scenario planning remains a downstream responsibility.
- AGREE: Disclose this human-authorized in-conversation fallback rather than representing it as a blind independent participant. No unresolved judgment call, knowledge dispute or draft-defect objection remains.
