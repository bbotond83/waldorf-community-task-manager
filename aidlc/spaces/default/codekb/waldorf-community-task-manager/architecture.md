# Architecture Analysis

## System Overview

The repository is one private npm package and a single Next.js App Router application. App Router pages, layouts, server actions, and route handlers form the delivery layer. Runtime/session composition selects a synthetic or production composition. Role façades and shared application contracts coordinate in-process domain modules through typed ports. The linked local route ends in deterministic in-memory adapters.

The production composition is a configuration-validating placeholder. It labels Supabase unlinked, performs no target call, and has no live authorization-version source. The SQL migration and narrow RPC adapter do not make the application production-backed.

## Architectural Style

**Observed:** modular monolith with one deployable package, domain-oriented source modules, typed application contracts, and partial ports-and-adapters separation. There are no npm workspaces, separate services, or public package API. UI/server routes call in-process TypeScript façades; injected repository, authorization, audit, clock, queue, provider, and event ports mark infrastructure seams.

### Evidence and Alternatives

This is an observed architecture, not a new decision to adopt a future topology. The modular-monolith interpretation is supported by one npm package, one App Router deployment surface, in-process facade/domain calls, and no separately deployable services. A microservice split is not evidenced; it would add network, consistency, deployment, and observability costs before independent service ownership or scaling needs have been established. A thin layered CRUD interpretation also misses the distinct domain services and injected ports present in source. The present monolith keeps local integration simple, while its limitation is that modules cannot be deployed or scaled independently.

The current synthetic/production separation is likewise an implementation boundary, not proof of a production-ready adapter. Synthetic mode enables deterministic local flows; the unlinked production slot limits accidental external calls, but creates a readiness risk if local behavior is mistaken for durable production behavior. Personal data and RLS must be verified only against a separately approved linked target; this scan did not open the workbook or inspect family/child records.

## Component Relationships

See component-inventory.md for the named ownership areas and responsibility details.

~~~mermaid
flowchart LR
  User[Parent Staff or Administrator] --> Browser[Browser]
  Browser --> App[Next.js App Router]
  App --> Runtime[Runtime and session composition]
  Runtime --> Facade[Role experience facade]
  Facade --> Contracts[Application contracts validation and results]
  Contracts --> Domain[Domain modules]
  Domain --> Ports[Injected repository authorization audit clock queue provider event ports]
  Ports --> Synthetic[Deterministic in-memory synthetic adapters]
  Runtime -. configuration only .-> Production[Unlinked production composition]
  Production -. no target call .-> External[Supabase scheduler providers deployment]
~~~

Text fallback: browser requests and actions enter the Next.js delivery layer, which selects a role/runtime facade and typed application contracts. Domain services call injected ports. The active local path resolves to synthetic in-memory adapters. The production composition only validates settings and does not connect those ports to external targets.

## Interaction Diagrams

### Synthetic Role Read and Mutation

~~~mermaid
sequenceDiagram
  actor User
  participant Browser
  participant App as Next.js App Router
  participant Runtime as Runtime composition
  participant Facade as Role facade
  participant Contract as Application contract
  participant Domain as Domain service
  participant Adapter as Synthetic adapter
  User->>Browser: Open a role page
  Browser->>App: Request page
  App->>Runtime: Resolve mode and session
  Runtime->>Facade: Select role experience
  Facade->>Contract: Load projection
  Contract->>Domain: Query role workflow
  Domain->>Adapter: Read synthetic state
  Adapter-->>Domain: Fixture or in-memory result
  Domain-->>Contract: Domain result
  Contract-->>Facade: Typed projection
  Facade-->>App: Page data
  App-->>Browser: Render UI
  User->>Browser: Submit form
  Browser->>App: Invoke server action
  App->>Facade: Dispatch role action
  Facade->>Contract: Validate and authorize command
  Contract->>Domain: Execute command
  Domain->>Adapter: Mutate synthetic state
  Adapter-->>Domain: Result
  Domain-->>Contract: Explicit result state
  Contract-->>App: Mapped action result
  App-->>Browser: Updated UI state
~~~

Text fallback: the browser invokes an App Router page or server action. Runtime composition selects a role facade; application contracts validate and authorize the request and call a domain service. In the current local mode, the service reads or mutates synthetic state and returns a typed result for UI mapping.

### Production Boundary

~~~mermaid
flowchart TD
  Production[Production composition] --> Config[Validate runtime configuration]
  Config --> Port[Authorization version port]
  Port --> Undefined[Returns undefined]
  Config -. no outbound call .-> Supabase[Supabase target]
  Config -. unlinked .-> Scheduler[Scheduler and notification providers]
  Config -. not configured .-> Deploy[Deployment target]
~~~

Text fallback: production composition validates settings, but its authorization-version port returns undefined and it makes no outbound call. Supabase, scheduler/providers, and deployment remain unlinked.

## Data Flow and Ownership

- App Router pages/actions use role-specific facades and shared application contracts.
- Domain services own access, directory, coordination, import/migration, notifications, and privacy/audit rules.
- Synthetic composition wires deterministic local profiles and in-memory stores.
- The single SQL migration declares role/version tables, scoped placeholders, authorization RPCs, and RLS policies. No complete domain persistence adapter or migration runner was found.
- Notification and coordination event/job concepts are expressed behind ports; no external queue, event broker, or provider is linked.

## Risks and Follow-up

- Complete and exercise production authentication, persistence, RLS, scheduler/provider, and deployment integrations before production-readiness claims.
- Keep the synthetic/production boundary explicit. Confirm data ownership and transaction semantics when a durable adapter is designed.
- Current CI has validation and provenance work but no deploy job.
- All architectural conclusions are static; no runtime or integration checks were performed.
