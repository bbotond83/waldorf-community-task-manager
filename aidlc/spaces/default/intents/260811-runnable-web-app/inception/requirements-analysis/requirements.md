# Requirements

## Intent Analysis

The requester is not asking for a new demonstration or a redesign. The goal is to make the application approved in `260729-feature` runnable and testable locally before Vercel deployment by supplying the missing Next.js application/delivery layer around the existing TypeScript domain modules. [intent] [scope] [Q1]

The brownfield CodeKB confirms that business behavior and modular domain code exist, while the repository lacks a web framework entry point, application routes, UI composition, runtime dependencies, local environment contract, and `dev`/`build`/`start` commands. Its earlier recommendation to build only a synthetic task-list/create slice is superseded by the user's subsequently approved Intent Capture, Scope Definition, and Approval & Handoff gates; CodeKB remains authoritative for implemented-code structure, not for the corrected product boundary. [business] [architecture] [structure] [intent] [scope]

## Normative Inherited Requirements

The complete approved requirements artifact at `../../../260729-feature/inception/requirements-analysis/requirements.md` is incorporated by reference and remains normative without weakening or reinterpretation. This includes: [Q1] [prior-requirements]

- Functional requirements **FR-01 through FR-18**, including every suffixed requirement (**FR-05a**, **FR-12a**) for roles, families, privacy, coordination, records, migration, notifications, lifecycle, archive treatment, and acceptance behavior. [prior-requirements]
- Privacy requirements **NFR-02a through NFR-02h** and non-functional requirements **NFR-01 through NFR-08**, including **NFR-06a**, for security, privacy, locale/data standards, accessibility, quality, performance/reliability, auditability, and executable acceptance. [prior-requirements]
- All prior constraints, assumptions, out-of-scope boundaries, and open questions. [prior-requirements]
- The observable role and workflow acceptance expectations represented by prior stories **US-01 through US-14**. [prior-stories] [Q4]

If a local-runtime requirement below appears to conflict with an inherited product requirement, the inherited product/privacy requirement takes priority and the conflict must be resolved before implementation. [Q1] [Q6]

## Functional Requirements — Local Runtime Delta

### Runtime and application composition

- **FR-LR-01 Runnable package contract:** The repository shall provide documented package commands for dependency installation, development server, production build, deterministic production start, strict type checking, tests and coverage, lint/format verification, critical browser tests, and start smoke. Verification: every documented command executes from a fresh checkout using the supported Node/npm baseline. [Q2] [Q7]
- **FR-LR-02 Next.js entry point:** The repository shall contain a Next.js application entry point and shared application shell compatible with the approved Vercel deployment model. Verification: development and production modes render a successful root/application response and production output starts through the documented command. [scope] [Q2] [Q6] [prior-design]
- **FR-LR-03 Domain composition:** Application routes and actions shall invoke existing domain-module public contracts through explicit application/infrastructure adapters; framework components shall not duplicate business rules or directly mutate another module's owned state. Verification: architecture tests/review map each critical flow to an existing public contract or an explicitly designed contract addition. [architecture] [structure] [practices]

### Local identity and data

- **FR-LR-04 Synthetic local profiles:** In explicit development synthetic mode, the application shall offer privacy-safe parent, read-only staff, assigned-group administrator, kindergarten administrator, and super-administrator profiles with documented permitted scopes. Verification: browser tests select each profile and assert its home route/navigation. [Q3] [Q4]
- **FR-LR-05 Session switching:** Synthetic mode shall provide a development-only profile-switch action that clears the prior local session and re-evaluates route authorization. Production configuration shall not expose the synthetic selector. Verification: a forbidden direct route remains denied before switching and becomes available only after selecting a profile whose inherited role/scope permits it. [Q3] [Q6]
- **FR-LR-06 Privacy-safe fixtures:** Local seeds, fixtures, screenshots, logs, and browser evidence shall contain only synthetic data and shall cover inherited available, empty, full/ineligible, pending, success, validation, authorization denial, dependency failure/retry, and invalidated states. Verification: fixture review and browser tests demonstrate each state without real personal data. [Q3] [Q4] [prior-requirements]

### Role-aware application surfaces

