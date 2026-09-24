# Business Overview

## Purpose and Current State

The Waldorf Kindergarten Community Task Manager is intended to replace an Excel-based coordination process used by a kindergarten community. Its broader product direction covers community membership, scoped authorization, family and group directories, duties and sign-ups, administrative approvals, reminders, legacy-data migration, and privacy lifecycle management.

The repository currently implements a tested TypeScript domain library, in-memory test adapters, and a partial Supabase/PostgreSQL authorization schema. It does **not** contain a runnable web application, server, browser entry point, composition root, or production persistence layer. The README's description of a responsive application is therefore product intent, not the current implementation state.

## Users and Language

The domain recognizes five roles:

- `super_admin`
- `kindergarten_admin`
- `group_admin`
- `parent`
- `read_only_staff`

Authorization is scoped to an organization, group, or family. Technical identifiers and source code use English. User-facing denials are deliberately generic Hungarian text (`Nincs jogosultság`) to avoid leaking whether a protected record exists. The intended UI is Hungarian.

## Business Capabilities

The implemented library models these capabilities:

| Capability | Implemented behavior |
|---|---|
| Access control | Role grants and revocation, authorization-version checks, scoped authorization, redacted access audits |
| Community directory | Family, parent, child, group and school-year relationships; privacy-filtered projections; archive and restore |
| Task coordination | Capacity-aware sign-up, optimistic versions, swaps, cancellations, contribution permissions, events and audits |
| Parent experience | Assignment and notification projections plus command façades for sign-up, swap and cancellation |
| Administration | Approval/import queues, school-year views, privileged operations and archive actions |
| Staff scheduling | Privacy-minimized 31-day schedule projection |
| Notifications | Seven-day and 24-hour scheduling, cancellation, durable job dispatch and retry state |
| Legacy import | Validation of 17 required sheets, preview, conflict handling, staging, publication and rollback state |
| Privacy lifecycle | Departure grace periods, deletion/anonymization decisions, audit retention and deferral |

The main aggregate concepts are `User`, `RoleGrant`, `Family`, `Task`, `Assignment`, `ImportPreview`, `Notification`/`DurableJob`, and privacy lifecycle records. A family owns its parent and child relationships. An assignment belongs to a task and family and moves among `active`, `swap_pending`, `cancellation_pending`, and `removed` states.

## Active Intent Boundary

The active intent is narrower than the broader product direction: provide a runnable local browser experience that lists deterministic synthetic tasks and allows a task to be created locally. Live Supabase integration, authentication, real community data, the broader coordination workflows, and deployment are excluded from that intent.

That intent is blocked by missing delivery-layer capabilities: the existing `Task` contract has no title, the coordination repository cannot save or list tasks, and the repository has no UI, browser/application state boundary, composition root, validation boundary, development command, or build output. A safe evolution is a small feature-local application contract and browser adapter over synthetic in-memory data, while retaining the existing domain ports and keeping the local harness explicitly separate from production.

## Business Risks and Constraints

- Family and child data is privacy-sensitive; projections and denials must remain data-minimizing.
- Role and scope checks exist in both TypeScript and SQL but are not proven equivalent by integration tests.
- Excel migration represents a one-time, high-integrity transition; fingerprints, publication, conflict handling and rollback need stronger production semantics.
- The implemented breadth may be mistaken for production readiness because the delivery and persistence edges are absent.
- The emitted `assignment.changed` event has no consumer, so reminder or projection updates do not currently occur automatically.

