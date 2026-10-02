# Local Startup Fix Requirements

## Intent Analysis

Enable contributors to run the documented synthetic application locally using the supported Node/npm toolchain, without a separate runtime-mode shell export. Fix the common prehook configuration-loading boundary for development, build and production-server startup. This is a Minimal brownfield bugfix; all requirements below are Must priority.

The approved investigation identifies one shared validator that reads inherited `process.env` before Next loads environment files. README assumes `nvm` despite the reported existing Homebrew Node 24 installation. Existing smoke checks inject synthetic mode and therefore cannot alone prove the documented startup recipe works.

## Sources

- [desc] Initial description: this intent's `project-description.json`, obtained through `aidlc engine workspace project-description`.
- [scope] Workflow-selected scope: `bugfix`, Minimal depth and Minimal test strategy.
- [Q1] Confirmed summary: `requirements-analysis-questions.md`, `Consolidated Summary Confirmation`, exact answer `Looks correct`.
- [RE] Approved investigation: `../reverse-engineering/developer-scan.md` and the focused updates to the following space CodeKB inputs:
  - `../../../../codekb/waldorf-community-task-manager/business-overview.md` — contributor setup goal and synthetic local boundary.
  - `../../../../codekb/waldorf-community-task-manager/architecture.md` — npm prehook process boundary, environment-loader alternatives, precedence, and isolated production slot.
  - `../../../../codekb/waldorf-community-task-manager/code-structure.md` — README, package scripts, validator and pure schema responsibilities.
- [memory:M1] Active-space `team.md` Testing Posture and `project.md` Mandated rules: regression tests, existing quality gates, 80% line/branch/function coverage, Node/npm and code style constraints.

## Functional Requirements

### FR1 — Supported local toolchain instructions

README shall document Node 24.x and npm 11.x selection and verification. Retain the version-manager route and add a current-terminal Homebrew route for the existing `/opt/homebrew/opt/node@24/bin` installation, including how to check the resulting versions. Do not require installation of `nvm` when compatible Homebrew tools already exist. [desc] [RE] [Q1]

- **Acceptance:** Given the described machine with compatible Homebrew tools and no `nvm`, when a contributor follows the documented current-terminal setup, then Node reports major 24, npm reports major 11, and the existing toolchain check passes.
- **Error case:** Given an unsupported Node or npm major, when the existing toolchain check runs, then it still fails with the existing stable diagnostic. README explains that version checks must pass before startup.
- **Boundary:** The documented commands alter only the current process environment; they do not write shell profiles or change global machine settings.

### FR2 — Environment-file configuration before prehook validation

The lifecycle configuration validator shall load the same applicable environment files and precedence as the installed Next framework before validating runtime configuration. This shall apply to `predev`, `prebuild`, and `prestart`. Preserve a pure `validateRuntimeConfig(environment)` boundary and existing validation result states. Loader implementation and dependency ownership are selected during Code Generation planning. [desc] [RE] [Q1]

- **Acceptance:** Given documented synthetic configuration in `.env.local` and no inherited `APP_RUNTIME_MODE`, when any of the three prehooks runs under supported tools, then runtime configuration validation succeeds and permits the associated framework command to run.
- **Precedence:** Given both an inherited variable and a conflicting environment-file value, when validation runs, then the inherited value takes precedence, including an inherited invalid value causing rejection.
- **Mode:** Given no explicit `NODE_ENV`, then dev uses development environment-file selection and build/start use production selection, matching Next. Given an explicit supported `NODE_ENV`, selection matches Next for that mode. Synthetic `APP_RUNTIME_MODE` remains valid for local production build/start.
- **File ordering:** Resolve environment values in the installed Next order: inherited environment, mode-specific local file, `.env.local` except in test mode, mode-specific file, `.env`. Test-mode behavior shall preserve Next's exclusion of `.env.local`.
- **Error case:** Missing or invalid effective runtime configuration shall still fail before Next starts; no implicit synthetic fallback may convert such a failure into success.

### FR3 — Documented local dev and build/start acceptance

README shall provide a reproducible synthetic setup and local dev/build/start procedure after toolchain selection and environment-file preparation. Verification shall follow that procedure without separately exporting `APP_RUNTIME_MODE`. [desc] [Q1]

- **Dev acceptance:** Given supported tools and the documented synthetic configuration, when `npm run dev` runs on loopback, then the server starts and `/api/readiness` demonstrates synthetic readiness without an exported runtime mode.
- **Build/start acceptance:** Given the same documented local synthetic setup, when `npm run build` completes and `npm run start` runs on loopback, then the server starts and readiness demonstrates synthetic mode without an exported runtime mode. `NODE_ENV=production` does not select production application mode by itself.
- **Failure acceptance:** Given missing or invalid effective configuration, then each affected command fails before framework work with an existing safe configuration diagnostic and nonzero exit.
- **Verification isolation:** Preserve any existing contributor environment files. Use temporary fixtures or an isolated checkout for precedence/error scenarios, stop processes started for verification, and record the actual results instead of treating existing injected-mode smoke checks as proof of this requirement.