- **FR-LR-07 Shared shell:** The application shall provide Hungarian role-aware navigation, responsive layout, skip link, semantic landmarks, visible focus, and status-announcement regions shared across permitted routes. Verification: parent, staff, and each administrator scope receive only permitted navigation; critical routes pass keyboard and automated accessibility checks. [Q4] [prior-requirements]
- **FR-LR-08 Parent surface:** The application shall make the inherited parent responsibility experience locally testable, including linked-family duties, eligible signup, full/ineligible explanation, swap/cancellation request states, reminder/notification visibility, and privacy boundaries. Verification: critical browser scenarios trace to FR-02, FR-03, FR-05, FR-13, FR-14, and prior US-01 through US-04. [Q4] [prior-stories]
- **FR-LR-09 Staff surface:** The application shall provide a read-only staff schedule surface limited to permitted schedule and coordination display-name fields, with loading, empty, failure/retry, detail, and authorization-denial states and no mutation/contact/sensitive fields. Verification: positive visibility and negative field/action browser/API scenarios trace to FR-03 and US-13. [Q4] [prior-stories]
- **FR-LR-10 Administrator surfaces:** The application shall make inherited scoped administrator dashboard, records, task/event, assignment, approval, import, reminder-monitoring, archive, and permitted settings surfaces reachable and stateful. Assigned-group, kindergarten, and super-administrator scope differences shall follow FR-01/FR-03 and the approved access matrix. Verification: route/action tests cover loading, empty, validation, pending, success, denied, conflict/invalidated, dependency failure, and recovery outcomes. [Q4] [prior-requirements] [prior-stories]
- **FR-LR-10a Inherited executable surfaces:** Synthetic local mode shall implement and exercise the NFR-08 inventory: invitation expiry/resend, authentication entry and upcoming-duty notice, notification-centre read/link, queues and filters, school-year archive, role × resource × field API parity, import preview/commit/recovery, reminder scheduling/status, and lifecycle recovery. Local adapters may simulate email/provider/database effects, but the UI/application/API behavior and state transitions remain mandatory. Verification: named browser/API scenarios map each inventory item to a Pass/Fail record. [Q1] [Q4] [prior-requirements]
- **FR-LR-10b Real-target repeat set:** After targets are linked, the authorization/data assertions for Supabase authentication, RLS/object access, immediate revocation, persistence/transaction behavior, migration commit, scheduled jobs, and provider delivery/idempotency shall be repeated against real integrations. These checks are release evidence, not a prerequisite for synthetic local runnability. [Q3] [Q6] [prior-requirements]

### Configuration and documentation

- **FR-LR-11 Environment contract:** The repository shall provide a versioned example environment file and documentation that distinguishes synthetic local mode from Supabase/Vercel target configuration, identifies required/optional variables, and fails with actionable privacy-safe messages when configuration is invalid. No secret value shall be committed. [Q6] [Q7] [practices]
- **FR-LR-12 Fresh-checkout runbook:** Documentation shall enable a developer to install dependencies, configure synthetic mode, start the application, select test profiles, reach parent/staff/admin surfaces, execute every quality command, and identify checks that remain outstanding until real Supabase/Vercel targets are linked. Verification: an independent fresh-checkout walkthrough completes without undocumented steps. [Q7]
- **FR-LR-13 Deployment activation boundary:** The repository may produce Vercel-compatible build output, but executable deployment workflows shall remain disabled until the application exists, local gates pass, and target projects/integrations are linked. Verification: deployment configuration/plans cannot publish production from an unlinked local state. [Q6] [practices]
- **FR-LR-13a Deployment precedence:** This local-development intent shall not deploy to staging or production. After a deployable application and linked targets exist in a future deployment workflow, eligible changes may deploy automatically to staging after required gates, but production promotion shall require protected manual approval and shall promote an immutable tested deployment. This rule supersedes the inherited continuous-production sentence for this intent. [Q8] [practices]
- **FR-LR-14 Authorization matrix artifact:** Before application acceptance, the team shall version and approve a role × scope × route × action × resource × field matrix and sensitive-field dictionary. Its minimum rules are inherited: super administrator organization-wide including super-admin governance; kindergarten administrator organization-wide excluding super-admin governance; group administrator only granted groups; parent only linked family/own assignment and request actions; read-only staff only scoped schedules and required coordination display names. Email, phone, locality/residence, optional profile fields, protected request reasons, and unrelated-family data follow NFR-02c/NFR-02h restrictions. The matrix shall include immediate-revocation and generic-denial expectations and shall be generated from the prior access-foundation construction contract plus inherited requirements, then approved before route implementation acceptance. [prior-requirements] [prior-stories] [Q4]

## Non-Functional Requirements — Local Runtime Delta

