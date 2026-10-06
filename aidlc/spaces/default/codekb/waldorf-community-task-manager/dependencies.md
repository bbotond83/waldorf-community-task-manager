# Dependencies

## External Dependencies

Framework/validator/tool versions and purposes are listed once in [technology-stack.md](technology-stack.md). npm lockfile is the reproducibility boundary because several declarations use `latest`. Only direct resolutions were inspected; no transitive vulnerability audit was performed. Next ESLint's scoped `fast-glob` replacement uses `tinyglobby@0.2.17` with compatibility regression coverage in source.

Application code has no discovered external backend SDK. Supabase access uses an injected RPC client contract. Node crypto implements local synthetic session signatures; live identity/provider calls are absent from the inspected shared login chain.

## Internal Dependencies

One npm application; no cross-workspace packages. Route/layout/action code consumes runtime/role-boundary helpers and application facades. Runtime selects synthetic or unlinked production composition. Facades consume typed domain/access contracts and injected parent/staff/admin/session adapters. Legacy domain services depend on repositories, authorizers, events/audit, clocks and provider/queue ports. See [architecture.md](architecture.md) and [component-inventory.md](component-inventory.md) for the dependency map and owners.

## Coupling and State Risks

Synthetic composition imports the application barrel; compilation/import breadth is a candidate timing surface, not a measured bottleneck. Parent module state/cache and admin process-global state couple requests within one process without persistence across processes. The root shell's static profile navigation and business admin dynamic revocation differ in execution path. Synthetic ports and legacy domain services are separate implementations; tests of one cannot prove the other.

## Integration Boundaries

Persistence, notification provider/scheduler, Supabase auth/RLS and deployment targets remain outstanding. CI is wired to canonical local verification; the explicit login performance command is outside that chain. No real-target readiness or deployment availability was established.
