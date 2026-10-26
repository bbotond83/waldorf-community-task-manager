# AI-DLC State Tracking

## Project Information
- **Project**: Fix finding B5 (U1 review R-09): db:worker has no equivalent of the local-only guard that db:seed and db:reset have. Today scripts/db/worker.ts setupWorker calls loadToolingSettings (which only runs assertLocalAddress on DATABASE_URL and SUPABASE_URL) and then connects and runs `drop schema if exists "worker_N" cascade` (with --reset), creates and migrates the worker schema, truncates its tables and deletes auth.users rows by worker email prefix. A hosted database reached through a loopback tunnel would pass the address check and be changed. Fix: reuse the existing guard in scripts/db/local-guard.ts. (1) Before connecting, run assertLocalSettings (address check plus the default-local-password check, assertLocalStackPassword) on the settings. (2) After connecting, run assertLocalStack (the identity check) and close the client when it refuses, as connectLocalStack does; the cleanest shape is to use connectLocalStack(settings, deps.connect) in setupWorker. IMPORTANT: db:worker is itself one of the tools that creates the migration tracking table (the runner does `create table if not exists ...applied_migrations`, and db:start does not migrate), so the identity check must NOT require that the tracking table already exists for the worker: give assertLocalStack/connectLocalStack an optional parameter (for example { requireManaged: false }, default true so seed and reset keep their exact behaviour) and have the worker pass false; the other identity reasons (postgres database, supabase_admin role, JWT secret hash when present) stay required. Keep the worker error wrapping (ToolingError step names, worker/schema detail) working: a refusal should surface as a ToolingError with step guard and the worker and schema in its detail, and must not echo any password. Existing tests: scripts/db/tooling.test.ts uses FAKE_URL with the password fake-db-password in the worker tests and a fakeSql that does not answer the identity query: update the worker tests so they use a loopback URL with the Supabase CLI default password (the one in LOCAL.databaseUrl of scripts/db/local-guard.test.ts, postgres:postgres) and a fake that answers the identity query like local-guard.test.ts does; keep other tooling tests (migrate) unchanged. tests/database/stack-support.ts and the real-stack tests call setupWorker against the real local stack with the default password and must keep working. New tests: setupWorker refuses a non-default password before any connection is made, refuses a database that does not identify itself as the local stack (client closed, no drop/create/truncate/delete statement run), and still works on a stack whose tracking table does not exist yet. Also mention in the README db:worker description that it refuses anything but the local stack, like seed and reset. Record in aidlc/spaces/default/intents/261012-real-backend-local/follow-ups/minor-findings-plan.md under B5 that db:worker now has the guard, and note that db:migrate (scripts/db/migrate.ts) has only the address check, which is out of scope here and listed as a separate possible follow-up. Source: plan group B5 of that file. Skip Reverse Engineering and the deployment stages (the person already decided that for these fixes).
- **Project Description Source**: project-description.json
- **Project Type**: Brownfield
- **Project Type Source**: workspace scan
- **Scope**: express
- **Start Date**: 2026-10-26T11:19:51Z
- **Question Id**: 533abd3b
- **State Version**: 8
- **Active Agent**: aidlc-quality-agent
- **Worktree Path**:
- **Bolt Refs**:
- **Practices Affirmed Timestamp**:

## Scope Configuration
- **Stages to Execute**: 0.1, 0.2, 0.3, 2.1, 2.3, 3.5, 3.6
- **Stages to Skip**: 1.1 (intent-capture), 1.2 (market-research), 1.3 (feasibility), 1.4 (scope-definition), 1.5 (team-formation), 1.6 (rough-mockups), 1.7 (approval-handoff), 2.2 (practices-discovery), 2.4 (user-stories), 2.5 (refined-mockups), 2.6 (domain-design), 2.7 (units-generation), 2.8 (contract-design), 2.9 (delivery-planning), 3.1 (functional-design), 3.2 (nfr-requirements), 3.3 (nfr-design), 3.4 (infrastructure-design), 3.7 (ci-pipeline), 4.2 (environment-provisioning), 4.5 (incident-response), 4.6 (performance-validation), 4.7 (feedback-optimization), 4.1 (deployment-pipeline), 4.3 (deployment-execution), 4.4 (observability-setup)
- **Depth**: Minimal
- **Test Strategy**: Minimal
- **Review Override**: advisory
- **Guard Policy**: off (from scope express)
- **Sensors**: off (from scope express)
- **Learnings**: off (from scope express)
- **Summary Confirmation**: off (from scope express)
- **Plan Approval**: off (from scope express)
- **Collaborators**: off (from scope express)

## Workspace State
- **Project Root**: .
- **Languages**: TypeScript
- **Frameworks**: Next.js, React
- **Build System**: npm (package.json)

## Execution Plan Summary
- **Total Stages**: 7
- **Completed**: 6
- **In Progress**: none

## Runtime State
- **Revision Count**: 1

## Phase Progress
<!-- Status values: Pending, Active, Verified, Skipped -->

- **Initialization**: Verified
- **Ideation**: Skipped
- **Inception**: Verified
- **Construction**: Verified
- **Operation**: Skipped

## Stage Progress
<!-- Checkbox states: [ ] not started, [-] in progress, [?] awaiting approval (gate open), [R] revising (user rejected gate), [x] completed, [S] skipped via --stage/--phase jump -->

### INITIALIZATION PHASE
- [x] workspace-scaffold — EXECUTE
- [x] workspace-detection — EXECUTE
- [x] state-init — EXECUTE

### IDEATION PHASE
- [ ] intent-capture — SKIP
- [ ] market-research — SKIP
- [ ] feasibility — SKIP
- [ ] scope-definition — SKIP
- [ ] team-formation — SKIP
- [ ] rough-mockups — SKIP
- [ ] approval-handoff — SKIP

### INCEPTION PHASE
- [S] reverse-engineering — EXECUTE
- [ ] practices-discovery — SKIP
- [x] requirements-analysis — EXECUTE
- [ ] user-stories — SKIP
- [ ] refined-mockups — SKIP
- [ ] domain-design — SKIP
- [ ] units-generation — SKIP
- [ ] contract-design — SKIP
- [ ] delivery-planning — SKIP

### CONSTRUCTION PHASE
- [ ] functional-design — SKIP
- [ ] nfr-requirements — SKIP
- [ ] nfr-design — SKIP
- [ ] infrastructure-design — SKIP
- [x] code-generation — EXECUTE
- [x] build-and-test — EXECUTE
- [ ] ci-pipeline — SKIP

### OPERATION PHASE
- [ ] deployment-pipeline — SKIP
- [ ] environment-provisioning — SKIP
- [ ] deployment-execution — SKIP
- [ ] observability-setup — SKIP
- [ ] incident-response — SKIP
- [ ] performance-validation — SKIP
- [ ] feedback-optimization — SKIP

## Current Status
- **Lifecycle Phase**: CONSTRUCTION
- **Current Stage**: build-and-test
- **Next Stage**: none
- **Status**: Completed
- **Last Updated**: 2026-10-26T11:47:43Z

## Session Resume Point
- **Last Completed Stage**: build-and-test
- **Next Action**: Workflow complete
- **Pending Artifacts**: none
