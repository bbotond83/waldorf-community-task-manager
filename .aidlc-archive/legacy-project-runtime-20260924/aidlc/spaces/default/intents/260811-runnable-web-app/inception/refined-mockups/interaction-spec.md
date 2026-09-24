# Interaction Specification

## Sources and Inheritance

This specification refines the current [wireframes](../../ideation/rough-mockups/wireframes.md), [user flow](../../ideation/rough-mockups/user-flow.md), [stories](../user-stories/stories.md), [requirements](../requirements-analysis/requirements.md), and [team practices](../practices-discovery/team-practices.md). The approved `260729-feature` interaction specification remains normative; rules below add local-runtime detail without changing product behavior.

## Global Interaction Rules

- Use native links for navigation, buttons for actions, labelled form controls, and dedicated pages for approvals, swaps, cancellations, access governance, privacy lifecycle, and imports.
- Validate fields on blur and again on submit. Display an error summary linked to fields; focus the summary, then make the first invalid field the next focus target.
- Expected failures render explicit UI states. Unexpected infrastructure failures map to privacy-safe Hungarian messages; raw errors, secrets, and personal data never reach the page or logs.
- Every mutation exposes pending state immediately, disables duplicate submission, and ends in `success`, `denied`, `conflict`, `invalidated`, `dependency-failure-retryable`, or `dependency-failure-terminal`. Retry is rendered only for `dependency-failure-retryable`.
- Dynamic results use a persistent `aria-live="polite"` status region. Critical validation and failed confirmation use `role="alert"` without stealing focus repeatedly.
- Destructive or access-changing actions require a review page or confirmation dialog. Dialogs trap focus, close with Escape when cancellation is safe, and restore focus to the trigger.

## LocalIdentitySelector

| Field | Value |
|---|---|
| Component | `LocalIdentitySelector` |
| Description | Development-only synthetic role/session entry |
| Category | input / navigation |

States: `initial`, `resolving`, `ready`, `empty`, `validation`, `pending`, `success`, `denied`, `dependency-failure-retryable`, and `dependency-failure-terminal`; `conflict` and `invalidated` are not applicable to identity selection. Inputs are fixture profile ID and intended path; profile summaries include only synthetic role and scope. Arrow keys move within the radio group; Tab reaches `Folytatás`; Enter/Space activates. On success focus moves to destination H1. On switch, scoped caches clear before the selector renders. Production composition must not instantiate this component.

## InvitationAuthEntry

| Field | Value |
|---|---|
| Component | `InvitationAuthEntry` |
| Description | Invitation acceptance/resend and authentication outcome routing |
| Category | input / navigation / feedback |

States: `initial`, `loading`, `empty`, `validation`, `pending`, `success`, `denied`, `conflict` (used invitation), `invalidated` (expired invitation), `dependency-failure-retryable`, and `dependency-failure-terminal`. Inputs are privacy-safe invitation outcome, authentication outcome, and upcoming-duty summary; raw tokens and account-existence booleans never reach rendered props. Resend has one non-enumerating success message. State copy, controls, focus, fixtures, and destinations follow `mockups.md` § Invitation and Authentication Entry.

## AppShell and RoleNavigation

| Field | Value |
|---|---|
| Component | `AppShell`, `RoleNavigation` |
| Description | Shared landmarks, context, permitted destinations, and feedback |
| Category | layout / navigation / feedback |

Inputs are active identity summary, authorization-derived destinations, current path, breadcrumbs, and route outcome. Navigation is derived from FR-LR-14, never hard-coded from a client role label alone. Direct forbidden routes render the denial page through the server authorization result. Below 1024px, the menu button exposes `aria-expanded`; Escape closes it and returns focus. Route change closes it and focuses H1.

## AsyncStatePanel

| Field | Value |
|---|---|
| Component | `AsyncStatePanel` |
| Description | Consistent loading, empty, denied, invalidated, error, and recovery states |
| Category | feedback |

Inputs use the shared state union `initial | loading | empty | validation | pending | success | denied | conflict | invalidated | dependency-failure-retryable | dependency-failure-terminal | recovery`. Hungarian heading/message, privacy-safe reason, and permitted recovery action derive from that result. Loading uses `role="status"`; denial and full-page error own the route H1; only `dependency-failure-retryable` exposes retry and returns to loading; terminal failure exposes guidance/back only. The panel never accepts raw exception text or arbitrary HTML.