- **NFR-LR-01 Reproducibility:** The supported baseline is Node.js `24.x` and npm `11.x`, enforced by `package.json` engines plus a checked-in runtime-version file. A fresh checkout with the documented synthetic configuration shall install, develop, build, start, and execute local acceptance checks without external paid services or real personal data. CI shall reject unsupported major versions. [Q2] [Q3] [Q7]
- **NFR-LR-02 Quality gates:** Delivery shall pass strict TypeScript, Prettier and ESLint checks, tests with at least 80% line, branch, and function coverage across all production source, production build, deterministic start smoke, critical browser flows, secret scanning, SAST, and dependency scanning; high/critical security findings block delivery. [Q5] [practices]
- **NFR-LR-03 Accessibility:** Critical synthetic parent, staff, and administrator flows shall have no serious or critical automated accessibility violations and shall satisfy inherited WCAG 2.2 AA-aligned keyboard, focus, semantic, status, form-error, zoom, and touch-target expectations. [Q5] [prior-requirements]
- **NFR-LR-04 Performance:** Under the inherited versioned 30-family synthetic profile, locally rendered critical pages and application responses shall meet the inherited 2-second target; interactive mutation feedback shall expose pending state immediately and terminate in an observable success/error state. [prior-requirements] [Q4]
- **NFR-LR-05 Security equivalence:** Synthetic adapters may substitute infrastructure availability but shall not bypass role/scope authorization, sensitive-field filtering, validation, audit-redaction rules, or application error mapping. Local negative tests shall cover every matrix role against at least one permitted and one forbidden route/action/resource/field; unrelated-family and out-of-scope group access; direct API access; contact/optional-profile/reason field absence; immediate revocation on the next request; validation parity; redacted audit/log output; generic infrastructure/error mapping; and absence of secrets/personal data from fixtures, screenshots, responses, and logs. The FR-LR-10b subset repeats row/object authorization, revocation, persistence, transactions, jobs, and provider behavior against Supabase/providers. [Q3] [Q5] [Q6] [practices] [prior-requirements]
- **NFR-LR-06 Maintainability:** New framework/application code shall preserve module ports, dependency injection at infrastructure seams, English technical identifiers, Hungarian user copy, colocated tests, and explicit result states for expected application failures. [architecture] [practices]
- **NFR-LR-07 Browser boundary:** Automated CI shall run the full critical parent, staff, administrator, authorization-denial, and synthetic-profile flows in current Chromium and Firefox desktop, plus mobile-Chrome viewport/touch emulation. Before release, current Safari desktop and mobile Safari on simulator or physical device shall run documented smoke scenarios for local entry, navigation, one parent mutation, staff read/denial, one administrator approval, validation, and accessibility/keyboard behavior; results are versioned Pass/Fail records. A browser may not be omitted silently: an unavailable environment is an outstanding release blocker or an explicitly approved, dated exception. [prior-requirements] [Q5]

## Acceptance Evidence Matrix

| Evidence | Synthetic local acceptance | Repeat against linked targets |
|---|---|---|
| Role navigation, route/action denial, field absence, direct API parity | Required for every role/scope matrix row represented by critical flows | Repeat with Supabase auth/RLS/object policies |
| Immediate role/scope revocation | Required using synthetic session/grant store; next request denied | Repeat with Supabase session/RLS configuration |
| Validation and application error mapping | Required across UI/API/invitation/profile/import seams | Repeat adapter/integration-specific failures |
| Audit/log redaction and privacy-safe fixtures/screenshots | Required | Repeat production-format structured logs without personal content |
| Persistence, atomic swap/import, lifecycle, job scheduling/idempotency | Contract/state tests required with synthetic adapters | Real database transaction, scheduler, and provider tests required before release |
| Email/provider delivery | In-app state and simulated delivery outcome required | Provider attempt/idempotency/retry evidence required before release |
| Vercel output | Production build/start required locally | Preview/staging deployment required after project link |

The matrix prevents synthetic success from being reported as real-target verification while still making privacy and authorization behavior testable locally. [Q3] [Q5] [Q6] [practices]

## Constraints

- Use the approved Next.js modular monolith, Vercel frontend target, and Supabase backend/authentication/database boundary. [prior-design] [Q6]
- Preserve all existing domain-module ownership and public-contract boundaries discovered in the CodeKB. [architecture] [structure]
- Preserve inherited Hungarian locale, `Europe/Budapest`, privacy, authorization, audit, retention, migration, reminder, and accessibility requirements. [prior-requirements]
- Use synthetic data only for local fixtures and evidence; never require production credentials to exercise the local acceptance surface. [Q3]
- Follow affirmed trunk, test, deployment, code-style, security, and supply-chain practices. [practices]
- Treat the human-approved current intent/scope/handoff artifacts as product-boundary authority when an older CodeKB recommendation conflicts; CodeKB remains authority for observed source structure. [intent] [scope] [business] [architecture]

