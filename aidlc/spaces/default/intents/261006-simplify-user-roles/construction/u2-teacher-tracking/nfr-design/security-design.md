# Teacher Tracking Security Design

## Current Authority Boundary

NFR1.22: current session resolution and AUTH-TEACHER-TRACKING authorization validate active subject/grants/version and same organization/group on every request. The teacher facade must arrange authorization before date/source work; the old facade validates date first and must be adapted to the approved precedence. Source reads happen only after both authorization and strict real-calendar validation. Group choices/defaults are derived from current grants; static fixture groups supply labels only after authorization. Denied/no-grant contexts never silently choose another group.

NFR1.23: preserve U1 direct-command enforcement and existing authorization audit. Teacher facade exposes read methods only. No write port is injected into pages or teacher application API; forge direct commands in integration checks and compare source/business snapshots. Coordination and Directory retain writable ownership.

## Field and Source Boundary

NFR1.24/26: validate every returned record's required shape, organization and group before projecting any result. A mismatched record denies the whole request. Malformed data maps to terminal dependency failure. Build TrackingEntry by individually copying its declared properties; never spread a source record. No raw sourceRecordId, organization metadata, financial, allergen, private-contact or unrelated fields enter the result. Apply existing contextual text escaping and encoded URL construction to all names, titles, statuses and ids. Test hostile display and sensitive sentinel values in HTML and results.

## Browser and Compatibility Boundary

NFR1.25: GET-only old routes construct fixed /teacher/schedule successors with encoded single-segment ids and canonical groupId/from/to. Translate csoport/kezdet/veg only where values are unambiguous; reject malformed/ambiguous supplied context into the successor's validation state rather than dropping it into a wider default query. The implementation must choose a safe internal invalid-filter representation without reflecting arbitrary query input; pin it in code plan. Unknown/scenario/returnTo/host inputs are dropped. Redirects do not create cookies or provide schedule data. Destination independently authorizes. Existing session/CSP/origin/secret controls are retained; no new authentication mechanism or crypto is designed.

## Verification Controls and Dependencies

NFR2.23: retain blocking formatting/lint/typecheck/tests, 80% line/branch/function coverage, build/start, critical browser/Axe, high/critical dependency/SAST and secret-scanning checks. No quality threshold is waived by local success. Shared static SQL cases cannot certify real RLS. Production remains unlinked. U1 administration scope-selection finding remains a U3 before-release fix; this teacher design does not close it.

The concrete source seam and result mappings below in logical-components.md/reliability-design.md supply the two missing functional handoff details. TeacherTracking is shorthand for the declared KindergartenTeacherTracking component; no component/owner is added by that shorter name.

## Sources

[performance-requirements.md](../nfr-requirements/performance-requirements.md), [security-requirements.md](../nfr-requirements/security-requirements.md), [scalability-requirements.md](../nfr-requirements/scalability-requirements.md), [reliability-requirements.md](../nfr-requirements/reliability-requirements.md), [observability-requirements.md](../nfr-requirements/observability-requirements.md), [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md), [functional-spec.md](../functional-design/functional-spec.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md).

