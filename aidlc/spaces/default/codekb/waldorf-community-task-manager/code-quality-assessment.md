# Code Quality Assessment

> Focused update, 2026-10-01: earlier repository-wide prose is preserved as historical static knowledge; its freshness was UNVERIFIED. Only the deep files listed in reverse-engineering-timestamp.md were analyzed for this update. No tests or runtime/external checks were executed.

## Verification Boundary

Static inspection only at commit d7995af0aacf59ff7aa75880c45cc5e0a50eda9e. No tests, builds, installs, audits, application sessions, external calls, database operations, or deployments were run. Existing recorded checks below are historical and retain their original SHA/date.

## Test Organization and Coverage

- 20 colocated src/**/*.test.ts files; tests/unit/ has 2 files, tests/integration/ 6, and tests/browser/ 5 Playwright specs.
- Node node:test uses experimental TypeScript stripping; Vitest/jsdom runs integration/UI tests and V8 coverage; Playwright is configured for Chromium, Firefox, and mobile Chrome; Axe checks accessibility.
- 80% line/branch/function thresholds are declared in the domain Node command and Vitest. Vitest explicit coverage includes only src/runtime/**/*.{ts,tsx}; most domain modules and App Router pages/actions are not explicitly included. Confirm whole-production-source enforcement before relying on the broader README claim.
- The 2026-08-12 committed acceptance report records 33 PASS / 0 FAIL / 6 OUTSTANDING at SHA 69edd12c7aba1c0ae35138bbac67932d86b85e63. It predates this scan and is not a current baseline. Outstanding areas include desktop/mobile Safari, Supabase auth/RLS/persistence, scheduler/provider, and Vercel preview/staging.
- Ignored .verification/evidence points to the same old SHA. Nothing was rerun.

## Static Quality Controls

- tsconfig.json uses strict mode and includes app, all src, tests, scripts, and configuration.
- ESLint and Prettier are blocking in the configured verification chain.
- npm lint/format globs cover app, src/application, src/runtime, tests, and scripts but omit most domain folders such as access, directory, coordination, import-migration, notifications, and privacy-audit.
- Several omitted domain modules compress methods into very long lines, reducing readability and automated style coverage.

## CI and Supply Chain

- .github/workflows/ci.yml runs verify:local on pull requests targeting main and pushes to main, not feature-branch pushes alone.
- CI selects Node 24 and runs verification. Main push validation is followed by a CycloneDX SBOM and build/SBOM attestations. Actions are pinned to immutable SHAs.
- Workflow has no deployment job.
- Verification scripts include privacy, secret, SAST, and no-deploy checks.

## Risks and Technical Debt

1. **Unlinked production integration:** src/runtime/production/composition.ts validates configuration but makes no target call, labels Supabase unlinked, and has no active authorization-version source.
2. **Incomplete persistence:** local UI uses synthetic in-memory profiles/stores. One SQL migration is a partial auth/RLS scaffold, not a complete production domain store.
3. **Toolchain mismatch:** observed shell Node 26.10.0 is outside required Node 24.x. Validators reject the unsupported major.
4. **Dependency drift:** package.json uses latest for selected direct dependencies although the lock currently pins versions.
5. **Quality-scope gaps:** coverage and lint/format globs do not clearly enforce all production source.
6. **Feature-branch CI gap:** pushes alone do not trigger CI until a PR targets main.
7. **Stale documentation:** README AIDLC footer says 2.5.11; active intent description says 2.9.0; current project stamp is 2.10.0. Some inherited project rule wording refers to the earlier domain-library-only state.
8. **Privacy limit:** the source workbook was inventoried by name/size only and not opened; no family or child records were inspected.

## Historical Archive Assessment

The archived CodeKB claim that there were no routes, browser/server entry, Next/React runtime, or dev/build/start commands is contradicted by current source. Its domain modules, synthetic in-memory adapters, and partial Supabase authorization edge are partly supported and extended. Its coverage/security/test metrics and intent boundary claims are historical, not current verification or backlog. Current integration/deployment targets remain unlinked.

## Improvement Opportunities

- Link and exercise production auth, durable persistence/RLS, scheduler/providers, and approved deployment target before production claims.
- Align or narrow coverage and lint/format guarantees to actual source globs.
- Decide whether feature-branch pushes should receive CI before PR creation.
- Reconcile stale README/runtime wording and obsolete conditional rule text in a separate review.
- Run the project verification chain with Node 24 when implementation work is authorized.

## Confirmed Local Startup Defect

`scripts/validate-runtime-config.ts:3` validates inherited `process.env` without loading configuration files. `package.json:13–18` invokes it in predev, prebuild, and prestart before Next initializes. README's env-copy recipe therefore cannot provide runtime mode to these validators without an extra shell export. README's nvm-only runtime selection also misses the reported existing Homebrew option.

## Focused Verification Gap and Risk Controls

Smoke (`scripts/start-smoke.mjs:7–13`) and the skimmed local verification runner (`scripts/verification/run-local-verification.ts:41–48`) explicitly inject synthetic mode. Their success alone would conceal the defect. Later authorized regression checks should use temporary fixture environments with no exported mode, exercise development versus production selection and shell precedence, and assert missing/invalid configuration still fails with secret-safe output. This is a recommendation, not an executed check or Testing Contract.

Existing test filenames and CI presence were inventoried; their bodies and current results were not evaluated. Preserve all prior verification figures as historical. Keep Node/npm constraints, Next precedence, pure schema checks, safe errors, and loopback defaults. No `.env.local` contents were read; no secrets, tests, startup processes, or external targets were accessed by this investigation.
