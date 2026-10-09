# Dependencies

Static synthesis of the revalidated 2026-10-06 developer scan for `261006-simplify-user-roles`, Standard depth, branch `feature/simplify-user-roles`, observed HEAD `0dce0567f18dc72e46aa88d87e5626708b08bc7d`. Full repository breadth with partial deep coverage. No application changes, tests, builds, browser sessions, migrations or target calls were performed.

## External Dependencies

Next.js, React/React DOM and Zod plus Node crypto provide runtime behavior. TypeScript, ESLint/Next rules, Prettier, Vitest/Istanbul, Testing Library/jsdom, Playwright and Axe support delivery. [Technology stack](technology-stack.md) owns resolved versions. Most manifest versions say `latest`; `npm ci` and lockfile provide reproducibility. `source-map-js` resolves to patched 1.2.2; no audit was executed here.

## Internal Dependency Direction

Web → runtime/session and facades → typed authorization/domain or adapter ports → repository/provider interfaces. Access roles/scopes are shared types; facade projection/idempotency and event/evidence contracts are cross-cutting boundaries. Synthetic stores and production repository ports give different durability guarantees. No complete cycle/unused-code analysis was executed.

## Role Dependency Map

| Display concept | Domain ID (`src/access/types.ts:1`) | Synthetic profile ID / role | Current scope and behavior |
| --- | --- | --- | --- |
| Parent | `parent` | `parent-local` / `parent` | Own-family duties/requests/contributions and notifications |
| Group Administrator | `group_admin` | `group-admin-local` / `group-admin` | Granted group core records/tasks/assignments/approvals/archive; application import explicitly denied |
| Kindergarten Administrator | `kindergarten_admin` | `kindergarten-admin-local` / `kindergarten-admin` | Organization operations including import/reminders/privacy/settings; application governance denied |
| Read-only Staff | `read_only_staff` | `staff-local` / `staff` | Granted-group schedule/coordination display names; no mutation/contact/profile/protected reasons |
| Super Administrator | `super_admin` | `super-admin-local` / `super-admin` | Organization administration plus governance |

There is **no existing `kindergarten_teacher` role** or teacher profile. The user named four desired roles, but did not decide whether teacher replaces the read-only staff concept, the kindergarten administrator concept, combines them, or has a different permission matrix. Existing permission behavior must remain factual evidence for that decision.

Cross-cutting dependency map:

1. `src/access/types.ts:1` defines the five-role union; `access-service.ts:52` applies role branches. Domain kindergarten admins can do almost everything except super-admin grant changes; group admins are broadly allowed any scoped resource except role grants. The terminal branch behaves like read-only staff without a runtime explicit role check. Removing a union member alone does not reject unknown persisted role strings at runtime.
2. `src/application/authorization.ts:41` defines eight typed matrix rows, one explicit group import denial, and a role home map at line 135. `contracts.ts:81` fixes row IDs; `GrantModel` at line 247 restricts displayed grants to three admin roles. Domain policy and application policy are distinct; replacing one leaves inconsistent effective behavior elsewhere.
3. `src/runtime/synthetic/profiles.ts:4` validates five profile IDs; catalog starts at line 50 and supplies five Hungarian labels and three navigation sets. `ProfileSelector` renders the catalog dynamically. Session token payload stores profile ID and version; resolving it requires the profile still exists and has matching version (`session/session.ts:81`). A removed profile will invalidate its cookie without a compatibility alias unless explicitly designed otherwise.
4. `app/admin/_lib/session.ts:28` maps profile-role vocabulary to domain roles, gates three admin roles at line 69, and gives group admin group scope versus organization scope for other administrators. `app/munkatars/_lib/session.ts:33` accepts only synthetic role `staff`, emitting `read_only_staff` and every `STAFF_GROUPS` scope. Parent has a separate resolver. These gates need coherent updates alongside the role catalog.
5. `src/application/admin-facade.ts:483` selects kindergarten/super/group rows; advanced commands use this selector except governance's explicit super-only row. `app/admin/import/layout.tsx:8` independently denies group admins. `app/admin/beallitasok/page.tsx` requests settings and governance separately, showing governance only on success. Removing kindergarten admin leaves the super admin as the existing organization-operation role unless requirements change grants.
6. `src/directory/directory-service.ts:102` enumerates all three admin roles for sensitive family fields and mutations; its checks include family scope plus child group scopes. Keep family/group relationship protections when changing roles.
7. `src/staff-web/synthetic-staff.ts:12` defines granted Tölgyfa/Napraforgó groups and an ungranted denial fixture; `StaffApplicationFacade` requests `AUTH-STAFF-SCHEDULE`. These are actual kindergarten group scopes, not obsolete role categories. Admin/parent fixtures use other scope IDs (`org-napsugar`, `group-boroka`), while verification fixtures name still other IDs. Do not remove domain groups based only on the word “groups” in the intent.
8. SQL `20260806_access_rls.sql:34` lists `super_admin`, `kindergarten_admin`, `group_admin` in `has_admin_scope`. `app_role_grants.role` is unconstrained text; migration has no role enum or cleanup/mapping. `has_active_scope` ignores role and checks active scope. Domain tables have select/write RLS policies; group-admin import behavior is broader in SQL than application denial. Migration execution and real rows are unknown.
9. `src/import-migration/import-service.ts:12` contains five archive owners named `kindergarten-admin`, plus workgroup/finance/library/water-test process owners. These are ownership metadata, not additional members of `Role`. Retaining legacy sheet coverage while choosing new responsible owners is an explicit follow-up.
10. `verification/fixtures.json` contains five profiles; authorization JSON has 16 rows and a separate version `waldorf-authz-v1`; scenarios reference profile and row IDs. The TypeScript matrix version is `2026-08-12.1`. Manifest validation checks reference integrity but does not compare the permission semantics against application/domain implementations (`scripts/verification/core.ts:104–183`). Update all affected contracts and links together.

## Operational Dependencies and Risks

Changing the TypeScript union alone leaves SQL text, runtime grants, profiles and cookie IDs. Real kindergarten group scopes and process owners must be distinguished from role categories. Preserve existing family/group privacy, revocation and last-admin protection until requirements change them. Historical records remain historical evidence. Real Supabase/auth/RLS/persistence, scheduler/provider, Vercel and Safari remain outstanding. Team/project attestation prose diverges from private CI unsigned evidence; practices discovery must reconcile through its authorized process.