### FR4 — Regression coverage and delivery evidence

Add targeted regressions for the common loading defect across all affected prehooks, environment-file selection and shell precedence, including invalid configuration and safe failure output. Run applicable existing project checks and summarize changed files, command results, and limitations. [desc] [Q1] [memory:M1]

- **Acceptance:** Tests demonstrate environment-file configuration works with no inherited runtime mode and that dev/build/start use their intended environment selections.
- **Failure coverage:** Tests demonstrate missing/invalid effective configuration remains rejected, conflicting inherited values win, test mode does not load `.env.local`, and diagnostic output does not contain fixture secrets.
- **Evidence:** Record supported Node/npm versions, targeted regression outcomes, existing checks, build/start readiness and documented dev startup results. A skipped or failed check is reported as such and cannot be claimed as passed.

## Non-Functional Requirements

- **NFR1 — Secret-safe validation:** Failure output contains only the existing error code and relevant variable name, never environment-file contents, credentials or secret values. Use dummy secret markers in isolated tests and assert they are absent from captured output. [desc] [RE]
- **NFR2 — Local isolation:** All verification uses synthetic fixtures and loopback listeners. Make zero external or production-system connections and zero deployment actions. Loading and validation must not instantiate or call external integrations. [desc] [Q1]
- **NFR3 — Compatibility and maintainability:** Preserve Node 24.x/npm 11.x enforcement, explicit configuration results, pure validation, current module boundaries, and project formatter/linter conventions. Honor affirmed quality gates: strict type checking, existing suites, at least 80% line/branch/function coverage across production source, production build, start smoke, critical browser/a11y flow and dependency checks that block high/critical findings. No target-connected integration check is authorized by this local task. Record any unavailable check or pre-existing failure explicitly; do not weaken gates to pass. [desc] [memory:M1]

## Constraints

- Work on a bugfix branch; preserve concurrent work from other intents and avoid unrelated changes. [desc]
- Modify project source and documentation only; no global machine/shell configuration edits. [desc]
- Keep existing Next version conventions: read relevant installed guides before writing framework-related code. [memory:M1]
- Follow the requested AI-DLC summary, planning, review and approval checkpoints. [desc]
- No new performance, availability, scaling or product UX targets are introduced by this local startup bugfix. [scope]

## Out of Scope

Nondefault host/port propagation from environment files into npm's later shell expansion; production integrations or deployment; global toolchain changes; changes to domain features, authorization, persistence or Hungarian UI copy. These exclusions do not relax the documented default loopback acceptance. [Q1] [RE]

## Assumptions & Open Questions

None.

Reported Homebrew Node/npm versions are supplied observations and will be checked during verification. Current code and checks may have pre-existing failures; actual baseline results must determine that. These are pending measurements, not assumptions required to define the fix. Environment-loader selection and test harness details are implementation decisions for Code Generation, not unresolved product requirements.

## Traceability and Handoff

| ID | Outcome | Source | Design and implementation | Verification |
|---|---|---|---|---|
| FR1 | Accurate supported-toolchain instructions | desc, RE, Q1 | Code Generation plan: README | Version checks and toolchain rejection regression |
| FR2 | Matching env loading in all prehooks | desc, RE, Q1 | Code Generation plan: validator, lifecycle scripts, dependency if needed | Loader/CLI regressions for modes, ordering and invalid values |
| FR3 | README procedure reaches local dev/build/start | desc, Q1 | Code Generation plan: documented recipe | Loopback dev and build/start readiness without mode export |
| FR4 | Regression and results evidence | desc, Q1, memory:M1 | Code Generation testing contract | Targeted tests and Build and Test evidence |
| NFR1 | No secrets in diagnostics | desc, RE | Preserve formatter and error boundary | Dummy-secret output assertions |
| NFR2 | Synthetic, local execution only | desc, Q1 | Isolated fixtures and loopback command plan | Record commands and synthetic readiness; no target calls |
| NFR3 | Existing compatibility and quality targets | desc, memory:M1 | Existing module and check contracts | Baseline and applicable final checks with coverage |

User Stories, Units Generation and design stages are skipped by the active bugfix scope. This table names planned downstream verification, not completed implementation or test evidence. Code Generation must establish the concrete file plan and Testing Contract before implementation.
