# Runtime Foundation Security Requirements

## Sources and Scope

This packaging contract derives from [requirements](../../../../inception/requirements-analysis/requirements.md) and the brownfield [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md). Functional-design artifacts are absent because `runtime-foundation` is a packaging unit; no missing business logic is inferred.

## Runtime Mode Isolation

- `APP_RUNTIME_MODE` is required and accepts only `synthetic` or `production`; missing/unknown values fail startup with stable privacy-safe code.
- Synthetic composition, selector, fixture reset, and failure-scenario controls are unreachable and absent from production builds/routes.
- Production composition validates required variable presence/shape without printing values or calling targets during validation.
- Local synthetic start performs no Supabase/provider/Vercel/staging/production network request and triggers no deployment.

## Authentication and Authorization

- Server routes/actions resolve session and authorize every route/action/resource/field through the approved contract; client visibility is never enforcement.
- Synthetic profiles use invented identifiers/scopes and authorization versions. Profile switch clears prior session, scoped cache, and transient form state.
- Immediate revocation denies the next request and prevents protected-content flash.
- Denied responses are generic/non-enumerating, leave state unchanged, and contain no prohibited row/field/resource-existence signal.

## Data and Input Protection

- Fixtures, screenshots, logs, responses, evidence, and tests contain no real or production-derived family/child/contact data.
- Environment files commit names/examples only; secrets are gitignored and redacted from errors.
- Route, form, invitation, profile, import, and test-reset inputs are schema validated, normalized, bounded, and protected against unsafe content.
- Cookies use HTTP-only, same-site, path, and environment-appropriate secure attributes; state-changing requests enforce same-origin/CSRF protection.

## Error, Audit, and Supply Chain

- Adapter exceptions map to retryable or terminal dependency states; raw stack/error/provider payloads never reach UI/evidence.
- Security events record stable code, redacted actor/reference, timestamp, and evidence ID only.
- Lockfile installation is deterministic. Dependency scan, secret scan, and SAST block high/critical findings. CI actions are immutable-pinned before delivery acceptance.

## Verification

- Negative tests cover missing/invalid mode, crafted synthetic endpoints in production, forbidden route/action/field, stale session, CSRF/origin, unsafe input, secret/error redaction, and zero target network/deployment invocation.
- Critical browser flows have no serious/critical automated accessibility issues; security success does not substitute for linked Supabase RLS/auth verification, which remains OUTSTANDING.

