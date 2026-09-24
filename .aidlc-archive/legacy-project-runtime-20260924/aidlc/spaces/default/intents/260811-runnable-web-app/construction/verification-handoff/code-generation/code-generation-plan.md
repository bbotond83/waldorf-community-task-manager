# Verification and Local Handoff Code Generation Plan

## Scope

Package objective local acceptance for the complete runnable application. The unit owns versioned authorization/privacy/scenario manifests, aggregate verification commands, evidence status and privacy validation, browser/security/accessibility/build/start orchestration, `.env.example` and fresh-checkout documentation, and explicit outstanding linked-target reporting. It does not change product business rules or deploy anything.

## Plan

- [x] **Step 1 — Version the authorization matrix and sensitive-field dictionary.** Create machine-readable and human-reviewable role × scope × route × action × resource × field rows covering Parent, Staff, Group/Kindergarten/Super Administrator, generic denial, immediate revocation, and explicit prohibited field identifiers; validate uniqueness and cross-references. Trace: US-LR-00/07, FR-LR-14, NFR-LR-05.
- [x] **Step 2 — Version the fixture/profile and scenario manifest.** Map every current local story and inherited US-01–US-14/NFR-08 inventory item to owning route/command, synthetic profile/fixture, authorization row, expected state, browser/API evidence, and local versus linked-target status requirement; fail on missing critical coverage. Trace: US-LR-07/08, FR-LR-10a/10b.
- [x] **Step 3 — Implement the evidence schema, recorder, and fail-closed aggregator.** Validate scenario/story/requirement/matrix/fixture/runtime/tool/browser/result/timestamp/path fields; accept `PASS` only from executed current local evidence, preserve `FAIL`, require `OUTSTANDING` for unexecuted real-target/Safari checks, reject stale/missing/mismatched/unsafe artifacts, and generate deterministic Markdown/JSON reports. Trace: US-LR-07/08/09, NFR-LR-05.
- [x] **Step 4 — Implement privacy, secret, and deployment-boundary scans.** Scan fixtures/source-generated logs/reports/HTTP artifacts/screenshots/traces/accessibility snapshots for secrets, contact/locality/profile/protected-reason/unrelated-family/raw-error patterns; verify synthetic controls cannot activate in production composition; verify repository commands contain no deployment target/token/publish/promote invocation. Trace: US-LR-07/08/09, FR-LR-13/13a, NFR-LR-05.
- [x] **Step 5 — Implement deterministic aggregate local verification commands.** Add scripts for environment/toolchain/manifests, format/lint/typecheck, domain/delivery tests and ≥80% line/branch/function coverage, security/audit, production build, loopback start/readiness smoke, critical Chromium/Firefox/mobile flows with axe/performance, evidence aggregation, process cleanup, and non-zero failure propagation. Trace: US-LR-01/07/08, NFR-LR-01/02/03/04/07.
- [x] **Step 6 — Harden browser fixture isolation and complete aggregate browser coverage.** Remove process-global/cross-project state races, ensure every scenario resets/selects unique deterministic state, run all runtime/Parent/Staff/Admin Core/Admin Advanced critical flows across required automated browsers, and retain privacy-safe failure artifacts only. Trace: US-LR-02–07, NFR-LR-07.
- [x] **Step 7 — Add Standard-strategy tests for manifests, aggregation, and scanners.** Cover valid evidence plus at least two malformed/stale/privacy/missing cases per tool, matrix/manifest completeness, status non-upgrade, synthetic-control production denial, no-deployment guard, process cleanup/failure propagation, and deterministic report output. Trace: US-LR-07/08/09, NFR-LR-02/05/06.
- [x] **Step 8 — Complete the fresh-checkout environment contract and runbook.** Reconcile `.env.example`, README, and any dedicated local-acceptance guide with Node 24/npm 11 setup, install/config/dev/build/start/smoke/profile routes/quality commands, fixture reset, troubleshooting, synthetic limitations, Safari execution instructions, linked Supabase/provider/Vercel repeats, and explicit no-deployment behavior. Trace: US-LR-01/09, FR-LR-11/12/13a.
- [x] **Step 9 — Generate the local acceptance and outstanding-target reports.** Execute the full verification sequence, bind results to git SHA/tool/fixture/manifest versions, record local `PASS`/`FAIL`, list Safari and Supabase/provider/Vercel rows as `OUTSTANDING` unless actually executed, and ensure no local outstanding row is silently omitted. Trace: US-LR-07/08/09, acceptance evidence matrix.
- [x] **Step 10 — Validate a clean handoff and summarize.** Run fresh-install-equivalent validation on Node 24/npm 11 using the lockfile and synthetic config, rerun format/lint/typecheck/tests/coverage/build/smoke/full browser/security/evidence checks, fix unit-owned failures including cross-suite flakes, mark steps complete, and record files, commands, final evidence, outstanding rows, and deviations in `code-summary.md`. Trace: Bolt 5 demo/DoD and NFR-LR-01/02.

## Boundaries

- Verification uses public application routes/contracts and synthetic test seams; it never bypasses authorization by importing private repositories/adapters to force outcomes.
- Fixtures, reports, screenshots, traces, and logs contain invented data only and no credential or production-derived personal data.
- Supabase/RLS/persistence/jobs/providers/Vercel/Safari rows remain `OUTSTANDING` until executed against their real targets/environments.
- Commands may install, test, build, start, and call localhost only; no executable deployment workflow or deployment action is added.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback after two pinned-model dispatch failures)

**Verdict:** READY

The approved Plan Approval answer is explicit, and all ten plan steps are marked complete. The plan covers required test files and test configuration, maps implementation steps to US-LR stories and normative requirements, and keeps verification on synthetic/local boundaries. The code summary reports passing local gates with coverage above the 80% threshold, local-only browser coverage, and linked-target/Safari checks as OUTSTANDING. The summary also states that no deployment workflow or external target call was added or executed, consistent with the security and deployment contracts. No material mismatch between the plan, reported implementation, and consumed requirements was found.

