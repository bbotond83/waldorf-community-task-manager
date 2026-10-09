# Integration Test Instructions

## Environment and Data

Use locked installed dependencies, Node24/npm11 via PATH=/opt/homebrew/opt/node@24/bin:$PATH. Do not reinstall or upgrade. Build/start/browser use APP_RUNTIME_MODE=synthetic and APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1. All records are isolated invented fixtures; no live migration or backend linkage. Preserve existing thresholds, privacy, disabled deployment, private unsigned evidence and local next-env.d.ts (save/restore around generated build). Real PostgreSQL tools/target are unavailable; actual locking/RLS remains Unverified, with no later validation stage scheduled.

## Scoped Commands

Each distinct command below runs once. Counts overlap; never sum runs as unique tests.

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/access/access-service.test.ts src/access/access-matrix.test.ts src/application/authorization.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npx vitest run --config vitest.config.ts --project delivery tests/unit/runtime-boundaries.test.ts tests/integration/synthetic-route.test.ts tests/integration/runtime-shell.test.tsx
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/access/role-policy.test.ts src/access/current-role-migration.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/access/legacy-role-conversion.test.ts src/access/transaction.test.ts src/access/access-service.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/access/access-service.test.ts src/access/access-matrix.test.ts src/directory/field-policy.test.ts src/directory/directory-service.test.ts src/application/authorization.test.ts src/application/contracts.test.ts src/application/facades.test.ts src/application/isolation.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npx vitest run --config vitest.config.ts --project delivery tests/unit/runtime-boundaries.test.ts tests/unit/current-role-session.test.ts tests/integration/synthetic-route.test.ts tests/integration/runtime-shell.test.tsx
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/teacher-tracking/schedule-service.test.ts src/teacher-web/synthetic-teacher.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/integration/teacher-components.test.tsx tests/coverage/teacher-pages.test.tsx
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/teacher-tracking/tracking-model.test.ts src/teacher-tracking/schedule-service.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/teacher-web/synthetic-teacher-repository.test.ts src/teacher-web/synthetic-teacher.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/application/teacher-facade.test.ts src/application/isolation.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test --test-name-pattern='Teacher|teacher' src/application/facades.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/integration/teacher-boundaries.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/unit/teacher-filters.test.ts tests/integration/teacher-routes.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/coverage/app-entrypoints.test.tsx -t 'Teacher|teacher|compatibility'
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:browser -- tests/browser/teacher-web.spec.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:browser -- tests/browser/teacher-web.spec.ts --grep @a11y
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/coverage/production-inventory.test.ts -t 'U2 teacher inventory'
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:browser -- tests/browser/runtime-foundation.spec.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/teacher-tracking/tracking-model.test.ts src/teacher-tracking/schedule-service.test.ts src/teacher-web/synthetic-teacher-repository.test.ts src/teacher-web/synthetic-teacher.test.ts src/application/teacher-facade.test.ts src/application/isolation.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/unit/teacher-filters.test.ts tests/integration/teacher-boundaries.test.ts tests/integration/teacher-routes.test.ts tests/integration/teacher-components.test.tsx tests/coverage/teacher-pages.test.tsx
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/admin-experience/admin-service.test.ts src/import-migration/import-service.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/unit/verification-core.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/import-migration/import-service.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/application/admin-facade.test.ts src/admin-experience/admin-service.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/integration/retained-workflows.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/unit/current-role-references.test.ts tests/unit/verification-core.test.ts tests/coverage/verification-entrypoints.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:browser -- tests/browser/parent-web.spec.ts tests/browser/admin-core.spec.ts tests/browser/admin-advanced.spec.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:browser -- tests/browser/parent-web.spec.ts tests/browser/admin-core.spec.ts tests/browser/admin-advanced.spec.ts --grep @a11y
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --experimental-strip-types --test src/import-migration/import-service.test.ts src/admin-experience/admin-service.test.ts src/application/admin-facade.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/integration/retained-workflows.test.ts tests/unit/current-role-references.test.ts tests/unit/verification-core.test.ts tests/coverage/verification-entrypoints.test.ts
```

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:delivery -- tests/coverage/production-inventory.test.ts
```

## Integrated Gates

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm test
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:coverage
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run format:check
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run lint
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:browser
```

Maintain the dynamic all-production denominator and80% each line/branch/function. All configured Chromium/Firefox/mobile projects and critical Axe assertions apply.
