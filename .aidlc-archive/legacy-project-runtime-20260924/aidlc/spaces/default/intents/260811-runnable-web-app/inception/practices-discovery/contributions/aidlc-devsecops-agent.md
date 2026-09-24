**Collaborator:** aidlc-devsecops-agent

## Contribution

The lead draft is accurate that repository-enforced security is currently limited to strict type checking, thresholded tests, and `npm audit --audit-level=high`. The locked npm dependency graph, `npm ci`, minimal dependency surface, and tested-git-SHA recording are useful foundations, but they do not constitute a complete DevSecOps or software-supply-chain posture.

### Lint and format

- No formatter or linter is configured, so the stated practice to use repository tooling is not yet executable. The compressed one-line declarations reported by CodeKB are direct evidence that this gap affects reviewability as well as style.
- The interview should select the TypeScript formatter and linter, decide whether both checks block pull requests, and define whether security-focused lint rules are part of the initial ruleset. Prettier plus ESLint is a reasonable proposal, not a discovered fact.
- Until the tools and scripts exist, `team-practices.md` should continue to describe lint and format as a practice to establish rather than as a gate that already runs.

### SAST and DAST

- No SAST control is evidenced. Before production promotion is automated, the team should choose a pull-request SAST control appropriate to TypeScript, such as Semgrep or security-focused ESLint rules, with explicit severity thresholds and a time-boxed, justified waiver process.
- No runnable application, staging target, or deployment pipeline exists, so DAST cannot currently be an executable gate. The intended practice should state when DAST becomes mandatory: after a deployable browser application and isolated test environment exist, and before promotion to production. The interview should also decide whether a lightweight OWASP ZAP baseline is sufficient initially or whether authenticated scanning is required once authentication enters scope.
- The current synthetic local slice should still receive negative input-validation and browser security behavior tests, but those are not a substitute for DAST against a deployed application.

### Secrets and dependency security

- No repository or history secret scan is evidenced. Add an interview decision for a CI secret-scanning gate, whether developers also use a pre-commit hook, and the response rule for a detected credential: revoke and rotate first, then remediate repository history as appropriate.
- The existing high-severity npm audit gate also blocks critical findings because `high` is the minimum threshold. This aligns with the project rule requiring high and critical dependency vulnerabilities to block CI. The interview should confirm whether exploitable high/critical findings are an unconditional merge block, how time-boxed exceptions are approved, and how quickly critical findings must be remediated.
- The evidence does not establish an automated dependency-update cadence, continuous vulnerability monitoring, or ownership for vulnerability triage. These remain human decisions; they should not be inferred from the presence of `npm audit`.

### Supply-chain controls

- The lockfile, clean install, private package setting, minimal dependencies, and tested-SHA provenance are positive controls.
- GitHub Actions are referenced by mutable major tags (`actions/checkout@v4`, `actions/setup-node@v4`), and there is no evidence of full-commit action pinning, an SBOM, artifact signing/attestation, or build provenance beyond the source SHA. The interview should decide whether third-party actions must be pinned to immutable commit SHAs and how updates are reviewed.
- Because no application artifact exists, artifact signing and deployment attestation are future gates rather than current repository facts. Once a deployable bundle exists, the pipeline should generate an SBOM, bind the artifact to the tested commit and dependency lock, scan it before promotion, and retain provenance. The current tested SHA should remain the only provenance claim until then.
- CI least-privilege settings, workflow token permissions, protected-environment rules, branch protection, required review, and waiver authority are not established by the supplied evidence. They require repository/platform inspection or explicit interview confirmation.

### Security-sensitive deployment contradiction

The continuous-production statement cannot be safely affirmed without resolving its conflict with the organization default of manual production approval and the project rule that requires manual production approval for the two-environment MVP. From a security-gate perspective, production automation must remain aspirational until a deployable target exists and lint/format, SAST, secret scanning, dependency scanning, build/browser checks, and environment-appropriate DAST have defined blocking behavior. The human should explicitly choose whether continuous production means automatic deployment after a still-required protected-environment approval, or whether the narrower manual-approval rule is being retained.

### Interview gaps to carry forward

1. Which formatter, linter, and security lint/SAST tool will be adopted, and which severities block merge?
2. Is secret scanning required in CI, pre-commit, or both, and who owns rotation and incident handling?
3. What are the dependency vulnerability remediation SLA, exception approver, exception expiry, and automated update cadence?
4. Must GitHub Actions and other build inputs be pinned immutably, and when do SBOM generation and artifact attestation become mandatory?
5. At what delivery milestone does DAST become a promotion gate, and what scan depth is required?
6. Who owns security findings, waiver review, branch/environment protection, and production promotion approval?
7. How should the continuous-production team aim be reconciled with the existing manual-production-approval project rule?

## Positions

- AGREE: The draft correctly distinguishes existing typecheck, coverage, and high-severity dependency-audit gates from missing lint, format, SAST, secret, DAST, and supply-chain controls — this matches all supplied CodeKB evidence.
- AGREE: Deployment configuration must remain non-executable until a deployable application and linked target exist — current evidence cannot support runtime scanning, promotion, or rollback claims.
- AGREE: The formatter and linter choice belongs in the interview — repository evidence shows the need but not a team-approved tool or ruleset.
- OBJECT: The deployment section is not yet internally actionable because continuous production conflicts with the organization and project manual-approval rules — the human must resolve the promotion semantics before affirmation.
- OBJECT: The interview topics are incomplete for DevSecOps — they must explicitly cover SAST, secret scanning, DAST activation, immutable build inputs, SBOM/provenance, vulnerability waivers, remediation ownership, and security-gate thresholds.
