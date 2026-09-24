# Application Components

## Design Basis

This design consumes the current [requirements](../requirements-analysis/requirements.md), [stories](../user-stories/stories.md), CodeKB [architecture](../../../codekb/waldorf-community-task-manager/architecture.md) and [component inventory](../../../codekb/waldorf-community-task-manager/component-inventory.md), and affirmed [team practices](../practices-discovery/team-practices.md). It preserves the approved modular-monolith domain boundaries and adds the missing locally runnable delivery, application, and composition layers.

## Existing Domain Components

| Component | Ownership retained | Public collaboration |
|---|---|---|
| Access | users, role grants, scopes, authorization version, redacted access audit | `AccessService`, typed authorization decisions |
| Directory | families, parents, children, groups, school years, field projection, archive | `DirectoryService`, privacy-minimized views |
| Coordination | tasks/events, assignments, signup, swap/cancellation, contribution policy | `CoordinationService`, assignment events |
| Parent Experience | parent projections and commands | `ParentExperienceService` |
| Admin Experience | queues, school-year/archive projection, scoped operations | `AdminExperienceService` |
| Staff Schedule | 31-day privacy-minimized schedule | `StaffScheduleService` |
| Import Migration | required-sheet registry, preview, conflicts, commit, reconciliation | `ImportService` |
| Notifications/Jobs | reminder creation, job status, retry/cancellation | `NotificationService`, `DurableNotificationJobs` |
| Privacy/Audit | lifecycle eligibility, deletion/anonymization, audit retention | `PrivacyLifecycleService` |

No route or UI component writes these records directly or moves their business rules into framework code.

## New Application Components

| Component | Purpose | Owns | Does not own |
|---|---|---|---|
| `ApplicationFacade` | Stable command/query surface for every route | orchestration, authorization recheck, result mapping, idempotency context | domain rules or persistence |
| `ScreenModelFactory` | Produce already-authorized typed screen models | UI state union, Hungarian safe messages, route/menu projections | authorization policy decisions |
| `AuthorizationContract` | Executable UX-AUTH/FR-LR-14 rows and sensitive-field IDs | stable matrix lookup and generic denial mapping | client-only visibility |
| `SessionGateway` | Resolve, create, switch, and revoke application sessions | session result contract and cache invalidation signal | production credential storage |
| `JobCoordinator` | Consume assignment/import/lifecycle events and drive deterministic jobs | idempotency correlation and application status | browser timers |
| `EvidenceRecorder` | Record scenario/result metadata without personal data | synthetic vs linked-target status, redacted evidence IDs | secrets or raw provider payloads |

`ApplicationFacade` is split internally by cohesive ports (`IdentityApplication`, `ParentApplication`, `StaffApplication`, `AdminApplication`) but exposed through one composition root. Cross-module calls use IDs and public types only.

## New Delivery Components

| Component | Responsibility | Boundary |
|---|---|---|
| Next.js App Router | Hungarian server-rendered routes, route handlers, error/loading states | calls application ports only |
| `AppShell` and screen components | semantic role-aware rendering from approved refined mockups | consume typed screen models only |
| Server actions/route handlers | validate transport input, resolve session, call façade, return result | never instantiate repositories |
| `SyntheticCompositionRoot` | deterministic fixtures, clocks, in-memory adapters, failure scenarios | only when `APP_RUNTIME_MODE=synthetic` |
| `ProductionCompositionRoot` | Supabase/auth/provider adapter slots and production config validation | selector absent; unlinked checks remain outstanding |
| `RuntimeModeGuard` | fail closed on missing/invalid mode, prohibit synthetic endpoints in production | starts no deployment or external target call |

## UI Route Ownership

- Public entry: `/`, `/meghivas/[token]`, `/belepes`.
- Parent: `/szulo/feladatok`, `/szulo/feladatok/[id]`, `/szulo/ertesitesek`.
- Staff: `/munkatars/beosztas`.
- Administrator: `/admin`, `/admin/nyilvantartasok`, `/admin/feladatok`, `/admin/hozzarendelesek`, `/admin/jovahagyasok`, `/admin/import`, `/admin/emlekeztetok`, `/admin/archivum`, `/admin/beallitasok`, `/admin/adatvedelem`.

Routes exist only when their authorization row permits them. Group Administrator import is absent and direct access is denied by `AUTH-GRP-IMPORT-DENY`. The browser receives no prohibited row or sensitive-field data.

## Shared State Contract

All delivery/application results use:

`initial | loading | empty | validation | pending | success | denied | conflict | invalidated | dependency-failure-retryable | dependency-failure-terminal | recovery`.

Each result includes a stable code, privacy-safe Hungarian presentation key, optional authorized data, focus target, announcement mode, and retry metadata. Only `dependency-failure-retryable` carries a retry action/idempotency key.

## Data Ownership and Persistence

Synthetic adapters are seeded per process from versioned invented fixtures and implement existing/new ports. Mutations remain deterministic for browser tests; state resets through an explicit test-only endpoint guarded by synthetic mode. Future Supabase repositories own persistence per module and use RLS as defense in depth. Foreign contexts store IDs, not another module's aggregate. No local fixture, evidence, screenshot, response, or log contains production-derived personal data.

## Acceptance Boundaries

- Local acceptance proves complete routes, application/domain orchestration, authorization equivalence, explicit states, build/start, browser flow, and synthetic persistence behavior.
- Linked-target acceptance separately proves Supabase auth/RLS/transactions, scheduler/provider behavior, and Vercel execution.
- This intent creates no executable deployment workflow and performs no staging or production deployment.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback after two pinned-model dispatch failures)

**Verdict:** READY

**Iteration:** 1

The design is implementable against the observed brownfield boundaries. New delivery and application components depend only on public module contracts; domain modules remain framework-independent; composition implements ports without calling delivery; and event/job flow does not introduce a cycle. The shared `ApplicationResult<T>` state vocabulary is consistent across component, method, service, and dependency artifacts, including distinct retryable and terminal dependency failures.

Synthetic and production compositions are mutually exclusive, fail closed, and preserve authorization/privacy invariants. Group Administrator import denial, immediate revocation, sensitive-field minimization, synthetic-only reset/session controls, and linked-target evidence boundaries are explicit. The full parent, staff, administrator, invitation/authentication, import, reminder, governance, lifecycle, and evidence surfaces have owning methods and routes.

Each ADR includes Context, Decision, Consequences, Alternatives Rejected, security/compliance impact, and reversibility. Vercel-compatible build/start is separated from deployment, and no AWS or executable deployment path is introduced. No blocking ownership conflict, hidden dependency, unachievable quality target, or architecture contradiction was found.
