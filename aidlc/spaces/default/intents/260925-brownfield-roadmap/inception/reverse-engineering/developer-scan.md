## Developer Code Scan Results

**Scan date:** 2026-09-29  
**Repository:** `waldorf-community-task-manager`, branch `feature/aidlc-v2.9-brownfield-setup`, HEAD `d7995af0aacf59ff7aa75880c45cc5e0a50eda9e`  
**Snapshot boundary:** `paths=["./"]`, `store_generation=sha256:ecf4309e7a57c767554862082c3b9072438529e80748a7ed822dcafa596dbf5a`, `source_fingerprint=git:ef7c3b2053bd61aa8f24102480297684d5014d14`. A space-level CodeKB was present at this snapshot; this scan did not use it as a substitute for source inspection and did not modify it.

### Scan Coverage

- **Analyzed deeply:** complete file inventories for `app/`, `src/`, `tests/`, `scripts/` and `supabase/`; all route/action locations and module exports; runtime configuration/composition/session code, shared application authorization/facade contracts, representative domain service implementations, all API route handlers and representative server actions; root README and build/dependency/test/security/CI configuration (`package.json`, lockfile, TypeScript, Next, ESLint, Vitest, Playwright, environment example, toolchain scripts and GitHub workflow); verification manifests, report provenance and outstanding-target inventory; the user-facing Hungarian walkthrough's flow inventory; current `.codex/onboarding.md`, `config.toml`, `hooks.json`, compiled stage/scope inventory, framework stamp/manifest, selected core tools/hooks and feature/bug-fix/active-project scope definitions; active-space project rules and current intent scope/backlog/handoff/state; archived intent registry and both archived state files; all nine archived CodeKB documents' architecture/API/technology/quality claims; and the tracked-file/top-level directory inventory for `./`.
- **Skimmed only:** individual app page/component bodies and domain implementation files beyond representative routes/services/public surfaces; the remaining AI-DLC tool, stage, agent, skill, knowledge and archived-runtime source files after inventorying their paths/counts; archived intent contents beyond state/registry, CodeKB and selected decision-bearing artifacts (generated audits, sensors, hook-health, session and recovery data were not individually interpreted); PRD headings/index and QA artifact inventories; ignored `.next/`, `.verification/`, `coverage/` and `test-results/` output presence/provenance. The source workbook `source-materials/waldorf-community-app/Ovis tábla v2.xlsx` was inventoried by name and size only and not opened; no family/child records were inspected.
- **Breadth/provenance:** 1,451 tracked files were inventoried. The largest tracked areas are `.aidlc-archive/` (866 files), `.codex/` (273), `.agents/` (84), `src/` (80), `app/` (71), `aidlc/` (16) and `tests/` (14). The local filesystem also contains ignored/generated files; those do not represent additional source packages.
- **Verification limit:** static inspection only. No tests, builds, installs, audits, app sessions, external calls, database operations or deployments were run. Existing recorded verification results are cited with their SHA and date, not as a fresh pass. The pre-existing dirty AI-DLC state/audit/artifact changes were left intact.

### Packages Found

