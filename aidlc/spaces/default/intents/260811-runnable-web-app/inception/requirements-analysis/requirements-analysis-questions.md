# Requirements Analysis Questions

## Sources

- [intent] `../../ideation/intent-capture/intent-statement.md`
- [scope] `../../ideation/scope-definition/scope-document.md`
- [business] `../../../codekb/waldorf-community-task-manager/business-overview.md`
- [architecture] `../../../codekb/waldorf-community-task-manager/architecture.md`
- [structure] `../../../codekb/waldorf-community-task-manager/code-structure.md`
- [practices] `../practices-discovery/team-practices.md`
- [prior-requirements] `../../../260729-feature/inception/requirements-analysis/requirements.md`
- [prior-stories] `../../../260729-feature/inception/user-stories/stories.md`
- [prior-design] `../../../260729-feature/inception/application-design/decisions.md`

## Q1. Requirements Authority

Which requirements baseline governs this intent?

- A. Import all approved functional, non-functional, privacy, constraint, assumption, out-of-scope, and open-question content from `260729-feature`, then add only local-runtime delivery requirements
- B. Replace the prior requirements with a task demo
- C. Keep only domain-library requirements
- D. Redesign the product requirements
- E. Not yet decided
- X. Other (please specify)

[Answer]: A. Import all approved functional, non-functional, privacy, constraint, assumption, out-of-scope, and open-question content from `260729-feature`, then add only local-runtime delivery requirements

## Q2. Runnable Commands

What commands must the repository provide?

- A. Documented install plus `dev`, production `build`, deterministic `start`, type-check, test/coverage, lint/format-check, browser-test, and start-smoke commands
- B. Development server only
- C. Production build only
- D. Manual framework commands without package scripts
- E. Not yet decided
- X. Other (please specify)

[Answer]: A. Documented install plus `dev`, production `build`, deterministic `start`, type-check, test/coverage, lint/format-check, browser-test, and start-smoke commands

## Q3. Local Identity and Data

How must the application run without production credentials?

- A. Development-only synthetic profiles and privacy-safe seeded adapters expose parent, staff, group-admin, kindergarten-admin, and super-admin states; production configuration uses Supabase authentication/data boundaries
- B. Require real family data and production credentials
- C. Bypass authorization locally
- D. Use a single hard-coded administrator
- E. Not yet decided
- X. Other (please specify)

[Answer]: A. Development-only synthetic profiles and privacy-safe seeded adapters expose parent, staff, group-admin, kindergarten-admin, and super-admin states; production configuration uses Supabase authentication/data boundaries

## Q4. Surface and Workflow Coverage

What must be testable locally?

- A. Shared role-aware shell; parent responsibility/signup/request states; read-only staff schedule boundary; scoped administrator dashboard, records, task/event, assignment, approvals, import, reminders, archive/settings surfaces; and inherited validation/authorization/failure states
- B. One task creation form only
- C. Navigation without workflows
- D. Static screenshots only
- E. Not yet decided
- X. Other (please specify)

[Answer]: A. Shared role-aware shell; parent responsibility/signup/request states; read-only staff schedule boundary; scoped administrator dashboard, records, task/event, assignment, approvals, import, reminders, archive/settings surfaces; and inherited validation/authorization/failure states

## Q5. Verification Targets

Which local acceptance evidence is mandatory?

- A. Strict type check, tests with at least 80% line/branch/function coverage across production source, production build, deterministic start smoke, critical role-aware browser flows, no serious/critical automated accessibility violations, and high/critical dependency/SAST blocking
- B. Manual visual inspection only
- C. Unit tests without build/start checks
- D. Build success without browser verification
- E. Not yet decided
- X. Other (please specify)

[Answer]: A. Strict type check, tests with at least 80% line/branch/function coverage across production source, production build, deterministic start smoke, critical role-aware browser flows, no serious/critical automated accessibility violations, and high/critical dependency/SAST blocking

## Q6. Environment and Deployment Boundary

What configuration boundary applies?

- A. Provide a documented example environment contract; local synthetic mode is explicit; Vercel/Supabase production compatibility is preserved; executable deployment remains disabled until a deployable app and linked targets exist
- B. Hide required configuration in developer machines
- C. Activate production deployment immediately
- D. Replace Vercel/Supabase
- E. Not yet decided
- X. Other (please specify)

[Answer]: A. Provide a documented example environment contract; local synthetic mode is explicit; Vercel/Supabase production compatibility is preserved; executable deployment remains disabled until a deployable app and linked targets exist

## Q7. Documentation Acceptance

What must local-run documentation prove?

- A. From a fresh checkout, a developer can install, configure synthetic mode, start the app, select test identities, reach role surfaces, run all quality commands, and understand which checks still require real Supabase/Vercel targets
- B. List only the development command
- C. Rely on undocumented team knowledge
- D. Document production deployment only
- E. Not yet decided
- X. Other (please specify)

[Answer]: A. From a fresh checkout, a developer can install, configure synthetic mode, start the app, select test identities, reach role surfaces, run all quality commands, and understand which checks still require real Supabase/Vercel targets

## Q8. Future Deployment Precedence

When a deployable application and linked targets exist, which promotion rule applies?

- A. This local intent performs no deployment; future staging may deploy automatically after gates, while future production promotion requires protected manual approval
- B. This local intent deploys production automatically
- C. Future production deploys automatically after gates
- D. No future deployment policy is needed
- E. Not yet decided
- X. Other (please specify)

[Answer]: A. This local intent performs no deployment; future staging may deploy automatically after gates, while future production promotion requires protected manual approval

## Consolidated Summary Confirmation

- Import all approved `260729-feature` requirements unchanged as the product baseline, except where current approved practices explicitly supersede an inherited delivery-policy sentence.
- Add package/runtime commands for development, production build/start, code quality, browser, and smoke verification.
- Provide explicit synthetic local identities/data while preserving Supabase production boundaries.
- Make the inherited parent, staff, and scoped administrator surfaces/workflows testable.
- Enforce strict type, 80% line/branch/function coverage, build/start, browser, accessibility, dependency, and SAST gates.
- Document environment configuration, Vercel/Supabase compatibility, and the boundary between synthetic and real-target evidence.
- Prove fresh-checkout local setup and operation.
- Perform no staging or production deployment in this local intent; in a future linked workflow, staging may be automatic and production promotion requires protected manual approval.

Does this all look correct before I finalize the requirements artifact?

- A. Looks correct
- B. Request changes
- X. Other (please specify)

[Answer]: A. Looks correct
