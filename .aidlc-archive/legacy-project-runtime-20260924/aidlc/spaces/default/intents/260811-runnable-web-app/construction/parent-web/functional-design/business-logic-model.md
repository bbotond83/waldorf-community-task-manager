# Parent Web Business Logic

## Sources

Implements approved [units](../../../../inception/units-generation/unit-of-work.md), [story map](../../../../inception/units-generation/unit-of-work-story-map.md), [requirements](../../../../inception/requirements-analysis/requirements.md), Application Design [components](../../../../inception/application-design/components.md), [methods](../../../../inception/application-design/component-methods.md), and [services](../../../../inception/application-design/services.md).

## Flows

- Invitation/auth: valid/expired/used/invalid, non-enumerating resend, authentication success/failure, upcoming-duty/empty destination.
- Duties: linked-family list/detail; available/full/ineligible/assigned states; signup with expected version/idempotency.
- Swap/cancellation: dedicated detail, validation, pending, approved/rejected, conflict/invalidated, retryable/terminal failure.
- Notifications: list/read/link, reminder timing, stale/cancelled, simulated provider status.
- Event notes: parent reads permitted allergen state and edits only own contribution.

## Privacy and State

Every load/action re-authorizes linked family/object/field. Unrelated data is absent. Mutations block duplicates, preserve safe context, announce once, and return exhaustive application states. Route success focuses H1; inline success retains focus; validation/error/denial focuses summary/state.

## Server Boundary

Server components/actions call parent/session façades only. Client components manage disclosure, pending, focus, and announcements—not eligibility, capacity, authorization, reminder, or note policy.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The parent workflows cover the approved invitation, duty, request, notification, and contribution-note states while enforcing linked-family and field authorization on every load/action. Mutation, privacy, recovery, focus, and façade boundaries are implementable and contain no client-owned policy or hidden infrastructure dependency.
