# Administrator Advanced Web Business Logic

## Sources

Implements approved [units](../../../../inception/units-generation/unit-of-work.md), [story map](../../../../inception/units-generation/unit-of-work-story-map.md), [requirements](../../../../inception/requirements-analysis/requirements.md), Application Design [components](../../../../inception/application-design/components.md), [methods](../../../../inception/application-design/component-methods.md), and [services](../../../../inception/application-design/services.md).

## Import Flow

Authorize Kindergarten or Super Administrator before accepting a workbook. The seven-step flow selects a synthetic fixture/file, validates required sheets and headers, creates a fingerprinted preview, presents row/entity changes and conflicts, records explicit resolutions, confirms the scope and consequences, commits once using the original idempotency key, and renders a reconciled outcome. A changed fingerprint, stale preview, unresolved conflict, dependency failure, or interrupted commit produces an explicit non-destructive recovery state. Group Administrator navigation is absent and direct requests are denied before parsing.

## Reminder and Governance Flows

Reminder monitoring lists authorized job status, attempt metadata, safe recipient summary, and simulated delivery outcome. Retry is available only for retryable failed jobs and reuses the correlation/idempotency identity. Governance lists only grants within the actor's authority; update validates target role, scope, last-super-admin protection, expected version, and self-lockout rules, then invalidates affected sessions so revocation applies on the next request. Super-administrator-only controls never reach other administrator models.

## Lifecycle and Settings Flows

Lifecycle views show authorized retention eligibility and blockers without exposing protected family detail. Execution revalidates eligibility/version, performs the domain-defined deletion or anonymization transition atomically, records a redacted audit result, and returns completed, blocked, stale, denied, retryable, or terminal state. Recipient selection and settings use allowlisted options, scope-safe previews, validation, pending disable, and explicit save outcomes. Synthetic mode simulates provider/database effects but preserves all business states and labels linked-target verification as outstanding.

## Server Boundary

Server components request authorized screen models; server actions validate origin, schema, scope, expected version, fingerprint, and idempotency before calling the admin façade. Client code only enhances progressive disclosure, file selection, pending feedback, focus, and announcements. It performs no authorization, conflict resolution, lifecycle eligibility, retry classification, or provider logic.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The advanced design makes import, reminder, governance/revocation, lifecycle, recipient, and settings flows explicit, idempotent, recoverable, and scope-aware. Workbook fingerprints, conflict resolution, retry classification, last-admin/self-lockout checks, next-request revocation, lifecycle revalidation, and synthetic evidence boundaries are implementable through the approved façade and domain ports.
