# Code Structure

## Repository Layout

```text
.
├── src/
│   ├── access/
│   ├── admin-experience/
│   ├── coordination/
│   ├── directory/
│   ├── import-migration/
│   ├── notifications/
│   ├── parent-experience/
│   ├── privacy-audit/
│   └── staff-schedule/
├── supabase/migrations/20260806_access_rls.sql
├── .github/workflows/ci.yml
├── package.json
├── package-lock.json
├── tsconfig.json
├── README.md
├── source-materials/
└── qa-results/
```

The scan found 41 TypeScript files and approximately 583 source lines: 29 production/support files and 12 colocated test files across nine functional modules. Tests use the `*.test.ts` suffix inside each module. There is no `app`, `pages`, `public`, `server`, `routes`, `components`, or equivalent delivery directory.

## Module Organization

Most modules follow a small repeated shape:

- `index.ts`: module barrel exporting services, in-memory adapters and public types.
- `*-service.ts`: domain service or experience façade plus dependency ports.
- `types.ts`: domain contracts where the module is large enough to separate them.
- `in-memory-*.ts`: executable test adapter.
- `*.test.ts`: behavior tests colocated with the implementation.

`access` additionally contains `supabase-route-adapter.ts`. `notifications` separates scheduling from `durable-jobs.ts`. The single SQL migration is outside the TypeScript module tree.

## Code Patterns

- Constructor injection supplies repositories, authorizers, clocks, queues, providers and dispatchers.
- Repository interfaces hide persistence and expose transaction callbacks for core multi-write mutations.
- In-memory maps/arrays provide deterministic adapter behavior and rollback snapshots in tests.
- Fallible façades commonly return discriminated states such as `ready`, `empty`, `denied`, `not_found`, and `invalid-filter`.
- Lower-level coordination/import paths also use domain-specific errors or authorization-decision unions.
- Optimistic concurrency is modeled with task/assignment versions.
- Privacy is enforced by minimized projection types and generic Hungarian denial messages.
- Domain events and audit writers are ports; they are not backed by durable production infrastructure.

## Entry Points and Exports

Each functional module has a barrel, but the package has no root `src/index.ts`, `exports` map, `main`, `types`, or emitted JavaScript. The package is private and `tsconfig.json` is `noEmit`. Therefore, the barrels are internal organizational conveniences rather than a consumable package API.

The Supabase route adapter is exported from its source file but not re-exported by `src/access/index.ts`. There is no composition root to instantiate services, and no browser/server entry to invoke them.

## Configuration and Generated Assets

- `package.json` defines typecheck and Node-native test scripts only.
- `tsconfig.json` uses strict NodeNext/ES2024 checking and allows TypeScript extension imports.
- `.github/workflows/ci.yml` runs validation on pull requests and `main` pushes.
- The Supabase migration defines authorization storage, domain placeholder tables, RPC functions and RLS policies.
- No formatter, linter, bundler, framework config, environment template, CSS, static assets or generated build directory exists.

## Structural Gaps for a Runnable App

A runnable browser slice needs an explicit delivery/application area, task list/create contract, writable task repository or state store, validation boundary, composition root, HTML/CSS assets or framework entry, and `dev`/`build` scripts. These should be additive and feature-local so the existing coordination behavior and public module barrels are not accidentally redefined by the narrow local intent.

