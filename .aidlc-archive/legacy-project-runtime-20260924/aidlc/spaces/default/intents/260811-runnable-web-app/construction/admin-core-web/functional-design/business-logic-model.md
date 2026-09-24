# Administrator Core Web Business Logic

## Sources

Implements approved [units](../../../../inception/units-generation/unit-of-work.md), [story map](../../../../inception/units-generation/unit-of-work-story-map.md), [requirements](../../../../inception/requirements-analysis/requirements.md), Application Design [components](../../../../inception/application-design/components.md), [methods](../../../../inception/application-design/component-methods.md), and [services](../../../../inception/application-design/services.md).

## Route Flows

- Dashboard resolves admin scope and parallel summary results, preserving per-panel failure without leaking denied counts.
- Records list/filter/detail/create/edit/archive/restore call admin façade methods with matrix row, scope, expected version, and idempotency.
- Tasks/events and assignments expose validation, eligibility, capacity, stale/conflict, denial, retryable, and terminal outcomes.
- Approval queue/detail implements exact seven-outcome contract; filter/selection state survives return/conflict.
- Event notes use parent/admin participant field permissions; Group Admin import navigation/direct access is absent/denied.

## State and Navigation

Every route renders one H1 and exactly one populated/empty/full-page error state. Mutations remain on detail/context, disable duplicates, announce once, and focus summary/state only for validation/terminal outcomes. Responsive cards are normative at mobile/200% zoom.

## Server Boundary

Server components load authorized models. Server actions validate form data, re-resolve session/authorization, call façade, and return typed action state. Client components are limited to progressive disclosure, focus enhancement, and pending feedback; no policy/domain calculation.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The core administrator design covers scoped dashboard, records, tasks/events, assignments, approvals, archive/restore, and notes with exact outcome and authorization boundaries. Panel/operation isolation, version/idempotency, Group Administrator import denial, responsive behavior, and server-only policy ownership are coherent with shared contracts.
