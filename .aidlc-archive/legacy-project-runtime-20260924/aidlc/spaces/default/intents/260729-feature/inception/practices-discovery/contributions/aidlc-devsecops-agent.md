**Collaborator:** aidlc-devsecops-agent

## Contribution

### Evidence-based assessment

This is a greenfield Next.js/TypeScript MVP. The repository has planning and source-material documents only: no application package, lockfile, CI workflow, deployment manifest, formatter/linter configuration, scanner configuration, or established security practice was found. The proposed use of repository-selected formatter and linter is therefore appropriate as a draft, but it is not yet an enforceable practice. The organisation baseline requires the selected linter to run in CI and block merge failures.

The product handles family and child data, role-bounded contact visibility, administrator actions, transactional email, and a one-time Excel import. These raise concrete implementation risks—object-level authorization failure, malformed or malicious import content, PII leakage through logs or email, and credential exposure—but do not establish team hard constraints without human affirmation.

### Recommended delivery-security baseline for affirmation

- Use a committed package lockfile and deterministic clean installs in CI. Enable automated dependency update PRs (Dependabot or Renovate) and run dependency vulnerability scanning on every pull request/build; block a merge for an unwaived Critical or High finding with a documented, time-bounded exception process.
- Run a TypeScript-capable SAST scan on pull requests (for example Semgrep or CodeQL) and fail protected merges on Critical or High findings. Add security-focused lint rules once ESLint is selected; formatter and ordinary lint checks alone do not constitute SAST.
- Run secret detection both before commit and in CI (for example Gitleaks), scan the repository history before the first production release, and use only Vercel/Supabase/provider-managed secret stores for runtime credentials. A detected secret requires revocation and rotation, not merely deletion from the current file.
- Treat dependency and CI configuration as supply-chain inputs: review third-party GitHub Actions, pin them to immutable revisions where the chosen forge supports it, keep dependencies minimal, and retain a dependency inventory/SBOM for release review. The exact SBOM tool and release artifact provenance mechanism remain to be selected.
- Add authenticated DAST to a staging or ephemeral environment after the application has stable authentication and representative non-production test data. It must exercise authorization boundaries and import endpoints, never production or live family data. DAST is not currently runnable because no deployed application or test identity exists.
- Require security tests alongside feature work for authorization and sensitive data flows: server-side Supabase RLS/object-level checks for every role and resource, import size/type/schema validation with safe parsing, rate limits on authentication/import endpoints, and redacted structured audit logs for privileged workflow actions. These should be made measurable in the later NFR, functional-design, build-and-test, and CI-pipeline stages.

### Interview gaps to resolve

1. Which source-control forge and CI provider will be used, and are protected branches mandatory? This determines the available native secret scanning, CodeQL, dependency alerts, approval rules, and action-pinning policy.
2. Which concrete tools will be adopted for formatter/linter, SAST, secret detection, dependency scanning, and SBOM generation; which severities block merge versus create a tracked finding; and who may approve a time-limited waiver?
3. Should secret scanning be required locally as well as in CI, and who owns immediate credential rotation if a secret is exposed?
4. Will staging have isolated test accounts and synthetic data for authenticated DAST, and what approval/rollback rule blocks production when a security gate fails?
5. Which security events must be auditable, how long are redacted audit logs retained, and who can access them? This must align with the unresolved GDPR legal-basis and retention decisions.

## Positions

- AGREE: The draft defers formatter, linter, and TypeScript conventions to the eventual repository configuration and proposes CI enforcement — there is no existing configuration from which to infer a stronger established practice.
- AGREE: The draft elevates privacy and role-bounded access in testing and deployment readiness — contact visibility, child/family data, and admin workflows make authorization failures high impact.
- OBJECT: “Formatter and linter checks in CI” is insufficient as the complete security posture — it omits SAST, secret detection, dependency scanning, supply-chain controls, and a severity/waiver policy.
- OBJECT: The interview currently has no explicit security-tooling, protected-branch, credential-rotation, or staging-DAST question — these decisions cannot be inferred for this greenfield project and should be resolved before promoting a security practice.
