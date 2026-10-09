# Teacher Tracking Business Rules

## Business Rules

The YAML is authoritative. Ordered execution is defined by functional-spec.md.

```yaml
rules:
  - id: BR2.1
    statement: "Current assigned-group authority"
    category: authorization
    applies_to: "TeacherContext and TrackingQuery"
    trigger: "Every list, detail and retry request"
    logic: "IF session or authorization version is stale THEN invalidate; IF role, current active grant or organization/group membership fails THEN deny before querying source"
    violation: "No records, names, counts or existence hints; existing safe recovery"
    source: "FR6, FR8, FR12"
  - id: BR2.2
    statement: "Strict calendar range"
    category: validation
    applies_to: "TrackingQuery"
    trigger: "Filter submission"
    logic: "IF date is not a real YYYY-MM-DD calendar date, from exceeds to or elapsed difference exceeds 31 days THEN reject; ELSE accept inclusive UTC day bounds"
    violation: "Field correction with no schedule data"
    source: "FR7, FR13"
  - id: BR2.3
    statement: "Current source integrity"
    category: constraint
    applies_to: "TrackingSourceRecord"
    trigger: "Each authorized fetch"
    logic: "IF any returned record differs from authorized organization/group or has an invalid required shape THEN fail closed without partial records; ELSE use current source values"
    violation: "Scope mismatch denied; malformed or unavailable data safe dependency failure"
    source: "FR6, FR7, FR9"
  - id: BR2.4
    statement: "Browser field allowlist"
    category: policy
    applies_to: "TrackingEntry"
    trigger: "Projection"
    logic: "IF source fetch succeeds THEN individually project only listed TrackingEntry attributes; never copy unlisted fields or substitute coordinator as owner"
    violation: "Discard unauthorized fields and expose no raw record"
    source: "FR7, FR9"
  - id: BR2.5
    statement: "Explicit absence"
    category: policy
    applies_to: "Owner, assignees and status"
    trigger: "List/card/detail rendering"
    logic: "IF owner is null THEN show Nincs kijelölt felelős; IF assignee list empty THEN show Nincs beosztott; IF status null THEN show Nincs elérhető állapot; ELSE show source display values"
    violation: "Never guess a person or status"
    source: "FR7"
  - id: BR2.6
    statement: "Fresh refetch and safe recovery"
    category: policy
    applies_to: "Tracking query outcomes"
    trigger: "Refresh, retry, source change or failure"
    logic: "IF a new request occurs THEN reauthorize and reread current records; IF loading or failure THEN withhold prior schedule data; IF retryable THEN offer fresh authorized retry with safe filter context"
    violation: "Use existing application outcome and focus/announcement vocabulary"
    source: "FR7, FR12, FR13"
  - id: BR2.7
    statement: "Empty and denied distinction"
    category: authorization
    applies_to: "List and detail outcomes"
    trigger: "Authorized query completion"
    logic: "IF authorized query has no records THEN return empty; IF detail id is absent from that authorized result THEN deny generically; unauthorized scope never returns an empty result that implies access"
    violation: "No counts, names, create action or record existence disclosure on denial"
    source: "FR6, FR9"
  - id: BR2.8
    statement: "Read-only boundary"
    category: authorization
    applies_to: "Teacher interactions and application access"
    trigger: "Navigation or direct mutation attempt"
    logic: "IF teacher requests write, approve, assign, admin or governance action THEN deny through shared policy; render no mutation control, form or export path in tracking"
    violation: "No state change; shared denial/audit contracts apply"
    source: "FR8, FR9"
  - id: BR2.9
    statement: "Teacher naming and navigation"
    category: policy
    applies_to: "Current teacher screens and routes"
    trigger: "Current UI rendering"
    logic: "IF role is kindergarten_teacher THEN use Óvónő copy and teacher schedule/detail names; preserve Parent, Group admin and Super administrator navigation ownership"
    violation: "No obsolete staff labels in executable teacher surface"
    source: "FR2, FR14"
  - id: BR2.10
    statement: "Responsive accessible parity"
    category: policy
    applies_to: "List, cards, detail and filters"
    trigger: "Rendering and keyboard navigation"
    logic: "IF narrow view THEN use cards; ELSE table; both expose identical fields with text status, wrapping names and a single keyboard-visible representation; keep native filters, labels, reset and safe focus"
    violation: "No color-only status or duplicated focusable hidden content"
    source: "FR7, FR13, NFR3"
  - id: BR2.11
    statement: "Safe bookmark compatibility"
    category: validation
    applies_to: "Legacy schedule/detail bookmarks"
    trigger: "Old route GET"
    logic: "IF old bookmark is requested THEN redirect only to fixed same-origin teacher successor with encoded single-segment id and validated whitelisted group/date context; drop unknown parameters and never accept redirect target input; successor reauthorizes"
    violation: "Malformed context receives destination validation/default behavior; well-formed ungranted scope remains denied"
    source: "FR12, FR13, FR14"
  - id: BR2.12
    statement: "Preserve source ownership and records"
    category: constraint
    applies_to: "Source repository and cross-unit consumers"
    trigger: "Source integration and naming cleanup"
    logic: "IF tracking is introduced THEN preserve business record identities, dates, groups and relationships; extend synthetic source explicitly for owner/assignee/status, retaining absent cases; never write through tracking or guess joins between unrelated fixtures"
    violation: "No new durable tracking store or fabricated production integration evidence"
    source: "FR7, FR10, FR15"
```

## Rules Summary

| Rule | Decision |
| --- | --- |
| BR2.1 | Current assigned-group authority |
| BR2.2 | Strict calendar range |
| BR2.3 | Current source integrity |
| BR2.4 | Browser field allowlist |
| BR2.5 | Explicit absence |
| BR2.6 | Fresh refetch and safe recovery |
| BR2.7 | Empty and denied distinction |
| BR2.8 | Read-only boundary |
| BR2.9 | Teacher naming and navigation |
| BR2.10 | Responsive accessible parity |
| BR2.11 | Safe bookmark compatibility |
| BR2.12 | Preserve source ownership and records |

## Sources

[requirements.md](../../../inception/requirements-analysis/requirements.md), [unit-of-work.md](../../../inception/units-generation/unit-of-work.md), [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md), [components.md](../../../inception/domain-design/components.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md).

