# Proposed Coverage Tooling Amendment

## Decision and Authorization

Current Code Generation remains blocked at Step 8. The installed Vitest/V8 provider emits an invalid negative branch counter for a real, passing action test. No provider, dependency, production source, floor or counter has been changed to bypass it. This document proposes a concrete scope amendment; it does not execute it or reset the existing Approve Plan receipt. The conductor owns the user decision and applies the current relaxed approval fence.

## A — Aligned Istanbul Provider (Preferred)

Exact amendment: `package.json`, `package-lock.json`, `vitest.config.ts`.

- Add the development dependency `@vitest/coverage-istanbul` pinned to **4.1.11**, matching the installed Vitest 4.1.11. Availability has not been queried.
- Preserve the installed `@vitest/coverage-v8@4.1.11`; change the configured provider to `istanbul`.
- Preserve the complete production denominator, native/adapted domain obligations, meaningful assertions, map-integrity validation and **80% lines / 80% branches / 80% functions**.
- Validate the installed provider API/source maps against inventory/support cases, compare all 128 domain case names, and rerun scoped/full tests and complete coverage before trusting metrics. Measure remaining gaps; attaining floors is not guaranteed.

Execute **only after explicit package/registry authorization**:

```bash
npm install --save-dev --save-exact @vitest/coverage-istanbul@4.1.11 --ignore-scripts --no-audit --no-fund
```

Resolve this package from the npm registry only. No browser download, production integration, deployment, global change or package script execution is included. If the version is unavailable, resolution requires another concrete decision.

Estimate: 0.5–1 engineering day for provider/adapter validation, plus 1–3 days for measured meaningful gaps. Additional tool fees: $0. Risk: medium; instrumentation changes branch/source-map semantics and must be independently validated. This deliberately expands the retained package/lock scope only if the user authorizes it.

## Separate Registry Audit Exception

The following optional read-only audit is distinct from installing the provider:

```bash
npm audit --audit-level=high
```

Use the npm registry only; do not run automatic fixes or mutate dependencies in response. Record the real exit and findings. High/critical findings block delivery and require their own impact decision. Without this exception, T14 remains Unverified.

The conductor can offer: **package + audit**, **package only**, or **offline hold**. Package-only authorization leaves T14 Unverified. Existing source/plan permissions and approval receipts are preserved.

## B — Offline Custom Instrumentation

Alternative scope amendment: introduce a dedicated custom Vitest coverage provider/support tests and modify measurement configuration using installed TypeScript 5.9 AST instrumentation. No registry/download is needed; adding provider files and changing the instrumentation contract require a concrete user scope/tooling decision.

Estimate: 3–5 engineering days for instrumentation and validation, then measured gap work. Tool fees: $0. Risk: high; correct async/TSX/function/branch instrumentation and source-map equivalence become project-owned verification work. This is not implemented and is less attractive than A.

## Offline Hold

Retain the present failing complete coverage gate and evidence; defer T07 pending a supported tooling solution. No package/config change or network permission is needed. This is immediate, but Code Generation/delivery remains blocked. The historical limited reports do not satisfy the whole-source floor.
