# Infrastructure Services

## Sources

This local service inventory implements [security design](../../nfr-design/security-design.md), Application Design [components](../../../../inception/application-design/components.md), and [services](../../../../inception/application-design/services.md).

## Local Services

- Node/Next.js web process bound to configurable loopback host/port.
- In-process synthetic repositories, session store, deterministic clock/IDs, job queue, provider simulator, evidence sink.
- Local filesystem only for build outputs and versioned evidence; no personal data.
- npm registry is installation-time only, not an application runtime dependency.

## Future Adapter Slots

Supabase auth/Postgres/RLS, transactional email, durable scheduler, and Vercel hosting remain unlinked adapter targets. Their verification status is OUTSTANDING and they are not provisioned here.

## Configuration

`.env.example` documents `APP_RUNTIME_MODE=synthetic`, host/port and safe fixture version. Secrets use uncommitted server-only variables in future linked environments. Invalid configuration fails before listening.

