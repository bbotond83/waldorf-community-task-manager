# Reverse Engineering Timestamp

## Current Focused Scan

- **Scan date:** 2026-10-02
- **Repository:** waldorf-community-task-manager
- **Commit observed during synthesis:** f5cb3a5e234b729c2638b070bb390af9f26e3ad5
- **Intent:** 261002-slow-profile-login
- **Scan type:** Focused static profile-login investigation, Minimal depth
- **Pre-scan store generation:** sha256:967310007ca84822a5f9c2dfddee0ccdfde459ce474f10457023412100a8d744
- **Pre-scan source fingerprint:** tree:06b37f8e2f42c8f1b06d49afec5055c6ba36a4f109637193699e2387981bfccf
- **Pre-scan source paths:** app,proxy.ts,src,scripts,tests,package.json,package-lock.json,next.config.ts
- **Evidence:** inception/reverse-engineering/developer-scan.md and confirmed reverse-engineering-questions.md in this intent.
- **Verification:** Static synthesis only; no tests, elapsed baseline, app/browser sessions, backend calls or environment secrets read. The newly authored sequence diagrams were syntax-checked before writing.
- **Fingerprint access:** Mint used ordinary sandbox shell access, matching the pre-scan snapshot; it returned `unknown`. This does not establish a verified-CURRENT future store.
- **Coverage:** Exact deeply analyzed files below; other files under app/src/tests remain shallow. Advanced-admin helper was only skimmed. Prior UNVERIFIED analyzed paths were demoted; paths also deeply read in this scan remain analyzed.

## Preserved Historical Scan Metadata

- **Scan date:** 2026-10-01
- **Repository:** waldorf-community-task-manager (unrecorded project-root repository)
- **Commit observed during synthesis:** 13c700977b491ad5ebcaf4700743fd55e214196d
- **Intent:** 261001-local-startup-fix
- **Scan type:** Focused static startup investigation, Minimal depth
- **Pre-scan store generation:** sha256:fb74a9548910ef520b09eaeb013aa4f367ba5d3e370bcea26425f00a0d3fa3e1
- **Pre-scan source fingerprint:** git:266f195b6c6ddc567904ec51166b0185830ee4cc
- **Pre-scan source paths:** README.md,package.json,package-lock.json,.nvmrc,.npmrc,.env.example,next.config.ts,scripts/validate-runtime-config.ts,scripts/validate-toolchain.mjs,scripts/start-smoke.mjs,src/runtime/config.ts,src/runtime/composition.ts,src/runtime/production/composition.ts
- **Evidence:** active intent inception/reverse-engineering/developer-scan.md and confirmed reverse-engineering-questions.md.
- **Verification performed:** static synthesis only; no tests, startup sessions, external connections, or secrets read.
- **Recovery:** initial sandbox fingerprint mint was unknown. A fresh snapshot and full focused-file revalidation at 2026-10-01T10:12:24Z established unchanged findings. Directory snapshot entries failed publication containment, so a refreshed exact-file snapshot matching the same analyzed files established the Git fingerprint above, identical to the prior mint. Mint, comparison, and publication use matching escalated Git access; no bypass was applied.

### Earlier Full Scan

The prior full static scan was performed on 2026-09-29 for intent `260925-brownfield-roadmap` at commit `d7995af0aacf59ff7aa75880c45cc5e0a50eda9e`, branch `feature/aidlc-v2.9-brownfield-setup`. It recorded `./` and sixteen components, with fingerprint `ef7c3b2053bd61aa8f24102480297684d5014d14`. Its pre-scan store generation was `sha256:ecf4309e7a57c767554862082c3b9072438529e80748a7ed822dcafa596dbf5a`, source fingerprint `git:ef7c3b2053bd61aa8f24102480297684d5014d14`, and paths `./`. No runtime checks were performed in that scan. Prior prose is preserved in the other eight documents; prior deep whole-repository coverage is demoted to shallow because freshness was UNVERIFIED.


The preceding startup metadata describes the 2026-10-01 investigation, not current verification. Earlier outside prose is retained in the other eight artifacts. Its fingerprint is not reused for this scan.

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: 261002-slow-profile-login
fingerprint: unknown
analyzed:
  paths:
    - package.json
    - next.config.ts
    - proxy.ts
    - app/layout.tsx
    - app/page.tsx
    - app/api/synthetic/session/route.ts
    - app/api/synthetic/reset/route.ts
    - app/belepes/page.tsx
    - app/belepes/actions.ts
    - app/belepes/AuthenticationEntry.tsx
    - app/szulo/layout.tsx
    - app/szulo/feladatok/page.tsx
    - app/szulo/_lib/session.ts
    - app/szulo/_lib/facade.ts
    - app/munkatars/layout.tsx
    - app/munkatars/beosztas/page.tsx
    - app/munkatars/_lib/session.ts
    - app/munkatars/_lib/facade.ts
    - app/admin/layout.tsx
    - app/admin/page.tsx
    - app/admin/_lib/session.ts
    - app/admin/_lib/facade.ts
    - src/runtime/ProfileSelector.tsx
    - src/runtime/AppShell.tsx
    - src/runtime/composition.ts
    - src/runtime/config.ts
    - src/runtime/types.ts
    - src/runtime/security/origin.ts
    - src/runtime/session/session.ts
    - src/runtime/synthetic/composition.ts
    - src/runtime/synthetic/profiles.ts
    - src/runtime/production/composition.ts
    - src/application/index.ts
    - src/application/session-facade.ts
    - src/application/authorization.ts
    - src/parent-web/index.ts
    - src/parent-web/synthetic-parent.ts
    - src/staff-web/index.ts
    - src/staff-web/synthetic-staff.ts
    - src/admin-core/synthetic-admin.ts
    - src/admin-advanced/index.ts
    - scripts/validate-runtime-config.ts
    - scripts/validate-toolchain.mjs
    - scripts/start-smoke.mjs
    - tests/unit/runtime-boundaries.test.ts
    - tests/integration/synthetic-route.test.ts
    - tests/integration/runtime-shell.test.tsx
    - tests/browser/runtime-foundation.spec.ts
    - tests/browser/parent-web.spec.ts
    - tests/browser/staff-web.spec.ts
    - tests/browser/admin-core.spec.ts
  components:
    - Synthetic profile login boundary
    - Profile landing and role navigation
    - Parent authentication entry
    - Local synthetic session adapters
    - Login regression surface
shallow:
  paths:
    - ./
    - app/
    - src/
    - .codex/
    - .agents/
    - .aidlc-archive/
    - source-materials/
    - qa-results/
    - verification/
    - .next/
    - .verification/
    - coverage/
    - test-results/
    - scripts/verification/
    - tests/
    - .github/workflows/
    - supabase/
    - tsconfig.json
    - vitest.config.ts
    - playwright.config.ts
    - eslint.config.mjs
    - .prettierrc.json
    - README.md
    - package-lock.json
    - .nvmrc
    - .npmrc
    - .env.example
    - src/admin-advanced/synthetic-advanced.ts
```
