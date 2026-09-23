# Runtime Foundation Code Generation Plan

## Scope

Build the walking-skeleton runtime that turns the existing TypeScript domain library into a locally runnable Next.js application without implementing later parent, staff, or administrator workflows. The unit owns packaging, guarded composition, synthetic profile/session entry, the shared accessible shell, readiness, baseline test configuration, and local run documentation.

## Plan

- [x] **Step 1 — Establish the supported web toolchain and scripts.** Update `package.json`/lockfile for Next.js, React, validation, ESLint, Prettier, and delivery-test dependencies; enforce Node 24.x/npm 11.x with engines and `.nvmrc`; preserve existing domain test scripts while adding `dev`, `build`, `start`, `lint`, `format:check`, delivery tests, and smoke commands. Trace: US-LR-01, US-LR-08, NFR-LR-01/02/06.
- [x] **Step 2 — Create fail-closed runtime configuration and composition contracts.** Add typed `APP_RUNTIME_MODE` validation, stable redacted configuration errors, mutually exclusive synthetic/production composition roots, server-only imports, and production rejection/absence of synthetic controls. Trace: US-LR-01, US-LR-02, FR-LR-01/04/05/11, NFR-LR-05.
- [x] **Step 3 — Implement privacy-safe synthetic profiles and session switching.** Add invented Parent, Staff, Group Administrator, Kindergarten Administrator, and Super Administrator profiles with scope summaries; create/read/switch an HTTP-only same-site synthetic session; clear prior session/transient state; expose test-only reset behavior only in synthetic mode; add `data-testid` attributes to interactive controls. Trace: US-LR-02, US-LR-00 support, US-14, FR-LR-04/05/06.
- [x] **Step 4 — Implement the shared Hungarian accessible application shell.** Add the App Router root layout, global design tokens/styles, skip link, semantic header/navigation/main/status regions, visible focus, responsive navigation, role/scope announcement, safe denied state, and placeholder permitted home destinations supplied by authorized synthetic profile models rather than client policy. Trace: US-LR-03, US-LR-04e support, FR-LR-07/14, NFR-LR-03.
- [x] **Step 5 — Add readiness and local walking-skeleton routes.** Make `GET /` render HTTP 200 with `Helyi tesztprofil kiválasztása`, add a privacy-safe readiness route, ensure production-compatible build/start behavior, and keep every request local with no Supabase/provider/Vercel invocation or deployment code. Trace: US-LR-01, US-LR-09 support, FR-LR-01/02/13/13a.
- [x] **Step 6 — Add unit and integration tests for runtime/config/session/shell boundaries.** Cover valid/invalid modes, redacted configuration failures, synthetic profile inventory, session switch/clear behavior, production denial of synthetic actions, readiness/root output, navigation projection, denied state, and no target-call behavior; retain colocated `*.test.ts` files and Standard-strategy error/edge coverage. Trace: US-LR-01/02/03, NFR-LR-01/03/05/06.
- [x] **Step 7 — Configure delivery test, lint, format, and smoke tooling.** Add test configuration appropriate to Node/React/Next, ESLint/Prettier configuration, deterministic local start-smoke helper with process cleanup and configurable loopback port, and initial Playwright configuration/spec scaffold for the root/profile/shell walking skeleton. Trace: US-LR-01/03/08/09, NFR-LR-02/03/07.
- [x] **Step 8 — Document fresh local startup and runtime boundaries.** Add `.env.example` with non-secret synthetic defaults and update `README.md` with install, configure, dev, build, start, smoke, profile selection, quality commands, production-slot limitations, outstanding linked-target/Safari evidence, and explicit no-deployment scope. Trace: US-LR-01/02/09, FR-LR-11/12/13a.
- [x] **Step 9 — Validate and summarize the walking skeleton.** Run the focused type/lint/format/unit/integration/build/start smoke checks available for this unit, fix unit-owned failures, mark completed steps, and record created/modified files, test results, coverage scope, and deviations in `code-summary.md`. Trace: Bolt 1 definition of done and US-LR-01/02/03.

## Boundaries

- Existing domain modules remain framework-independent and are not rewritten.
- Later application façade and role-surface behavior is represented only by stable ports/navigation placeholders required to prove composition and shell boundaries.
- Synthetic data is invented and contains no real family, child, contact, or credential data.
- This plan creates no executable deployment workflow and performs no staging or production deployment.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback after two pinned-model dispatch failures)

**Verdict:** READY

The approved plan and summary align with the runtime security and deployment contracts: synthetic and production composition are isolated, synthetic controls fail closed in production, sessions and state-changing requests have explicit safeguards, and the local runtime makes no target calls or deployment. The plan includes config/session tests, accessibility/browser checks, and fresh-start documentation. The reported verification evidence is consistent with the scoped walking skeleton; later product flows and linked targets remain assigned/outstanding. No blocking mismatch was found.
