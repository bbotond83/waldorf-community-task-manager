# Code Structure

## Layout (single package)

| Path | Purpose |
|---|---|
| `app/layout.tsx`, `app/globals.css` | Root layout (`lang="hu"`, metadata) and the only stylesheet |
| `app/page.tsx` | Entry: runtime composition, production boundary, `ProfileSelector` or `AppShell` home |
| `app/belepes/` | Parent login page and `AuthenticationEntry` client form, server action |
| `app/szulo/` | Parent area: layout, `feladatok/` (list, `[id]`, `csere`, `lemondas`), `ertesitesek/`, `_components`, `_lib`, `actions.ts` |
| `app/admin/` | Admin area: dashboard `page.tsx`, `feladatok/`, `jovahagyasok/`, `nyilvantartasok/`, `archivum/`, `import/`, `emlekeztetok/`, `adatvedelem/`, `beallitasok/`, `_components`, `_lib`, actions |
| `app/teacher/` | Teacher area: `schedule/` list and detail, `_lib` filters/compatibility |
| `app/munkatars/beosztas/` | Legacy route handlers redirecting (307) to `/teacher/schedule`; no pages |
| `app/api/` | `readiness`, `synthetic/session`, `synthetic/reset` |
| `app/meghivas/[token]/`, `app/hozzaferes-megtagadva/` | Invitation and access-denied pages |
| `src/runtime/` | `AppShell.tsx`, `ProfileSelector.tsx`, `RuntimeConfigurationError.tsx`, `composition.ts`, `config.ts`, `session/`, `synthetic/`, `production/`, `security/` |
| `src/application/` | Facades, contracts, results, authorization, idempotency, validation, projection |
| `src/<domain>/` | access, admin-advanced, admin-core, admin-experience, coordination, directory, import-migration, notifications, parent-experience, parent-web, privacy-audit, teacher-tracking, teacher-web |
| `proxy.ts` | CSP nonce middleware |
| `public/brand/` | `logo.png`, `cover.jpg` (untracked at scan time) |
| `tests/` | `unit`, `integration`, `coverage`, `browser`, `database` |
| `scripts/`, `verification/`, `supabase/migrations/`, `.github/workflows/ci.yml` | Tooling, evidence manifests, RLS/role SQL, CI |

## File Classification

- Pages/layouts: `app/**/page.tsx|layout.tsx|loading.tsx|error.tsx`
- Server actions: `app/**/actions.ts`, `advanced-actions.ts`
- Shared UI: `src/runtime/*.tsx`, `app/*/_components/*.tsx`
- Domain/services: `src/<domain>/*-service.ts`, in-memory repositories
- Tests: colocated `src/**/*.test.ts` (node:test), `tests/**` (Vitest, Playwright)

## Patterns

- Server components by default; client components only for forms with `useActionState` (`AuthenticationEntry`, mutation forms).
- Relative imports with explicit `.ts`/`.tsx` extensions (`allowImportingTsExtensions`).
- `data-testid` on nearly every element; Hungarian route slugs (`szulo`, `belepes`, `jovahagyasok`, `nyilvantartasok`).
- Class-name families in the global CSS: `selector-*`, `profile-*`, `admin-*`, `parent-*`, `teacher-*`, `advanced-*`.
