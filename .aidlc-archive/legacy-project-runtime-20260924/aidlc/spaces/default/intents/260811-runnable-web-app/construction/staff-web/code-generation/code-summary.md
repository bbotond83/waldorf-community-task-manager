# Staff Web Code Summary

## Scope Delivered

Implemented the complete read-only Staff schedule surface at `/munkatars/beosztas` and `/munkatars/beosztas/[id]`. Every request resolves the server session, enforces the read-only Staff role and granted group, validates a maximum 31-day range, calls the Staff application façade, and renders only the allowlisted schedule projection. No Staff mutation/action/edit contract was introduced.

## Files Created

- `app/munkatars/layout.tsx`, `loading.tsx`, and `error.tsx`
- `app/munkatars/_lib/{session,facade,filters}.ts`
- `app/munkatars/_components/{StaffAccessState,StaffStatePanel,FocusedStateSection}.tsx`
- `app/munkatars/beosztas/page.tsx`
- `app/munkatars/beosztas/[id]/page.tsx`
- `app/munkatars/beosztas/_components/{ScheduleFilter,ScheduleCollection}.tsx`
- `src/staff-web/{index,synthetic-staff,synthetic-staff.test}.ts`
- `tests/integration/staff-components.test.tsx`
- `tests/browser/staff-web.spec.ts`

## Files Modified

- `app/globals.css` — Staff filter, semantic table, mobile-card, detail, state, touch-target, and responsive/zoom styles.
- `construction/staff-web/code-generation/code-generation-plan.md` — all eight approved steps checked with evidence.
- `construction/staff-web/code-generation/code-summary.md` — this completion record.

## Key Decisions and Privacy Boundary

- URL parameters are the only Staff filter/detail-return state; no protected shared client store or cache was added.
- Desktop table and mobile cards are rendered from the same authorized `ScheduleEntryModel` collection.
- Detail retrieval repeats role, authorization-version, group, row, date-range, and field authorization. Missing or out-of-scope keys return the same generic denial and no row count or existence signal.
- The synthetic adapter has one public operation, `getSchedule`. Invented fixtures cover two granted groups, bounded ready/empty results, ungranted scope, next-request revocation, and retryable/terminal dependency failures.
- Rendered fields are limited to date/time, activity, granted group, permitted location/coverage, and required coordination display name. Contact, locality, optional profile, protected reason, assignment, family, unrelated rows, raw error/provider values, and mutation controls/contracts are structurally absent.
- Retry is rendered only for `dependency-failure-retryable`; validation, denial, invalidation, and terminal failure do not gain a retry capability. Denial/error sections receive programmatic focus and assertive announcement; normal/empty transitions use polite status semantics.

## Test and Verification Evidence

Commands were executed with Node `24.19.0` and npm `11.19.0` via the Node 24 package runner where the host default was Node 26.

| Check | Result |
|---|---|
| Staff Prettier check | PASS |
| Staff ESLint check | PASS, zero warnings |
| Strict TypeScript | PASS |
| Aggregate domain tests | PASS, 118/118 |
| Aggregate delivery tests | PASS, 57/57 |
| Domain coverage | PASS: 93.12% lines, 85.90% branches, 90.39% functions; `synthetic-staff.ts` 100% lines/functions and 82.61% branches |
| Delivery coverage | PASS: 94.59% lines, 95.34% branches, 91.30% functions |
| Next.js production build | PASS; Staff list/detail routes emitted as dynamic server routes |
| Deterministic start smoke | PASS: `SMOKE_START_OK: waldorf-local-ready` |
| Focused Staff browser suite | PASS, 18/18 across Chromium, Firefox, and mobile Chrome |
| Aggregate browser suite | 74/75; every Staff case passed. One parallel Parent signup case failed once per aggregate attempt in alternating desktop engines, outside Staff ownership; its isolated Chromium rerun passed 1/1. |

Focused browser evidence covers profile selection, filter/list/detail/return, empty/clear, invalid 31-day range, generic group/row denial, retryable/terminal failures, DOM privacy and no-mutation assertions, axe with no serious/critical violations, keyboard/skip-link/focus, 200% zoom/reflow, mobile cards, 44px touch targets, and measured Staff list response below two seconds in every project.

## Deviations and Outstanding Evidence

- The approved application façade already existed, so Staff Web consumed it and added only the deterministic Staff adapter and delivery composition instead of changing the façade contract.
- No Staff API route was added: server components invoke the authorized application façade directly, satisfying the server boundary without creating a second transport surface.
- The aggregate browser suite has one non-Staff parallel-state failure described above; no Parent code or tests were changed because this unit owns Staff Web only.
- Supabase authentication/RLS/persistence, hosted Vercel targets, and Safari desktop/mobile evidence remain `OUTSTANDING`. No deployment workflow, target call, credential, or production-network action was added or invoked.
