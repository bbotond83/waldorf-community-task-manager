# Teacher Tracking Logical Components

## Inventory and Failure Domains

| Component | Responsibility and dependency | Isolation |
| --- | --- | --- |
| Access | Current role/grant/version checks | Failure denies/invalidates before source call |
| KindergartenTeacherTracking | Read-only schedule query and allowlist projection | No write capability or durable store; TeacherTracking shorthand refers here |
| Application | Existing authorization pipeline and ApplicationResult mappings | Errors become safe no-data outcomes |
| Runtime | Inject source adapter/repository and classifier | Synthetic only; production unavailable |
| Web | Native filters, table/cards/detail and fixed compatibility redirect | No raw source/private fields or mutation port |
| Coordination / Directory | Existing writable business and identity ownership | No guessed joins or reassigned records |

NFR3.21/22/23 and NFR2.27: retain existing stack, ports, English teacher names, Hungarian Óvónő copy, Budapest dates, 44rem parity, native keyboard behavior and exact result focus targets. Code Generation preserves test-after per layer and existing blocking tools, with no dependency upgrade.

## Concrete Source Mapping

The current bounded source is src/staff-web/synthetic-staff.ts: SYNTHETIC_SCHEDULE, STAFF_GROUPS and SyntheticStaffScheduleAdapter.getSchedule, created by createSyntheticStaffFacade. It currently filters a frozen literal and contains no separate injected repository. Introduce a minimal read repository at this existing adapter seam rather than claim one already exists. Proposed logical read port: TeacherScheduleRepository.readCurrent receives authorized group scope and validated from/to, returns current TrackingSourceRecord records. The adapted teacher schedule adapter takes that read port through its constructor; the runtime factory supplies it. Application still exposes its existing getSchedule/getScheduleEntry read contract, renamed coherently to teacher exports in code plan.

The synthetic repository owns an isolated copy of the existing backing records. Its read port has no update method. A separately held repository test/operator handle replaces a record by existing id after validation; tests pass the same repository instance to the adapter, read once, update owner/assignees/status via that handle, then read again. Runtime initialization provides declared fixture data, not a teacher write endpoint or production store. Snapshot/frozen copies prevent caller mutation.

| Existing record | Existing group / organization | Preserved start and end | Explicit proposed synthetic additions |
| --- | --- | --- | --- |
| schedule-garden | group-oak / org-waldorf-local | 2026-08-13T06:30:00.000Z to 07:30:00.000Z | sourceRecordId=schedule-garden; owner Kitalált Dóra; assignees [Kitalált Eszter]; currentStatusLabel Ütemezett |
| schedule-crafts | group-oak / org-waldorf-local | 2026-08-14T12:00:00.000Z to 14:00:00.000Z | sourceRecordId=schedule-crafts; owner Kitalált Fanni; assignees [Kitalált Géza, Kitalált Hanna]; currentStatusLabel Nyitott |
| schedule-coverage | group-sunflower / org-waldorf-local | 2026-08-18T08:00:00.000Z to 10:00:00.000Z | sourceRecordId=schedule-coverage; owner null; assignees []; currentStatusLabel null |

Copy id/groupId/startsAt/endsAt/title/location/optional coordinationDisplayName from the same existing record; add explicit organizationId from the owning existing group scope. All new names/labels are declared synthetic fixture values, not inferred people/statuses or real data. Ütemezett/Nyitott are display labels corresponding to existing scheduled/open vocabulary seen in the separate admin fixtures, used only as declared local source labels, with no join to those unrelated records and no new enum. They are not permanent presentation constants: current read returns source label, and tests replace it. Retain missing values and existing coordination Kitalált Ágnes/Kitalált Bence separately. Existing Tölgyfa/Napraforgó labels remain; ungranted group-ungranted exposes nothing. Preserve all existing ids, groups, dates and titles.

The repository filters startsAt inclusively against UTC day bounds. Adapter/facade validate every returned organization/group before allowlisting. Only TrackingEntry fields reach browser. Production linkage to existing task/assignment/identity models is unavailable; no title/position/coordinator/family/admin-ID join is guessed.

## Boundary Verification

Read spy proves zero source calls for denied scope and one for an authorized query. Same-instance test update proves fresh owner/assignees/status, while interleaved contexts prove no projection reuse. Source shape/scope and sensitive sentinels exercise privacy. The result table in reliability-design.md supplies existing wrapper/focus/announcement identifiers. Component name here resolves functional shorthand to the existing declared owner without adding a new boundary.

## Sources

[performance-requirements.md](../nfr-requirements/performance-requirements.md), [security-requirements.md](../nfr-requirements/security-requirements.md), [scalability-requirements.md](../nfr-requirements/scalability-requirements.md), [reliability-requirements.md](../nfr-requirements/reliability-requirements.md), [observability-requirements.md](../nfr-requirements/observability-requirements.md), [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md), [functional-spec.md](../functional-design/functional-spec.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md).

Additional declared architectural context: [components.md](../../../inception/domain-design/components.md). Bounded source evidence: src/staff-web/synthetic-staff.ts, src/application/staff-facade.ts, facade-pipeline.ts, results.ts, validation.ts and src/admin-core/synthetic-admin.ts status vocabulary. No source changes, tests or real target queries were performed in this design.

