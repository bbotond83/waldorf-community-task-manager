# Units of Work

## Approved Decomposition

The user selected three bounded units and explicitly chose **Approve Plan** in [units-generation-questions.md](units-generation-questions.md). Logical ownership remains as defined by [components.md](../domain-design/components.md) and [decisions.md](../domain-design/decisions.md). Unit boundaries divide implementation responsibility; they do not change entity ownership. English role name: Kindergarten teacher; Hungarian UI label: `Óvónő`.

| Unit ID | Directory | Name | Kind | Deployment model | Complexity |
| --- | --- | --- | --- | --- | --- |
| U1 | u1-current-role-foundation | Current-role foundation | library | Embedded in the existing application; migration delivered alongside it | L |
| U2 | u2-teacher-tracking | Kindergarten teacher tracking | service | Shared existing application executable | M |
| U3 | u3-retained-workflows-cleanup | Retained workflows and cleanup | service | Shared existing application executable | M |

The `service` units are runnable feature slices of the existing executable, not new independently deployed processes. They carry applicable service design scope because their behavior crosses runtime, application and UI boundaries. U1 has no standalone runtime. Estimates are relative change complexity, not time commitments. All three are integrated for one coherent release; no partial production rollout of mixed role semantics is proposed. Deployment target linkage/live migration remains outside this intent.

## U1: Current-role Foundation

**Owns and delivers:** Access current-role vocabulary/policy, runtime exhaustive role rejection, deterministic grant conversion, authorization versions, revocation and last-super-administrator protection; four-category runtime catalog and session resolution; matching SQL policy/constraint migration; authorization rows and policy consumer updates needed for current-role compilation and behavior.

**Component responsibility slices:** Access; Runtime profile/session/composition bindings; Application authorization/contracts shared role definitions; role-check portions of Directory, Coordination, AdminExperience, ImportMigration and Web session gates. Other units own workflow/projection changes in those shared files. No component or entity changes owner.

**Behavior:** Parent own-family and Group admin core-group rights remain. Kindergarten teacher reads assigned groups only and cannot mutate. Super administrator owns organization-scoped advanced operations/governance. Map staff grants to teacher and kindergarten-admin grants to super-admin, preserving organization/group scope, inactive/revoked state and history. Handle equivalent target grants without duplicate effective access or reactivation. Invalidate stale authorization with redacted evidence. Convert populated grants before constraining roles; reject unsupported/unmapped values instead of falling through. Real group records remain intact.

**Boundary/output:** Current-role, scoped authorization and current-session contracts consumed by U2/U3. The migration artifact and populated fixture evidence are delivered here; no live target execution is implied. Runtime catalog uses only current profiles; old profile cookies may require existing safe selection/sign-in recovery.

**Tests owned:** Colocated role/scope/action/field denial tests; conversion active/inactive/revoked/duplicate/repeat cases; current/stale/unknown sessions; last-admin protection; populated migration/constraint policy checks appropriate to available local tooling. Record static checks separately from actual database execution. Test-after applies to each changed layer before the next layer. Existing callers must compile and preserve baseline tests using the current vocabulary.

**Constraints:** This is an embedded foundation and cannot by itself demonstrate the new complete teacher presentation. Classic scope has skeleton off, so no first integrated-skeleton claim is made. Do not globally rename fixture/manifest scenario IDs owned by U3 or teacher route/projection implementation owned by U2; expose stable contracts and coordinate unavoidable shared edits.

## U2: Kindergarten Teacher Tracking

**Owns and delivers:** Rename existing staff schedule/web modules to coherent English development names; supply authorized source inputs and allowlisted owner/assignee/current-status projection; update application teacher facade contracts; render equal tracking fields in table/cards/detail; retain current filters, location/coordination and explicit empty/denied/invalid/retry/session states; implement minimal old schedule/detail redirects with validated filter context and current destination authorization.

**Component responsibility slices:** KindergartenTeacherTracking; teacher projection/result portions of Application; teacher adapter bindings in Runtime; teacher UI/navigation presentation and redirect portions of Web. Access supplies U1 policy; Coordination and Directory remain business owners.

**Boundary/output:** Uses U1 role/grant/session contracts. Delivers stable teacher source/projection, names, routes and result contracts for U3's final fixture/scenario cleanup. Contract Design must pin authoritative source provenance, identities and missing-value behavior before implementation: existing schedule data does not already contain the new fields. Do not infer owner from coordination contact or create a new writable task/event store.

