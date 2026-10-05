# Profile Login Performance Requirements

## Intent Analysis

Make selecting and switching a synthetic profile complete within five seconds, so the local application is usable without a prolonged login wait. This is a focused brownfield bugfix. The user confirmed all five profiles, the existing home greeting as the ready state, and both local development and built production start.

The approved code analysis observes a native profile form, a local signed session, a redirect to the dynamic home page, and a browser cache-clearing response header. Cache clearing and first-use compilation remain hypotheses; neither is an established cause. Measure the existing behavior before choosing the smallest supported fix.

## Sources

- [desc] Initial description: fix the slow login issue. Login to a profile shouldn't take longer than 5 seconds.
- [scope] Workflow-selected scope: bugfix; Minimal depth and Minimal test strategy.
- [Q1] `requirements-analysis-questions.md`, Q1: all five synthetic profiles and profile switching through the selector.
- [Q2] `requirements-analysis-questions.md`, Q2: the home greeting and correct role navigation visible and usable.
- [Q3] `requirements-analysis-questions.md`, Q3: development and built production, first and repeated submissions after readiness.
- [confirmation] `requirements-analysis-questions.md`, Consolidated Summary Confirmation: Looks correct.
- [RE] `aidlc/spaces/default/codekb/waldorf-community-task-manager/business-overview.md`: profile login business boundary.
- [RE] `aidlc/spaces/default/codekb/waldorf-community-task-manager/architecture.md`: observed selector/session/home interaction and isolation requirements.
- [RE] `aidlc/spaces/default/codekb/waldorf-community-task-manager/code-structure.md`: delivery/runtime/component change boundaries.
- [RE-detail] `../reverse-engineering/developer-scan.md`: functional security checks and missing selector timing assertions; static evidence only.
- [memory] `aidlc/spaces/default/memory/team.md` and `project.md`: regression coverage, privacy, accessibility, code style, and existing blocking quality checks.

## Functional Requirements

### FR1 — Select and Switch Profiles

**Priority: Must. Sources: [Q1], [Q2], [RE].**

- **FR1.1:** Selecting any of the five existing synthetic profiles shall establish that profile's session and display its home greeting and authorized role navigation.
- **FR1.2:** Selecting another profile shall replace the active session and display only the newly selected profile's greeting and authorized navigation. The prior profile's protected projection shall not remain visible or be served as the new profile's output.
- **FR1.3:** Successful selection shall retain the current home landing destination and existing role-navigation behavior.

Acceptance: Given the ready synthetic selector and each available profile, when the user submits a selection, then its greeting and authorized navigation are usable. Given a signed-in profile, when another profile is selected, then the new profile is active and the prior profile's protected navigation/projection is absent. Existing role access tests must continue to reject access outside the new profile's permissions.

### FR2 — Preserve Session and Failure Boundaries

**Priority: Must. Sources: [RE], [RE-detail], [confirmation], [memory].**

- **FR2.1:** Performance changes shall preserve session-token rotation, signature verification, expiry, authorization-version validation, and HTTP-only/SameSite cookie protections.
- **FR2.2:** Existing origin validation, invalid-profile/body rejection, explicit sign-out, and synthetic controls disabled in production runtime mode shall retain their documented results. Built production start for timing uses synthetic mode; it does not activate synthetic controls in production runtime mode.
- **FR2.3:** Shared caching or navigation changes shall preserve per-request profile authorization and avoid caching one profile's protected output for another profile.

Acceptance: Invalid or disallowed submissions shall not create a valid selected-profile session. Tampered, expired, or invalidated sessions shall not authorize protected output. A performance improvement shall not weaken these outcomes. Existing failure paths retain their explicit statuses and user-visible recovery behavior.

### FR3 — Diagnose and Protect the Performance Outcome

**Priority: Must. Sources: [desc], [Q3], [RE-detail], [memory].**

- **FR3.1:** Record a reproducible before-change click-to-ready baseline in both selected runtime configurations, including first-use and repeat behavior, before selecting the implementation change.
- **FR3.2:** Add an automated browser regression measuring the interval defined in NFR1 and asserting the correct selected profile and its usable navigation. Exercise every profile on first selection and every profile as a switch destination from a different profile.
- **FR3.3:** Record before/after timing results, runtime commands/mode, tool versions, browser, machine characteristics, readiness setup, cache/first-use conditions and any failures. A missing or failing measurement shall remain unresolved evidence rather than a performance pass.

Acceptance: The timing test must fail when an otherwise successful login exceeds 5,000 ms. It must also fail if content is incorrect or navigation is unusable, even when the measured interval is short. Loading feedback, response status alone, or API-only timing does not satisfy the ready-state assertion.

