# Component Inventory

## Runtime and Domain Components

| Component | Responsibility | Direct dependencies | Health |
|---|---|---|---|
| `AccessService` | Scoped RBAC, stale-session detection, role grant/revoke and redacted audit | User/grant repositories, audit writer, clock | Healthy domain core; no production repository |
| `SupabaseRouteAdapter` | Translate access checks to Supabase RPC calls | `SupabaseClientPort`, access `Scope` | At risk: unexported, untested, unwired |
| `DirectoryService` | Family relationships, group assignment, visibility projection, archive/restore | Directory repository, authorizer, grants, audit, clock | Healthy domain core; memory-only execution |
| `CoordinationService` | Capacity-aware signup, swaps, cancellations, contribution permissions | Coordination repository, family directory, events, audit, optional authorizer | Healthy tested rules; missing task CRUD and event consumer |
| `ImportService` | 17-sheet validation, preview/conflicts, stage/publish/rollback state | Import repository | At risk: weak fingerprint and partial rollback semantics |
| `NotificationService` | Schedule 7-day/24-hour reminders and cancel a duty | Store, provider, queue, clock | At risk: provider is retained but scheduling does not dispatch through it |
| `DurableNotificationJobs` | Dispatch due jobs, record success/retry, cancel jobs | Durable job repository, dispatcher, clock | Healthy isolated behavior; no durable adapter/worker |
| `ParentExperienceService` | Parent assignment/notification projections and command façade | Family directory, parent repository, clock, optional commands | Healthy façade; no composition wiring |
| `AdminExperienceService` | Admin queues, school-year projection, operations and archive façade | Authorizer, admin repository, optional operations | Healthy façade; no adapter/UI |
| `StaffScheduleService` | Privacy-minimized, filtered 31-day schedule | Authorizer, schedule repository, clock | Healthy façade; no adapter/UI |
| `PrivacyLifecycleService` | Departure grace, delete/anonymize, retention, deferral and purge | Lifecycle repository/processor/clock ports | At risk: standalone, invalid-date/helper concerns |

## Persistence and Support Components

| Component | Responsibility | Dependencies | Health |
|---|---|---|---|
| Access in-memory adapters | Users, grants and audit test storage | Native maps/arrays | Healthy for tests only |
| Directory in-memory adapters | Family storage, transaction snapshot, audit capture | Native maps/arrays | Healthy for tests only |
| Coordination in-memory adapters | Fixed task lookup, assignment/swap state, event/audit capture | Native maps/sets/arrays | Healthy for tests; tasks cannot be saved/listed |
| Import in-memory repository | Preview/conflict/staging/publication state | Native maps/arrays | Healthy for unit tests; external atomicity not modeled |
| Notification in-memory store | Notifications and attempts | Native arrays | Healthy for tests only |
| Parent in-memory repository | Assignment/notification projections | Native arrays | Healthy for tests only |
| Supabase migration | Tables, auth RPCs and RLS policies | PostgreSQL/Supabase auth context | At risk: partial schema, limited constraints/indexes, no tests |
| GitHub Actions CI | Install, typecheck, coverage, high-severity audit, SHA recording | Node 24, npm, GitHub Actions | Healthy baseline; lacks delivery/build/migration checks |
| Source and QA material | Product inputs and prior quality evidence | Repository files | Support-only; not runtime code |

## Missing Components

| Missing component | Required responsibility | Architectural placement |
|---|---|---|
| Browser application | Render Hungarian task list/create form and accessible states | Delivery adapter |
| Composition root | Instantiate feature contract, store and UI dependencies | Application bootstrap |
| Task application contract | List/create titled tasks with typed validation outcomes | Feature/application boundary |
| Writable task store | Deterministic seed, list and save operations | In-memory adapter for active intent |
| Browser build/dev tooling | Bundle/serve source and produce a verifiable artifact | Tooling boundary |
| Production repositories | Persist domain aggregates with defined transactions | Infrastructure adapters, future scope |
| Assignment event consumer | Translate assignment changes to reminders/projections | Integration/application component, future scope |
| Observability adapters | Structured logs, metrics, traces and job/audit failure signals | Cross-cutting infrastructure, future scope |

## Dependency Hotspots

Access is the main upstream/fan-out component and therefore the highest-impact contract boundary. Directory visibility is shared by coordination and parent experience. Import migration feeds admin conflict work. Notifications and privacy lifecycle are currently separate ways: neither is wired into coordination or a delivery flow. The missing composition root prevents runtime dependency cycles but also means integration compatibility is unproven.

