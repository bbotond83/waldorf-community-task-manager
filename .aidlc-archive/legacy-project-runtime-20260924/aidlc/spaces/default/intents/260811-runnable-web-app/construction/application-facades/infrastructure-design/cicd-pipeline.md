# Application Facades CI Design

## Sources

Implements façade [security design](../../nfr-design/security-design.md), [logical components](../../nfr-design/logical-components.md), Application Design [components](../../../../inception/application-design/components.md) and [services](../../../../inception/application-design/services.md), plus [business logic](../../functional-design/business-logic-model.md).

## Checks

- strict TypeScript and forbidden dependency checks (no Next/React/env/concrete adapter imports);
- Prettier/ESLint;
- unit/contract tests for validation, authorization, projection, state mapping, idempotency, events/evidence;
- ≥80% line/branch/function coverage;
- malicious/faulting port and redaction tests;
- UI/API parity integration suite executed by consuming units;
- dependency/SAST/secret scans with high/critical blocking.

## Evidence

Reports list stable scenario/story/requirement/matrix IDs and synthetic/linked target status. No raw inputs, personal values, or exception text are retained.

## Deployment

This library is bundled in the modular-monolith artifact; it is not published as a package and has no deploy job.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The CI checks enforce framework independence, contract behavior, malicious-port failure, coverage, security, and redacted evidence. Shared port and adapter ownership align with runtime composition and existing domain modules; the library is bundled rather than independently published or deployed.
