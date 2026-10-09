# Dependencies

## External (package.json)

Runtime: `next` 16.4.0, `@next/env` 16.4.0, `react` and `react-dom` (`latest`, installed 19.2.8), `zod` (`latest`, 4.4.3).

Dev: `typescript` ^5.9, `eslint` (latest), `eslint-config-next` 16.3.8, `prettier`, `vitest` 4.1.11 with `@vitest/coverage-istanbul` and `-v8`, `jsdom`, `@testing-library/react` and `jest-dom`, `@playwright/test`, `@axe-core/playwright`, `@types/node` ^24, `@types/react(-dom)`.

An `overrides` entry maps `@next/eslint-plugin-next` `fast-glob` to `tinyglobby@0.2.17`. `.npmrc` present; lockfile `package-lock.json` fixes resolved versions. CI runs `npm audit --audit-level=high` via `verify:security`, and generates a CycloneDX SBOM.

No UI component library, icon set or font package is installed; branding work adds none by default.

## Internal Dependencies

- `app/**` imports `src/runtime/*`, `src/application/*`, `src/admin-core/*`, `src/admin-advanced/*` and per-area `_lib` helpers.
- `src/runtime/AppShell.tsx` and `ProfileSelector.tsx` depend on `synthetic/profiles.ts` types only.
- `src/application` depends on no domain module (ports); domain modules and `*-web` adapters implement ports.
- Tests import from `src/runtime/*` and `app/**` directly (`tests/integration/runtime-shell.test.tsx`, `tests/coverage/*`).
- Role-label strings in `profiles.ts` are consumed by ProfileSelector, AppShell, HomePage and the status announcement; there is no separate i18n layer.
