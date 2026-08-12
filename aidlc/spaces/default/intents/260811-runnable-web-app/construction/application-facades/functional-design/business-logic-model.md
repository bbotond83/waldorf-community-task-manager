# Application Facades Business Logic Model

## Sources

Implements approved [units](../../../../inception/units-generation/unit-of-work.md), [story map](../../../../inception/units-generation/unit-of-work-story-map.md), [requirements](../../../../inception/requirements-analysis/requirements.md), Application Design [components](../../../../inception/application-design/components.md), [methods](../../../../inception/application-design/component-methods.md), and [services](../../../../inception/application-design/services.md).

## Request Pipeline

`validate input → resolve session → authorize matrix row/scope/action/field → invoke owning domain public API in idempotency context → classify domain/adapter outcome → project allowed screen model → record redacted evidence`.

Validation or denial stops before resource retrieval. Expected domain outcomes become explicit result states. Unexpected adapter errors are classified at one boundary as retryable or terminal; raw errors never cross it.

## Role Orchestration

- Session façade handles synthetic selection/switch, invitation/resend, production-boundary selection, cache invalidation, and destination routing.
- Parent façade composes Directory visibility, Parent projections, Coordination commands, Notifications, and contribution authorization.
- Staff façade composes schedule service only and emits an allowlisted read-only view.
- Admin façade composes Access, Directory, Coordination, Admin, Import, Jobs/Notifications, and Privacy through per-workflow methods; it never writes sibling records directly.

## Mutation Sequence

Each mutation validates an idempotency key and expected version, authorizes before load, executes the owning module transaction, publishes a privacy-minimized event/audit outcome, then returns one terminal result. Duplicate pending calls produce at most one effect. Conflict, invalidation, already-decided, and denial leave state unchanged. Retryable failures preserve safe context and reuse the same key.

## Result Projection

The exhaustive union is `initial | loading | empty | validation | pending | success | denied | conflict | invalidated | dependency-failure-retryable | dependency-failure-terminal | recovery`. Each result includes stable code, safe data, focus target, announcement, and optional retry/evidence. Only retryable dependency failure contains retry metadata.

## Events and Evidence

Assignment changes schedule/replace/cancel reminders; import/lifecycle operations enqueue recovery/status jobs. Events carry IDs/versions/idempotency and no contact/free-text secrets. Evidence distinguishes synthetic PASS from linked-target OUTSTANDING.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The façade pipeline is exhaustive and preserves the approved module boundaries: authorization precedes retrieval, expected outcomes remain typed, unexpected failures are classified once, mutations carry version/idempotency, and projections/events/evidence exclude prohibited data. Role façades map to every delivery surface without creating a domain or dependency cycle.
