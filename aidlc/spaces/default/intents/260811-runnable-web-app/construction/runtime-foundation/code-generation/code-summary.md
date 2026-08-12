# Runtime Foundation Code Summary

## Scope and Traceability

Implemented the approved nine-step `runtime-foundation` walking skeleton for US-LR-01, US-LR-02,
US-LR-03 and the stated runtime support for US-LR-00, US-LR-04e, US-LR-06g, and US-LR-09. Existing
domain modules and their public behavior remain unchanged. No later parent, staff, or administrator
workflow surface and no deployment workflow or target invocation was added.

## Files Created or Modified

- Packaging/toolchain: `package.json`, `package-lock.json`, `tsconfig.json`, `.nvmrc`, `.npmrc`,
  `.env.example`, `.gitignore`, `next-env.d.ts`, `next.config.ts`, `eslint.config.mjs`,
  `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, and `playwright.config.ts`.
- Runtime composition/configuration: `src/runtime/config.ts`, `composition.ts`, `types.ts`, mutually
  exclusive `synthetic/composition.ts` and `production/composition.ts`, invented synthetic profile
  registry, signed synthetic session primitive, and same-origin request guard.
- Delivery shell/routes: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, the generic denied page,
  readiness route, synthetic session/reset routes, CSP proxy, and shared AppShell/profile/error
  components.
- Verification: toolchain/runtime validators, deterministic production start-smoke helper, focused
  unit tests, shell and synthetic-route integration tests, and Chromium/Firefox/mobile-Chrome
  Playwright plus axe checks.
- Documentation/artifacts: runtime/start/quality/deployment-boundary sections in `README.md`, the
  completed approved plan, and this summary.

## Key Implementation Decisions

- Exact installed versions are lockfile-pinned: Next.js 16.3.0, React/React DOM 19.2.8, Zod 4.4.3,
  Vitest 4.1.10, Playwright 1.62.1, ESLint 9.39.5, and Prettier 3.9.6.
- `.nvmrc`, `engines`, `.npmrc engine-strict`, and a preinstall/start/build toolchain check enforce
  Node 24.x/npm 11.x with stable privacy-safe failures. Node 26 was intentionally rejected with
  `TOOLCHAIN_NODE_UNSUPPORTED`; Node 24.19.0/npm 11.19.0 passed.
- `validateRuntimeConfig` inspects an allowlisted projection and returns stable result codes. The
  production branch validates variable presence/shape but creates only an unlinked adapter slot and
  performs no Supabase/provider/Vercel call.
- Synthetic and production roots are dynamically, exclusively selected. Synthetic profile/session
  and reset routes return 404 in production behavior and cannot create a session there.
- Synthetic sessions use a bounded signed opaque cookie (`HttpOnly`, `SameSite=Lax`, path `/`);
  profile switches rotate/clear it and clear browser cache state. State changes enforce same origin.
- Navigation is supplied by server-owned invented profile projections. UI copy is Hungarian;
  technical identifiers are English. All interactive controls have stable `data-testid` values.
- The shell includes a skip link, semantic landmarks, live status, visible focus, responsive
  navigation, 44px control targets, privacy-safe denial, and CSP/security headers.

## Verification Results

All final checks below ran on 2026-08-12 using Node 24.19.0 and npm 11.19.0 unless stated:

- `npm ci`: PASS; 457 packages installed, zero reported vulnerabilities.
- `npm run format:check`: PASS.
- `npm run lint`: PASS with zero warnings.
- `npm run typecheck`: PASS under strict TypeScript.
- `npm test`: PASS — 52 existing domain tests plus 26 runtime unit/integration tests.
- `npm run test:coverage`: PASS — existing domain production source 94.57% lines, 87.99% branches,
  88.56% functions; runtime production source 97.14% lines, 95.34% branches, 100% functions.
- `npm run build`: PASS; production App Router output includes root, readiness, synthetic guarded
  routes, denied state, and CSP proxy.
- `npm run smoke:start`: PASS with `SMOKE_START_OK: waldorf-local-ready`; child process cleaned up.
- `npm run test:browser`: PASS — 9/9 across Chromium, Firefox, and mobile-Chrome emulation,
  including profile selection/switch projection and no serious/critical axe violations on root.
- Unsupported local Node 26.7.0 toolchain check: expected FAIL with stable
  `TOOLCHAIN_NODE_UNSUPPORTED`, proving the baseline guard.

## Coverage Scope and Outstanding Evidence

The unit proves configuration/composition isolation, production denial of synthetic routes, profile
inventory/projection, signed session rotation/expiry/cookie flags, same-origin enforcement, readiness,
shell semantics, profile switching, start smoke, and root automated accessibility. Full role/product
flows remain owned by later UI and verification units. Supabase authentication/RLS/persistence,
scheduled jobs/providers, linked Vercel execution, and Safari desktop/mobile Safari evidence remain
`OUTSTANDING`; synthetic success is not reported as target verification.

## Deviations

- The approved plan asked for the current stable compatible stack; lockfile resolution selected the
  exact versions listed above.
- Browser tests initially used the development server, but the file watcher exceeded the execution
  environment's open-file limit. The final scaffold runs Playwright against the already-required
  production build, which is deterministic and better matches the walking-skeleton build/start gate.
- Browser binaries were installed once for verification, and browser execution required an
  unsandboxed macOS process-port allowance. The final suite passed under the supported runtime.
- No CI/CD workflow, dependency/SAST/secret-scanning workflow, SBOM, or attestation was added because
  this unit and approved intent explicitly prohibit an executable deployment workflow; those remain
  verification/pipeline responsibilities.