## ScopedCollectionView

| Field | Value |
|---|---|
| Component | `ScopedCollectionView` |
| Description | Filters, counts, pagination, table/card alternatives, and permitted detail links |
| Category | display / input |

Inputs include already-authorized rows, field schema, filters, sort, page information, and empty/error outcome. Desktop table headers carry `scope="col"` and sort state. Mobile cards preserve labels and actions. Filters use a fieldset/legend and a visible reset. Server results omit prohibited rows and fields; the component does not merely hide them with CSS.

## MutationAction and OutcomePanel

| Field | Value |
|---|---|
| Component | `MutationAction`, `OutcomePanel` |
| Description | Idempotent submission and explicit business outcomes |
| Category | input / feedback |

Inputs are authorized action, validation state, idempotency token, and explicit result union. Submit disables immediately and shows a textual pending indicator. Success updates the owning card/detail and announces. Conflict/invalidated focuses its heading and offers refresh. Retry is available only when the scenario manifest and application result both mark the dependency failure `retryable: true`; all business conflicts, denial, already-decided, invalidated, success, and non-retryable failures omit retry. Expected denial never exposes resource existence outside scope. Approval rendering follows `mockups.md` § Approval Outcome Contract exactly.

## ApprovalDetail

Dedicated page inputs: scoped request view, current state, authorized reason view, decision form, and redacted audit summary. Approve/reject requires explicit submit; reject requires a labelled reason only when the business contract requires it. A stale version returns invalidated state and replaces obsolete controls. Browser back returns to the queue with filters preserved.

## ImportSequence

Each step owns an H1 suffix and visible `n / 7` progress. Draft uploads and mappings persist across Back. Row errors link from the summary to the row control. Confirm is absent or disabled with explanation until every blocking conflict resolves. Commit uses an immutable preview ID and idempotency key. An interrupted result offers exactly the safe actions returned by the application contract; verified restoration is a distinct terminal state.

## AccessGovernance and Revocation

Role/scope change is a review-first form showing current and proposed grants. Confirmation announces success without sensitive audit content. All next requests re-evaluate authorization. On revocation, protected navigation disappears, cached scoped queries clear, and any open protected route atomically becomes denial; protected content must not remain visible during refresh.

## PrivacyLifecycleDetail

The page represents review-required, hold/sibling deferral, grace-period countdown, delete/anonymize pending, completed, failed, and redacted-audit states. Dates use `Europe/Budapest` display but machine-readable values. Only authorized roles receive lifecycle reasons or audit summaries. Final actions require a summary and explicit confirmation.

## Responsive and Motion Behavior

- Mobile `<768px`: one column, navigation disclosure, card collections, full-width primary actions.
- Tablet `768–1023px`: two-column summaries/filters where content permits.
- Desktop `1024–1439px`: persistent side navigation and responsive table views.
- Large `>=1440px`: max-width content; no stretched reading lines.
- Animation remains under 300ms and is removed or reduced under `prefers-reduced-motion`.
- Complex import, grant-matrix, approval, lifecycle, and wide-validation layouts follow `mockups.md` § Complex Responsive Contracts; its mobile card/list forms are normative at 320px and 200% zoom, never a horizontally scrolling table fallback.

## Keyboard and Focus Sequence

The stable order is skip link → header/profile → role navigation → breadcrumb/context → H1 → filters/content → primary action → supporting actions → status. List-to-detail and successful route changes focus H1. Inline mutations retain focus. Closing a dialog restores its trigger. Validation focuses the error summary. Denial, invalidated, and terminal recovery focus their state headings.

## Observable Test Contract

Browser scenarios must exercise each component's ready, loading/pending, success, empty where applicable, validation, denied, invalidated/conflict, dependency failure, and retry/recovery state using synthetic fixtures. Authorization tests assert prohibited destinations, controls, rows, and sensitive fields are absent from both rendered output and API responses. Real-target assertions remain explicitly outstanding until linked Supabase/provider/Vercel targets exist; this local intent performs no deployment.
