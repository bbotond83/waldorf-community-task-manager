# Teacher Tracking Frontend Components

## Component Hierarchy

- Teacher schedule shell: current Óvónő navigation, heading and existing application result panel.
  - Native filter form: grant-derived group options, labeled from/to calendar fields, submit and reset.
  - Tracking list: one responsive representation at the existing 44rem boundary.
    - Wide table: caption, column headers and local horizontal overflow where needed.
    - Narrow cards: headings and labeled values.
    - Entry fields: date/time, group, title, location, coordination when present, responsible owner, assignees and current status.
  - State panel: authorized empty, invalid filters, denial, session recovery, retryable/terminal dependency failure.
- Teacher detail shell: same projected fields and safe schedule back link with validated filters.

## Inputs and State

Inputs are the current application outcome, grant-derived group choices, validated filter context and allowlisted TrackingEntry values. Persist only submitted filter state; never retain a raw source record, prior denied projection or independent status cache. No mutation state, selection toolbar, export or modal is introduced.

## Interaction and Validation

Native submission makes a fresh authorized query; reset uses established date defaults and a currently granted group. Real YYYY-MM-DD dates, order and elapsed difference at most 31 days are required. Group denial cannot select another group silently. Retry rechecks authority and current source. Back/detail links retain only safe context.

Owner null: Nincs kijelölt felelős. Empty assignees: Nincs beosztott. Status null: Nincs elérhető állapot. Coordination is a separate label, never an owner fallback. All three representations use the same projection and wording.

## Accessibility and Integration

Retain native labels, headings, keyboard links, existing result focus/announcement behavior, text status and wrapping names. Only one responsive representation is keyboard-visible; hidden alternatives contain no accessible duplicate controls. Loading and failures expose no stale data or names/counts. Denied panels have no create action.

List/detail use the same teacher read boundary and existing application outcomes. User-visible dates follow Hungarian/Budapest presentation. Current labels use Óvónő; technical names are English. Existing stable automation hooks should be preserved where feasible and coordinated with U3 cleanup where renamed. Serious/critical browser accessibility findings must be absent at final verification; this document is design evidence only.

## Sources

[requirements.md](../../../inception/requirements-analysis/requirements.md), [unit-of-work.md](../../../inception/units-generation/unit-of-work.md), [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md), [components.md](../../../inception/domain-design/components.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md).

Approved refined mockup interaction behavior is retained; functional-spec.md owns workflow order, entities.md owns projected inputs and rules.md owns decisions.