- `waldorf-community-task-manager` — one private npm ESM package, version `0.2.0`; no npm workspace or separately deployable service packages.
- `app/` — Next.js App Router UI/delivery layer: Parent (`/szulo`), Staff (`/munkatars`), Administrator (`/admin`), login, synthetic invitation and access-denied flows, shared role components/layouts, server actions and route handlers. UI copy is Hungarian; technical identifiers are English.
- `src/application/` — shared result/contract types, authorization matrix and session-version invalidation, facade pipeline, validation, projection, idempotency and evidence abstractions.
- `src/runtime/` — Zod configuration validation, synthetic/production composition selection, profile shell, origin boundary and synthetic session handling.
- `src/access/` — role-grant and scope authorization domain service, audit/repository ports, in-memory adapters and a narrow Supabase RPC port adapter.
- `src/directory/` — family/parent/child data contracts, group/school-year links, visibility policy and archive/restore.
- `src/coordination/` — task sign-up/capacity, optimistic versions, assignments, swaps, cancellations, contribution and allergen access checks, audit/event ports.
- `src/import-migration/` — legacy workbook sheet registry, row validation, preview/fingerprint, conflict resolution, commit, rollback and recovery contracts.
- `src/notifications/` — 7-day/24-hour scheduling and durable dispatch/retry/cancellation jobs through provider/store/queue ports.
- `src/parent-experience/`, `src/admin-experience/`, `src/staff-schedule/` — role-oriented application services with explicit ready/empty/denied/validation result shapes.
- `src/parent-web/`, `src/admin-core/`, `src/admin-advanced/`, `src/staff-web/` — in-memory synthetic fixtures and feature façades used by the current local experience.
- `src/privacy-audit/` — family personal-data lifecycle, grace/hold deferral, anonymization and audit-retention behavior behind repository ports.
- `tests/` and colocated module tests — integration, runtime, domain and browser verification.
- `.codex/`, `.agents/`, `aidlc/` — a bundled AI-DLC 2.10.0 Codex workflow/tooling layer, agent roles, stage skills/definitions, hooks/sensors, scopes, project rules and versioned workflow records. This is repository governance/tooling, distinct from the application package.
- `source-materials/`, `qa-results/`, `verification/` — PRD/workbook inputs, historical review artifacts, synthetic scenario/authorization manifests and recorded local/linked-target evidence.

### Build System

- **Type:** Node/npm with Next.js App Router, React and TypeScript. The declared supported runtime is Node 24.x and npm 11.x; the shell observed during this scan is Node `v26.10.0` / npm `11.19.1`, so this shell does not satisfy the enforced Node major.
- **Configuration:** `package.json`, `package-lock.json`, `.nvmrc`, `.npmrc`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `.github/workflows/ci.yml`; AIDLC harness configuration is under `.codex/` and compiled metadata under `.codex/tools/data/`.
- **Build/runtime relationships:** `app/` routes and server actions call role-specific façades under `src/*-web`/`src/admin-*`, shared contracts under `src/application`, and runtime/session composition under `src/runtime`. Synthetic composition wires deterministic in-memory profiles and stores. Domain services depend on typed/injected repository, authorization, audit, clock, queue, provider and event ports. The only SQL integration seam is an injected Supabase RPC adapter plus one migration; the production composition explicitly remains unlinked.
- **Scripts:** local install/dev/build/start toolchain checks; strict typecheck; lint/format; Node domain tests; Vitest integration/unit tests and coverage; Playwright browser/a11y; smoke startup; manifest/evidence validation; privacy/secret/SAST/no-deploy scans; and sequential `verify:local` orchestration.
- **Framework workflow:** the repository's compiled AI-DLC graph has 33 core stages across initialization, ideation, inception, construction and operation. The installed project stamp is 2.10.0. `.agents/skills/`, `.codex/agents/`, `.codex/hooks/`, `.codex/aidlc-common/` and `.codex/tools/` package the workflow; current project-practice source remains under `aidlc/spaces/default/memory/`.

### APIs Discovered

- **HTTP routes — 3:** `GET /api/readiness`; `POST /api/synthetic/session`; `POST /api/synthetic/reset`. Synthetic mutation routes reject non-synthetic mode and require same-origin requests. Session selection/reset are local harness operations.
- **Application actions:** Next server actions provide synthetic login/invitation; parent signup, swap, cancellation, notification-read and contribution; administrator record/task/assignment/approval/event-note, import/conflict/recovery, reminders, governance, privacy lifecycle and settings operations. These use `FormData` and typed action results; they are not a separately versioned public REST API.
- **Database boundary:** `supabase/migrations/20260806_access_rls.sql` declares `authorization_version_for`, `has_active_scope`, and `has_admin_scope`, role/version tables and scoped RLS policies. `src/access/supabase-route-adapter.ts` calls the first two through a minimal injected client port. No Supabase SDK, generated database types, migration runner, or live integration tests were found.
- **Domain/application surfaces:** internal TypeScript contracts and ports are the primary APIs; there is no OpenAPI/GraphQL/gRPC specification or standalone package root export.

### Frameworks & Libraries

Versions below are from the manifest/lockfile; `latest` denotes a moving range in `package.json`, currently fixed by the lockfile values shown.

