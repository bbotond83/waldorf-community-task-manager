# Interaction Specification

## Basis and Naming

Use the approved existing-layout approach in [refined-mockups-questions.md](refined-mockups-questions.md), the eight approved [stories](../user-stories/stories.md), [requirements](../requirements-analysis/requirements.md) and [team practices](../practices-discovery/team-practices.md). Kindergarten teacher is the English development role name; `Óvónő` is Hungarian UI copy. Examples below describe contracts, not executable implementation. Rough mockups and user-flow inputs are absent in this classic workflow.

## Current Profile Card

| Field | Value |
| --- | --- |
| Component | Current Profile Card |
| Description | Select an existing synthetic profile from the four current role categories. |
| Category | Navigation / input |

### States

| State | Description | Trigger |
| --- | --- | --- |
| Default | Role title, scope summary and native selection button | Authorized local selector load |
| Hover / focus | Existing button styling and visible focus | Pointer / keyboard |
| Submitting | Existing form submission lifecycle; no fabricated success | Select profile |
| Error | Existing safe failure/recovery; no session created for invalid profile | Rejected or removed profile |

### Props / Inputs

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| profileId | string | Yes | — | Current valid synthetic profile identifier; downstream design defines English identifiers. |
| roleLabel | localized string | Yes | — | One of the four approved role categories. |
| scopeSummary | localized string | Yes | — | Existing permitted scope description. |

### Responsive Behaviour

Retain the existing fluid profile grid; stack cards as available width requires. Four categories do not imply a maximum of four real users.

### Accessibility

Native button uses visible `Profil használata` copy within a semantically headed card. Tab focuses it; Enter/Space activates it. Preserve visible focus, usable target and existing post-submission navigation. Contrast must be measured on the rendered implementation; this document makes no measurement claim.

### Usage Example

```text
CurrentProfileCard(current teacher profile, UI label "Óvónő", assigned-group summary)
Select -> validate current profile -> existing authorized home or safe failure
```

## Authorized Schedule Filter

| Field | Value |
| --- | --- |
| Component | Authorized Schedule Filter |
| Description | Read existing scheduled tasks/events for an assigned group and date range. |
| Category | Input |

### States

| State | Description | Trigger |
| --- | --- | --- |
| Default / edited | Native group/date fields reflect current safe filter values | Load / user edit |
| Hover / focus | Existing focus and control treatment | Pointer / keyboard |
| Loading | Request fresh authorized data; no optimistic changes | Submit or reset |
| Invalid | Explain invalid dates or range longer than existing 31-day limit | Validation failure |
| Denied | Replace protected results with safe access state | Scope or session no longer valid |

### Props / Inputs

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| authorizedGroups | permitted group list | Yes | — | Current grant-derived options only; zero groups produces denied/no-access handling. |
| groupId | string | Yes | Existing authorized selection | Must be validated against current grants. |
| from / to | dates | Yes | Existing valid range | Preserve current date semantics and maximum 31-day range. |
| safeReturnContext | validated filter values | No | — | Supports details/back and retry without trusting raw query input. |

### Responsive Behaviour

Keep the existing filter layout above 44rem. At 44rem and below stack native inputs; submit/reset remain reachable. No alternate mobile authorization path.

### Accessibility

Use visible associated labels and native select/date inputs. Tab follows document order; Enter submits using existing form behavior. Preserve visible focus and associate validation guidance with the relevant fields. Error heading receives existing focused-state treatment after navigation; no automatic submission on merely changing a group is introduced.

### Usage Example

```text
AuthorizedScheduleFilter(current grants, group, from, to)
Submit -> validate -> recheck session/scope -> collection or state panel
Reset -> existing valid authorized defaults -> refetch
```

The existing GET form pattern is retained. There is no task mutation, group assignment, export or advanced-operation action in this filter.

## Tracking Collection

| Field | Value |
| --- | --- |
| Component | Tracking Collection |
| Description | Display permitted task/event tracking records as a table or cards. |
| Category | Display / navigation |

### States

| State | Description | Trigger |
| --- | --- | --- |
| Populated | Date/title/group/owner/assignees/current status plus details link | Successful authorized response |
| Partial | Explicit absence for missing owner, assignment or unavailable status | Permitted record lacks a field |
| Empty | Authorized result has no matching records | Successful empty response |
| Loading / error / denied | State panel replaces protected results | Pending or failed authorization/data request |
| Link hover / focus | Existing visible link treatment | Pointer / keyboard |

### Props / Inputs

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| items | permitted projection list | Yes | — | Allowlisted tracking fields only; no hidden private fallback data. |
| ownerDisplayName | string or absence | Per item | Explicit absence | Distinct from coordination contact and assignees. |
| assigneeDisplayNames | string list | Per item | Explicit absence | Existing permitted assignment identities. |
| currentStatusLabel | localized existing status or absence | Per item | Explicit unavailable message | Reflect current source state; no new status enum is defined here. |
| detailLinkContext | validated item/filter context | Yes | — | Rechecked when details are requested. |

### Responsive Behaviour

Above 44rem use the existing semantic table and local horizontal overflow. At 44rem and below show cards with the same labeled fields. Hide the alternate representation using the existing display switch so it has no focusable duplicates. Names/titles wrap; tracking fields remain visible.

### Accessibility

