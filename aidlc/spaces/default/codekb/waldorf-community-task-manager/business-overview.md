# Business Overview

Sources: full rescan on 2026-10-12 (branch `feature/real-backend-local`, HEAD `80bd4f4`), plus a focused update on 2026-10-27 (HEAD `5d2b484`, intent `denied-audit-ratelimit`) that re-read the audit and database-test area under `supabase/` and `tests/database/`. A second focused update on 2026-11-02 (HEAD `3456409`, intent `empty-nav-after-login`) re-read the sign-in, shell and navigation area; sections marked "(2026-11-02)" come from it. Sections marked "(2026-10-27)" come from the first focused update. Revision 2 on 2026-11-02 (same intent, owner asked to also scan the audit area) re-read the audit migrations 20261012, 20261013, 20261015, 20261019, 20261044 and 20261045, `supabase/config.toml` and the database test support, `audit`, `audit-purge` and `migrations` tests; sections marked "(2026-11-02, audit re-verified)" come from it. All other sections are kept from the 2026-10-12 full scan and are known to be stale outside the database layer: since then the project added a real Supabase backend (U1 to U5 migrations), `src/data/` RPC ports and `src/identity/`. Product facts come from the repository code, `README.md`, the Hungarian user guide `HASZNALATI_UTMUTATO_HU.md` and the heading structure of the product requirements document `source-materials/waldorf-community-app/waldorf-community-task-manager-prd-v1-en.md`.

## Purpose

The Waldorf Community Task Manager is a web application for a Waldorf kindergarten community. Parent families sign up for community duties ("feladatok"), swap or cancel assignments, and receive reminders. Kindergarten administrators and teachers coordinate those duties, approve changes, and maintain family and group records. The product language rule is: English code and schema identifiers, Hungarian user-facing copy (UI, e-mail, notifications).

## Actors and roles

The access model has four roles (`src/access/types.ts`, matrix `four-role-v1` in `src/application/authorization.ts`):

| Role | Home path | What the app lets them do |
|---|---|---|
| `parent` | `/szulo/feladatok` | Browse duties, sign up, request swap, request cancellation, read notifications, add contribution notes. Scoped to one family. |
| `kindergarten_teacher` | `/teacher/schedule` | Read-only schedule/coordination view for the groups in their grants, with field-level restrictions (display names, status). |
| `group_admin` | `/admin` | Dashboard, records, tasks, assignments, approvals, archive of a group; explicitly denied import (`AUTH-GRP-IMPORT-DENY`). |
| `super_admin` | `/admin` | Everything the group admin has, plus import, reminders, lifecycle (delete/anonymize), settings, role grants and governance. |

Legacy roles `read_only_staff` and `kindergarten_admin` are converted to `kindergarten_teacher` and `super_admin` by migration `20261006_current_roles.sql` and by `convertLegacyRoles` in `src/access`.

In the audit log (2026-10-27) the actor role is recorded as `parent`, `teacher`, `group_admin`, `super_admin`, `system` (operator command, seed, service key) or `none` (a signed-in account without a grant in that organization, so a denied attempt is still attributable).

## Key business capabilities (as implemented at the 2026-10-12 scan)

| Capability | Where it lived | State of reality then |
|---|---|---|
| Duty sign-up with capacity | `SyntheticParentPort`; rules duplicated in `src/coordination` | In-memory only (since replaced by kernel migrations 20261028-20261030) |
| Swap request and auto-approval | same | In-memory only |
| Cancellation request | `app/szulo/feladatok/[id]/lemondas` | In-memory only |
| 7-day and 24-hour reminders | `src/notifications`; admin advanced | Labels only (since: notification migrations 20261036-20261038) |
| Admin approvals, records, tasks | `SyntheticAdminPort` | Fixture arrays |
| Excel import | `src/admin-advanced`, `src/import-migration` | One fixture (since: import migrations 20261039-20261042) |
| Role grants / governance | `AdvancedWorkflowStore` | 3 hardcoded grants (since: identity migrations 20261014-20261023, 20261033) |
| Privacy lifecycle (30-day retention, anonymize) | `src/privacy-audit`, admin advanced | 3 hardcoded candidates (since: 20261032, 20261035_integrity_lifecycle) |
| Invitations | `app/meghivas/[token]` | Three literal tokens (since: 20261017, 20261021) |
| Login | `app/belepes`, `ProfileSelector` | Profile picker (since: Supabase sign-in, 20261016, 20261020) |

## Sign-in landing and role menus (2026-11-02)

