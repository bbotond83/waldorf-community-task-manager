# Practices Discovery Evidence

## Status and Boundaries

Step 5 final integration, 2026-10-06. All three independent contributions and the completed interview were read and integrated. Brownfield rerun for `261006-simplify-user-roles`, Standard depth and test strategy. Observed branch `feature/simplify-user-roles`, HEAD `0dce0567f18dc72e46aa88d87e5626708b08bc7d`. No tests, builds, scans, browser automation, target calls, source edits, memory edits or lifecycle commands were performed. Local-only `next-env.d.ts` remains untouched.

## Upstream Inputs

All six consumes were read from `aidlc/spaces/default/codekb/waldorf-community-task-manager/`:

| Input | Use in discovery |
| --- | --- |
| code-structure.md | One private ESM package; module boundaries, Next.js routes, npm and toolchain configuration. |
| technology-stack.md | Locked Node/Next/React/TypeScript/test-tool context; unlinked integration slots. |
| dependencies.md | Cross-cutting authorization roles, synthetic profiles, SQL and verification dependencies. |
| code-quality-assessment.md | Coverage and browser gates, security scanner limits, private unsigned-evidence discrepancy. |
| architecture.md | Modular monolith, ports and adapters, explicit authorization and result boundaries. |
| business-overview.md | Parent/admin/read-only coordination workflows, scope entities and privacy safeguards. |

These are static partial-deep-coverage records, not fresh execution proof. Their statements that teacher behavior is undecided are current-state scan limitations; the subsequent human clarification below supplies the replacement and read-only intent without changing scanned source facts.

## Affirmed Baseline

Read active-space `memory/org.md`, `memory/team.md`, `memory/project.md`, and `memory/phases/inception.md`. The five-section baseline is retained with the human-selected test-after order and later human-approved private evidence approach. Other project mandates and learned corrections remain additive. The earlier same-change testing statement did not establish ordering; the completed interview now resolves it explicitly.

## Lead Inspection

| Evidence inspected | Observation | Interpretation and limits |
| --- | --- | --- |
| `git log -12` with dates and subjects | Recent feature/fix/docs branches merge by PR to main; merges #5 through #9 appear explicitly. | Supports feature branches and main integration. Recent merge commits are an observation; the affirmed squash policy remains unchanged. No unanswered merge-policy question remains. No exact branch lifetime or deployment cadence established. |
| `.github/workflows/ci.yml` | PRs targeting main and main pushes run validation; read-only contents permissions, pinned action revisions, credential persistence disabled, cancellation concurrency, npm ci and browser install. | Pipeline-as-code and reproducible validation are visible. No repository branch-protection settings inspected; presence of a workflow does not prove enforcement by GitHub. |
| `scripts/verification/run-local-verification.ts` and `package.json` | Ordered toolchain/manifests/format/lint/types/tests/coverage/security/build/smoke/browser and evidence aggregation. Linked targets stay OUTSTANDING. | Canonical `npm run verify:local` command matches README. Ordering of command execution does not establish test-first development methodology. No result is asserted for this intent. |
| `vitest.config.ts`, domain coverage scripts | Line/branch/function thresholds are 80%; production app/src/scripts/proxy/config inventory is configured. | Coverage scope aligns with affirmed target. Static thresholds do not prove current measured coverage. |
| `eslint.config.mjs`, `.prettierrc.json`, `tsconfig.json` | Next core-web-vitals and TypeScript rules; strict TypeScript; Prettier width 100, semicolons, double quotes and trailing commas. | Current format/lint scripts cover app, application/runtime, tests/scripts/config. Older domain modules are outside their explicit command paths; do not imply universal formatting enforcement. |
| `.npmrc`, `.nvmrc`, package engines | Node 24.x/npm 11.x with engine strictness and toolchain prehooks. | Visible supported runtime, not newly added team mandate. |
| Workflow build_evidence job and README CI build evidence | After validation, synthetic rebuild creates Next archive, CycloneDX SBOM, unsigned metadata and SHA256SUMS; uploads private artifact for 14 days. | No GitHub attest call, no cryptographic attestation. Merged commit f140d2f intentionally avoids unsupported personal-private attestation service. The merged implementation follows later human authorization; older memory attestation wording is stale and does not reopen that decision. |
| README deployment limits and verification/runbook.md | Local synthetic runtime makes no linked-target calls; deployment disabled pending target. Safari and real Supabase/provider/Vercel verification outstanding. | Environment topology is an affirmed future staging/production plan, not provisioned environment evidence. Production promotion/rollback cadence cannot be inferred. |

## Intent Context

The original request limits available roles to Parent, Group admin, Kindergarten teacher and Super administrator and asks for a new branch and proper cleanup. Subsequent exact clarification:

> 3. You can replace the "Munkatárs" role with the "Óvónő" role. They only need to see the tasks and the owners, to be abéle to track thr status of the tasks and events.

Carry forward Munkatárs-to-Óvónő replacement with read-only task, owner and task/event status access. Scope across groups, legacy kindergarten-admin disposition and meaning of unnecessary groups belong to requirements analysis. This product request is not a new team methodology or hard practice constraint.

## Independent Review and Interview

Read contributions/aidlc-quality-agent.md, contributions/aidlc-developer-agent.md and contributions/aidlc-devsecops-agent.md. Their independent inspection lists and original positions remain in those durable files.

| Participant | Integrated finding and disposition |
| --- | --- |
| Quality | Explicit Methodology/Ordering after the interview resolves the draft-promotion objection. Coverage floors are aggregate, not per-file; no current measurement is claimed. Installed Chrome timing stays opt-in. Manifest integrity is not executable policy parity and synthetic evidence is not real-target proof. |
| Developer | Retained strict TypeScript, ports/injection, result states and Hungarian copy. Colocated tests describe domain convention; delivery/browser suites live under tests. Lint/format enforcement remains bounded. Boundary mapping is a practice, not universal exception-containment proof. |
| DevSecOps | Resolved both objections: records remain explicitly unsigned, and the already authorized/merged private CI approach is not reopened or expanded into signing work. Retained scanner limits, missing dedicated DAST, no inspected branch protection, and lack of byte-identity proof between the validated build and rebuilt artifact. |

Quality/developer suggestions to interview again about attestation were based on older memory wording; the primary session's later authorization and the security contribution resolve that discrepancy. The merge history observation is retained without changing affirmed squash policy or leaving a pending question.

The completed practices-discovery-questions.md records Guide me and answer A: implement each testable layer, then write and run its tests before moving to the next layer. Final Methodology is test-after, with exactly that order. Existing same-change, regression, coverage, accessibility and full validation requirements remain. No additional practice choice is unresolved. Product questions remain assigned to requirements analysis.

Security limitations retained: custom SAST is four regex patterns without severity classification/data-flow analysis; secret scanning covers selected working-tree files rather than history and does not comprehensively cover underscore-prefixed tokens; no dedicated DAST is established. These limitations do not authorize new tools or weaken affirmed security targets.

## Uncertainty

No fresh test/coverage/security results; no branch-protection settings; no real deployment or rollback execution; no measured release cadence; all required support contributions and the testing-cadence interview are complete. Static regex security scans are bounded controls. Historical test counts are not current evidence. Older memory attestation wording remains a documentary discrepancy against later human authorization; any deterministic memory handling belongs to the authorized workflow. No additional human practice decision is pending.
