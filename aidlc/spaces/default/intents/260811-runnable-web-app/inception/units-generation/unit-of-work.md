# Units of Work

## Design Basis

These delta units implement the approved Application Design [components](../application-design/components.md), [component methods](../application-design/component-methods.md), [services](../application-design/services.md), [component dependency](../application-design/component-dependency.md), and [decisions](../application-design/decisions.md), plus current [requirements](../requirements-analysis/requirements.md) and [stories](../user-stories/stories.md). Existing domain modules remain in place and are not recreated.

## Unit Definitions

| Unit | Kind | Size | Owns and delivers | Boundary/constraints |
|---|---|---:|---|---|
| `runtime-foundation` | packaging | L | Next.js/React/tooling, runtime config guard, composition roots, session shell, synthetic fixture registry/reset, shared AppShell/state components, build/start scripts | no domain rules; synthetic/production mutually exclusive; no deploy workflow |
| `application-facades` | library | XL | shared `ApplicationResult`, screen models, UX-AUTH contract, session/authorization, parent/staff/admin façade ports and implementations, error/idempotency/event/evidence mapping | wraps public domain APIs only; prohibited fields absent; exhaustive result mapping |
| `parent-web` | ui | L | invitation/auth entry, parent duties/detail/signup, swap/cancel, notifications, own event notes, all states/accessibility | depends on façades; no direct repository/domain adapter imports |
| `staff-web` | ui | S | privacy-minimized schedule/filter/detail and denial/failure states | read-only; AUTH-STA field boundary; no mutation controls/contracts |
| `admin-core-web` | ui | XL | dashboard, records, task/event, assignment/capacity, approvals, archive/restore, scoped nav | exact approval outcomes; Group Admin import absent; role/scope contracts |
| `admin-advanced-web` | ui | XL | import seven-step/recovery, reminder monitoring/retry, roles/governance/settings, recipient selection, privacy lifecycle | depends on admin shell/core patterns; Kindergarten/Super import only; durable job/event ports |
| `verification-handoff` | packaging | L | fixtures/scenario manifest, unit/integration/browser/accessibility/security checks, coverage/build/start smoke, fresh-checkout docs, evidence/outstanding report | ≥80% line/branch/function; no deployment; linked-target checks remain OUTSTANDING |

## Existing Module Collaboration

Access, Directory, Coordination, Parent Experience, Admin Experience, Staff Schedule, Import Migration, Notifications/Jobs, and Privacy/Audit remain library/service boundaries owned by the prior implementation. Units may extend missing public ports or adapters only at the owning module boundary and must preserve colocated tests.

## Deployment Model

All units are embedded in one Next.js modular-monolith artifact. `library`, `ui`, and `packaging` describe construction obligations, not independent deployment. Local synthetic mode is the acceptance runtime. Production-compatible build output is verified locally, but no staging or production deployment occurs.

## Cross-Cutting Constraints

- Node 24.x/npm 11.x, strict TypeScript, Prettier, ESLint, Hungarian UI copy.
- Server-side authorization and exact UX-AUTH/FR-LR-14 row/field evidence.
- Synthetic data only; no secrets/personal data in fixtures, logs, screenshots, or reports.
- Shared explicit result states; retry only for classified retryable dependency failure.
- Semantic HTML, keyboard/focus behavior, 200% zoom, 44×44 targets, no serious/critical automated accessibility violations.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback after two pinned-model dispatch failures)

**Verdict:** READY

**Iteration:** 1

The required YAML declares exactly the seven units once, every dependency resolves to a declared unit, kinds are valid, and an independent cycle check passes. The prose and machine topology agree. Parent, staff, and administrator-core units are parallel-capable only after their shared dependencies; the artifacts make no economic-order or critical-path recommendation.

Each unit has a cohesive responsibility, appropriate kind, embedded modular-monolith deployment model, explicit integration contracts, and owned stories. All 24 active local delivery stories are explicitly mapped after expanding the parent-story range; inherited US-01 through US-14 are preserved; retired umbrellas and epics are excluded from delivery counting. Existing domain modules are correctly treated as reused dependencies rather than duplicate new units. No deployment unit or production action is introduced.
