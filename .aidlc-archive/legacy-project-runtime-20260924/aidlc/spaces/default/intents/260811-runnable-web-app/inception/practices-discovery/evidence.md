# Practices Discovery Evidence

## Sources Inspected

- `aidlc/spaces/default/memory/org.md`: organization defaults for trunk-based squash merges, scope-dependent walking skeletons, scope-aware testing, staging deployment with protected production release, and repository-driven code style.
- `aidlc/spaces/default/memory/team.md`: the five currently affirmed team-practice sections used as the rerun baseline.
- `aidlc/spaces/default/memory/project.md`: executable-evidence precedence, high/critical vulnerability blocking, tested-SHA provenance, immutable Vercel promotion and rollback, and the restriction on deployment workflows before a deployable linked target exists.
- `aidlc/spaces/default/memory/phases/inception.md`: testability, contradiction resolution, architecture, security, compliance, and traceability guardrails.
- `aidlc/spaces/default/codekb/waldorf-community-task-manager/{code-structure,technology-stack,dependencies,code-quality-assessment,architecture,business-overview}.md`: reverse-engineering evidence for the modular strict-TypeScript core, ports and in-memory adapters, privacy-sensitive Hungarian product surface, current test results, partial Supabase edge, and missing browser, composition, build, style-tooling, and deployment boundaries.
- `.github/workflows/ci.yml`, `package.json`, `package-lock.json`, `tsconfig.json`, and `README.md`: Node 24/npm CI, strict type checking, thresholded native tests, high-severity dependency audit, source-SHA recording, project scripts and compiler settings, and the gap between product direction and current runtime capability.
- Git history and refs through `d840d4e958ff1aa00447f47ecef585dbec64c22a`: a linear single-author history with no merge commits; this did not independently prove branch lifetime, review, or squash policy.
- Deployment/configuration search: no deployable application bundle, linked target, Vercel configuration, container, infrastructure-as-code, environment, release, or executable deployment configuration was present.

## Participants and Contributions

- `aidlc-pipeline-deploy-agent` inspected the active-space rules, all six reverse-engineering artifacts, repository configuration, CI workflow, git history and refs, and deployment-config absence. It inferred the difference between current executable evidence and aspirational practice and authored the lead drafts and final integration.
- `aidlc-quality-agent` inspected the lead drafts and supplied quality evidence. It verified the 52-test domain-library baseline, 94.57% line/87.99% branch/88.56% function coverage, current 80% thresholds, strict typecheck, and high-severity audit. It identified absent full-source, browser, build/start, accessibility, SQL/RLS, adapter, and deployed-integration evidence.
- `aidlc-developer-agent` inspected naming, module boundaries, error handling, and file organization. It confirmed strict TypeScript, colocated tests, explicit ports, constructor injection, and application result states; it distinguished those from unproven public-barrel, shared-type, universal-result, and delivery-layout conventions, and flagged the synchronous transaction port as a future persistence constraint.
- `aidlc-devsecops-agent` inspected lint/format, SAST/DAST, secrets, dependency security, and supply-chain controls. It confirmed the locked install, high/critical dependency gate, and tested-SHA foundation and identified missing formatter/linter, SAST, secret scan, DAST, immutable action pins, SBOM, attestation, permissions, protection, and waiver evidence.
- The human participant answered A in all five interview areas and thereby affirmed the final branching, skeleton, testing, deployment, style, error-handling, and DevSecOps choices recorded below.

## Interview Decisions

- **Way of Working:** use trunk-based development, short-lived branches, squash merges to `main`, and green automated checks as a merge prerequisite.
- **Walking Skeleton:** retain the scope-dependent stance and use a gated first Bolt for this feature to prove browser, composition, build, and smoke-test boundaries.
- **Testing Posture:** write tests in the same change, require defect regression tests, enforce 80% line/branch/function coverage across all production source, and block on typecheck, tests, production build, start smoke, the critical browser flow, zero serious/critical accessibility violations, and high/critical dependency findings.
- **Deployment:** automatically deploy eligible changes to staging, require protected manual approval for immutable production promotion, and keep deployment workflows disabled until a deployable application and linked target exist.
- **Code Style and DevSecOps:** make Prettier and ESLint blocking; retain English identifiers, Hungarian user copy, module ports/injection, and colocated tests; use explicit results for expected failures and boundary mapping for unexpected infrastructure errors; add CI secret scanning and high/critical-blocking SAST; pin actions immutably; and add SBOM/attestation when an artifact becomes deployable.

## Resolved Objections

- The quality objection that branch/function thresholds, full-source inclusion, build/start, browser, and accessibility checks were only proposals was resolved by the Q3 affirmation. The accessibility threshold is now zero serious or critical violations for the critical browser flow.
- The quality objection that green CI was not proven to be a required merge status was resolved as team intent by Q1; platform enforcement remains implementation work rather than discovered evidence.
- The developer objections to treating all barrels as public APIs or imposing a universal result type remain accepted: neither was promoted. Q5 affirmed explicit result states only for expected application failures and boundary mapping for unexpected infrastructure failures.
- The developer objection to choosing formatter/linter tools without human confirmation was resolved by Q5's explicit selection of Prettier and ESLint. Shared-type ownership, public-barrel compatibility, and delivery-directory layout were not promoted.
- The DevSecOps objection to contradictory production semantics was resolved by Q4: staging is automatic, while immutable production promotion remains protected by manual approval.
- The DevSecOps objections that SAST, secret scanning, immutable action inputs, and future artifact provenance lacked human confirmation were resolved by Q5. DAST, waiver process, remediation ownership, and exact product selection were not inferred.

## Confidence Boundaries

1. **Domain-library confidence:** executable and currently strong for the production modules loaded by the test suite.
2. **Runnable local browser confidence:** absent until the production build, deterministic start, composition, list/create, invalid-input, critical browser-flow, and accessibility checks execute.
3. **Production and integration confidence:** absent until real infrastructure, SQL/RLS, production adapters, authentication, deployment, promotion, smoke, and rollback checks execute against linked targets.

## Remaining Uncertainty

- Git and repository evidence still does not establish branch-protection configuration, required reviewers, exception authority, actual branch duration, or historical squash mechanics.
- The exact formatter/linter configurations, SAST and secret-scanning products, critical browser-flow definition, accessibility scanner and standard, and any manual keyboard or screen-reader release evidence remain implementation choices.
- DAST activation point and depth, vulnerability remediation SLA, waiver approver and expiry, dependency-update cadence, security-finding ownership, CI token permissions, and environment-protection configuration remain undecided.
- Public barrel compatibility, ownership of repeated session/authorization/result shapes, application/delivery directory layout, and the synchronous transaction port's evolution before async persistence remain architectural decisions rather than team practices.
- No executable evidence yet establishes full-source coverage, browser/accessibility behavior, SQL/RLS correctness, production-adapter behavior, SBOM/attestation, artifact signing, or deployed smoke and rollback behavior.
- The application framework, bundler, linked deployment target, environment endpoints, production approvers, smoke thresholds, and rollback thresholds remain future design or provisioning decisions.
