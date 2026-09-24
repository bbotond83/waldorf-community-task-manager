# Administrator Advanced Web Code Summary

## Outcome

Implemented the complete advanced administrator surface through the approved `AdminApplicationFacade` boundary. The result includes authorized navigation, a seven-step import flow with immutable fingerprint and recovery, reminder monitoring/retry, Super Administrator grant governance and next-request revocation, privacy lifecycle execution, recipient selection, permitted settings, deterministic synthetic state, responsive Hungarian UI, stable `data-testid` controls, and explicit application result states.

## Story and Requirement Coverage

- **US-LR-06d / inherited US-08–US-10:** bounded workbook validation, required sheet/header cases, fingerprinted preview, conflict resolution, confirmation, idempotent commit, interruption, duplicate suppression, and recovery.
- **US-LR-06e:** privacy-safe reminder list/filter/status, simulated-provider label, correlation/attempt evidence, retry classification, and original retry identity.
- **US-LR-06f/06g / inherited US-11/US-12:** Super Administrator governance with Kindergarten denial, last-admin/self-lockout/stale protection, affected-session invalidation, next-request denial, lifecycle eligibility/blocker/version recheck, atomic delete/anonymize, redacted audit ID, recipients, and settings.
- **FR-LR-05/07/10/10a/14 and NFR-LR-02/03/04/05/06/07:** strict role navigation, direct-request denial, field minimization, Hungarian copy, two-second browser assertions, keyboard/focus/zoom/touch behavior, explicit failure/recovery states, and local-only evidence.

## Files

### Advanced application and deterministic adapters

- `src/admin-advanced/index.ts`
- `src/admin-advanced/synthetic-advanced.ts`
- `src/admin-advanced/synthetic-advanced.test.ts`
- `src/application/admin-facade.ts`
- `src/application/contracts.ts`
- `src/application/authorization.ts`

### Routes, actions, presentation, and composition seams

- `app/admin/advanced-actions.ts`
- `app/admin/_components/ImportWorkflow.tsx`
- `app/admin/_lib/facade.ts`
- `app/admin/_lib/session.ts`
- `app/admin/import/page.tsx`
- `app/admin/emlekeztetok/page.tsx`
- `app/admin/adatvedelem/page.tsx`
- `app/admin/beallitasok/page.tsx`
- `app/api/synthetic/reset/route.ts`
- `src/runtime/synthetic/profiles.ts`
- `app/globals.css`

### Verification

- `tests/integration/admin-advanced-components.test.tsx`
- `tests/browser/admin-advanced.spec.ts`

## Key Decisions

- A composite synthetic `AdminApplicationPort` delegates core operations to the existing admin-core port and owns advanced operations in an isolated deterministic store. Routes never import domain modules, repositories, workbook parsers, provider clients, database/session stores, or raw aggregates.
- Group Administrator advanced requests are rejected by the authorization façade before advanced state is read or created. Kindergarten Administrator receives import, reminders, lifecycle, recipients, and settings but never governance. Super Administrator alone receives the governance row.
- Import state is server-owned and bounded. Commit requires resolved conflicts, confirmation, the unchanged fingerprint, expected version, and the original idempotency key. Retryable failures remain retryable; interruption produces a non-destructive recovery state.
- Reminder retries reuse the correlation ID as their idempotency identity. Grant removal records a safe outcome and invalidates the affected synthetic subject so the next request loses protected navigation/data immediately.
- Lifecycle and settings mutations recheck expected versions and allowlists at the command boundary. Lifecycle evidence contains only an invented redacted audit identifier.

## Verification Evidence

Executed on the required Node 24/npm 11 baseline with `APP_RUNTIME_MODE=synthetic` and fixture `waldorf-local-v1`:

| Check | Result |
|---|---|
| Prettier check | PASS |
| ESLint (`--max-warnings=0`) | PASS |
| Strict TypeScript | PASS |
| Domain tests | PASS — 128 tests |
| Delivery/component tests | PASS — 60 tests |
| Domain coverage | PASS — 93.51% lines, 85.16% branches, 90.67% functions |
| Delivery coverage | PASS — 94.59% lines, 95.34% branches, 91.30% functions |
| Production build | PASS — all four advanced routes compiled |
| Deterministic start smoke | PASS — `SMOKE_START_OK: waldorf-local-ready` |
| Advanced Playwright | PASS — 21/21 across Chromium, Firefox, and mobile Chrome |
| Axe serious/critical | PASS — none in the critical advanced flow |
| Keyboard/focus/200% zoom/44×44 touch | PASS |
| Two-second bounded advanced steps | PASS; observed critical import flow below 2 seconds |
| Production dependency audit | PASS — 0 vulnerabilities |

The Playwright projects ran with one worker because the approved deterministic synthetic workflow store is process-global; each scenario resets it before execution. This prevents cross-project mutation races without weakening browser coverage.

## Deviations and Outstanding Evidence

- No scope deviation and no deployment or external target invocation occurred.
- Supabase transactions/RLS/session invalidation, scheduler/provider delivery and idempotency, Vercel hosted execution, Safari desktop, and mobile Safari remain `OUTSTANDING` by the approved local-only evidence boundary.

## Boundary Scan

The owned delivery and adapter files contain no raw Supabase/provider/database/domain workflow imports. The only `provider body` occurrence is a negative redaction assertion in the advanced test suite.