Table caption and column headers identify values; cards use meaningful headings and labeled values. Native details links support keyboard activation and have an understandable item context. Status is text, not color alone. Preserve Hungarian date display and current Budapest time-zone convention. No row-as-button or mutation controls are introduced.

### Usage Example

```text
TrackingCollection(authorized projected items, safe filters)
Details -> fresh session/group/item check -> read-only detail
No items after authorization -> "Nincs találat", clear-filter action
```

Use `Nincs kijelölt felelős`, `Nincs beosztott` and `Nincs elérhető állapot` for actual field absences. Domain Design must map authoritative source fields; this specification does not claim those additions already exist.

## Read-only Schedule Detail

| Field | Value |
| --- | --- |
| Component | Read-only Schedule Detail |
| Description | Inspect tracking fields and existing permitted location/coordination information. |
| Category | Display / navigation |

### States

| State | Description | Trigger |
| --- | --- | --- |
| Populated / partial | Focused heading and labeled definition-list values | Fresh authorized item response |
| Denied / invalidated | Safe state replaces item; no existence disclosure | Item/group/session authorization fails |
| Loading / dependency failure | Existing feedback/recovery panel | Fetch lifecycle |
| Back link hover / focus | Existing link styling | Pointer / keyboard |

### Props / Inputs

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| item | permitted detail projection | Yes | — | Tracking values plus separately labeled existing location/coordination. |
| backContext | validated authorized filters | Yes | — | Preserve existing schedule context on return. |

### Responsive Behaviour

Retain the current detail layout and wrap definition values on narrow widths. No toolbar or modal is added.

### Accessibility

Keep focused detail heading and native back link. Definition terms label each value. Preserve keyboard order and visible focus; return retains safe filters through existing navigation. Owners and coordination contacts are separately named, and no private contacts, financial, allergen or unrelated family data enters markup or announcements.

### Usage Example

```text
ReadOnlyScheduleDetail(authorized item, safe filters)
Back -> schedule with preserved filters -> recheck grants and refetch
```

## State and Recovery Panel

| Field | Value |
| --- | --- |
| Component | State and Recovery Panel |
| Description | Distinguish empty results, invalid filters, denied access and dependency/session failures. |
| Category | Feedback / navigation |

### States

| State | Description | Trigger |
| --- | --- | --- |
| Loading | Existing localized pending state, no stale protected records | Pending request |
| Authorized empty | Existing polite status and clear-filter link | Successful authorized empty result |
| Invalid filter | Date-range guidance and correction path | Failed filter validation |
| Denied / no groups | Generic existing access denial without protected names/counts | Failed current scope/item access |
| Invalidated session | Safe existing sign-in recovery; no stale-role rendering | Session requires refresh/reauthentication |
| Retryable error | Existing retry link with safe context | Temporary dependency failure |
| Terminal error | Existing later-retry guidance | No immediate supported retry |

### Props / Inputs

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| state | existing supported state | Yes | — | Determined by authorization/validation/data outcome, not inferred from missing rows. |
| safeRecovery | existing safe link/context | When applicable | — | Clear filters, correct inputs, retry or sign in. |
| localizedMessage | allowlisted text | Yes | — | No unauthorized item/group/owner disclosure. |

### Responsive Behaviour

Reuse current inline panel at all widths; messages wrap and recovery controls remain usable. No new dialog or notification system.

### Accessibility

Preserve existing polite status for authorized empty results and FocusedStateSection behavior for failures. Recovery uses native links/buttons with visible text/focus. Avoid duplicate announcements and automatic retry loops. Loading/error content must not retain stale protected records in hidden DOM. Actual announcement and focus behavior require downstream browser checks.

### Usage Example

```text
StateAndRecoveryPanel(retryable failure, safe current filters)
Retry -> recheck current session/grants -> refetch data -> appropriate state
StateAndRecoveryPanel(invalidated session, existing safe sign-in recovery)
Sign in -> current-role resolution -> authorized destination or denial
```

## Story Transitions and Boundaries

| Story | Interaction outcome |
| --- | --- |
| US1.1 | Four current profile/role categories; invalid legacy selection cannot mint a fifth role/session. |
| US2.1 | Authorized filters -> collection -> detail -> back; owner/assignment/status and absences present in both responsive layouts. |
| US2.2 | Kindergarten teacher has read-only navigation; direct mutation requests independently denied. |
| US3.1 | Converted active staff grants resolve to Kindergarten teacher screens; inactive/revoked grants remain inactive/revoked. |
| US3.2 | Converted active kindergarten-admin grants resolve to existing organization-scoped Super administrator screens including governance; no migration wizard. |
| US3.3 | Changed/revoked grants trigger current authorization or safe refresh/sign-in, without stale protected content; last-super-administrator protection remains server/domain work. |
| US4.1 | Preserve Parent own-family and Group admin core-group flows; advanced operations belong to Super administrator, with independent direct-request denial for other roles. |
| US4.2 | Remove obsolete current-role labels/options while retaining actual business groups, records and historical evidence; migration/cleanup has no invented UI flow. |

## Assumptions & Open Questions

None for interaction direction. Domain/Contract Design will resolve authoritative field projection, English identifiers and route compatibility. These artifacts specify design targets, not implementation, executed tests, measured contrast or accessibility certification. See [mockups.md](mockups.md), [design-system-mapping.md](design-system-mapping.md) and [accessibility-checklist.md](accessibility-checklist.md).
