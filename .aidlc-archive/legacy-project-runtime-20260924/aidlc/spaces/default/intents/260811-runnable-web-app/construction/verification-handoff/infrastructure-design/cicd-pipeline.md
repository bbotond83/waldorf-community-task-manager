# Verification Handoff CI Design

## Sources

Implements [security design](../../nfr-design/security-design.md) and Application Design [components](../../../../inception/application-design/components.md) and [services](../../../../inception/application-design/services.md). Missing service NFR and functional-design artifacts are intentionally inapplicable to verification packaging.

## Ordered Gates

1. Enforce Node 24.x/npm 11.x and install from the lockfile.
2. Validate environment, manifests, authorization matrix, sensitive-field dictionary, fixture privacy, and absence of deployment activation.
3. Run Prettier check, ESLint, strict TypeScript, focused/unit/integration tests, then aggregate tests with 80% line/branch/function coverage.
4. Run secret scanning, SAST, dependency scanning, redaction/forbidden-field checks, blocking high and critical findings.
5. Build the Next.js production artifact, start it deterministically on loopback, and pass readiness/HTTP smoke.
6. Run Chromium, Firefox, and mobile-Chrome critical flows with accessibility, keyboard, focus, zoom, touch, authorization, privacy, and two-second checks.
7. Aggregate local `PASS`/`FAIL` evidence and separate `OUTSTANDING` linked-target/Safari rows; verify the fresh-checkout command sequence.

## Artifact and Deployment Policy

Evidence and build metadata bind to the tested git SHA. CI may retain local reports according to repository policy but does not publish a deployable package, contact Vercel/Supabase/providers, or deploy to staging or production. A future linked deployment workflow must be a separate approved change and retain protected manual production promotion.