- A person signs in on `/bejelentkezes` (e-mail and password, Hungarian copy). The sign-in action stores the session cookies and returns to `/bejelentkezes`, which for a signed-in visitor shows only the panel "Be van jelentkezve" with a sign-out button. The role's home page and menu are reached only when the person opens `/` (which redirects to the role home) or types an address. Seen by the owner as: after a successful sign-in as super admin, group admin or parent, the browser shows no menu and no content, only the logout button.
- Menu per role (`src/runtime/navigation.ts`): super admin 9 items (Áttekintés, Nyilvántartások, Feladatok és események, Jóváhagyások, Archívum, Importálás, Emlékeztetők, Adatvédelem, Beállítások); group admin the first 5; parent 3 (Értesítések, Feladatok, Cserék); teacher none by design, because Beosztás is the teacher's only page.
- Homes: super admin and group admin `/admin`; parent `/szulo/ertesitesek`; teacher `/teacher/schedule`, a read-only schedule ("Beosztás") with a filter and the entries of the groups the teacher is granted.
- A person with an account but no role grant gets the "no role" panel on `/` ("Ehhez a fiókhoz még nem tartozik szerepkör").

## Audit of sensitive actions (2026-10-27)

- Every role change, approval, import commit and lifecycle action is recorded as one append-only row in `audit_events` (business rules BR3.2 to BR3.4 of unit U1; table defined in `supabase/migrations/20261012_platform_audit.sql`).
- An event has an outcome of `success` or `denied`. A denied event records an attempt the caller was not authorized to make (for example a parent trying to place a lifecycle hold, or a group admin inviting into a group they do not manage).
- Denied events are written today for: lifecycle holds (place, release), the invitation functions (action `role.grant`), grant add/revoke and account deactivate/reactivate (20261018, 20261033), and the family-kernel invitation path (20261030). Other units (sign-up, swaps, directory, notifications, import) answer `denied` without writing an event.
- Events can be read by a super admin of the organization and by a group admin for events of their own group (BR2.15). Nobody can change an event; events older than 365 days are purged in batches of at most 5000 by the system housekeeping (NFR1.68, follow-up B1).
- Volume limit (2026-11-02, audit re-verified): the audit table files read in this run (20261012 to 20261045) contain no limit on denied events. The owner decision of 2026-10-27 (follow-up B3) caps them at 20 per account in any 60 minutes; the file for it, `20261046_audit_denied_rate_limit.sql`, is now merged (commit 4ea27bf) but was not analyzed in this run; its header says further denials still answer `denied` to the caller and are not written, `success` events are never limited and the system account is exempt.
- Who can produce an event (2026-11-02, audit re-verified): a signed-in caller whose session is not active is refused with an error before any event is written (`platform_actor_account`), so only an account with a live session and an active status can add events, including denied ones. Actions by the operator command, the seed or the service key are recorded as the `system` actor.
- Purge outcome (2026-11-02, audit re-verified): the housekeeping result reports how many old events were purged and whether the purge failed (`audit_purge_failed`); a failing purge no longer stops the other clean-up steps (20261045).

## Product state

- At the 2026-10-12 scan the application was a runnable synthetic prototype. Since then the database layer grew to 40 migration files (2026-11-02 listing; 39 at the 2026-10-27 listing) covering identity, directory, coordination, kernel (sign-up, swaps, family), schedule, lifecycle, notifications, import, audit purge and the denied-event limit; the application-side wiring of that backend was not re-scanned.
- Hosting intent (project rules): Vercel immutable deployments with Supabase as the backend; no deployment workflow may be created until a deployable app and linked target exist.

## Intent in progress

Intent `empty-nav-after-login` (2026-11-02, brownfield, bugfix): a signed-in person must land on the role home page with its menu instead of the bare signed-in panel. The previous intent, `denied-audit-ratelimit` (2026-10-27, brownfield, express): a per-account rate limit for denied-call audit events, done once in the shared platform audit write, as a forward-only migration, with real-stack database tests in `tests/database`. The previous intent recorded here, `261012-real-backend-local`, introduced the local Supabase backend. This artifact records what exists; it does not propose solutions.

## Business rules that the code encodes (to preserve)

- Authorization is versioned: a stale or missing authorization version yields `invalidated` and clears protected caches.
- Optimistic concurrency by `version` on duties and admin items; conflict is an explicit result state.
- Every outcome is one of 12 result states, each with a presentation code mapped to Hungarian copy. Database functions return the envelope `{state, reference, code}`.
- Audit (2026-10-27): the actor is always derived from the signed-in session and never taken as a parameter (BR3.9); the audit write happens in the same transaction as the change (BR3.3); `details` is a code-shaped text (`^[a-z0-9_.:-]*$`, at most 500 characters), never free text or personal data.
- Idempotency (2026-10-27): a repeated call with the same key replays the stored result for 24 hours, including a `denied` result.
- Privacy: contact visibility rules; sensitive-field manifest in `verification/sensitive-fields.json`; teacher view limited to display names and status.
