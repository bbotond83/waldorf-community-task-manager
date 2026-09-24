# Family Directory Code Summary

## Delivered

- `src/directory/types.ts` defines directory-owned records, repository, audit, and view contracts while structurally consuming `src/access` authorization and role-grant interfaces.
- `src/directory/directory-service.ts` implements transaction-scoped family, parent, child, group, archive, and restore operations; rejects duplicate/cross-organization links; refreshes visibility; and emits redacted events.
- `src/directory/in-memory-directory-repository.ts` provides an independently executable rollback-capable repository and audit writer for tests.
- `src/directory/directory-service.test.ts` adds six focused behavior and privacy tests.
- The project test command now runs all access and directory tests.

## Security and Privacy Decisions

- A directory mutation requires both a server authorization decision and an active administrative grant; parents cannot mutate directory relationships.
- Family reads require a matching family or relevant active-group scope. Linked parents receive display-only parent/child information; contact, locality, and optional-profile values are restricted to in-scope administrators.
- Directory audit events contain only actor ID, event kind, time, related family ID, and a generic summary.

## Validation

- `npm test` — 13 tests passed.
- `npm run typecheck` — passed (`tsc --noEmit`).

## Deferred Integration

No Next.js handler, Supabase migration/index/RLS policy, pagination endpoint, or performance benchmark was created because this workspace has no database or framework scaffold. The repository and authorization ports are the integration seams; any Supabase transaction/RLS implementation must preserve the command atomicity and field filtering tested here.
