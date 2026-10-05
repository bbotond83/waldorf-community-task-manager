# Profile Login Delay Requirements

## Intent Analysis

Resolve the reported nearly three-minute login delay in the actual local app, with measured evidence of its cause and correction. Success means every local profile reaches a usable main page within five seconds in Chrome at `http://localhost:3000`. The earlier intent added isolated timing regressions but did not reproduce or correct the reported delay.

This is a brownfield bugfix at Minimal depth and Minimal test strategy. All requirements below are Must priority. Source inspection has identified the shared local session endpoint and root redirect; it has not established a runtime bottleneck or a successful fix.

## Functional Requirements

### FR1: Reproduce and Attribute the Actual-Environment Delay

- **FR1.1** Record the affected Chrome/server baseline at `http://localhost:3000` before changing its configuration: running server mode and toolchain, source revision, relevant output/cache state, and browser state without exposing secrets. [desc] [Q1]
- **FR1.2** Exercise profile selection and immediate main-page navigation in that environment, recording elapsed time and enough browser request/redirect/asset and server request/compilation evidence to identify the delayed segment. Explicitly label observed evidence and hypotheses. [desc] [Q1] [Q2]
- **FR1.3** If the original server or delay cannot be recovered, report what was attempted and the missing reproduction evidence, and obtain the user's next reproduction step. Passing on a fresh isolated server alone does not close the defect. [desc] [Q1]

Acceptance: Given the affected app is available, when login is exercised, then the baseline identifies the actual browser/server and timing segments. Given the reported delay cannot be reproduced, when results are reported, then the defect remains unresolved and the missing evidence is explicit.

### FR2: Correct the Demonstrated Shared Cause

- **FR2.1** Apply a correction to the demonstrated cause in the shared login flow or its necessary local runtime/startup configuration, and tie the change to the measured delayed segment. Cache clearing, compilation, imports and resource conditions are investigation candidates, not predetermined fixes. [desc]
- **FR2.2** Re-run the affected flow after the correction and document comparable before/after conditions, elapsed times and any deliberate environment changes. [desc] [Q1] [Q2]

Acceptance: Given a delayed segment has been demonstrated, when the correction is applied, then the follow-up measurements show its effect under documented comparable conditions. An unsupported explanation or additional tests without causal correction does not satisfy this requirement.

### FR3: Verify Completion for Every Profile

- **FR3.1** Verify all five existing local profiles: parent, staff, and the three administrator variants, using their existing profile identities and authorized main destinations. [desc]
- **FR3.2** Measure from profile selection submission through the existing redirect/session flow and immediate navigation until the main task, schedule or administration page is loaded and usable. A greeting and navigation alone is an intermediate state. Use an immediate controlled navigation action so human thinking time does not enter the measurement. [Q2]
- **FR3.3** Record per-profile first-selection and profile-switch measurements, including the first relevant route use before diagnostic warm-up. Report cold and repeated observations separately and retain actual-environment evidence alongside supporting isolated development/production regression results. [desc] [Q1] [Q2]

Acceptance: Given each profile can be selected in the affected app, when the timed flow runs, then its correct authorized main page is usable within NFR1 and a per-profile result is recorded. A prior profile's greeting/data, a loading/error page, or an unusable main page cannot end the timer successfully.

### FR4: Preserve Login and Role Boundaries

- **FR4.1** Preserve signed session integrity, HttpOnly cookie behavior, expiry/tampering rejection, same-origin protection, sign-out, profile switching and role/scope authorization, including dynamic administrator revocation. [memory:M1]
- **FR4.2** Preserve Hungarian user-facing behavior and each profile's authorized navigation and data boundaries. Any cache-related correction must retain session and profile isolation. [memory:M1] [memory:M2]

Acceptance: Given an invalid/expired session, denied origin or unauthorized role, when a protected flow is attempted, then existing denial behavior remains effective. Given profiles are switched or signed out, then the previous profile's protected state is not exposed through the new session.

### FR5: Protect the Fix With Executed Regression Evidence

- **FR5.1** Add regression coverage for the demonstrated defect and the confirmed completion boundary; preserve relevant existing login/session/role tests. [desc] [memory:M1]
- **FR5.2** Explicitly execute the login timing regression during this bugfix's verification because the standard browser suite and canonical local verification currently exclude it. Record the command, environment, revision and outcomes; historical passing reports are not current evidence. [desc] [memory:M1]

