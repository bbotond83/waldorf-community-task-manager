# Local Startup Fix Coverage Retry Questions

## Planning Context

Approved inputs: `../../inception/requirements-analysis/requirements.md` (FR1–FR4, NFR1–NFR3), the focused developer scan and startup CodeKB, and the installed Next 16.3.6 environment-variable guide. This is one stage-level bugfix iteration. All task changes belong on `bugfix/local-startup-fix`.

No additional product questions are needed. The implementation plan and test instructions will be written after this confirmation; application changes and executable checks require the subsequent Plan Approval.

## Previous Startup Outline

Does this implementation outline correctly cover the approved requirements?

- Update `README.md` with Node 24/npm 11 version checks, the retained nvm route, and current-terminal `export PATH="/opt/homebrew/opt/node@24/bin:$PATH"` selection for existing Homebrew tools. Document synthetic `.env.local`, dev and local production build/start without a separate runtime-mode export. Preserve existing local environment files.
- Declare `@next/env` at exact version `16.3.6` in `package.json` and `package-lock.json`, matching Next. Pass development selection from `predev` and production selection from `prebuild`/`prestart` to `scripts/validate-runtime-config.ts`. The standalone validator defaults to production, preserving its smoke caller.
- In the validator, retain an explicitly supplied supported `NODE_ENV`; otherwise use the command's default. Call `loadEnvConfig(process.cwd(), effectiveMode === "development")` before the existing pure schema validation. Next's loader owns inherited-variable precedence, mode-specific file ordering, test-mode exclusion of `.env.local`, and variable expansion. Use its CommonJS-compatible default import. Keep synthetic application mode independent of framework production mode.
- Keep existing code/variable-only validation diagnostics. Provide a redacted loader logger and fail closed on loader errors with a stable generic diagnostic; never print raw parser/filesystem errors, environment contents or dummy secrets. Loading must not construct application integrations.
- Use the existing Vitest configuration without changing its coverage thresholds. After the validator/script changes, add `tests/integration/runtime-config-cli.test.ts` with fresh child processes and temporary environment-file projects. Exercise the actual npm prehooks using copied lifecycle scripts with absolute paths to the real validators. Sanitize child `NODE_ENV`, application variables and Next loader markers so Vitest state and loader caches cannot conceal the defect. Cover all three prehooks, explicit supported modes, each precedence tier, shell overrides including invalid values, missing/invalid values, expansion, test exclusion, and secret-safe loader/configuration failures. Clean temporary fixtures after every scenario.
- Add `tests/unit/toolchain-validation.test.ts` for supported and unsupported Node/npm diagnostics using an isolated mock process boundary; keep the existing runtime-boundary tests. Exact focused command: `npm run test:delivery -- tests/integration/runtime-config-cli.test.ts tests/unit/toolchain-validation.test.ts tests/unit/runtime-boundaries.test.ts`.
- Follow test-after ordering: establish the supported toolchain, existing runner readiness and brownfield baseline after Plan Approval; implement the affected boundary, then write/run its regressions. Preserve the existing 80% line/branch/function gates and record actual baseline/final results. Full production-source coverage is an existing measurement gap to report, not permission to lower thresholds or broaden this fix into a coverage refactor.
- Verify the README procedure in a disposable copy containing the changed application files and only synthetic environment fixtures, with inherited `APP_RUNTIME_MODE` removed. Run local dev and build/start, check synthetic readiness on loopback, and terminate every owned process. Run existing formatting, lint, type checks, suites, coverage, smoke, local security scans and critical browser/accessibility checks where available. Preserve the dependency-audit gate and report it as outstanding if it cannot run within the local-only boundary. Report unavailable or failed checks explicitly.

Options:

- Looks correct
- Request changes

[Answer]: Looks correct

## Consolidated Summary Confirmation

The owner selected `-Retry with fix` after Build and Test found T07 (whole-source coverage) and T14 (dependency audit) Unverified. This new outline supersedes the former restriction on expanding coverage. Preserve the existing startup implementation, bugfix branch and append-only Loop-Back Log. Does this retry outline correctly describe the next plan?

- Inventory all 141 executable candidates: 70 App Router files, 60 non-test src files, nine scripts, proxy.ts and next.config.ts. Distinguish type-only modules with zero runtime counters. Exclude tests, generated output, dependencies and test/lint configuration by purpose, never to conceal production gaps. List CSS separately because V8 has no CSS counters.
- Use installed Vitest/V8 for one expanded denominator with unchanged 80% line, branch and function floors. After fresh Plan Approval, measure first, then add meaningful tests for actual gaps. No claim that thresholds already pass.
- Keep the native domain suite and delivery tests. Plan a coverage-only node:test adapter in a separate Vitest project to reuse domain assertions; validate its compatibility before relying on it.
- Add direct tests for page/session states, actions and authorization, proxy/security headers, CLI diagnostics, smoke cleanup and verification-script success/failure. Mock framework, process and I/O seams to prevent external/production connections. Keep subprocess regressions without claiming they populate parent counters.
- Check the final JSON report against the executable-source inventory. Do not add separate percentages or silently omit unreachable files. Likely changes: vitest.config.ts, grouped tests/coverage/ files, domain adapter and inventory verifier. The detailed plan must name exact paths before approval; preserve the existing six startup paths.
- Preserve all existing checks and synthetic loopback acceptance. Registry auditing remains prohibited pending separate explicit authorization; the retry decision is not an external-scope exception.
- Estimate: 1–3 engineering days, $0 new tooling cost, medium risk. Framework mocks, adapter compatibility and uncovered branch counts are measurement uncertainties. The former Plan Approval is withdrawn; no application/test/config edits or executable checks begin before a fresh approval.

Options:

- Looks correct
- Request changes

[Answer]: Looks correct

## Plan Approval

Approve the coverage-retry plan and its test instructions for this new stage-level attempt?

This approval covers the current code-generation-plan.md, its unchanged Testing Contract, and unit-test-instructions.md. It authorizes the 17 named coverage configuration/support/test paths and their specified local verification, while preserving the existing six startup paths. Registry access still requires the separate explicit scope exception. Work remains on bugfix/local-startup-fix.

[Approval Fingerprint]: sha256:v3:f775141c7651032d0e6fd758e894ba6ee2efce4ab126d424d41af385e71b003a
[Planned Source]: 9871d908ce9cdcc15e109b377e75569d7f59fec79bd54a4c75a40fd10aa9bfd3

Approve Plan
Request Changes

[Answer]: Approve Plan
