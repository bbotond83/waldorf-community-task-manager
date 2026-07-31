# Practices Discovery Questions

Mode: guided interview. The organization defaults appear as suggested answers because this is a greenfield project; select or replace each one before affirmation.

## Q1 — Way of Working

Which working and merge practice should the team affirm for this project?

- A. Trunk-based; short-lived feature branches; squash-merge to `main` within 1–2 days. *(Suggested)*
- B. GitHub Flow; pull-request review to `main`, with a different branch lifetime.
- C. GitFlow; use `develop`, release, and hotfix branches.
- D. Direct commits to `main` after CI passes.
- E. Establish a project-specific workflow.
- X. Other: describe it.

[Answer]: A — Trunk-based; short-lived feature branches; squash-merge to `main` within 1–2 days.

## Q2 — Walking Skeleton

How should the team handle the first Construction Bolt?

- A. Scope-dependent: run a gated skeleton only when the scope enables it. *(Suggested)*
- B. Always run a gated walking skeleton for every greenfield feature.
- C. Never run a separate walking-skeleton ceremony.
- D. Run it for this MVP only, proving deployment and role-bounded access.
- E. Decide after delivery planning.
- X. Other: describe it.

[Answer]: A — Scope-dependent: run a gated skeleton only when the scope enables it.

## Q3 — Testing Posture

What test and quality-gate practice should apply?

- A. Tests alongside code, ≥80% line coverage, and green CI before merge; prioritize role/privacy and critical workflows. *(Suggested)*
- B. TDD with ≥80% line coverage and green CI before merge.
- C. BDD scenarios for business workflows plus unit tests; set coverage later.
- D. Green existing suite only; no coverage threshold for this MVP.
- E. Define a stricter project-specific policy.
- X. Other: describe it.

[Answer]: A — Tests alongside code, ≥80% line coverage, and green CI before merge; prioritize role/privacy and critical workflows.

## Q4 — Deployment

Which deployment and production-release practice should the team affirm?

- A. Auto-deploy merged `main` to staging; manually approve production after staging smoke tests. *(Suggested)*
- B. Continuous deployment to production after all automated gates pass.
- C. Manual staging and production deployments.
- D. Staging auto-deploy; production manual approval plus a documented rollback drill before launch.
- E. Defer the choice until the deployment-pipeline stage.
- X. Other: describe it.

[Answer]: B — Continuous deployment to production after all automated gates pass.

## Q5 — Code Style

Which coding-convention practice should the team affirm?

- A. Use repository formatter/linter and idiomatic TypeScript; add no extra conventions yet. *(Suggested)*
- B. Formatter/linter plus named exports only.
- C. Formatter/linter plus a Result-style error-handling convention.
- D. Establish a detailed project style guide now.
- E. Defer all code-style decisions to the code-generation stage.
- X. Other: describe it.

[Answer]: A — Use repository formatter/linter and idiomatic TypeScript; add no extra conventions yet.

## Interview Notes

Record any hard constraints stated by the team in `discovered-rules.md` using `ALWAYS` or `NEVER` form. Do not infer a hard constraint from a selected default.

## Consolidated Summary Confirmation

Confirmed practices: trunk-based short-lived branches with squash merges; a scope-dependent walking skeleton; tests alongside code with at least 80% line coverage and green CI; continuous deployment to production after automated gates; and repository tooling with idiomatic TypeScript.

Does this all look correct before I generate the final artifacts?

- Looks correct — Generate the artifact from these answers.
- Request changes — Revise one or more answers before generation.

[Answer]: Looks correct
