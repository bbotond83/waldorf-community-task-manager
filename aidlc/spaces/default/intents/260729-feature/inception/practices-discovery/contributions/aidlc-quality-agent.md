**Collaborator:** aidlc-quality-agent

## Contribution

This is a greenfield feature-scope project. There is no application source, test configuration, coverage reporter, formatter/linter configuration, or CI workflow to establish existing test or code patterns. The proposed baseline—tests alongside code, at least 80% line coverage, and a green CI gate before merge—matches the organization default and is a reasonable minimum, but it is not sufficient by itself to demonstrate that this privacy-sensitive MVP is safe to release.

The affirmed testing posture should preserve the proposed coverage and CI requirements and explicitly prioritize requirement-based tests at the high-risk boundaries:

- Authorization and privacy: prove each role can access only its permitted records and fields. Include negative database/API-level tests for parent contact details, child/family data, assignment identity visibility, and out-of-scope admin actions; frontend hiding alone is explicitly insufficient.
- Critical workflows: signup, swap, cancellation approval, reminder creation and email-delivery failure handling, and Excel-import preview/validation need success, rejection, duplicate/capacity, and malformed-input boundary coverage. Required audit events should be asserted where the PRD requires them.
- Integration boundaries: test Next.js-to-Supabase authorization/data interactions and email/import adapters using isolated, synthetic test data. Do not use identifiable child or family data in fixtures, seeded environments, screenshots, or logs.
- Release evidence: staging smoke tests should cover sign-in, a role-bounded access denial, one critical assignment journey, Hungarian validation/copy on that journey, and the invariant that in-app notification persists when email delivery fails.

For the Standard test strategy, the team should select its working cadence (tests-after, TDD, or BDD), the TypeScript test runner and coverage reporter, and a unit-plus-integration pyramid. It should decide whether the 80% threshold is line-only or also has a meaningful branch/critical-path expectation. Coverage must not be treated as proof of privacy controls: named positive and negative authorization assertions are required. The eventual CI pipeline should make lint/format, unit and integration tests, and coverage merge-blocking; accessibility, security, end-to-end, and performance checks need measurable targets and cadence in later NFR, test, CI, and release work.

Interview gaps to resolve before affirmation:

- Which test runner, coverage reporter, and Supabase test-environment approach will be used, and will database migrations/RLS policies be exercised in integration tests?
- Is the team committing to TDD, BDD/Given-When-Then, or tests-after, and which PRD journeys are P0 release gates?
- Does the 80% line floor apply repository-wide, to changed code, or both; what branch/authorization assertion floor prevents superficial coverage?
- Which checks block a merge and which run on staging/release (accessibility scan, dependency/security scanning, E2E smoke, and performance against the stated under-two-second targets)?
- Who owns failure triage, flaky-test handling, test data cleanup, and production-release smoke evidence for a solo part-time delivery model?

## Positions

- AGREE: Tests alongside code, a minimum 80% line-coverage floor, and green CI before merge are an appropriate feature-scope baseline for this greenfield MVP.
- AGREE: The draft correctly calls out role/contact visibility, assignment workflows, reminders, and Excel import as areas needing targeted test attention.
- OBJECT: The proposed testing posture does not yet state a test-layer strategy, tooling, or test-data rule; add unit and integration coverage expectations and require synthetic, non-identifying family/child fixtures.
- OBJECT: The coverage target alone is not an adequate release signal for privacy controls; require explicit positive and negative authorization assertions and staging smoke evidence before production approval.
