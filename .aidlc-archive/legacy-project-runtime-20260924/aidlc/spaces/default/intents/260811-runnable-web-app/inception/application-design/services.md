# Services and Runtime Composition

## Service Model

The runtime implements the approved [requirements](../requirements-analysis/requirements.md) and [stories](../user-stories/stories.md), respects the CodeKB [architecture](../../../codekb/waldorf-community-task-manager/architecture.md) and [component inventory](../../../codekb/waldorf-community-task-manager/component-inventory.md), and follows [team practices](../practices-discovery/team-practices.md).

One Next.js process hosts server-rendered routes, route handlers/server actions, application façades, and the existing domain modules. This is a modular monolith, not a distributed service topology.

## Request Lifecycle

1. Delivery adapter parses and normalizes transport input.
2. `SessionGateway` resolves the synthetic or production session.
3. `AuthorizationContract` evaluates the stable matrix row and scope.
4. Role-specific application façade orchestrates existing domain service calls.
5. Domain/application result maps to the shared screen-state union.
6. `ScreenModelFactory` removes prohibited fields and selects safe Hungarian presentation keys.
7. Delivery component renders or serializes the result; `EvidenceRecorder` records only redacted metadata.

The browser never calls repositories or Supabase directly.

## Synthetic Local Service Set

- Versioned fixture registry with invented families, roles, grants, duties, requests, import runs, reminders, and lifecycle cases.
- Existing in-memory repositories plus focused adapters for missing list/save/job/session contracts.
- Injected deterministic clock and ID/idempotency source.
- Failure-scenario registry capable of retryable and terminal dependency outcomes without external services.
- Simulated email/job/provider outcomes labelled synthetic.
- Test-only reset endpoint protected by build-time/runtime synthetic-mode guards.

Synthetic mode requires no paid service, real credential, or staging/production network access.

## Production Adapter Slots

The production composition validates Supabase URL/keys and provider configuration, uses the approved authentication boundary, and omits all synthetic endpoints/components. Supabase repositories/RLS, scheduler, transactional email, and Vercel deployment are replaceable adapters behind the same application ports. They are not claimed verified or invoked by this local intent.

## Orchestration and Events

User requests use synchronous in-process commands/queries. Assignment changes publish durable application events consumed by `JobCoordinator` to replace/cancel reminders. Import interruption and privacy lifecycle create durable recovery jobs. Synthetic mode executes the same event contracts through deterministic in-memory queues; linked environments use durable persistence and scheduled workers.

Every event/job carries event ID, aggregate ID/version, occurred-at time, idempotency key, type, and privacy-safe payload. Consumers record success, retry scheduled, cancelled/stale, or terminal failure. Duplicate delivery produces at most one domain effect.

## Lifecycle and Scaling

Local development runs one process. Production-compatible build output remains stateless at the web handler boundary; durable state/jobs belong in Supabase-backed adapters. The modular monolith can scale web instances independently once shared persistence exists. No AWS service is introduced because Vercel/Supabase are the approved targets.

## Reliability and Security

- Authorization runs on every route/action/resource request; client visibility is not enforcement.
- Immediate revocation rejects stale authorization versions and clears protected cache/navigation.
- Validation is shared across UI/API/invitation/profile/import entry points.
- Adapter exceptions become retryable or terminal dependency results at the application boundary.
- Logs/evidence exclude secrets, raw provider bodies, contact values, optional profiles, protected reasons, and unrelated-family data.
- A deterministic start-smoke endpoint proves readiness without bypassing authentication or exposing operational secrets.

## Deployment Boundary

The service can be built and started in production mode locally for smoke testing. No executable deployment workflow is enabled, no Vercel/Supabase target is linked by this stage, and no staging/production deployment occurs. Future eligible staging and protected manual production promotion follow the affirmed practice only after linked-target gates pass.

