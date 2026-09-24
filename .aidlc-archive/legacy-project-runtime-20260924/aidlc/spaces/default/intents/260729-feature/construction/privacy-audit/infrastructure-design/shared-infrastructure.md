# Shared Infrastructure

## Shared Resources

Privacy and audit shares EU Supabase, Vercel worker runtime, authentication, secret stores, backups, telemetry, and deployment controls. It owns retention and audit tables; other units emit only allowlisted redacted events.

## Ownership

The platform owns provider configuration and operations. This unit owns lifecycle correctness, redaction validation, retention cleanup, and hold-aware recovery.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
