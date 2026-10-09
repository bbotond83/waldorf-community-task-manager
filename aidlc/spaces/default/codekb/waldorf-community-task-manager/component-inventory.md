# Component Inventory

Static synthesis of the revalidated 2026-10-06 developer scan for `261006-simplify-user-roles`, Standard depth, branch `feature/simplify-user-roles`, observed HEAD `0dce0567f18dc72e46aa88d87e5626708b08bc7d`. Full repository breadth with partial deep coverage. No application changes, tests, builds, browser sessions, migrations or target calls were performed.

## Inventory Basis

Every discovered application/domain module and delivery surface is catalogued. Health labels are static risk assessments; shallow inventory does not certify component correctness.

## Access and Authorization

- **Path**: `src/access`
- **Responsibility / ownership**: Grants, scoped policy, revocation and redacted audit.
- **Dependencies**: Repositories/authorization ports; domain consumers.
- **Health**: At-risk: unknown-role fallback and policy duplication.

## Directory

- **Path**: `src/directory`
- **Responsibility / ownership**: Families, parents, children, school-year/groups, consent and archives.
- **Dependencies**: Access grants, transactional repository and visibility recalculation.
- **Health**: At-risk: sensitive-field and role checks.

## Coordination

- **Path**: `src/coordination`
- **Responsibility / ownership**: Signup/capacity, swaps, approvals and contributions/allergens.
- **Dependencies**: Directory visibility, transactions and assignment events.
- **Health**: Partial deep service coverage.

## Notifications

- **Path**: `src/notifications`
- **Responsibility / ownership**: Scheduling, deduplication, dispatch/retry/cancel.
- **Dependencies**: Queue/store/provider ports.
- **Health**: At-risk: real provider/persistence unlinked.

## Privacy Lifecycle

- **Path**: `src/privacy-audit`
- **Responsibility / ownership**: Deferral, deletion/anonymization and retention.
- **Dependencies**: Repository transaction; 30-day grace, 365-day audit purge and holds.
- **Health**: Partial deep service coverage; production execution unknown.

## Import Migration

- **Path**: `src/import-migration`
- **Responsibility / ownership**: Seventeen-sheet consent/conflicts, fingerprint commit and rollback.
- **Dependencies**: Transactional repository, archive/process owners.
- **Health**: At-risk: legacy administrator archive ownership.

## Parent Experience

- **Path**: `src/parent-experience`
- **Responsibility / ownership**: Own-family duties, notifications and commands.
- **Dependencies**: Directory visibility and parent repository.
- **Health**: Partial deep service coverage.

## Staff Schedule

- **Path**: `src/staff-schedule`
- **Responsibility / ownership**: Read-only projected schedules; maximum 31-day filter.
- **Dependencies**: Access and schedule repository.
- **Health**: At-risk: teacher behavior undecided.

## Admin Experience

- **Path**: `src/admin-experience`
- **Responsibility / ownership**: Scoped queues, school years and archive operations.
- **Dependencies**: Access, repositories/operation ports, import destinations.
- **Health**: At-risk: policy alignment.

## Application Facades

- **Path**: `src/application`
- **Responsibility / ownership**: Contracts, policy matrix, orchestration, results/idempotency/evidence.
- **Dependencies**: Access types and domain/session/adaptor ports.
- **Health**: At-risk: large facade and duplicated policy.

## Runtime and Sessions

- **Path**: `src/runtime`
- **Responsibility / ownership**: Config, composition, catalog, signed cookie and shell.
- **Dependencies**: Zod, Node crypto, application policy and synthetic adapters.
- **Health**: At-risk: five-role catalog; unlinked production.

## Admin Core Adapter

- **Path**: `src/admin-core`
- **Responsibility / ownership**: Synthetic records/tasks/assignments/approvals/archives.
- **Dependencies**: Admin facade ports and runtime authorization.
- **Health**: Shallow: process-local state.

## Admin Advanced Adapter

- **Path**: `src/admin-advanced`
- **Responsibility / ownership**: Synthetic import/reminders/governance/lifecycle/settings.
- **Dependencies**: Core adapter and advanced store; facade guards.
- **Health**: Shallow: process-local transactions.

## Parent Web Adapter

- **Path**: `src/parent-web`
- **Responsibility / ownership**: Synthetic duties/notifications/invitations/session.
- **Dependencies**: Parent/session facades and catalog.
- **Health**: Shallow: mutable fixture stores.

## Staff Web Adapter

- **Path**: `src/staff-web`
- **Responsibility / ownership**: Schedules, business group scopes and failure fixtures.
- **Dependencies**: Staff facade and field projection.
- **Health**: Partial deep coverage; legacy staff role.

## App Router Web

- **Path**: `app`
- **Responsibility / ownership**: Hungarian pages, layouts, actions and access states.
- **Dependencies**: Runtime/session and application facades.
- **Health**: Partial deep coverage; independent persona gates.

## SQL Persistence Policies

- **Path**: `supabase/migrations`
- **Responsibility / ownership**: Intended tables/grants/RLS functions.
- **Dependencies**: Supabase contract.
- **Health**: At-risk: unconstrained text roles; execution unknown.

## Verification and Delivery

- **Path**: `scripts, tests, verification, .github`
- **Responsibility / ownership**: Manifests, local runners, bounded scans, suites and CI/evidence.
- **Dependencies**: Node, Vitest, Playwright and build tools.
- **Health**: Partial deep coverage; manifest parity and six targets outstanding.
