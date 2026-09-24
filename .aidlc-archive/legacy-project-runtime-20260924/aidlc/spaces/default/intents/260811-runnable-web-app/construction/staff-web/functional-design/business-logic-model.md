# Staff Web Business Logic

## Sources

Implements [units](../../../../inception/units-generation/unit-of-work.md), [story map](../../../../inception/units-generation/unit-of-work-story-map.md), [requirements](../../../../inception/requirements-analysis/requirements.md), Application Design [components](../../../../inception/application-design/components.md), [methods](../../../../inception/application-design/component-methods.md), and [services](../../../../inception/application-design/services.md).

## Flow

Resolve Staff session → validate 31-day range/group filter → authorize schedule row/scope → request allowlisted schedule model → render loading/empty/ready/denied/retryable/terminal states. Detail repeats authorization. No mutation path exists.

## Privacy

Models include date/time, activity, granted group, permitted location/coverage, and required coordination display name only. Contacts, locality, optional profiles, protected reasons, assignment/family detail, unrelated rows, and edit controls are absent.

## Interaction

Filters persist through detail/retry. Empty clears filters. Denial exposes no counts/rows. Route changes focus H1; state transitions announce; mobile uses labelled cards.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The staff design is correctly read-only, bounded to 31 days, re-authorizes list/detail access, and makes sensitive fields and mutation paths structurally absent. Its filter, state, accessibility, and façade contracts satisfy the unit definition without depending on administrator or parent internals.
