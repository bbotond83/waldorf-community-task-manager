**Collaborator:** aidlc-quality-agent

## Contribution

### Evidence-backed testing posture

The draft is directionally correct that testing is a first-class delivery gate, but it should distinguish current executable evidence from practices that still need affirmation.

- The verified baseline is strong for the loaded TypeScript domain modules: 52 tests pass with 94.57% line, 87.99% branch, and 88.56% function coverage; strict TypeScript and the high-severity dependency audit also pass.
- The repository currently enforces 80% line, branch, and function thresholds in its Node-native coverage command, while the affirmed team rule names only 80% line coverage. Branch/function thresholds are therefore observed repository gates, not yet an affirmed team-wide practice.
- Coverage is incomplete as a system signal because it measures modules loaded by tests rather than all production source. In particular, `supabase-route-adapter.ts` is not exercised. The evidence record should explicitly preserve this limitation whenever quoting the percentages.
- The observed test/code pattern is colocated `*.test.ts` files, deterministic in-memory adapters, injected clocks and infrastructure ports, and behavior-focused assertions around domain services and façades. This supports fast, isolated tests, but the evidence does not establish a balanced test pyramid: no browser, component, HTTP-contract, SQL/RLS, production-adapter, composition, build/start, accessibility, or end-to-end tests exist.
- Provisioned integration behavior must remain an outstanding evidence item until run against real targets, in accordance with the project testing rules. The active synthetic browser slice must not be presented as evidence for Supabase, RLS, authentication, or production persistence.

### Corrections recommended for the lead artifacts

In `team-practices.md`, retain the affirmed statement “write tests alongside code; maintain at least 80% line coverage; require green CI before merge.” Present 80% branch/function thresholds as current repository checks pending human affirmation, rather than silently strengthening the team rule. Likewise, describe colocated tests, full-source coverage inclusion, production build/start smoke, browser smoke, invalid-input checks, and automated accessibility checks as proposed practices for the new delivery boundary until the interview confirms which are durable team rules and which are intent-specific acceptance gates.

Replace “basic accessibility checks” with a verifiable definition before it becomes a gate. At minimum, the interview should decide the automated standard/tool class, blocking violation severity, covered critical flow, and whether keyboard/manual checks are release evidence rather than per-PR automation.

The evidence artifact should preserve three distinct confidence claims:

1. Domain-library confidence: executable and currently strong.
2. Runnable local browser confidence: absent until build/start, composition, create/list, validation, and browser checks execute.
3. Production/integration confidence: absent until real infrastructure, SQL/RLS, adapter, authentication, and deployment checks execute.

### CI quality-gate assessment

Current blocking evidence covers `npm ci`, strict typecheck, thresholded Node tests/coverage, `npm audit --audit-level=high`, and tested-SHA recording on pull requests and `main` pushes. There is no evidence of required-status enforcement, lint/format, production build, browser, migration/RLS, accessibility, artifact, deployment, flaky-test quarantine, or performance gates. Green workflow execution is not by itself proof that branch protection makes every check merge-blocking.

For the runnable-web-app intent, the minimum proposed automated gate set should be: dependency install, typecheck, full-source unit/application coverage, production build, deterministic start/health smoke, create/list and invalid-input behavior, one critical browser smoke flow, and an objectively configured accessibility scan. Keep SQL/RLS and deployed-integration gates out of this synthetic slice, but require them before any real-data or production-readiness claim. Performance testing is not currently evidenced; ask for a measurable responsiveness target only if the team wants it to block this narrow intent.

### Interview gaps that quality evidence cannot resolve

- Is the durable coverage rule 80% line only, or 80% line/branch/function; is it a fixed floor or a no-regression rule above the current baseline; and must coverage include every production source file?
- Does “tests alongside code” mean TDD, tests-after within the same change, BDD for acceptance flows, or another cadence? Must every defect receive a reproducing regression test?
- Which checks are actually required merge statuses, and who may override a failing or flaky gate? What is the expected maximum CI feedback time and flaky-test remediation policy?
- Are colocated `*.test.ts`, in-memory fakes, and constructor-injected ports intended durable conventions or merely the present code shape?
- Which runnable-boundary checks block every pull request versus release/nightly execution: production build, start smoke, browser smoke, accessibility, and any performance check?
- What precise accessibility standard and pass/fail threshold applies to the Hungarian critical list/create flow, and what manual keyboard or screen-reader evidence is required?
- Should browser smoke use synthetic data only as a permanent test-data rule, and what reset/isolation behavior is required so tests remain independent and repeatable?
- Does “green CI before merge” include lint/format once tools are selected, and should coverage, test results, and build artifacts be retained or annotated for review?

## Positions

- AGREE: The draft correctly treats current executable test results as authoritative and provisioned integrations as unverified — this matches project guardrails and the CodeKB evidence.
- AGREE: Strict typecheck, tests/coverage, and high-severity dependency audit are current CI checks — the workflow and quality assessment directly support them.
- AGREE: The runnable browser boundary needs build/start, composition, create/list, invalid-input, browser, and accessibility evidence — these are the principal untested boundaries for the active intent.
- OBJECT: “Maintain at least 80% line, branch, and function coverage” is presented as affirmed team policy — only line coverage is currently affirmed; branch/function thresholds are repository evidence pending interview confirmation.
- OBJECT: The draft turns colocated tests, full-source inclusion, browser smoke, and accessibility checks into settled practice — evidence supports proposing them, but team intent and exact pass/fail semantics remain unresolved.
- OBJECT: “Basic accessibility checks” is not testable enough for an Inception quality gate — the standard, scope, severity threshold, and manual evidence need measurable definitions.
- OBJECT: “Green CI before merge” is stronger than the available enforcement evidence — workflow execution is observed, but required-status/override policy cannot be inferred without branch-protection or human confirmation.
