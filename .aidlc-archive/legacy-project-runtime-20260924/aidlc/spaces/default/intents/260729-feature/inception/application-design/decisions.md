# Architecture Decisions

## ADR-01 Modular Monolith

**Context:** MVP requires coordinated privacy, import, and workflow transactions. **Decision:** Next.js modular monolith with domain modules. **Consequences:** simpler deployment and atomic workflows; module interfaces preserve future extraction. **Alternative rejected:** microservices add operational complexity. **Reversibility:** moderate.

## ADR-02 Defense-in-Depth Authorization

**Context:** sensitive family data needs immediate scoped protection. **Decision:** server domain authorization plus Supabase RLS. **Consequences:** policy tests at both boundaries. **Alternative rejected:** single-layer checks. **Reversibility:** low.

## ADR-03 Durable Jobs

**Context:** reminders, privacy lifecycle, and recovery must survive requests. **Decision:** database-backed idempotent jobs and scheduled workers. **Consequences:** observable retries and recovery. **Alternative rejected:** browser timers/synchronous processing. **Reversibility:** moderate.
