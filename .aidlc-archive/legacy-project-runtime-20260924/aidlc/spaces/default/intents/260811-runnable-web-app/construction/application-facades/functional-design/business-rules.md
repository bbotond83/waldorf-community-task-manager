# Application Facades Business Rules

## Sources

Rules trace to approved [units](../../../../inception/units-generation/unit-of-work.md), [story map](../../../../inception/units-generation/unit-of-work-story-map.md), [requirements](../../../../inception/requirements-analysis/requirements.md), Application Design [components](../../../../inception/application-design/components.md), [methods](../../../../inception/application-design/component-methods.md), and [services](../../../../inception/application-design/services.md).

## Authorization and Privacy

1. Every route/action/resource/field request names an approved matrix row; authorization precedes retrieval.
2. Group Admin import is always denied; Kindergarten/Super import follows scoped rows.
3. Staff receives schedule and required coordination display names only; no mutations or sensitive fields.
4. Parent receives linked-family/own assignment/request/note/notification data only.
5. Revocation increments authorization version; the next request clears protected cache and denies.
6. Denial is generic, non-enumerating, unchanged-state, and redacted across UI/API/log/audit/evidence.

## Validation and State

1. Equivalent UI/API/invitation/profile/import input uses shared normalization and stable error IDs.
2. Invalid input produces `validation` with no domain mutation.
3. Business stale/full/ineligible/already-decided outcomes are conflict/invalidated, never retryable dependency failures.
4. Retry exists only when both scenario and adapter classification mark dependency failure retryable.
5. Terminal dependency failure exposes guidance/back and no retry.

## Idempotency and Transactions

1. Every consequential mutation requires idempotency key; retries reuse it.
2. Approve/reject/signup/swap/import/job/lifecycle yields at most one terminal effect and redacted audit transition.
3. Failed or denied operations leave owned state unchanged.
4. Cross-module follow-up uses events/jobs; no façade writes another module's storage.

## Runtime and Evidence

1. Synthetic mode uses invented fixtures and labels simulated effects.
2. Production mode exposes no synthetic selector/reset/scenario capability.
3. Local success cannot mark Supabase/RLS/provider/Vercel evidence PASS.
4. This intent invokes no deployment or target network action.

