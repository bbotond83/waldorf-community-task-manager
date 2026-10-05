# Quality Baseline — 2026-10-05

## Isolation and Provenance

Before application correction, current source/configuration/tests/dependencies were copied to `/private/tmp/waldorf-quality-baseline-261005`. Generated output, environment files and existing verification runtime were excluded. The snapshot's read-only Git pointer supplied HEAD `85dab6b5c7762265357146a54e1612479e8c4302`; the copied working source is the baseline, not a clean-commit claim. Node **24.21.0**, npm **11.19.0**; explicit synthetic fixture `waldorf-local-v1`.

All builds/generated types/.next/.verification and coverage output stayed in that snapshot. Browser servers used ports 4100–4102, smoke 4210, production-header inspection 4220. The active server's `.next/dev`, port 3000, process, fixtures and browser were untouched. Only owned verification processes were started/stopped. No application source or tests changed in the repository.

## Executed Outcomes

| Command | Result |
|---|---|
| `npm run check:toolchain` | PASS |
| Exact scoped Vitest files from test instructions | PASS: 38 tests in 3 files |
| `npm run format:check` | PASS |
| `npm run lint` | PASS, zero warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS: native domain 128; delivery 285 in 24 files; no failures/skips |
| `npm run test:coverage` | PASS: domain and delivery floors retained; combined Vitest coverage invocation 413 tests in 44 files |
| `npm run verify:security` | PASS: privacy/secret/SAST/no-deploy scans; npm audit 0 vulnerabilities |
| `npm run build` | PASS |
| `npm run smoke:start` | PASS |
| `npm run test:browser` | PASS: 96 across Chromium/Firefox/mobile Chrome |
| `npm run test:a11y` | PASS: 15 tagged flows, including serious/critical axe gates |
| `npm run verify:local` | PASS: evidence 33 PASS, 0 FAIL, 6 OUTSTANDING linked targets |

Production coverage: **94.19% lines**, **80.11% branches**, **92.30% functions**; existing 80% floors unchanged. Full commands, timestamps, exits and logs are retained in `quality-baseline/results.json`, `quality-baseline/repaired-results.json` and corresponding logs. Scoped command: `npm exec -- vitest run --config vitest.config.ts tests/unit/runtime-boundaries.test.ts tests/integration/synthetic-route.test.ts tests/integration/runtime-shell.test.tsx`.

Initial scoped/type/test/coverage attempts failed due to the diagnostic snapshot copy excluding directories named `coverage`, accidentally omitting `tests/coverage/support/production-coverage-reporter.ts`. This was a harness preparation error, not a source regression. The original coverage test/support directory was copied unchanged into the snapshot; those four checks were rerun and passed, followed by a passing canonical verification. Both initial and repaired logs are retained. An initial production-header inspection also exited before cleanup awaited an already-closed child; corrected diagnostic cleanup and a sequential rerun succeeded. No application change was used to make these checks pass.

## Real Production Cache Headers

Owned production server port 4220 was exercised after verification/build settled. Only whitelisted nonsensitive response headers were recorded in `quality-baseline/production-headers.json`; cookies/tokens stayed transient in memory.

Anonymous root and authenticated root plus authorized parent `/szulo/feladatok`, staff `/munkatars/beosztas` and all three administrator `/admin` responses returned 200 with:

```text
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

Existing selection endpoint returned 303 with the root location and `Clear-Site-Data: "cache"`; it currently supplies no explicit Cache-Control header. No header or authentication protection was altered during this baseline. Browser/security baseline verifies current boundaries; this alone does not establish privacy after the proposed intervention, which needs follow-up checks.

## Limits and Next Work

Step 2 is complete; causal intervention and original-context paired evidence remain outstanding. The opt-in login timing suite was not executed as part of these standard quality checks and must still run explicitly under Step 5/6. Baseline browser passes do not reproduce or close the original Chrome delay. Linked-target checks remain outstanding. Parent supplies the refreshed tool-produced brief before any application correction.
