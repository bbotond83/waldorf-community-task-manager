# Practices Discovery Evidence

## Sources Inspected

- `aidlc/spaces/default/memory/org.md`: suggested organization defaults for the five practice areas.
- `aidlc/spaces/default/memory/team.md` and `project.md`: no prior affirmed team or project specializations.
- `aidlc/spaces/default/memory/phases/inception.md`: inception requirements, traceability, and security/compliance guardrails.
- `practices-discovery-questions.md`: the completed guided interview and final confirmation.
- The three collaborator contribution files: greenfield evidence assessment and areas that require later decisions.

## Participants

- Human participant: selected A, A, A, B, and A for the five interview questions, then confirmed “Looks correct.”
- `aidlc-pipeline-deploy-agent`: integrated the confirmed interview choices.
- `aidlc-quality-agent`: reviewed testing posture and release-quality gaps.
- `aidlc-developer-agent`: reviewed code-style and executable-quality-gate gaps.
- `aidlc-devsecops-agent`: reviewed security, scanning, and supply-chain gaps.

## Interview Decisions

- Trunk-based development with short-lived branches and squash merges to `main`.
- Scope-dependent walking skeleton.
- Tests alongside code, at least 80% line coverage, and green CI before merge.
- Continuous deployment to production after automated gates pass.
- Repository formatter/linter and idiomatic TypeScript, with no additional conventions yet.

## Unresolved Uncertainty for Later Stages

- Select the formatter, linter, package manager, test runner, coverage reporter, CI provider, exact blocking commands, and coverage enforcement scope.
- Define test layers, authorization/privacy assertions, synthetic test-data handling, staging smoke coverage, and release-quality targets.
- Select security tooling and policy: dependency and secret scanning, SAST/DAST, SBOM/provenance, severity thresholds, waiver ownership, and credential-rotation response.
- Design production environment topology, rollout/rollback controls, observability, and any staging-specific checks. The affirmed continuous-deployment choice does not by itself specify these mechanisms.
- Decide detailed TypeScript conventions, module boundaries, error-handling conventions, and import/export rules after repository and application design are established.

These are unresolved next-stage decisions, not human-affirmed rules or constraints.
