# Access Foundation Code Summary

## Delivered

- Strict TypeScript project and test configuration in `package.json` and `tsconfig.json`.
- Typed access domain contracts, server-side policy service, in-memory adapters, and public exports under `src/access/`.
- Role/scope/field policy: organization-wide super and kindergarten admins, group-scoped group admins, family-scoped parents, and read-only staff limited to schedules and coordination display names.
- Immediate revocation: changing a grant increments the subject authorization version; stale sessions fail their next protected request.
- Generic `Nincs jogosultság` denials and redacted audit events that omit resource/field/request values.

## Validation

- `npm test` — 7 tests passed.
- `npm run typecheck` — passed (`tsc --noEmit`).

## Review Remediation

- Parent authorization now uses an explicit action × resource × field matrix: it permits only linked-family reads, assignment reads, contribution reads/updates, swap/cancellation request reads/creation, and notification reads/updates. Contact, locality, optional-profile, role-grant, and assignment mutation requests are denied.

## Boundaries

No Next.js route handler, Supabase adapter, RLS migration, or integration test was created because the repository was documentation-only and contains no Supabase schema/project. The repository and audit interfaces are the required integration seams; the future RLS predicate must mirror this library’s scope check.
