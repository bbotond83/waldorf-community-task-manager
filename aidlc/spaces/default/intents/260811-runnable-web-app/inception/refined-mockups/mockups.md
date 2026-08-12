# Refined Mockups

## Canonical Baseline and Scope

The approved `260729-feature` [mockups](../../../260729-feature/inception/refined-mockups/mockups.md), [interaction specification](../../../260729-feature/inception/refined-mockups/interaction-spec.md), [design-system mapping](../../../260729-feature/inception/refined-mockups/design-system-mapping.md), and [accessibility checklist](../../../260729-feature/inception/refined-mockups/accessibility-checklist.md) remain normative. This refinement makes that complete product locally runnable; it does not replace it with a task demo or redesign its journeys.

The screen inventory traces to the current [wireframes](../../ideation/rough-mockups/wireframes.md), [user flow](../../ideation/rough-mockups/user-flow.md), [stories](../user-stories/stories.md), [requirements](../requirements-analysis/requirements.md), and [team practices](../practices-discovery/team-practices.md).

## Shared Application Frame

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Ugrás a tartalomra │ Waldorf közösségi feladatok │ Tesztprofil / Fiók     │
├────────────────────┬───────────────────────────────────────────────────────┤
│ Role-aware nav     │ Breadcrumb/context                                   │
│ Active destination │ H1 + scope/status                                    │
│                    │ Primary content                                      │
│                    │ Inline errors + aria-live outcome region              │
└────────────────────┴───────────────────────────────────────────────────────┘
```

The first focusable control is `Ugrás a tartalomra`. One `main` landmark and one H1 identify every route or full-page state. Desktop uses a persistent side navigation; below 1024px it collapses; below 768px content is single-column and dense tables become labelled cards without changing DOM reading or focus order. `Tesztprofil váltása` appears only in explicit synthetic development mode.

## Local Startup and Identity

```text
Initial session resolution
├─ resolving → “Munkamenet betöltése…” status
├─ authenticated synthetic session → authorized role home
├─ no session → H1 Helyi tesztprofil kiválasztása
├─ no configured profiles → H1 Nincs elérhető tesztprofil + Beállítás ellenőrzése
└─ adapter/session failure → H1 A helyi munkamenet nem indítható + Újra

Profile selection
→ Parent | Staff | Group admin | Kindergarten admin | Super admin
→ role + synthetic scope summary
→ Folytatás
├─ pending → duplicate submission disabled
├─ success → authorized home; focus destination H1
└─ failure → privacy-safe inline error; focus error summary; retry enabled
```

An unauthenticated direct URL preserves only the intended path, redirects to the selector, and reveals no protected content. Selecting an authorized profile resumes at that path; selecting an unauthorized profile renders `Nincs jogosultság`. Switching profile clears the previous session and cached scoped data before returning focus to the selector H1. Production configuration contains neither selector nor synthetic identities and enters through the approved Supabase authentication boundary.

## Invitation and Authentication Entry

```text
Open invitation link
├─ valid → H1 Meghívás elfogadása → synthetic identity/account summary → Folytatás
│  ├─ pending → duplicate submit disabled
│  ├─ success → Belépés → upcoming-duty notice or empty state
│  └─ failure → retryable/non-retryable result from explicit state union
├─ expired → H1 A meghívó lejárt → Új meghívó kérése
├─ used → H1 A meghívót már felhasználták → Belépés
└─ invalid/unknown → same non-enumerating response as expired; no account existence signal

Resend → labelled identifier input → Küldés
→ always: “Ha a meghívás megújítható, elküldtük az új hivatkozást.”
→ focus remains on form; one polite announcement; no account-existence disclosure

Authentication entry
├─ synthetic local mode → selected profile session establishment
└─ production composition → Supabase boundary (not locally claimed as verified)
→ success
   ├─ upcoming duty → notice with permitted Saját feladataim link
   └─ none → “Nincs közelgő feladat” + permitted home link
