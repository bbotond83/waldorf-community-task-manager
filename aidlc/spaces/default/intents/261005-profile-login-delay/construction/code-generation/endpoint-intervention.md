# Endpoint Intervention — 2026-10-05

## Reversible Change

After the passing quality baseline, removed only this successful session-response line in `app/api/synthetic/session/route.ts`:

```diff
-  response.headers.set("Clear-Site-Data", '"cache"');
```

Evidence motivating the paired intervention: original Chrome POST/303 completion 131508 ms, with 10.954 ms first-byte wait and 131496 ms zero-body response receive interval; Chromium's redirect-deferred cache-clearing mechanism identified by parent. This is a controlled causal candidate; original-context after evidence is still required before retaining/claiming the correction.

Installed Next guides read before editing: cookies, caching-without-cache-components and redirect. Existing signed-cookie rotation, HttpOnly/Lax options, profile schema, mode/origin checks, 303 root destination and protected dynamic pages remain in the source. Production private/no-store headers were verified in the pre-change baseline.

## Immediate Test-After Result

Updated existing `tests/integration/synthetic-route.test.ts` after the endpoint edit: every profile's initial/rotated selection rejects a cache-clearing header; sign-out, denied origin and unknown profile also assert absent clearing headers. Unknown profile retains no-cookie behavior. Existing malformed input, token, session and UI assertions remain.

Executed in the active repository with Node 24:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH /opt/homebrew/opt/node@24/bin/npm exec -- vitest run --config vitest.config.ts tests/unit/runtime-boundaries.test.ts tests/integration/synthetic-route.test.ts tests/integration/runtime-shell.test.tsx
```

PASS: **38 tests / 3 files**; runtime boundary 23, session route 11, runtime shell 4. Vitest duration 8.32 seconds, started 13:56:56 local. No test used an active-server browser request.

## Paired Evidence Pending

No heavy command, server restart, fixture/cache reset or browser run is active. Parent owns the original Chrome paired retry under retained browser settings. Implementation pauses here pending its outcome. Full quality, actual-server after matrix, broader regressions and privacy/history verification have not yet been executed against the correction.
