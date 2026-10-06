# Code Quality Assessment

## Test Coverage

Source-configured tools: native Node tests for domain modules; Vitest/jsdom/Testing Library for delivery/components; Playwright Chromium/Firefox/mobile Chrome; axe for accessibility. Tests reside in colocated `src/**/*.test.ts` and `tests/{unit,integration,coverage,browser}/`. Node and Vitest configurations enforce 80% line/branch/function floors; aggregate production inventory includes app/src/scripts/proxy/Next config.

**No tests, build or current coverage measurement were run in Reverse Engineering.** Historical counts and percentages are not current evidence.

## Login Regression and Measurement Limits

`test:login-performance` defines ten Chromium cases: five profiles in development and production, each measuring first login and switching with zero retries and a 5000 ms assertion. Timing starts at form submit and ends at the correct greeting plus usable navigation. Readiness and initial `/` are loaded before timing. Development uses a unique empty output directory; production uses a prebuilt bundle/fresh server. This excludes full cold server startup/initial root compilation and later navigation to a profile's business landing page.

Route integration tests directly invoke handlers for all five profiles, cookie rotation/sign-out/redirect and denial. Component tests render selector/shell without a server. Browser foundation covers parent selection and parent-to-staff switching; business browser suites reset fixtures and measure subsequent navigation after login. These are useful behavioral surfaces, not reproduction of the reported actual-server delay.

The prior login intent reports sub-second isolated first/switch samples but explicitly no reproduced delay or production login correction. Canonical `verify:local` and standard browser configuration exclude the timing suite. Acceptance must explicitly execute the timing check and capture the affected existing environment, with server/browser segment timing and all five profiles preserved.

## Linting, Formatting and CI/CD

ESLint flat Next web-vitals/TypeScript config is blocking at zero warnings; Prettier is also blocking. Current lint/format commands use selective paths and omit portions of older domain/synthetic modules. GitHub Actions runs pinned checkout/setup-node, locked install/browser install and `verify:local` on PR/main. Main pushes additionally rebuild, generate SBOM and attest provenance. No executable deployment workflow or linked target was found.

Local verification includes toolchain/manifests/format/lint/typecheck/test/coverage/security/build/smoke/standard browser/evidence. Security checks combine regex secret/SAST scanning with npm high/critical audit; configured checks do not prove runtime security. Team policy requires green checks, 80% coverage, no serious/critical accessibility violations and blocking high/critical dependency/SAST findings.

## Documentation Quality

README records supported startup/environment precedence, loopback use, watcher polling workaround, checks and outstanding targets. Explicit port and result contracts support maintainability. Hungarian user guide/source references exist but were only inventoried; prior intent evidence is historical.

## Technical Debt and Follow-up

| Finding | Evidence / implication |
|---|---|
| Reported delay unmeasured | Reproduce on the actual local server; isolated success does not close this defect |
| Cache clearing hypothesis | Session route sends `Clear-Site-Data: "cache"`; measure browser cache/assets and preserve session isolation before changing it |
| Compilation/environment hypothesis | Runtime composition/application-barrel imports, output contention, watcher/resource behavior and browser redirects need measured attribution |
| Toolchain mismatch | Shell Node 26 versus required Node 24; record the running server's actual version; cause not established |
| Nondurable synthetic state | Module/process stores; unlinked production boundary; no demonstrated real persistence |
| Divergent authorization paths | Static root navigation versus dynamic business admin revocation; preserve protected role/scope behavior |
| Migration/lifecycle debt | Partial synthetic rollback simulation and SQL security-definer/RLS contracts require later real-target validation |

## Outstanding Evidence

Committed local acceptance report references SHA `71a3b5f8d74be036b10571690e439d865fb5d664`, distinct from scan HEAD. Safari/mobile Safari, Supabase auth/RLS/persistence, provider/scheduler and Vercel checks remain outstanding. `.env.local` is synthetic, but effective settings of an already-running server were not checked. No login speed improvement or fix is claimed.
