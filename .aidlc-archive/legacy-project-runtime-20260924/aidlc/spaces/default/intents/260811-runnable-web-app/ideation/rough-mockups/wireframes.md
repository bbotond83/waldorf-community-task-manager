# Rough Wireframes

## Canonical Design Baseline

Implementation shall reuse the approved `260729-feature` [rough wireframes](../../../260729-feature/ideation/rough-mockups/wireframes.md), [refined mockups](../../../260729-feature/inception/refined-mockups/mockups.md), and [interaction specification](../../../260729-feature/inception/refined-mockups/interaction-spec.md). This artifact is a delivery bridge, not a redesign. [intent] [scope] [Q1]

## Shared Application Frame

```text
┌──────────────────────────────────────────────────────────────┐
│ Skip link │ Waldorf közösségi feladatok │ Role/profile menu │
├───────────────────┬──────────────────────────────────────────┤
│ Role-aware nav    │ Page heading + context/status           │
│ Parent:           │ Primary route content                    │
│ - Saját feladataim│ Cards/forms/tables from approved mockups │
│ - Értesítések     │ Inline validation and live status region │
│ Staff:            │                                          │
│ - Beosztás        │                                          │
│ Admin, by scope:  │                                          │
│ - Irányítópult    │                                          │
│ - Nyilvántartások │                                          │
│ - Feladatok       │                                          │
│ - Jóváhagyások    │                                          │
│ - Import          │                                          │
└───────────────────┴──────────────────────────────────────────┘
```

Parent navigation excludes the staff schedule. Read-only staff receive schedule visibility without mutation routes. Assigned-group administrators see records and operations only for assigned groups; kindergarten administrators see organization-wide operations; super administrators additionally receive cross-organization administration where the canonical access matrix permits it. Mobile collapses navigation into an accessible menu without changing reading or focus order. [scope] [Q2] [Q4] [prior-wireframes]

## Local Identity Entry

```text
<main aria-labelledby="identity-heading">
  H1 Helyi tesztprofil kiválasztása
  Synthetic profiles: Parent | Staff | Group admin | Kindergarten admin | Super admin
  Profile summary: role + permitted group/organization, never real personal data
  Continue → establish local test session → role home route
</main>
```

Development mode exposes `Tesztprofil váltása`, which clears the synthetic session and returns focus to the identity heading. Direct navigation to a forbidden URL renders denial; switching to an authorized profile and retrying the URL proves authorization routing. Production configuration omits this selector and uses the approved authentication boundary. Accessibility: H1; shared `header`/`nav` plus `main`; keyboard enters at the profile group; validation focuses the first invalid control; success focuses the destination H1. [scope] [Q2] [Q3] [Q4] [prior-wireframes]

## Parent: Saját feladataim

```text
<main>
  H1 Saját feladataim
  Filter/status summary
  Task cards: title, date/time, assignment/capacity/status
  Actions: Jelentkezem | Csere | Lemond
  Detail: ownership, eligibility, pending/outcome history
  Notification/status region
</main>
```

States: available, full, ineligible, assigned, swap-pending, cancellation-pending, approved, rejected, invalidated, empty, loading, and failure/retry. Accessibility: one H1 in `main`, shared `header`/role `nav`, keyboard entry at filters then cards; validation focuses the first invalid control, denial/retry focuses the state heading, and mutation outcomes use the live status region. [backlog] [Q2] [Q3] [Q4] [prior-refined]

## Read-Only Staff: Beosztás

```text
Available: H1 Beosztás → date/group filters → schedule cards/table → permitted detail
Loading: H1 Beosztás → labelled progress status
Empty: H1 Beosztás → "Nincs megjeleníthető beosztás" → clear-filter action
Failure: H1 Beosztás → privacy-safe error → Újra action
Denied: H1 Nincs jogosultság → no schedule/contact content → Vissza action
```

Retry returns to loading and then schedule, empty, or failure. Denial is reached through a forbidden parent/admin route or mutation URL and contains no family data. Accessibility: each state owns one H1 in `main`; keyboard enters at filters for success, clear-filter for empty, retry for failure, and back action for denial; transitions are announced. [scope] [Q2] [Q3] [Q4] [prior-wireframes]

## Administrator: Irányítópult and Operations

Administrator visibility is scoped by role: assigned-group, kindergarten-wide, or cross-organization only where the canonical access matrix grants it. [Q2] [prior-wireframes]

| Route | Primary sequence | States and recovery | Accessibility |
|---|---|---|---|
| Irányítópult | summaries → pending/import/reminder detail | loading, empty, failure → retry | H1 in `main`; first summary link is keyboard entry; retry receives focus |
| Nyilvántartások | list/filter → permitted family/child/group/year detail | loading, empty, denied, failure → retry | H1; labelled table/cards; filter entry; state heading receives focus |
| Feladatok és események | list → create/edit → validate → save | validation, pending, success, conflict/invalidated, failure → safe retry | H1 per list/detail; first invalid field focused; outcome announced |
| Hozzárendelés | task/event → eligible subject → capacity → submit | validation, pending, success, eligibility/capacity conflict, failure | H1; ordered fields; conflict heading focused |
| Jóváhagyások | queue → request detail → approve/reject | empty, pending, success, invalidated, denied, failure → retry | H1; queue entry; outcome announced |
| Import | upload → parse → map/conflicts → immutable preview → confirm | validation, progress, unresolved conflict, pending, success, recovery guidance | H1 per step; step heading focused; row error links; confirm disabled until valid |
| Értesítések | status list → privacy-safe detail → retry eligible failure | loading, empty, retry-pending, success, stale/cancelled | H1; filter entry; retry announced; no personal message body |
| Archívum/Beállítások | search/archive or permitted configuration form | loading, empty, validation, denied, success, failure | H1; first filter/control entry; state/error focus |