**Tests owned:** Authorized and denied group/item queries; private-field/mutation denial; current source re-fetch; explicit missing owner/assignment/status; unchanged 31-day filter rules; equivalent narrow/wide field projection; detail/back safe filters; valid/invalid old-link redirect behavior; keyboard/focus and browser/accessibility teacher flow. Implementation evidence must distinguish local synthetic execution from unlinked real targets.

**Constraints:** U1 prerequisite. Preserve business groups and tasks. No teacher mutations, new event module, realtime push or new infrastructure. Read installed Next.js documentation before framework code changes. The local-only next-env.d.ts edit remains excluded from commits.

## U3: Retained Workflows and Cleanup

**Owns and delivers:** Adapt existing Parent, Group admin and Super administrator workflows beyond the policy checks owned by U1; preserve parent own-family actions/notifications and group core administration; exercise super-admin imports/reminders/privacy/settings/governance including migrated-user fixtures; map executable import/archive administrator-owner metadata to super-admin without changing actual task owners or sheet coverage; finish current-role fixture, contract-manifest and executable scenario references using U1/U2 contracts.

**Component responsibility slices:** ParentExperience, AdminExperience, ImportMigration, Notifications and PrivacyLifecycle workflow consumers; final verification references and remaining current-role UI copy. Directory and Coordination business records remain unchanged. Shared Application/Runtime files may need narrowly scoped workflow/fixture wiring; U3 does not redefine U1 policy/session or U2 teacher projection/routes.

**Boundary/output:** Consumes U1 current-role semantics and U2 completed teacher contracts/naming. Delivers a coherent executable four-role catalog/scenario set and preserved existing workflow evidence for integrated Build and Test. Historical evidence, explicit migration/removed-role regression data and minimal old URL compatibility may retain old names with documented purpose; they are not selectable roles.

**Tests owned:** Parent permitted/other-family denial; Group admin core granted/ungranted group behavior; Super administrator organization advanced/governance allowed and wrong-organization denied; other-role advanced direct-request denial without state changes; archive/sheet coverage and business identity preservation; executable manifest/reference integrity and intentional legacy-reference inventory. Integrated migration fixture consumption uses U1 outputs rather than implementing a second converter.

**Constraints:** U1/U2 prerequisites because final cleanup consumes both current-role and teacher names/contracts. Keep existing private unsigned CI evidence approach. No new CI signing or deployment workflow; preserve audit/history and the local-only next-env.d.ts edit. Final broad quality proof belongs to Build and Test and must not be claimed from artifact generation.

## Shared-file Coordination and Completion Boundaries

U1 owns policy/role/session declarations; U2 owns teacher projection/routes and corresponding tests; U3 owns retained workflow/fixture/manifest changes and their tests. For shared Application, Runtime and Web files, Delivery Planning must name the responsible functions/sections or choose serial integration. Units are independently testable with prerequisite contracts/fixtures, not independent production releases. No parallel execution authorization is inferred.

All units use explicit failure results, scoped field minimization, ports/injection and English technical names with Hungarian UI copy. Existing strict checks, applicable tests, 80% line/branch/function coverage, production build/start smoke, critical browser/accessibility and security/dependency gates remain required. Unit checks accompany their changes; final integrated verification spans all completed units. Real backend checks remain outstanding until exercised against an available authorized target.

## Traceability and Sources

All eight stories are assigned in [unit-of-work-story-map.md](unit-of-work-story-map.md) and [traceability.json](traceability.json); exact cross-unit acceptance criteria are listed in the story map. [unit-of-work-dependency.md](unit-of-work-dependency.md) carries topology. Delivery Planning chooses Bolt grouping, economic sequencing and owners from that graph.

Sources: [components.md](../domain-design/components.md), [decisions.md](../domain-design/decisions.md), [requirements.md](../requirements-analysis/requirements.md), [stories.md](../user-stories/stories.md), and approved [units-generation-questions.md](units-generation-questions.md). No application changes, test runs, browser execution or migrations were performed in this stage.

## Assumptions & Open Questions

None for unit grouping. Contract Design must formalize shared roles/session outcomes, teacher source projection and redirect semantics. Functional Design must formalize schema/source mapping and conversion collision handling. These are mandatory downstream deliverables within approved scope, not unassigned optional work.
