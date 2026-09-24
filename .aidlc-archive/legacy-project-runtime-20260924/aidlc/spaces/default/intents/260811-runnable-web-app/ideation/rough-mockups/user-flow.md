# User Flow

## Flow Basis

These flows operationalize the approved `260729-feature` [parent, administrator, and staff flows](../../../260729-feature/ideation/rough-mockups/user-flow.md) inside a locally runnable application. They preserve the canonical refined mockups and interaction states rather than defining a new UX. [intent] [scope] [Q1]

## Local Entry and Role Routing

```text
Install/configure → Start app → Helyi tesztprofil kiválasztása
→ Select synthetic identity with role and permitted memberships
├─ Parent → Saját feladataim
├─ Staff → Beosztás
├─ Group admin → scoped Irányítópult
├─ Kindergarten admin → organization Irányítópult
└─ Super admin → permitted cross-organization administration
→ Forbidden direct URL? → denial without protected content
→ Tesztprofil váltása → clear session → selection heading
```

The selector is development-only; production uses the approved authentication entry. An authorized profile may retry the same URL after switching, proving the role/session transition. [scope] [Q2] [Q3]

## Parent Critical Flow

```text
Open Saját feladataim
→ Loading → task list / empty / dependency failure
→ Open eligible task → Jelentkezem → Pending
├─ Success → assignment visible + Hungarian announcement
├─ Full/ineligible → explanation, no assignment
└─ Failure → privacy-safe error + safe retry
→ Swap/cancellation detail → pending → approved/rejected/invalidated
```

The parent never sees another family's restricted contact details, and every mutation preserves context after success or failure. [Q2] [Q3] [prior-flow] [prior-interactions]

## Read-Only Staff Critical Flow

```text
Open Beosztás → loading
├─ schedule → filter → permitted detail
├─ empty → clear filter → loading
└─ failure → retry → loading
→ Open forbidden mutation/admin URL
→ denial heading; no mutation, schedule details, or contact data
```

This proves useful visibility while remaining read-only. [Q2] [Q3] [scope]

## Administrator Critical Flow

```text
Open scoped Irányítópult → summaries/pending items
→ Approval detail → validate current state/authority
├─ approve/reject → pending → success + audit-safe confirmation
├─ changed state → invalidated/conflict → refreshed current state
└─ failure → no partial success → safe retry
```

## Administrator Supporting Flows

```text
Records: list → filter → permitted detail → loading/empty/denied/failure
Task/event: list → create/edit → validation → pending → success/conflict/failure
Assignment: select context → eligible subject → capacity → success/conflict/failure
Import: upload → parse → map/conflicts → preview → confirm → success/recovery
Reminders: status list → detail → retry eligible failure → pending → success/stale
```

Each flow respects assigned-group, kindergarten-wide, or cross-organization scope. Conflict/invalidation returns to refreshed state; retry re-enters loading/pending and never duplicates a confirmed mutation. [Q2] [Q3] [prior-flow] [prior-interactions]

## Responsive and Keyboard Sequence

On mobile, order is header/context, primary status, records/cards, primary action, supporting actions, and feedback. Desktop may place navigation/supporting panels beside content without changing reading or focus order. Every flow is keyboard-operable, retains visible focus, and announces dynamic outcomes in Hungarian. [Q4] [prior-interactions]

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [scope] `../scope-definition/scope-document.md`
- [prior-flow] `../../../260729-feature/ideation/rough-mockups/user-flow.md`
- [prior-interactions] `../../../260729-feature/inception/refined-mockups/interaction-spec.md`
- [Q1]–[Q4] `rough-mockups-questions.md`