## Non-Functional Requirements

### NFR1 — Login Completes Within Five Seconds

**Priority: Must. Sources: [desc], [Q1], [Q2], [Q3].**

For each required measured submission, elapsed browser time shall be **at most 5,000 ms**, including session creation, redirect/navigation, any first-use route compilation after submission, rendering, and the work needed to make the selected profile's home greeting and correct role navigation usable. Averages or percentiles shall not conceal a failed required submission.

- Start the monotonic browser timer immediately before the action that submits the selected profile. Exclude test-driver scheduling overhead before that action.
- Stop only after asserting the selected-profile greeting is visible and role navigation is usable; include pending navigation and rendering in the interval.
- Apply the same boundary to local `npm run dev` and built `npm run build` followed by `npm run start`, using the supported Node 24/npm 11 toolchain and synthetic runtime configuration.
- Begin after the server is ready and the selector is visible. Server process startup/build and initial selector-page loading are outside this interval. Once submission begins, first-use route work is inside it.
- First-use evidence shall use an isolated server instance and fresh browser context for each profile, with the session route not invoked by test setup. Do not count a login warmed by fixture reset or a previous profile selection as first-use evidence. Record development compilation/cache conditions explicitly.
- Repeat/switch evidence shall use an established different-profile session, then time submission of each target profile. Use deterministic fixtures and sequential local interactions; this requirement specifies single-user local operation, not an unbounded network or hardware guarantee.
- Capture a baseline and a post-change first-use result for each of the five profiles in each runtime, and a repeat/switch result for each destination profile in each runtime. Report all measured results individually; any over-budget result fails the required timing check.

Boundary criterion: 5,000 ms passes; a greater measured elapsed value fails. Functional profile identity, navigation, and isolation checks remain mandatory alongside timing.

### NFR2 — Security and Profile Isolation

**Priority: Must. Sources: [RE], [memory], [confirmation].**

Session and role boundaries in FR2 shall remain enforced throughout login and switching. Cached assets may be reused only without serving another profile's protected content. Verification shall include switching between roles and checking the previous role's privileged navigation/output is absent and unauthorized access remains denied.

### NFR3 — Existing Quality and Accessibility

**Priority: Must. Sources: [memory], [scope].**

The change shall satisfy the existing project checks: strict type checking, ESLint/Prettier, existing tests and targeted regression, production build, deterministic start smoke, critical browser flow, and at least 80% line/branch/function coverage across production source as required by the affirmed practices. The critical browser flow shall have no serious or critical automated accessibility violations. High/critical dependency and SAST findings shall block delivery; preserve existing secret-scanning controls. Current executable results, not historical test counts, are acceptance evidence.

## Constraints

- Preserve the existing application stack, Hungarian user-facing copy, English technical identifiers, typed result states, and module ports/injection boundaries. [memory]
- Read relevant documentation under the installed `node_modules/next/dist/docs/` before writing Next.js code, as required by the project's AGENTS.md.
- Choose a targeted implementation from baseline evidence; a cache header or composition change is not pre-approved as the solution. [RE], [confirmation]
- Deployment and release approvals follow later workflow stages and existing project practices. This requirements approval does not approve production deployment. [memory], [scope]

## Out of Scope

- The separate parent identifier form at `/belepes`. [Q1]
- Redirecting selection directly to role work pages, and timing later manual role-page navigation. [Q2]
- Server startup/build performance before readiness, production authentication integration, database/provider changes, multi-user load targets, and broad dashboard optimization. [Q3], [RE], [scope]

## Assumptions & Open Questions

None.

The cause of the existing delay is an implementation investigation under FR3.1, not an unresolved product choice. First-use measurement feasibility and actual baseline results must be reported during Construction; they cannot silently narrow the confirmed development requirement or exclude compilation after submission.

## Traceability

| Requirement | Source | Planned acceptance evidence |
| --- | --- | --- |
| FR1, FR1.1–FR1.3 | Q1, Q2, approved analysis | Each profile selection, cross-profile switches, home/navigation assertions |
| FR2, FR2.1–FR2.3 | Analysis, confirmed security boundary, memory | Session/origin/expiry/mode and authorization regressions |
| FR3, FR3.1–FR3.3 | Initial request, Q3, memory | Recorded baseline, timing regression, before/after evidence |
| NFR1 | Initial request, Q1–Q3 | Individual first-use and switch measurements in both runtimes |
| NFR2 | Analysis, memory | Cross-role isolation and access-denial checks |
| NFR3 | Affirmed team/project practices | Existing quality, coverage, accessibility and security checks |