→ validation → error summary/field link
→ denied → Nincs jogosultság; no intended-resource content
→ retryable dependency failure → Újra, same safe context
└─ non-retryable failure → Vissza a belépéshez, no retry control
```

Valid invitation success focuses `Meghívás elfogadása`; authentication completion focuses the destination H1. Expired, used, invalid, denied, retryable, and terminal failure each focus their state heading. Resend uses identical visible copy for known and unknown identities. Synthetic fixtures are `invite-valid`, `invite-expired`, `invite-used`, `invite-invalid`, `invite-resent`, `auth-upcoming-duty`, `auth-no-upcoming-duty`, `auth-validation`, `auth-denied`, `auth-failure-retryable`, and `auth-failure-terminal`.

## Role-to-Navigation Matrix

| Destination | Parent | Read-only staff | Group admin | Kindergarten admin | Super admin |
|---|---:|---:|---:|---:|---:|
| Saját feladataim | Yes, linked family only | No | No | No | No |
| Értesítések | Yes, own privacy-safe notices | No | No | No | No |
| Beosztás | No | Yes, permitted schedule | Yes, assigned groups | Yes, organization | Yes, permitted organizations |
| Irányítópult | No | No | Assigned-group | Organization | Cross-organization |
| Nyilvántartások | No | No | Assigned-group | Organization | Cross-organization |
| Feladatok és események | No | No | Assigned-group | Organization | Cross-organization |
| Hozzárendelés | No | No | Assigned-group | Organization | Cross-organization |
| Jóváhagyások | No | No | Assigned-group | Organization | Cross-organization |
| Import | No | No | No — `AUTH-GRP-IMPORT-DENY` | Yes — `AUTH-KDG-ORG-OPS` | Yes — `AUTH-SUP-GOV` |
| Emlékeztetők | No | No | Assigned-group status | Organization status | Cross-organization status |
| Archívum | No | No | Assigned-group read | Organization | Cross-organization |
| Beállítások | No | No | Granted group settings | Organization settings | Organization + role governance |

UX-AUTH-0.1 below is authoritative for every rendered route in this artifact; none of these navigation cells is conditional. The final FR-LR-14 implementation matrix must preserve these UX decisions and add exact API/error/audit contracts. Prohibited destinations and controls are absent from navigation and denied by the same server-side rule on direct UI/API requests. Parent `Értesítések` and administrator `Emlékeztetők` are distinct destinations.

## Parent Surfaces

### Saját feladataim

Cards show task/event title, Budapest-local date/time, linked-family context, capacity, eligibility, assignment, and request status. Actions are `Jelentkezem`, `Csere kérése`, and `Lemondás kérése` only when allowed. Full and ineligible cards replace the action with a text explanation. Detail views expose only the parent's family, own contribution, request history, and privacy-safe notification outcome.

States: skeleton loading; no duties with clear-filter action; eligible; full; ineligible; assigned; pending; approved; rejected; invalidated; dependency failure with safe retry. Pending disables duplicate mutation. Success updates the card in place and announces the result.

### Értesítések

Cards show notice type, privacy-safe summary, created date, read state, and permitted destination link. `Olvasottnak jelölés` updates inline. No recipient contact, unrelated family, provider payload, or protected reason is rendered.

## Read-Only Staff Surface

`Beosztás` includes date and granted-group filters, total-result summary, then schedule cards/table containing date/time, activity, granted group, location when permitted, assigned coverage status, and only the coordination display names required by the approved access matrix. It never shows email, phone, residence/locality, optional profile fields, protected request reasons, unrelated-family rows, parent assignment detail, or mutation controls.

Out-of-scope row/API access returns generic denial with no schedule or contact payload. Loading, empty, failure/retry, and permitted detail states retain the same field boundary. Filter entry is first after H1; state transitions announce; denial focuses its H1.

## Administrator Surfaces

### Irányítópult and Records

Dashboard cards show scoped counts for upcoming duties, pending approvals, import attention, reminder failures, annual privacy review, and archive activity. `Nyilvántartások` provides scoped family, child, group, and school-year lists with explicit filters, result counts, pagination, and permitted detail fields. Empty, loading, denied, and dependency-failure states provide a single recovery action.

### Tasks, Events, Assignments, and Notes

Task/event list flows to create/edit detail with labelled fields, validation summary, capacity and eligibility context, save/cancel actions, and conflict refresh. Assignment detail selects permitted context and eligible subject before submission. Event-note detail lets parents edit only their own contribution; in-scope administrators edit supply, food, and allergen notes; allergen visibility is limited to assigned, signed-up, or explicitly granted participants.

### Approvals

Queue filters by request type, group, state, and date. Detail shows the scoped request, current assignment state, protected reason only where authorized, audit-safe history, and `Jóváhagyás` / `Elutasítás`. Submission rechecks authority and current state. Success returns an updated outcome; stale state becomes `A kérelem időközben megváltozott` with refresh; infrastructure failure never presents partial success and permits only idempotent retry.

### Import

The sequential screen set is `Feltöltés → Feldolgozás → Megfeleltetés → Ütközések → Változtathatatlan előnézet → Megerősítés → Eredmény`. Back navigation preserves draft mapping. Confirm remains disabled until blocking conflicts resolve. Interrupted commit shows the immutable preview reference, redacted outcome evidence, `Biztonságos újrapróbálás` or `Visszaállítás`, and a visible verified-restoration state; neither recovery path duplicates committed records.

### Reminders and Recipient Selection

`Emlékeztetők` shows schedule/status, attempt outcome, stale/cancelled state, and eligible retry without provider body or contact data. Family reminder-recipient detail lists active linked parents and allows one primary recipient; without a selection, every active linked parent remains the documented default.

### Roles, Access, and Immediate Revocation

Super-admin role/scope detail shows current grants, proposed change, affected routes/resources, explicit confirmation, and redacted audit evidence. After revocation, the affected synthetic profile's next UI/API/data request renders `Nincs jogosultság`; previously cached protected data is removed and cannot flash during transition.

### Privacy Lifecycle and Archive

Annual-review queue and family-departure detail show sibling/hold deferral, departure date, 30-day countdown, final delete/anonymize result, and access-controlled redacted audit history. `Archívum` provides school-year filters and scoped read-only results. Missing authorization produces generic denial rather than lifecycle metadata.

## Cross-Cutting State Contract

| State | Presentation | Focus and recovery |
|---|---|---|
| Initial/resolving | Concise labelled status | Stay in status region; no duplicate action |
| Loading | Content-shaped skeleton plus accessible text | Preserve route H1 and filter context |
| Empty | Reason and one permitted next action | Focus H1; action follows explanation |
| Validation | Summary plus field-linked Hungarian messages | Focus summary, then first invalid field |
| Pending | Initiating control disabled with progress text | Keep focus; announce completion |
| Success | Inline confirmation and refreshed content | Keep context; announce politely |
| Denied | `Nincs jogosultság`, no protected payload | Focus denial H1; return to permitted route |
| Conflict/invalidated | Current state and why action cannot continue | Focus state heading; refresh/reselect |
| Dependency failure | Privacy-safe message without raw details | Focus error heading; safe retry if idempotent |
| Recovery | Immutable reference and verified outcome | Explicit retry/rollback, never both concurrently |

## Responsive Examples

At 320–767px, navigation is a labelled disclosure, cards are single-column, filters use a collapsible fieldset, primary actions span available width, and each touch target is at least 44×44 CSS pixels. At 768–1023px, filters and summaries may form two columns while data remains card-first. At 1024–1439px, the side navigation and tabular views appear. At 1440px and wider, content is capped near 1200px. All layouts work at 200% zoom without two-dimensional scrolling except intrinsically tabular content, which has an equivalent card view.

## UX Authorization Contract

This artifact defines **UX-AUTH-0.1**. Its stable row and sensitive-field IDs freeze the rendered allow/absence/denial behavior for mockup acceptance. Approval of this stage approves this UX rendering contract. The standalone FR-LR-14 implementation matrix must preserve these rows, add exact application error/HTTP/audit fields, record its version/hash and approval receipt, and remains the US-LR-00 gate before dependent route implementation acceptance.

| Row ID | Actor and scope | Rendered allow case | Absent/denied case |
|---|---|---|---|
| AUTH-PAR-OWN | Parent, linked family | duties, own assignments/requests/notes/notices | AUTH-PAR-UNRELATED-DENY |
| AUTH-PAR-UNRELATED-DENY | Parent, unrelated family | — | route/action/resource absent; direct request generic denial; no fields/mutation |
| AUTH-STA-SCHEDULE | Staff, granted groups | schedule fields + SF-PARTICIPANT-NAME only when needed for coordination | no edit, assignment detail, contact, profile, reason, or unrelated row |
| AUTH-STA-SENSITIVE-DENY | Staff, any sensitive request | — | SF-EMAIL/PHONE/LOCALITY/OPTIONAL-PROFILE/PROTECTED-REASON absent; generic denial |
| AUTH-GRP-SCOPED-OPS | Group admin, granted groups | schedule, dashboard, records, tasks/events, assignments, approvals, reminder status, archive, granted group settings | outside-group rows/actions absent and direct requests denied |
| AUTH-GRP-IMPORT-DENY | Group admin | — | Import destination/action absent; direct request denied |
| AUTH-GRP-OUTSIDE-DENY | Group admin, ungranted group | — | generic denial; no row/count/field/mutation |
| AUTH-KDG-ORG-OPS | Kindergarten admin, own organization | all group-admin operations plus organization import, lifecycle, recipient selection and settings | cross-organization resources absent/denied |
| AUTH-KDG-GOV-DENY | Kindergarten admin | — | super-admin role/governance controls absent; direct request denied |
| AUTH-SUP-GOV | Super admin, permitted organizations | cross-organization operations plus role/scope governance | organizations outside grant absent/denied |
| AUTH-EVENT-NOTES | Parent/admin/participant | parent edits own contribution; scoped admin edits supply/food/allergen; assigned/signed-up/explicit participant reads allergen | every other note field/action absent and direct mutation denied |
| AUTH-ALL-REVOKED | Any actor after grant removal | permitted destination only | next request clears protected cache/navigation and renders generic denial |

Sensitive-field dictionary IDs: **SF-EMAIL**, **SF-PHONE**, **SF-LOCALITY**, **SF-OPTIONAL-PROFILE**, **SF-PROTECTED-REASON**, **SF-PARTICIPANT-NAME**, and **SF-UNRELATED-FAMILY**. Approval detail may render SF-PROTECTED-REASON only through AUTH-GRP-SCOPED-OPS, AUTH-KDG-ORG-OPS, or AUTH-SUP-GOV when the final FR-LR-14 row grants the request type; until that final row exists, the reason block is labelled **BLOCKED — US-LR-00** and omitted from implementation. Participant names follow AUTH-EVENT-NOTES. Import is exactly Kindergarten/Super only. Reminder monitoring follows each administrator's scoped-operation row. Super-admin governance follows AUTH-SUP-GOV only.

## Screen-by-State Inventory

Legend: `R` required fixture; `—` not applicable because the screen has no such state. Initial (`I`), loading (`L`), empty (`E`), validation (`V`), pending (`P`), success (`S`), denied (`D`), conflict/invalidated (`C`), dependency failure (`F`), retry/recovery (`Rcv`).

| Screen | I | L | E | V | P | S | D | C | F | Rcv |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Local identity | R | R | R | R | R | R | R | — | R | R |
| Invitation/auth entry | R | R | R | R | R | R | R | R | R | R |
| Parent duties/detail | R | R | R | — | R | R | R | R | R | R |
| Parent swap/cancel | R | R | — | R | R | R | R | R | R | R |
| Parent notifications | R | R | R | — | R | R | R | R | R | R |
| Staff schedule | R | R | R | — | — | R | R | — | R | R |
| Dashboard | R | R | R | — | — | R | R | — | R | R |
| Records/create/edit | R | R | R | R | R | R | R | R | R | R |
| Tasks/events/assignments | R | R | R | R | R | R | R | R | R | R |
| Approval queue/detail | R | R | R | R | R | R | R | R | R | R |
| Import sequence | R | R | R | R | R | R | R | R | R | R |
| Reminder monitoring | R | R | R | — | R | R | R | R | R | R |
| Roles/governance | R | R | R | R | R | R | R | R | R | R |
| Privacy lifecycle | R | R | R | R | R | R | R | R | R | R |
| Archive/restore | R | R | R | — | R | R | R | R | R | R |

Exact state fixtures and controls:

| Screen | Required state behavior |
|---|---|
| Identity | `Munkamenet betöltése…`; `Nincs elérhető tesztprofil`; field error + `Folytatás`; pending disables submit; success focuses home H1; denied shows no intended-resource data; `A helyi munkamenet nem indítható` + `Újra`. |
| Invitation/auth | Valid invitation, expired, used, invalid/unknown, resend, auth validation, pending, upcoming-duty success, no-duty success, denied, retryable failure, and non-retryable failure use the exact screens/copy/controls in `Invitation and Authentication Entry`; resend never enumerates identity. |
| Parent duties | Empty `Nincs megjeleníthető feladat`; full/ineligible replace signup; pending blocks duplicate; success refreshes one card; conflict/invalidated explains current eligibility; retry preserves filters only for retryable dependency failure. |
| Swap/cancel | Validation summary; pending; approved/rejected; denied; invalidated on competing change; retryable failure reuses idempotency key; non-retryable failure offers `Vissza a részletekhez`. |
| Notifications | Loading status; empty `Nincs új értesítés`; read pending/success; stale destination becomes invalidated; denied hides notice; retryable load/read failure preserves filter/read context. |
| Staff | Loading; empty + `Szűrők törlése`; populated AUTH-STA-SCHEDULE; denied AUTH-STA-SENSITIVE-DENY; failure + safe `Újra`; no mutation states. |
| Dashboard | Loading; all-zero empty guidance; populated summaries; denied no counts; failure + `Újra`; no mutation states. |
| Records | Loading/empty; create/edit validation; pending; one-record success; stale conflict refresh; denied per scope row; retryable failure preserves filters/form draft, non-retryable returns to detail. |
| Tasks/assignments | Empty list; validation; pending duplicate block; success; full/ineligible/stale conflict; denial; retryable dependency failure with idempotency; terminal failure returns to current detail. |
| Approvals | Uses the exact outcome table below; queue loading/empty/failure and detail validation are independently fixture-backed. |
| Import | Initial upload; parse loading; empty-sheet warning; row validation; commit pending/success; preview-version conflict; denial; retry/rollback only as returned; verified restoration terminal. |
| Reminders | Loading/empty; retry pending/success; stale/cancelled invalidated; denied; retryable provider/job failure shows `Újra`; non-retryable shows guidance only. |
| Governance | Empty grants; validation; confirmation pending/success; stale grant conflict; denial; retryable failure preserves proposal; revocation immediately exercises AUTH-ALL-REVOKED. |
| Lifecycle | Empty queue; hold/date validation; pending/success; sibling/re-enrolment/concurrent-change invalidation; denial; retryable failure preserves authorized case; terminal failure returns to queue. |
| Archive | Empty; archive/restore pending/success; restore conflict; denied; retryable dependency failure; terminal failure offers return without retry. |

## Approval Outcome Contract

| Outcome | Heading/message class | Mutation invariant | Retry | Idempotency, focus, announcement, recovery |
|---|---|---|---|---|
| Approve | `A kérelem jóváhagyva` | exactly one approved transition | absent | original key; focus stays on action/result region; one polite announcement; return to filtered queue |
| Reject | `A kérelem elutasítva` | exactly one rejected transition | absent | original key; same focus/announcement; return to filtered queue |
| Already decided | `A kérelemről már döntés született` | unchanged | absent | classify conflict; focus outcome heading; announce once; `Aktuális állapot megnyitása` |
| Invalidated | `A kérelem már nem érvényes` | unchanged | absent | focus heading; announce once; `Frissített részletek` |
| Denied | `Nincs jogosultság` | unchanged, no oracle | absent | focus denial H1; generic announcement; `Vissza` |
| Retryable dependency failure | `A döntés nem menthető` | unchanged before retry | present: `Újra` | manifest `retryable: true`; same key; at most one terminal transition; focus error heading, assert once |
| Non-retryable dependency failure | `A döntés most nem folytatható` | unchanged | absent | manifest `retryable: false`; focus error heading, assert once; `Vissza a kérelemhez` guidance |

This table supersedes the earlier generic phrase that infrastructure failure always permits retry.

## Complex Responsive Contracts

| Screen | Mobile <768px | Tablet 768–1023px | Desktop >=1024px | DOM/focus and preservation |
|---|---|---|---|---|
| Import | one step/page; mapping rows as labelled cards; conflict filters disclosed above cards; sticky-within-flow Back/Continue, never viewport-obscuring | step list + active panel; card mapping remains normative | step rail + active panel; table optional with card toggle | step heading → errors → fields/rows → actions; Back preserves upload/mapping/filter; at 320px/200% card view is mandatory, no 2D scroll |
| Grant matrix | one resource accordion at a time; role/scope summary precedes grants; review page before confirm | two-pane summary + grant groups | matrix table plus always-available accessible list alternative | role → scope → resource → action/field grants → review; disclosure state preserved; at 320px/200% list is normative |
| Approvals | filter disclosure → result cards → detail page; decision bar follows content, not fixed overlay | filters above two-column queue/detail when space permits | filter rail + queue/detail | filters → results → detail → reason → actions; filters and selected request preserved on return/conflict |
| Lifecycle | vertical timeline cards; current state expanded; final action after full summary | timeline beside detail | timeline + detail columns | summary → chronological states → reason/hold fields → action; selected case/filter preserved |
| Wide validation summary | full-width summary before first field/card; links wrap | summary spans all columns | summary spans form grid | summary is first invalid focus target; DOM link order matches field order at every breakpoint |

## Story-to-Screen Traceability

| Story | Screen/component | State/acceptance paths | Requirement trace | Spec section |
|---|---|---|---|---|
| US-LR-00 | UX Authorization Contract | stable rows/fields, blocked final matrix gate | FR-LR-14, NFR-LR-05 | UX Authorization Contract |
| US-LR-01 | startup/runbook marker | ready/build/start/config error | FR-LR-01/02/11/12 | Local Startup and Identity |
| US-LR-02 | LocalIdentitySelector | select/switch/production absence/crafted denial | FR-LR-04/05/06 | Local Startup and Identity |
| US-LR-03 | AppShell/RoleNavigation | role nav, mobile, zoom, deep-link denial | FR-LR-07/14 | Shared Frame; Role Matrix |
| US-LR-04a | Parent duties | loading/empty/available/full/ineligible/signup | FR-LR-08, US-01/02 | Parent Surfaces |
| US-LR-04b | Swap/cancel detail | validation/pending/approved/rejected/conflict/retry | FR-LR-08, US-03 | Parent Surfaces; State Inventory |
| US-LR-04c | Notifications | reminder timing/read/link/stale/provider-outstanding | FR-LR-10a/b, US-04 | Parent Surfaces |
| US-LR-04d | shared feedback | validation/focus/slow/error/recovery | NFR-LR-03/04 | Cross-Cutting Contract |
| US-LR-04e | invitation/auth entry | valid/expired/used/resend/upcoming-duty | FR-LR-10a, NFR-08 | Local Startup and Identity; State Inventory |
| US-LR-04f | event notes | own contribution/allergen allow/deny | FR-07, US-07 | Tasks, Events and Notes; AUTH-EVENT-NOTES |
| US-LR-05 | staff schedule | filter/detail/empty/failure/field/action denial | FR-LR-09, US-13 | Staff Surface |
| US-LR-06a1 | records | list/filter/detail/create/edit/all states | US-05/06 | Dashboard and Records |
| US-LR-06a2 | archive/restore | empty/pending/success/conflict/deny/retry | US-05, NFR-08 | Privacy Lifecycle and Archive |
| US-LR-06b1 | tasks/events | create/edit/archive/pending/stale/deny/failure | US-05 | Tasks, Events and Notes |
| US-LR-06b2 | assignments | eligibility/capacity/conflict/duplicate/deny | FR-05/05a | Tasks, Events and Assignments |
| US-LR-06c | approvals | seven exact outcomes | US-03/05 | Approval Outcome Contract |
| US-LR-06d | import | seven steps/atomic commit/retry/rollback | US-08–10 | Import; Responsive Contracts |
| US-LR-06e | reminders | empty/stale/cancelled/failure/retry/idempotency | US-04, FR-LR-10a/b | Reminders |
| US-LR-06f | lifecycle | annual/departure/hold/sibling/30-day/delete | US-11 | Privacy Lifecycle |
| US-LR-06g | governance/settings | grant change/deny/revocation/cache clear | US-06, NFR-LR-05 | Roles and Access |
| US-LR-06h | shared forms/import entry | normalized values/stable error/no mutation | US-12, FR-12 | Forms; State Inventory |
| US-LR-07 | all role surfaces | table-driven allow/deny/redaction evidence | NFR-LR-05 | UX Authorization Contract |
| US-LR-08 | all critical flows | browsers/a11y/performance/quality evidence | NFR-LR-02/03/04/07 | Accessibility Checklist |
| US-LR-09 | local handoff | fresh checkout/evidence/outstanding/no deploy | FR-LR-12/13/13a | Canonical Scope; Acceptance Boundary |
| US-01 | parent duty list | own duties/eligibility/privacy | FR-02/03 | Parent Duties |
| US-02 | signup | available/full/ineligible/duplicate | FR-05 | Parent Duties |
| US-03 | swap/cancel | pending/atomic approval/rejection/invalidation | FR-05/05a | Swap/Cancel; Approvals |
| US-04 | reminders | scheduling/status/read/link/retry | FR-13/14 | Notifications; Reminders |
| US-05 | admin records/coordination | scoped CRUD/assignment/approval | FR-01/03/05 | Admin Surfaces |
| US-06 | roles/access | grants/revocation/audit | FR-01/03 | Roles and Access |
| US-07 | event notes | contribution/allergen visibility | FR-07 | AUTH-EVENT-NOTES |
| US-08 | import preview | mapping/conflicts/hostile input | FR-08/09/12a | Import Sequence |
| US-09 | import commit | immutable/atomic/repeat/recovery | FR-10/11/12a | Import Sequence |
| US-10 | preserved status | archive/import result read-only values | FR-06 | Archive; Import Result |
| US-11 | privacy lifecycle | review/hold/grace/delete/anonymize | FR-04/15 | Privacy Lifecycle |
| US-12 | shared validation | UI/API/invitation/profile/import parity | FR-12 | Forms and Validation |
| US-13 | staff schedule | permitted names/no sensitive fields/no mutation | FR-03 | Staff Surface |
| US-14 | invitation/auth entry | expiry/resend/login/upcoming duty | FR-13/14 | Local Startup and Identity |

## Review

**Reviewer:** aidlc-product-lead-agent

**Verdict:** NOT-READY

**Iteration:** 1

The artifacts establish a coherent shell, privacy posture, responsive baseline, and accessibility vocabulary, and all required upstream artifact types are referenced. They are not yet precise enough for engineering and QA to implement and accept the full experience without returning for product decisions.

### Blocking findings

1. **The traceability register is not an executable story-to-screen mapping.** The `Traceability` section assigns the shared shell to `US-LR-04`, Parent and Staff collectively to `US-LR-05/06`, administrator surfaces to the ambiguous range `US-LR-06a1–10`, and authorization/privacy to `US-LR-11–14`. These references neither identify each owning delivery story nor map individual screens and states to acceptance criteria; `US-LR-06a1–10` is especially impossible to interpret as a stable set of story IDs. This contradicts the stage requirement to produce mockups per user story/screen and prevents QA from proving coverage. Good looks like a table with one row per actual story/acceptance path, its screen or component, applicable state variants, requirement IDs, and the artifact section that specifies it.

2. **The promised state inventory is generic rather than complete per critical surface.** Q3 commits to initial, loading, empty, validation, pending, success, denied, conflict/invalidated, dependency failure, retry, and recovery states. The cross-cutting table lists generic presentations, but the screen specifications do not declare applicability or expected outcomes: `Értesítések` has no loading/empty/denied/failure behavior; administrator records omit create/edit validation, pending, success, and conflict behavior; tasks/events/assignments omit empty, denied, terminal failure, and recovery presentations; and reminder, governance, archive, and lifecycle screens do not enumerate their complete fixture/state sets. The observable-test paragraph cannot supply the missing screen-specific result. Good looks like a screen-by-state inventory that marks every variant as required or not applicable and gives exact copy/control/state-preservation behavior for each required cell.

3. **Approval dependency-failure behavior is contradictory and incomplete.** `Approvals` says an infrastructure failure “permits only idempotent retry,” implying every such failure exposes retry. `MutationAction and OutcomePanel` and `AsyncStatePanel` instead allow retry only when the application result marks it safe. The approval mockup also does not distinguish retryable from non-retryable failure or specify already-decided, denied, approve, and reject outcomes separately. Developers cannot derive which control to render, and QA cannot assert unchanged state or duplicate-effect prevention for each outcome. Good looks like the approval outcome table carried into the UX: exact heading/message class, mutation invariant, retry control presence, idempotency behavior, focus/announcement, and recovery action for approve, reject, already-decided, invalidated, denied, retryable failure, and non-retryable failure.

4. **Authorization-critical UI remains conditional without a resolvable design contract.** The navigation matrix includes `If matrix grants`, and multiple sections defer fields/actions to the “approved” FR-LR-14 matrix, but the artifacts provide no matrix version/hash, row IDs, or direct artifact reference for those decisions. That leaves Import visibility for Group Admin, reminder scope, record field sets, approval reasons, event-note/allergen visibility, and settings/governance controls open to implementation interpretation. Generic server-side denial language does not define the exact permitted UI. Good looks like each conditional navigation/action/field rule citing a stable matrix row and sensitive-field ID, with the rendered allow case and absent/denied case specified; if the matrix is not yet approved, these mockups must identify the affected surfaces as blocked rather than presenting them as implementation-ready.

5. **Responsive behavior is not specified for the complex workflows that carry the highest implementation risk.** The breakpoint rules describe collections and general columns, but do not define the mobile/tablet structure and focus order for the seven-step import mapping/conflict screens, grant-matrix editing, approval filters/detail actions, lifecycle timeline, or wide validation/error summaries. The statement that intrinsically tabular content may scroll in two dimensions while an equivalent card view exists also leaves QA unable to decide which presentation is normative at 320px and 200% zoom. Good looks like a breakpoint-specific layout and interaction rule for each complex screen, including which representation is used, disclosure behavior, preserved step/filter state, action placement, and DOM/focus order.

## Review

**Reviewer:** aidlc-product-lead-agent

**Verdict:** NOT-READY

**Iteration:** 2

The revision materially improves traceability, state coverage, approval outcomes, authorization identifiers, and responsive behavior. Three prior blockers are resolved, one is only partially resolved, and the state/coverage repair exposes two new cross-artifact contradictions that remain machine-checkable blockers.

### Prior-finding verification

1. **Traceability — RESOLVED structurally.** `Story-to-Screen Traceability` now names every active `US-LR-*` delivery story and inherited `US-01`–`US-14`, with screen/component, acceptance paths, requirements, and specification section. The invalid aggregate ranges from iteration 1 are no longer authoritative. One claimed row remains unsupported by an actual screen contract and is recorded below as a new finding.

2. **Per-screen state inventory — PARTIALLY RESOLVED.** `Screen-by-State Inventory` marks required versus not-applicable states and supplies observable behavior for the listed screens, including the previously omitted notification, records, tasks/assignments, reminders, governance, lifecycle, and archive variants. However, the invitation/authentication journey claimed in traceability is absent from this inventory, and component state unions still disagree with it; see findings 2 and 3.

3. **Approval retry/outcome contract — RESOLVED.** `Approval Outcome Contract` defines approve, reject, already-decided, invalidated, denied, retryable dependency failure, and non-retryable dependency failure with exact mutation, retry, idempotency, focus, announcement, and recovery behavior. `MutationAction and OutcomePanel` now requires both manifest and application-result retryability and explicitly follows that table.

4. **Authorization design contract — PARTIALLY RESOLVED.** `UX-AUTH-0.1` adds stable authorization and sensitive-field IDs, rendered allow/deny behavior, and a clear `BLOCKED — US-LR-00` boundary for protected approval reasons. The earlier navigation matrix was not reconciled with this new normative contract; see finding 1.

5. **Complex responsive behavior — RESOLVED.** `Complex Responsive Contracts` now specifies mobile, tablet, desktop, DOM/focus order, state preservation, and the normative 320px/200%-zoom representation for import, grant editing, approvals, lifecycle, and wide validation. `interaction-spec.md` incorporates that contract and rules out horizontal-table fallback.

### Blocking findings

1. **Group Administrator import access has two contradictory answers in the same primary artifact.** `Role-to-Navigation Matrix` still says Group Admin Import is `If matrix grants` and says the later FR-LR-14 matrix is authoritative where conditional. `UX-AUTH-0.1` instead defines `AUTH-GRP-IMPORT-DENY`, states “Import is exactly Kindergarten/Super only,” and says stage approval freezes these rendered rules for the final matrix to preserve. Engineering cannot know whether to render a conditional Group Admin destination or omit it unconditionally, and QA cannot derive the allow/deny fixture. Good looks like one answer in both tables, with the navigation cell citing the governing AUTH row.

2. **Invitation/authentication-entry coverage is asserted but not designed.** The traceability row for `US-LR-04e` promises valid, expired, used, resend, and upcoming-duty paths and points to `Local Startup and Identity; State Inventory`. That mockup only specifies synthetic profile/session selection, while `Screen-by-State Inventory` has no invitation/authentication-entry screen or required behavior for any of those five paths. `LocalIdentitySelector` likewise accepts fixture profile ID/intended path, not invitation token or authentication outcomes. This is an orphan traceability claim: a developer still has to invent the screens, controls, privacy-safe resend response, destinations, and focus/recovery behavior. Good looks like a dedicated invitation/authentication screen or explicit inherited component contract plus state rows for valid, expired, used, resent, authentication success/failure, and upcoming-duty/empty outcomes.

3. **The cross-artifact state unions still disagree.** `Screen-by-State Inventory` requires validation and denied fixtures for Local identity, but `interaction-spec.md` defines `LocalIdentitySelector` states only as resolving, ready, empty-configuration, submitting, session-error, and selected. Separately, the global interaction rule says every mutation terminates in success, denied, invalidated/conflict, or “retry-safe failure,” while the revised screen inventory and approval contract require non-retryable terminal dependency failures. These are implementation-level discriminated-state contradictions: the component/API union described in the interaction specification cannot represent every required acceptance fixture. Good looks like exact shared state names across both artifacts, including identity validation/denial and distinct retryable/non-retryable dependency-failure variants.

No additional blocker was found in the responsive, keyboard/focus, privacy-redaction, synthetic-versus-linked-target, or upstream-reference checks.

## Review

**Reviewer:** aidlc-product-lead-agent

**Verdict:** READY

**Revision Iteration:** 1

### Prior-finding verification

1. **Group Administrator import authorization — RESOLVED.** `Role-to-Navigation Matrix` now unconditionally renders Group Admin Import as `No — AUTH-GRP-IMPORT-DENY`. `UX-AUTH-0.1` defines the same absent-destination/direct-denial result and states that Import is exactly Kindergarten/Super only. The navigation prose makes UX-AUTH-0.1 authoritative and removes the former conditional grant path.

2. **Invitation/authentication entry — RESOLVED.** `Invitation and Authentication Entry` now specifies valid, expired, used, invalid/unknown, resend, validation, pending, upcoming-duty, no-duty, denied, retryable-failure, and terminal-failure screens. It names the visible controls and destinations, focus targets, non-enumerating resend/invalid behavior, protected-data exclusions, and stable synthetic fixtures. `InvitationAuthEntry`, the screen-state inventory, story traceability, design-system mapping, and critical-flow accessibility evidence all reference the same journey.

3. **Component/shared state unions — RESOLVED.** `LocalIdentitySelector` explicitly represents initial/resolving, ready, empty, validation, pending, success, denied, retryable dependency failure, and terminal dependency failure, with conflict/invalidated marked inapplicable. `InvitationAuthEntry` represents the complete shared variants needed for its fixtures. `AsyncStatePanel` defines the shared discriminated union, exposes retry only for `dependency-failure-retryable`, and gives terminal failure guidance/back without retry. The global mutation rule and `MutationAction` use the same retryable-versus-terminal distinction.

### Rationale

The revised artifacts now give engineering deterministic screen, state, control, focus, responsive, component, role, and privacy behavior, while QA can derive fixture-backed tests and trace each current and inherited story to its owning specification. Required upstream wireframe, user-flow, story, requirement, and team-practice references remain present. The synthetic-versus-linked-target and no-deployment boundaries remain consistent. No new implementability, coverage, authorization, accessibility, responsive, or testability blocker was found in the permitted review scope.
