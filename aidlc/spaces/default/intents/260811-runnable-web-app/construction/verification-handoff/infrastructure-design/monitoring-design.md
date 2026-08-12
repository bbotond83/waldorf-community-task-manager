# Verification Handoff Monitoring Design

## Sources

Implements [security design](../../nfr-design/security-design.md) and Application Design [components](../../../../inception/application-design/components.md) and [services](../../../../inception/application-design/services.md). This artifact defines verification telemetry, not deployed production observability.

## Recorded Signals

Each command records tool/version, git SHA when available, runtime mode, fixture/manifest version, start/end/duration, exit status, scenario totals, pass/fail/outstanding counts, coverage percentages, accessibility violation severity, security finding severity, build identifier, smoke port/readiness, and artifact paths. Logs use scenario and evidence identifiers only and redact environment values, raw payloads, exceptions, and personal fields.

## Failure and Reporting Rules

The aggregate command fails on any mandatory command failure, coverage below 80% for line/branch/function, serious/critical accessibility finding, high/critical security finding, missing critical scenario, privacy-scan match, invalid evidence schema, build/start/readiness failure, or unexpected outstanding local row. Outstanding linked-target/Safari rows are listed separately and never counted as local passes. Temporary processes are terminated and failure artifacts retained with privacy scanning.

## Operational Boundary

No hosted metrics, log collector, trace backend, alert channel, dashboard, or incident integration is provisioned. Local verification output is development evidence and does not claim production observability.