Every route uses shared `header`/role `nav`, its own `main`, and one H1. List-to-detail navigation focuses the detail H1; validation focuses the first invalid control; denial/failure focuses its state heading; asynchronous success remains on the initiating control and announces through a live status region. [Q2] [Q3] [Q4] [prior-wireframes] [prior-interactions]

## Required Cross-Cutting States

| State | Presentation | Recovery/action | Source |
|---|---|---|---|
| Loading | Skeleton or concise Hungarian progress text | Wait; no duplicate actions | [Q3] [prior-interactions] |
| Empty | Explain why no records match | Clear filter or start permitted action | [Q3] [prior-interactions] |
| Validation | Field-linked Hungarian errors | Focus first invalid control, correct, resubmit | [Q3] [Q4] |
| Unauthorized | Explain access boundary without leaking data | Focus denial heading; return to permitted route | [Q3] [scope] |
| Dependency failure | Privacy-safe Hungarian error | Focus state heading; retry where safe | [Q3] [prior-interactions] |
| Pending | Disable duplicate mutation and announce status | Await/reload state | [Q3] [prior-interactions] |
| Success | Inline confirmation plus updated content | Continue without losing context | [Q3] [prior-interactions] |
| Invalidated | Explain why prior action is no longer valid | Focus explanation; return to current eligible state | [Q3] [prior-interactions] |

## Accessibility and Responsive Baseline

Use semantic landmarks and headings, a skip link, labelled native controls, visible keyboard focus, Hungarian inline errors, non-colour-only status, live announcements, 44×44 px touch targets, and usable layouts at mobile width and 200% zoom. Tables transform to accessible card summaries where horizontal density would break the flow. [Q4] [prior-wireframes] [prior-interactions]

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [scope] `../scope-definition/scope-document.md`
- [backlog] `../scope-definition/intent-backlog.md`
- [prior-wireframes] `../../../260729-feature/ideation/rough-mockups/wireframes.md`
- [prior-refined] `../../../260729-feature/inception/refined-mockups/mockups.md`
- [prior-interactions] `../../../260729-feature/inception/refined-mockups/interaction-spec.md`
- [Q1]–[Q4] `rough-mockups-questions.md`

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** NOT-READY  
**Iteration:** 2

### Prior-Finding Verification

The revision now establishes the approved `260729-feature` design as canonical, represents parent/staff/administrator entry surfaces, enumerates the shared loading/empty/validation/authorization/pending/success/failure/invalidated states, gives responsive behavior, and supplies heading/landmark/keyboard notes. Those changes address the five previously reported coverage categories. The remaining findings below are new or residual contradictions exposed by checking the revised bridge against its named canonical rough and refined artifacts.

### Findings

1. **Critical — Required inherited administrator screens and state rules are absent.** `Canonical Design Baseline` says implementation shall reuse the named refined mockups and interaction specification without redesign, but `Administrator: Irányítópult and Operations` has no implementable surface or flow for the refined mockups' required role/scope editor and next-request revocation result, family reminder-recipient selection, event-note permissions, or privacy-lifecycle annual-review/departure/hold/30-day/delete-or-anonymize states. The Import row also stops at generic “recovery guidance” and does not preserve the named interaction specification's safe retry-or-rollback and verified-restoration outcome. A developer cannot build these inherited screens from this artifact, and QA cannot trace the required role/state outcomes. Add screen-level sequences, role boundaries, visible fields/actions, failure/recovery states, and accessibility notes for each inherited required detail screen, or explicitly defer each one in the current scope/backlog and reconcile that deferral with Q1's “reuse ... without redesign” answer.

2. **Major — The successful staff schedule state does not define its privacy-safe data boundary.** `Read-Only Staff: Beosztás` specifies only “schedule cards/table → permitted detail.” The named refined mockup is more specific: schedule and coordination display names may appear, while edit controls, contacts, sensitive fields, assignment detail, and unrelated-family rows must not. The current denial state protects data only after forbidden navigation; it does not tell engineering which fields and rows are allowed on the ordinary schedule/detail screen. Define the displayed fields, filtering boundary, permitted coordination names, prohibited fields/actions, and the observable denial/no-leak behavior for out-of-scope rows.

3. **Major — Q3's initial and dependency-failure coverage is missing from local identity/session entry.** `Local Identity Entry` defines selection, validation, success, profile switching, and forbidden-route denial, but not initial session resolution, profile loading, no configured synthetic profiles, adapter/session-establishment failure, retry, or the unauthenticated direct-URL outcome. These are part of the state set explicitly selected in Q3 and are necessary before any role surface is reachable. Add the entry-state sequence and observable recovery/focus behavior so QA can test startup and failure paths without guessing.

4. **Major — Administrator navigation and role visibility are internally incomplete.** `Shared Application Frame` lists Dashboard, Records, Tasks, Approvals, and Import for administrators, while the route table later adds Notifications, Archive, and Settings; it never states which of those entries appears for group, kindergarten, or super administrators. `Értesítések` is also already a parent navigation label while the canonical prior wireframe distinguishes administrator reminder monitoring as `Emlékeztetők`. The general sentence “by scope” is not a testable route/menu contract. Provide one explicit role-to-navigation/route matrix, including administrator schedule access from the named prior access matrix, and use distinct labels or role-qualified destinations where parent notifications and administrator reminder monitoring differ.

### Verdict Rationale

The artifact is materially improved, but engineering would still need product decisions about which inherited administrator capabilities exist, what staff may see, how startup failures recover, and which routes each administrator role receives. QA cannot derive complete role/state/accessibility tests until those decisions are explicit.
