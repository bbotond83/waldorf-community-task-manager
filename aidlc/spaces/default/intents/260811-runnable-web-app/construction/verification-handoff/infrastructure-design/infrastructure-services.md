# Verification Handoff Infrastructure Services

## Sources

Derived from [security design](../../nfr-design/security-design.md) and Application Design [components](../../../../inception/application-design/components.md) and [services](../../../../inception/application-design/services.md). Missing service-kind NFR designs and functional business logic are intentionally inapplicable to verification packaging.

## Local Services

- npm provides locked installation and command orchestration.
- TypeScript, ESLint, and Prettier provide static correctness and style gates.
- Node test/coverage tooling and application integration runners provide code evidence.
- Playwright browser binaries provide Chromium, Firefox, and mobile-Chrome emulation; axe provides automated accessibility analysis.
- The locally built Next.js process provides the production-start smoke target on loopback.
- Repository Markdown/JSON manifests and temporary filesystem evidence provide traceability and aggregation input.

## External Services

None are required or contacted. Supabase authentication/RLS/database, provider delivery, schedulers, Vercel preview/staging, Safari environments, artifact hosting, and production are explicit future or outstanding evidence targets, not dependencies of local acceptance.
