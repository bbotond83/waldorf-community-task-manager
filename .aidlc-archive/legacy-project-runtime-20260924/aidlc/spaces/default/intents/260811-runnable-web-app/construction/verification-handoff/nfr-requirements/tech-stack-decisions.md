# Verification Handoff Technology Decisions

## Sources

Implements approved [requirements](../../../../inception/requirements-analysis/requirements.md) and extends the brownfield [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md). Functional design is intentionally absent because this packaging unit owns verification tooling, manifests, documentation, and evidence rather than application business rules.

## Selections

Use npm scripts on enforced Node 24.x/npm 11.x; strict TypeScript; ESLint and Prettier; Node-native unit/domain tests plus application integration tests; coverage reporting with 80% line, branch, and function thresholds across production source; Playwright for Chromium, Firefox, and mobile-Chrome emulation; axe integration for critical accessibility flows; production Next.js build/start plus deterministic localhost HTTP smoke; and repository-native Markdown/JSON manifests and reports.

## Commands and Artifacts

Provide focused and aggregate commands for typecheck, lint, format check, tests, coverage, browser tests, security scans, build, start smoke, and full local verification. Version `.env.example`, runtime-version metadata, privacy-safe fixture/profile/scenario manifests, authorization matrix and sensitive-field dictionary, fresh-checkout runbook, evidence report, and outstanding-target report. Commands fail non-zero on a mandatory local gate.

## Constraints

Tests run without paid services, production credentials, or real personal data. Browser and evidence tooling consumes public application routes/contracts rather than domain internals. Safari and linked Supabase/provider/Vercel checks are recorded as outstanding until actually executed. No executable deployment workflow is added or invoked.
