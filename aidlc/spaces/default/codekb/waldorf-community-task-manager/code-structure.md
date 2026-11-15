# Code Structure

## Repository Layout

```text
app/                    Next.js routes, server actions and screen components
  _identity/            Session lookup, sign-out, role home, access-state exit
  admin/                Admin screens, _components, _lib, actions.ts, advanced-actions.ts
  api/readiness/        Readiness endpoint
  bejelentkezes/        Sign-in
  hozzaferes-megtagadva/ No-access page
  jelszo-visszaallitas/ Password reset request and new password
  meghivas/[token]/     Invitation acceptance
  munkatars/beosztas/   Old teacher links, redirect only
  szulo/                Parent screens, _components, _lib, actions.ts
  teacher/              Teacher screens, _components, _lib
  fonts/, globals.css   Self-hosted fonts, the one stylesheet
src/
  access/               Roles, scopes, grant rules
  application/          Facades, pipeline, contracts, authorization matrix, status labels
  data/                 Database adapters behind the application ports
  identity/             Sign-in, sessions, invitations, password reset, mail
  import-parser/        Workbook template, reader, limits
  runtime/              Composition, configuration, shell components, database client
supabase/
  migrations/           41 forward-only SQL files, applied in file-name order
  config.toml, roles.sql, templates/recovery.html
scripts/
  db/                   Stack, migration, seed, reset, worker tools
  verification/         Local verification, evidence and scans
tests/
  unit/, integration/, coverage/, database/, browser/, support/
verification/           Manifests, runbook, reports
source-materials/       Product requirements document
qa-results/             Historical QA records
proxy.ts                Session refresh and content security policy
```

## File Classification

| Category | Where |
|---|---|
| Model and schema | `supabase/migrations/*_schema.sql`, `src/application/contracts.ts`, `src/access/types.ts` |
| Controller and handler | `app/**/actions.ts`, `app/**/route.ts`, `app/**/page.tsx`, `proxy.ts` |
| Service and use case | `src/application/*-facade.ts`, named functions in `supabase/migrations/` (`*_functions.sql`, `*_kernel_*.sql`, `*_commit.sql`) |
| Repository and data access | `src/data/*-port.ts`, `src/data/admin-*.ts`, `src/data/imports.ts`, `src/data/notifications.ts`, `src/data/gateway.ts` |
| Utility | `src/application/budapest-time.ts`, `validation.ts`, `src/data/values.ts`, `src/data/payload.ts`, `src/runtime/hyphenation.ts` |
| Configuration | `next.config.ts`, `src/runtime/config.ts`, `src/runtime/database/config.ts`, `supabase/config.toml` |
| Middleware | `proxy.ts`, `src/application/facade-pipeline.ts` |
| Test | `*.test.ts(x)`, `tests/**`, `tests/browser/*.spec.ts` |
| Migration | `supabase/migrations/*.sql`, `scripts/db/runner.ts` |
| Static | `app/globals.css`, `app/fonts/`, `public/brand/` |

## Migration Map

| File group | Block |
|---|---|
| `20260806`, `20261006` | First access tables and the role conversion |
| `20261012`, `20261013` | Platform: audit, holds, idempotency, result envelope |
| `20261014` to `20261023` | Identity: accounts, sessions, sign-in lockout, invitations, grants, privileges, password hook, email-change guard |
| `20261024`, `20261025` | Directory and settings |
| `20261026`, `20261027` | Coordination schema, events, tasks, notes |
| `20261028` to `20261030` | Kernel: sign-up, swaps and cancellations, family archive, dashboard, governance |
| `20261031`, `20261032` | Teacher schedule, lifecycle |
| `20261033` to `20261035_*` | Group reach rewrite, policy speed, repairs, placeholder drop |
| `20261036` to `20261038` | Notifications and the wrappers around the kernel |
| `20261039` to `20261042` | Import and its dashboard and lifecycle links |
| `20261043` to `20261046` | Repairs, audit purge, denied-audit limit |

## Code Patterns

- **Database use-case template**: active session check, idempotency key check, `identity_actor_organization()`, fingerprint, `platform_idempotency_check`, inner block with `platform_abort` for refusals, store on success, catch `U3R00`. New functions should copy it.
- **Wrapper around a core**: `alter function x rename to x_core`, then a new `x` that calls it and adds side effects only on a fresh success.
- **Result envelope**: `{state, reference, code}` plus extras such as `items` or `version`.
- **Expected version**: `version` columns raised by the `platform_touch_version` trigger, compared in functions.
- **Reach helpers**: `has_super_scope`, `has_core_scope`, `directory_reaches_family`, `directory_group_visible`, `coordination_task_reached`.
- **Ports with optional members**: a test double may omit a port method; the facade answers `denied`.
- **Frozen read models**: facades return `Object.freeze`d projections.
- **Forms**: hidden `id`, `expectedVersion`, `idempotencyKey`; a `useActionState` wrapper (`ParentMutationForm`, `AdminMutationForm`) shows outcomes.
- **Session resolvers**: each area has `_lib/session.ts`, `_lib/facade.ts` and an access-state component; `layout.tsx` blocks the page when access fails.
- **Styling hooks**: kebab-case classes with an area prefix (`parent-`, `teacher-`, `admin-`, `filter-`) and `data-testid` attributes, which browser specs rely on.

## Conventions

- English identifiers, Hungarian user text. Tests sit beside code (`src/**/*.test.ts`) or in `tests/`.
- Imports include the `.ts` extension in `src/` so Node can run them directly.
- Times are stored in UTC and shown in Europe/Budapest.
- Every new database function needs `revoke all` followed by explicit `grant execute`.
- Function and table names are snake_case, and every `create` is schema-neutral.
