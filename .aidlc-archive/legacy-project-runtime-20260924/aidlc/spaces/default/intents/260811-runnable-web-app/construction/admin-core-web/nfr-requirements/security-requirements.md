# Admin Core Web Security Requirements

## Sources

Derived from [business logic](../functional-design/business-logic-model.md), approved [requirements](../../../../inception/requirements-analysis/requirements.md), and brownfield [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

## Controls

- Server re-authorizes every route/action/object/field; navigation/control absence is secondary.
- Group Admin operates granted groups only and has no Import or super-admin governance route/action.
- Protected reasons/event notes render only for authorized rows/fields; prohibited data never enters props/HTML/accessibility tree.
- Mutations validate origin, schema, expected version, and idempotency; denial/conflict/failure leaves state unchanged.
- Approval implements exact approve/reject/already-decided/invalidated/denied/retryable/terminal outcomes.
- Errors/logs/evidence are non-enumerating and redacted.

## Verification

Positive/negative UI/API/object/field scenarios for each administrator role/scope, stale revocation/cache, direct URL/action, duplicate mutation, XSS/unsafe input, protected field absence, and audit/log/screenshot redaction.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

Core administrator NFRs quantify route/action response, bounded collection, responsive, authorization, field-minimization, exact approval-outcome, mutation, revocation, redaction, browser/accessibility, coverage, and build/start expectations. The selected server-first stack keeps policy out of clients and introduces no deployment path.