- Next.js `16.3.6`; React and React DOM `19.2.8` (manifest `latest`); Zod `4.4.3` (manifest `latest`).
- TypeScript `5.9.3` (manifest `^5.9.0`); Node.js required `24.x`; npm required `11.x`.
- Vitest and `@vitest/coverage-v8` `4.1.11`; Playwright `1.62.1`; `@axe-core/playwright` `4.13.0`; jsdom `30.0.1`; Testing Library React `16.3.2`.
- ESLint `9.39.5`; `eslint-config-next` `16.3.0`; Prettier `3.9.6`.
- PostgreSQL/Supabase SQL is represented in migration source only. No live database, email provider, scheduler, Vercel client, or production SDK is configured.
- AIDLC project stamp and manifest identify framework version `2.10.0`, Codex distribution; this is separate from the README footer, which still says `2.5.11` and the active intent description's historical `2.9.0` wording.

### Test Coverage

- **Test directories:** 20 colocated `src/**/*.test.ts` files; `tests/unit/` (2 files), `tests/integration/` (6), `tests/browser/` (5 Playwright specs).
- **Frameworks:** Node `node:test` with experimental TypeScript stripping; Vitest/jsdom with V8 coverage; Playwright Chromium, Firefox and mobile-Chrome projects; Axe accessibility checks.
- **Configured thresholds:** 80% lines/branches/functions appear in the Node domain coverage command and Vitest. The Vitest config explicitly includes only `src/runtime/**/*.{ts,tsx}` for coverage. Application page/action files and most domain modules are not explicitly included by that Vitest coverage configuration; confirm actual whole-production-source coverage before treating the README's broad coverage statement as enforced.
- **Recorded evidence:** the committed acceptance report records 33 PASS, 0 FAIL and 6 OUTSTANDING, but is bound to SHA `69edd12c7aba1c0ae35138bbac67932d86b85e63` at `2026-08-12T15:32:22Z`, not this scan's `d7995af`. Ignored `.verification/evidence` records the same old SHA. The six outstanding areas are desktop/mobile Safari, Supabase auth/RLS and persistence, scheduler/provider and Vercel preview/staging. No current checks were run.

### Code Quality Indicators

- **Type checking:** `tsconfig.json` enables strict mode and includes `app`, all `src`, `tests`, scripts and config files.
- **Linting/formatting:** ESLint and Prettier are blocking in the defined verification chain. The npm lint/format file globs include `app`, `src/application`, `src/runtime`, tests and scripts, but omit most domain folders under `src/` (e.g. access, directory, coordination, import-migration, notifications and privacy-audit). Several omitted modules compress entire methods onto very long lines, reducing readability and automated formatting/lint coverage.
- **CI:** `.github/workflows/ci.yml` runs `verify:local` on PRs targeting `main` and pushes to `main`, not feature-branch pushes alone. Main push validation is followed by a CycloneDX SBOM and build/SBOM attestations. Actions are pinned to immutable SHAs; the workflow has no deploy job.
- **Verification boundary:** README and project rules require synthetic-only local evidence, no real family/child data, and no deployment before a linked target exists. The production runtime accepts validated configuration but `src/runtime/production/composition.ts` makes no target call, labels Supabase `unlinked`, and has no current authorization-version source.
- **Project rules:** current rules affirm regression tests for defects, tests in the same change, green automated checks, English technical identifiers/Hungarian UI, module ports/injection, and no executable deployment workflow before a linked target exists. Some inherited rule text still refers to the earlier domain-library-only state; see risks below.

### Archived AIDLC Claims Compared with Current Evidence

The archived runtime contains two completed records: `260729-feature` (recorded Greenfield, reverse engineering skipped) and `260811-runnable-web-app` (recorded Brownfield, 23 of 32 stages completed at final state). The archive contains 832 files under the two intent records, including authored requirements/design/decision artifacts and generated state/audit/runtime/sensor/session material. Its nine-document CodeKB is dated 2026-08-11 at commit `d840d4e958ff1aa00447f47ecef585dbec64c22a`.