Acceptance: Given the correction and regression are complete, when verification is performed, then the targeted checks have current recorded outcomes and the existing required checks meet NFR3. A configured but unexecuted test is outstanding evidence.

## Non-Functional Requirements

### NFR1: Login Performance

Every recorded successful first-selection and switching acceptance flow for each of the five local profiles must complete in **5000 ms or less**, inclusive, using the FR3.2 boundary in the affected Chrome environment. Record per-flow durations; averages cannot conceal an individual failure. Isolated warmed-server success alone is insufficient. [desc] [Q1] [Q2]

Pass/fail: 5000 ms passes; a duration above 5000 ms, wrong profile, error, unresolved loading or unusable destination fails. Full server launch before profile selection is outside this timer; compilation/request work triggered by selection or subsequent immediate navigation is inside it.

### NFR2: Security and Session Isolation

No correction may weaken the existing origin, signed-cookie, expiry, role/scope, revocation or profile-data protections in FR4. Passing regression assertions and source review must support preservation of these boundaries. Secrets and session tokens must be excluded or redacted from recorded traces. [memory:M1]

### NFR3: Delivery Quality

Retain the affirmed quality requirements: green formatter/linter, strict type checking, tests, production build, deterministic start smoke and critical browser flow; at least 80% line, branch and function coverage across production source; no serious or critical automated accessibility violations in the critical flow; dependency and SAST checks block high/critical findings, with secret scanning retained. Do not lower targets to complete the bugfix. Current executed outcomes govern acceptance. [memory:M1]

## Constraints

- Use the existing Next.js/React/TypeScript application and module/port boundaries. Read the relevant installed Next.js guide before code changes. [memory:M2]
- The project requires Node 24/npm 11. Record the actual affected server's toolchain before any correction; the scan's Node 26 shell mismatch is a fact to investigate, not an established cause. Use the supported toolchain for required verification. [memory:M1]
- Preserve unrelated checkout changes and keep the change bounded to the demonstrated login cause, necessary runtime configuration and regression verification. [scope]
- Record accurate evidence: no actual-environment reproduction, speed improvement, passing current test suite, or real integration verification is claimed by the approved source scan. [desc]
- Existing release prerequisites and protected production approval remain applicable. These requirements do not authorize a new authentication provider or deployment target. [memory:M3]

## Out of Scope

New product features, role redesign, unrelated refactors, new live authentication/persistence/provider integrations, and new deployment targets. Broader system optimization and a browser-platform expansion are not acceptance goals for this reported Chrome defect.

## Assumptions & Open Questions

None.

## Technical Investigation Items

The exact bottleneck, effective running-server toolchain/configuration, and the influence of cache clearing, compilation/import breadth or local resource conditions remain engineering work under FR1. They are not accepted causal assumptions or missing stakeholder decisions. If actual-environment evidence cannot be obtained, use FR1.3 rather than declaring success from isolated checks.

## Sources

- [desc] Initial description: Fix the login delay affecting all profiles. The user observed nearly three minutes when logging into the Szülő profile and reports that all profiles are affected. The previous intent added regression coverage but did not reproduce or resolve the delay. Reproduce the delay in the actual local environment, identify and fix its cause in the shared login flow, and verify login completes within five seconds for every profile.
- [scope] Workflow-selected scope: `bugfix`; Minimal depth and Minimal test strategy in `../../aidlc-state.md`.
- [Q1] `requirements-analysis-questions.md`, Q1: affected environment is Chrome at `http://localhost:3000`.
- [Q2] `requirements-analysis-questions.md`, Q2: completion includes the usable profile main page after selection and navigation. The consolidated summary confirms all five profiles, the 5000 ms target and immediate navigation.
- [memory:M1] `aidlc/spaces/default/memory/team.md`, Testing Posture/Code Style; `project.md`, Testing Posture and Mandated: regression, security, authorization, current evidence and quality requirements. Approved `code-quality-assessment.md` documents existing test boundaries and the opt-in timing command.
- [memory:M2] `AGENTS.md` Next.js instructions; `aidlc/spaces/default/memory/team.md`, Code Style; approved `code-structure.md` and `architecture.md`: existing stack, module boundaries, Hungarian copy and shared login chain.
- [memory:M3] `aidlc/spaces/default/memory/project.md`, Deployment and Mandated: linked-target prerequisites, immutable release/rollback and manual production approval.
