# Business Overview

Source: full rescan on 2026-10-12, branch `feature/real-backend-local`, HEAD `80bd4f4`. Product facts come from the repository code, `README.md`, the Hungarian user guide `HASZNALATI_UTMUTATO_HU.md` and the heading structure of the product requirements document `source-materials/waldorf-community-app/waldorf-community-task-manager-prd-v1-en.md` (1955 lines; sections 13.1 to 13.11, 14, 15, 18).

## Purpose

The Waldorf Community Task Manager is a web application for a Waldorf kindergarten community. Parent families sign up for community duties ("feladatok"), swap or cancel assignments, and receive reminders. Kindergarten administrators and teachers coordinate those duties, approve changes, and maintain family and group records. The product language rule is: English code and schema identifiers, Hungarian user-facing copy (UI, e-mail, notifications).

## Actors and roles

The access model has four roles (`src/access/types.ts`, matrix `four-role-v1` in `src/application/authorization.ts`):

| Role | Home path | What the app lets them do today |
|---|---|---|
| `parent` | `/szulo/feladatok` | Browse duties, sign up, request swap, request cancellation, read notifications, add contribution notes. Scoped to one family. |
| `kindergarten_teacher` | `/teacher/schedule` | Read-only schedule/coordination view for the groups in their grants, with field-level restrictions (display names, status). |
| `group_admin` | `/admin` | Dashboard, records, tasks, assignments, approvals, archive of a group; explicitly denied import (`AUTH-GRP-IMPORT-DENY`). |
| `super_admin` | `/admin` | Everything the group admin has, plus import, reminders, lifecycle (delete/anonymize), settings, role grants and governance. |

Legacy roles `read_only_staff` and `kindergarten_admin` are converted to `kindergarten_teacher` and `super_admin` by the second SQL migration and by `convertLegacyRoles` in `src/access`.

## Key business capabilities (as implemented)

| Capability | Where it lives | State of reality |
|---|---|---|
| Duty sign-up with capacity | `SyntheticParentPort` (`src/parent-web/synthetic-parent.ts`); rules duplicated in unwired `src/coordination` | Works against in-memory state only |
| Swap request and auto-approval | same two places | In-memory only |
| Cancellation request | `app/szulo/feladatok/[id]/lemondas` | In-memory only |
| 7-day and 24-hour reminders | thresholds in unwired `src/notifications`; `ReminderJobModel` in admin advanced | Labels only ("Szimulalt kezbesites"); no scheduler or provider |
| Admin approvals, records, tasks | `SyntheticAdminPort` (`src/admin-core/synthetic-admin.ts`) | Fixture arrays; `assign` and `saveNotes` store nothing |
| Excel import of the existing kindergarten workbook | import preview/commit in `src/admin-advanced`; registry in `src/import-migration` | One hardcoded preview fixture; no upload, no parser; the real 17-sheet workbook `Ovis tabla v2.xlsx` exists in `source-materials/` and its sheet list matches `REQUIRED_SHEETS` |
| Role grants / governance | `AdvancedWorkflowStore` | 3 hardcoded grants |
| Privacy lifecycle (30-day retention, anonymize) | `src/privacy-audit` (unwired) and lifecycle operation in admin advanced | 3 hardcoded candidates |
| Invitations | `app/meghivas/[token]` | Three literal tokens; no invitation record, identity or family binding |
| Login | `app/belepes`, `ProfileSelector` | Profile picker; literal `parent-local` only |

## Product state

- The application is a runnable synthetic prototype. It presents itself as "Kizarolag kitalalt helyi adatok" (invented local data only). `README.md` states that Supabase authentication/RLS, persistence, scheduled jobs and providers remain `OUTSTANDING`.
- The database footprint is two SQL migrations covering grants, authorization versions, evidence and four thin tables; most of the PRD conceptual data model (section 15, lines 1108 to 1380) has no tables.
- Hosting intent (project rules): Vercel immutable deployments with Supabase as the backend; no deployment workflow may be created until a deployable app and linked target exist.

## Intent in progress

Intent `261012-real-backend-local` (brownfield) concerns a real local backend in place of the in-memory synthetic adapters. This artifact records what exists; it does not propose solutions.

## Business rules that the code already encodes (to preserve)

- Authorization is versioned: a stale or missing authorization version yields `invalidated` and clears protected caches.
- Optimistic concurrency by `version` on duties and admin items; conflict is an explicit result state.
- Every outcome is one of 12 result states (initial, loading, empty, validation, pending, success, denied, conflict, invalidated, dependency-failure-retryable, dependency-failure-terminal, recovery), each with a presentation code mapped to Hungarian copy.
- Duty states visible to parents: `available`, `full`, `ineligible`, `assigned`, `swap-pending`, `cancellation-pending`; notification timings: `7-day`, `24-hour`, `within-threshold`, `stale`, `cancelled`.
- Privacy: contact visibility rules in `src/directory`; sensitive-field manifest in `verification/sensitive-fields.json`; teacher view limited to display names and status.