## Assumptions

- Existing domain public contracts cover most critical application behavior; genuine gaps will be added at explicit module boundaries rather than implemented inside UI components. Rationale: CodeKB shows mature domain modules but no delivery layer. [architecture] [structure]
- A synthetic adapter set can represent critical success and failure states while remaining contract-compatible with later Supabase adapters. Rationale: explicit ports and in-memory patterns already exist. [architecture] [Q3]
- The requester can validate local browser behavior before linked Vercel/Supabase target validation. [intent] [Q7]

## Out of Scope

- Redesigning, narrowing, or replacing the inherited product requirements and UX. [Q1]
- Real production deployment or claims of real Supabase/RLS/email/Vercel verification during synthetic local validation. [Q6]
- Real family/child data in development, tests, fixtures, screenshots, or logs. [Q3]
- Prior deferred features: native apps, SMS/WhatsApp, payments, automatic rotation, live Excel synchronization, new ongoing completion tracking, and unrelated integrations. [prior-requirements]

## Open Questions for Design

- Complete and approve FR-LR-14's versioned authorization matrix before route implementation acceptance. [Q4]
- Define the concrete synthetic adapter composition and production Supabase adapter selection/configuration mechanism. [Q3] [Q6]
- Identify any missing application-facing query/view contracts without leaking persistence models into UI components. [architecture] [structure]
- Select the concrete Safari desktop and mobile-Safari execution environment while preserving NFR-LR-07's mandatory recorded smoke coverage. [Q5] [Q7]

## Source Precedence and Approval Status

1. The current human-approved Intent Capture, Scope Definition, and Approval & Handoff artifacts define this intent's product boundary. [intent] [scope]
2. The complete approved `260729-feature` requirements/stories/design define inherited product behavior. [prior-requirements] [prior-stories] [prior-design]
3. CodeKB defines observed implemented source structure. Its earlier task-demo recommendation is stale and superseded for scope purposes. [business] [architecture] [structure]
4. The Intent Capture reviewer verdict was advisory and remained NOT-READY after its configured iteration budget; the human subsequently approved that gate, and the more testable consolidated Requirements Q&A plus this artifact supersede its vague success wording for acceptance. [intent] [Q1] [Q2] [Q3] [Q4] [Q5] [Q6] [Q7]
5. Current affirmed deployment practice and Q8 supersede the inherited automatic-production wording: this local intent deploys nowhere; future staging may be automatic, while future production promotion is protected and manual. [Q8] [practices]

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
- [Q1]–[Q8] `requirements-analysis-questions.md`

## Review

**Reviewer:** aidlc-product-lead-agent

**Verdict:** NOT-READY

The deployment-policy contradiction is resolved. Q8, FR-LR-13a, and Source Precedence item 5 consistently state that this local intent deploys nowhere, future staging may deploy automatically after required gates, and future production promotion requires protected manual approval. This also matches the current team deployment practice and explicitly supersedes the inherited automatic-production wording. The spot-check found no new deployment contradiction.

### Blocking finding

1. **Q8 is not included in the confirmed consolidated summary.** In `requirements-analysis-questions.md`, the `## Consolidated Summary Confirmation` summarizes only Q1–Q7 and is answered `A. Looks correct`; Q8 appears afterward. Requirements Analysis Step 10 requires the confirmation to summarize every original and follow-up answer and to be reconfirmed after changes. Good looks like updating the consolidated summary with the Q8 deployment-precedence decision, resetting its `[Answer]:` tag, and obtaining a fresh explicit `Looks correct` response before approval.

## Review

**Reviewer:** aidlc-product-lead-agent

**Verdict:** READY

The prior blocker is resolved. The final consolidated summary now appears after Q1–Q8, includes a distinct summary statement for each answer, asks the required pre-generation confirmation question, and records the user's explicit `A. Looks correct` response.

No new blocker was found. Q8, FR-LR-13/FR-LR-13a, the acceptance-evidence boundary, Source Precedence item 5, and the affirmed team deployment practice consistently establish that this local intent performs no deployment; only a future workflow with a deployable application and linked targets may automate staging, while production promotion remains protected and manual. The explicit precedence rule resolves the inherited continuous-production sentence without weakening the inherited product or privacy requirements.
