# API Documentation

## External Network API

There are no implemented HTTP endpoints, route handlers, REST resources, GraphQL schemas, gRPC services, WebSocket channels, browser APIs, or webhooks. There is also no server or browser entry point. Any external API description beyond the Supabase RPCs below would be speculative.

## Public Service Surfaces

| Component | Primary operations | Result/error style |
|---|---|---|
| `AccessService` | `authorize`, `grantRole`, `revokeRole` | `AuthorizationDecision`, domain value, or void |
| `SupabaseRouteAdapter` | `authorizationVersion`, `hasActiveScope` | Promise; returns primitive/undefined or throws RPC error |
| `DirectoryService` | create/link/assign/archive/restore and visible-directory operations | Domain values or authorization decisions |
| `CoordinationService` | `signUp`, `requestSwap`, `decidePendingSwap`, `requestCancellation`, `decideCancellation`, contribution/allergen checks | Assignment/swap value, authorization decision, void, or retryable conflict error |
| `ImportService` | `createPreview`, `resolveConflict`, `commit`, `rollback` | Domain values or typed import errors |
| `NotificationService` | `schedule`, `cancelDuty` | Notification delivery statuses or void |
| `DurableNotificationJobs` | `dispatchDue`, `cancelDuty` | Updated durable jobs or void |
| `ParentExperienceService` | projections, notifications, read marking, sign-up/swap/cancellation façades | `ParentResult<T>` discriminated union |
| `AdminExperienceService` | queue, school-year, privileged operation and archive façades | `AdminResult<T>` discriminated union |
| `StaffScheduleService` | scoped 31-day schedule query | ready/empty/denied/invalid-filter result |
| `PrivacyLifecycleService` | lifecycle execution, deferral and purge processing | Lifecycle decisions/results through injected ports |

Exact TypeScript signatures are authoritative in each module's `index.ts`, service file and types file. There is no package-level export surface.

## Core Contracts

### Access

`Role` is one of `super_admin`, `kindergarten_admin`, `group_admin`, `parent`, or `read_only_staff`. `Scope` contains `id`, `type` (`organization`, `group`, or `family`), and `organizationId`. A `Session` carries `subjectId` and `authorizationVersion`. Authorization supports `read`, `create`, `update`, `delete`, and `manage`; decisions use codes `allowed`, `authorization_denied`, or `reauthorization_required`.

### Coordination

`Task` currently contains only `id`, `scope`, `capacity`, and `version`; it has no title or list/create operations. `Assignment` contains `id`, `taskId`, `familyId`, state and version. `signUp` requires an expected task version and checks family visibility and capacity. Swap and cancellation operations transition assignment state and may require admin approval. `CoordinationEvent` currently has one form: `assignment.changed` with `assignmentId`.

### Import and notifications

Import preview requires exactly the 17 named legacy sheets and validated rows. A preview contains an identifier, fingerprint, changed keys, copied rows, and state. Commit requires the preview identifier and matching fingerprint with no open conflicts. Notifications use `7d` and `24h` thresholds. Durable jobs transition among `queued`, `sent`, `retry_scheduled`, and `cancelled`, while delivery guarantees distinguish provider idempotency from at-least-once behavior.

### Experience façades

Parent results are `ready`, `denied`, or `not_found`; protected negative outcomes intentionally share the Hungarian message `Nincs jogosultság`. Admin results are `ready`, `empty`, or `denied`. Staff schedule results include `ready`, `empty`, `denied`, and `invalid-filter`. These unions are suitable application-layer contracts but are not mapped to HTTP status codes or UI states anywhere in the repository.

## Port Interfaces

Exported ports cover user/grant repositories, audit writers, directory repositories/authorizers, coordination repositories/events/audits, import repositories, notification stores/queues/providers, durable job repositories/dispatchers, parent/admin/staff repositories and commands, and privacy lifecycle processors/repositories. Ports are synchronous except the Supabase RPC adapter.

Transaction ports accept a callback (`transaction<T>(operation: () => T): T`). This contract describes atomic intent but does not define isolation, retry, async behavior or distributed effects; production adapters will need a stricter contract.

## Supabase RPC and SQL Surface

The migration defines three security-definer SQL functions:

| RPC | Inputs | Output | TypeScript usage |
|---|---|---|---|
| `authorization_version_for` | `requested_subject_id uuid` | integer | Used by `SupabaseRouteAdapter.authorizationVersion` |
| `has_active_scope` | organization and scope UUIDs | boolean | Used by `SupabaseRouteAdapter.hasActiveScope` |
| `has_admin_scope` | organization and scope UUIDs | boolean | Used internally by RLS only |

Six tables are created: `app_role_grants`, `app_authorization_versions`, `app_families`, `app_assignments`, `app_import_runs`, and `app_audit_events`. Fourteen RLS policies cover grant read, family CRUD, assignment CRUD, import CRUD, and audit read. No generated database types, Supabase SDK dependency, migration runner, route mapping, or SQL integration tests exist.

## Missing Delivery Contract for Active Intent

The active local-browser slice needs an explicit contract such as list tasks and create task with a validated title. This should be defined at the feature/application boundary rather than presented as an existing external API. Synthetic IDs and deterministic seed data should be documented, and UI errors should map from typed application outcomes without exposing real authorization or persistence semantics.

