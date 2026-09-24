# Runtime Foundation Security Design

## Sources and Applicability

This packaging-unit design implements [security requirements](../nfr-requirements/security-requirements.md) and [technology decisions](../nfr-requirements/tech-stack-decisions.md). Performance, scalability, reliability, and business-logic inputs are not produced for a packaging unit; this document does not invent them.

## Composition Guard

`validateRuntimeConfig` parses a minimal allowlisted environment projection before application construction. A discriminated `synthetic` branch imports synthetic adapters and registers selector/reset/scenario endpoints. A separate `production` branch imports production adapter factories and never imports/registers synthetic entry points. Unknown/missing mode returns stable `CONFIG_RUNTIME_MODE_INVALID` and exits non-zero.

Build/test verification searches the production route manifest/bundle for synthetic endpoints/markers and attempts crafted requests; both must be absent/404 or denied before session creation.

## Session and Request Boundary

- HTTP-only, SameSite=Lax session cookie; Secure in production; signed/opaque identifier; bounded lifetime.
- Every server component/action/route resolves session from the request and rechecks authorization version plus matrix row before loading resource data.
- State-changing requests verify same-origin Origin/Host and framework CSRF protections; no GET mutation.
- Profile switch/revocation rotates/clears session and invalidates scoped cache keys before rendering.

## Validation and Output Safety

Zod schemas (or approved equivalent) validate environment, route params, form data, JSON, invitation identifiers, and synthetic reset/scenario inputs with length/count/type bounds. Rendering relies on React escaping; no unsanitized HTML. Upload parsing remains in the owning import unit with file/type/size/formula controls.

Screen models are allowlisted projections. Denial resolves before retrieval and returns `AUTHORIZATION_DENIED`, Hungarian `Nincs jogosultság`, no object existence, no protected fields, and no retry. Adapter errors are caught once and mapped to `DEPENDENCY_RETRYABLE` or `DEPENDENCY_TERMINAL`; raw messages/stacks remain server-only and redacted.

## Headers and Browser Controls

Configure CSP compatible with Next.js nonces/hashes, `frame-ancestors 'none'`, `object-src 'none'`, restrictive `base-uri`/`form-action`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and appropriate Permissions Policy. Production transport relies on HTTPS/HSTS at the target; local HTTP does not claim transport verification.

## Secrets, Logs, and Evidence

Only named server environment variables enter configuration; secret variables are never exposed via `NEXT_PUBLIC_*`. `.env.local` is ignored; `.env.example` contains placeholders/non-secret synthetic defaults. Structured logs/evidence accept stable codes and redacted IDs, not free-form input/provider bodies/contact values/protected reasons. Test capture scans output for fixture-sensitive and secret patterns.

## Test Design

- Config table tests for every mode/required variable/error with zero target calls.
- Production-bundle/route negative tests for synthetic marker/reset/profile endpoints.
- Session tests for switch, stale version, revocation-next-request, cookie flags, origin rejection.
- Authorization matrix allow/deny tests at UI/API/object/field layers with unchanged state and no oracle.
- Validation/XSS/unsafe-input/header tests and redaction scans.
- Dependency classification tests prove retry appears only for retryable results with identical idempotency key.
- `npm audit --audit-level=high`, secret scanning, and SAST block high/critical findings.

## Failure Domains

Configuration failure prevents server start. Session/authorization failure affects only the request and fails closed. Synthetic reset is serialized/test-only and cannot exist in production. Evidence/log failure must not change domain outcome or leak fallback content; it surfaces a redacted operational failure for tests. No security fallback bypasses authorization or switches runtime modes.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The composition guard, request/session checks, schema boundaries, CSP/header strategy, secret/redaction rules, production-bundle negative checks, and failure domains implement the approved runtime requirements without assuming hosted infrastructure. Synthetic and production branches are mutually exclusive and every failure path remains closed and testable.
