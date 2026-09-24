# External Dependency Map

## Scope and Sources

This map applies the approved [requirements](../requirements-analysis/requirements.md), [stories](../user-stories/stories.md), [mockups](../refined-mockups/mockups.md), [components](../application-design/components.md), [units](../units-generation/unit-of-work.md), [DAG](../units-generation/unit-of-work-dependency.md), [story map](../units-generation/unit-of-work-story-map.md), and [team practices](../practices-discovery/team-practices.md).

## Local Completion Dependencies

| Dependency | Owner | Lead time | Consuming Bolts | Mitigation/status |
|---|---|---|---|---|
| Node 24.x/npm 11.x and package registry | developer environment | minutes | 1–5 | enforced/documented runtime; cached lockfile install where available |
| Current Chromium/Firefox and mobile emulation | developer/CI environment | minutes | 1–5 | Playwright-managed browsers or documented available equivalents |
| Safari desktop/mobile Safari | release owner | environment-dependent | 5 release evidence | recorded BLOCKED/exception if unavailable; not silently passed |

No external API, real family data, Supabase project, provider, or Vercel project blocks synthetic local completion.

## Linked-Target Dependencies

| Dependency | Owner | Blocks | Local status |
|---|---|---|---|
| Supabase project/auth/RLS/database migrations | future platform/release owner | real auth/RLS/persistence/transaction release evidence | OUTSTANDING |
| Transactional email provider | future release owner | real delivery/idempotency/retry evidence | OUTSTANDING |
| Durable scheduler/worker target | future platform owner | real reminder/lifecycle/recovery job evidence | OUTSTANDING |
| Linked Vercel project/environment protection | future release owner | preview/staging and protected production promotion | OUTSTANDING |

These items do not trigger deployment in this intent. Future staging may be automatic only after gates and linkage; production remains protected and manual.

