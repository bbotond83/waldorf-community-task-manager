# Profile Login Delay Code Summary

## Correction and Actual Browser Evidence

2026-10-05; base revision `85dab6b5c7762265357146a54e1612479e8c4302`, plus the 12 owned paths in `source-manifest.json`. User-confirmed affected origin `http://127.0.0.1:3000` supersedes the requirements' earlier localhost notation; see `reproduction-questions.md`. Stories and Unit DAG are absent by scope.

Removed only `Clear-Site-Data: "cache"` from the shared successful session 303. Chromium defers redirect completion while clearing finishes. Original Chrome POST: **131508.261 ms**, first-byte wait **10.954 ms**, zero body, receive **131496.017 ms**. Same original tab/server/settings after one-line hot reload: **22.857 ms**, receive **0.820 ms**. No server restart, browser cache reset or fixture mutation. Parent recorded original evidence in `native-chrome-retry.md`, `native-chrome-network-timings.json`, `native-chrome-after.md` and `native-chrome-after-network.json`.

Native submission through root and immediate usable main page in one call yielded conservative upper bounds including automation overhead: parent **2345 ms**, staff **2082 ms**, group admin **2273 ms**, kindergarten admin **2261 ms**, super admin **2292 ms**, parent repeat **2334 ms**. The earlier10896 ms inter-call observation included model delay and is excluded from application timing claims.

Unchanged same-server diagnostic harness: before30/30 target flows max1390.4 ms plus15 setup; after30/30 max336.4 ms plus15 setup. Full evidence: `baseline-timings.json`, `after-timings.json`. These fresh contexts did not reproduce the original browser condition. Their improvement does not explain the original131-second delay. Natural warmed routes and unknown server cache state remain labelled; hot reload is the only intentional server change.

## Implementation and Security

New reusable measurement starts in the actual submit event and ends at exact main pathname, successful page containers/content, correct profile and enabled control. Functional filter/tasks checks follow the stop timestamp separately. Failed samples emit before assertions, retaining renderer elapsed when available, host attempt duration and elapsed lower bound since observed POST. Host diagnostics never substitute for submission acceptance timing. Invalid/negative/nonfinite durations fail.

Added explicit existing-server Chrome config/spec (one worker, zero retries, no server lifecycle/cache reset), extended isolated dev/prod checks and excluded both opt-in suites from ordinary browser/canonical runs. Negative navigation includes the admin layout's existing authorized records/archive core projection. Added signout/back-history/profile-denial regression. Updated the existing coverage assertion requiring the removed header. README documents timing commands and production cache behavior.

Signed HttpOnly/Lax cookie rotation, full-document303 flow, origin/expiry/tamper/role/scope/revocation checks and Hungarian UI remain intact. Real production root and all five main pages return `private, no-cache, no-store, max-age=0, must-revalidate`; dev headers differ. Sanitized evidence: `quality-final/production-headers.json`.

## Verification

Node24.21.0/npm11.19.0; real Chrome154.0.8037.98 for controlled existing-server checks. Final broad checks ran in owned `/private/tmp/waldorf-quality-final-261005`, with isolated output and ports4100–4102 browser/4210 smoke/4220 headers/3800–3804 timing, preserving active `.next/dev` and port3000.

| Check | Current result |
|---|---|
| Exact scoped Vitest incl. coverage entrypoint assertion |56 tests/4 files pass|
| Dedicated existing-server Chrome |5 cases;30 targets+15 setup pass;max345.4 ms|
| Explicit isolated dev/prod |10 cases;20 targets+10 setup pass;max933.1 ms|
| Full native domain/delivery tests |128 native domain;291 delivery pass|
| Coverage |419 tests/44 files pass;lines94.19%,branches80.11%,functions92.30%|
| Formatter/linter/strict types |Pass|
| Dependency/privacy/secret/SAST/no-deploy |Pass;0 vulnerabilities|
| Production build/deterministic smoke |Pass|
| Chromium/Firefox/mobile Chrome |99 pass including history/signout|
| Serious/critical automated accessibility |15 pass|
| Canonical `npm run verify:local` |Pass;33 evidence pass,0 fail,6 outstanding|

Exact scoped commands are in `unit-test-instructions.md`; broad baseline/final commands in plan; raw final logs in `quality-final/`; explicit executed timing JSONs in `existing-server-regression.json` and `isolated-login-regression.json`. Baseline delivery285/coverage413/browser96 increased to291/419/99; all80% floors retained.

Initial final full tests failed only the obsolete header expectation; canonical reran tests/coverage green after repair. Dedicated initial sandbox launch failed SIGABRT; later new-harness checks exposed filter query/heading and existing admin core projection mismatches. Preserved those attempts separately; corrected harness and reran current final sources green. No samples were silently averaged or removed.

## Traceability and Limits

`traceability.json` maps every FR1.1–FR5.2 and NFR1–NFR3. FR1.3 was honored by pausing for origin/tab recovery and the user's next action before actual reproduction. Original before defect was captured for parent; the shared endpoint mechanism and same-context after checks demonstrate effect across all five without claiming five original defective baselines.

Real Supabase/auth/RLS, scheduler/email, Vercel and Safari prerequisites remain outstanding, unchanged from baseline. No deployment/live integration is claimed. No data-model/repository/runtime-configuration correction was needed. Relaxed-fence plan updates recorded causal evidence and the existing coverage/history regression; parent owns review and completion.

Rollback restores only the owned response-header line and corresponding owned tests/files. Preserve others' CodeKB/audit/generated edits; do not reset the checkout.