| Historical evidence | Current assessment |
|---|---|
| Archived CodeKB says no HTTP routes, browser/server entry or Next/React app; 41 TypeScript files and about 583 source lines. | **Contradicted / stale.** Current source has the App Router, role-specific pages, server actions, 3 route handlers, 15 top-level `src` modules, and app/browser test layers. |
| Archived CodeKB says no runtime npm dependencies or `dev`/`start`/`build` capability. | **Contradicted / stale.** Current manifest locks Next.js/React/Zod and defines loopback dev, build and start scripts plus local verification. |
| Archived architecture lists nine domain modules, in-memory adapters and a partial Supabase authorization edge. | **Partly supported, extended.** The earlier domain boundaries remain visible within the current 15-module `src` layout; runtime/application/UI and synthetic adapters have since been added. The production/persistence edge remains incomplete and unlinked. |
| Archived active intent is described as only a synthetic local task list/create slice. | **Stale as the current implementation boundary.** Current synthetic UI also exposes parent duties/requests/notifications, staff schedule, admin records/tasks/approvals/import/reminders/governance/privacy/settings. These are observable local surfaces, not proof of live business processes or production data. |
| Archived test counts, coverage percentages and zero-high-vulnerability result. | **Historical only.** The scan and current committed report bind them to earlier SHAs; they cannot establish current pass/fail or dependency status. |
| Prior planning discussed eventual deployment/integration paths. | **Not executable now.** Current README/rules say the targets remain outstanding and deployment must stay off until separately linked and approved. |

Decision-bearing historical requirements and designs are leads to reconcile, not a current feature backlog. Generated archive state/audits/runtime graphs/sensor and hook-health output are process evidence. A space-level CodeKB is present in the current working tree and was left untouched; do not confuse it with a fresh test run or this new full-root developer report.

### Recommended Future Feature and Bug-Fix Workflow

The approved scope calls for shared intake/discovery followed by separate feature and bug-fix delivery paths. It proposes `(Impact + Risk + Dependency leverage) / Effort`, with 1–5 ratings, and risk-first investigation. The weights and Must/Should/Could thresholds remain proposals until calibrated; no specific feature or defect is selected here.

1. **Shared intake/discovery:** record requested user outcome or reproducible symptom, affected roles, evidence, impact/severity, privacy/security/data-integrity/reliability risk, dependencies, effort and current SHA. For implementation work, trace the touched App Router action/page through its façade/application contract, domain service, adapter and tests. Use the highest-risk uncertainty to choose early investigation.
2. **Feature path:** define user outcome and testable acceptance conditions; map affected roles, authorization/sensitive fields, ownership and dependencies; design only the contracts/UI needed; deliver the smallest vertical slice with same-change tests; use a gated end-to-end skeleton for high-risk cross-boundary work.
3. **Bug-fix path:** establish failing reproduction, version, impact and blast radius; identify root cause; add the regression test before the narrow fix; run the regression and affected integration/browser checks. Keep unrelated refactors separate.
4. **Shared closeout:** review the diff and evidence; run the relevant focused checks and project quality/security gates; record linked-target/Safari items as outstanding unless actually exercised; make an explicit merge/release decision and capture follow-up learning. Do not deploy until a separately approved linked-target path exists.

For a single developer, one accountable owner is enough; add specialist review where risk warrants it. Existing `feature` scope runs all 33 stages at Standard depth, while `bugfix` is Minimal but includes deployment stages; both declare a relaxed guard policy. A future reusable scope should explicitly calibrate those guards and keep deployment skipped until current project rules allow it. This is advice only; no scope or rules were changed.

## Handoff Summary

- **Intent-relevant finding:** the current repository is a substantial synthetic Next.js application layered over the earlier domain core, while production authentication, persistence, providers, scheduler and deployment remain unlinked. The archive's domain-only CodeKB must be classified as stale where current source disproves it; don't turn archived/generated records into product scope.
- **Workflow-relevant finding:** the code has clear delivery → application/runtime → feature/domain → injected-port seams, supporting shared intake and evidence gathering followed by distinct feature and bug-fix paths. Current project practices support same-change regression tests, typed outcomes, authorization/privacy checks and blocking local quality gates.
- **Risks / follow-up:** current acceptance evidence is stale at SHA `69edd12`; observed Node 26 conflicts with required Node 24; manifest `latest` entries can move during lock refresh; test coverage and lint/format globs omit parts of production source; feature-branch pushes do not trigger CI until a PR targets `main`; README's AIDLC version footer and some inherited project-rule wording are stale. Keep the workbook unopened and all linked-target/Safari results outstanding until safely and explicitly checked.
