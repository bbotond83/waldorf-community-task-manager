# Monitoring Design

## Sources

Monitoring follows [security design](../../nfr-design/security-design.md), Application Design [components](../../../../inception/application-design/components.md), and [services](../../../../inception/application-design/services.md).

## Local Signals

- Startup: runtime mode, fixture version, host/port, readiness state; never secret values.
- Request: stable route/scenario/result code, duration, redacted actor/reference, correlation ID.
- Job/provider: synthetic queued/success/retry/stale/terminal status and idempotency reference.
- Verification: command, tool/browser version, result, timestamp, evidence path.

## Health and Failure

Readiness returns success only after validated composition. Dependency simulations expose explicit application states, not raw exceptions. Evidence/log write failures are visible and cannot change authorization/domain outcome.

## Future Target Boundary

No production logging/alerting service is provisioned. Linked-target observability remains OUTSTANDING and must preserve the same redaction envelope.

