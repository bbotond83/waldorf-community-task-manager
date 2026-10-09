# External Dependency Map

## Delivery Dependencies

A Bolt is one build pass over a piece of work, ending in a verifiable result. The three planned Bolts deliver local code/migration artifacts in one integrated application release. No new partner API or external-team handoff is needed for that scope. Existing local verification tooling is required but has not been exercised during planning.

| Dependency | Owner | Lead time | Affected milestone | Fallback / status |
| --- | --- | --- | --- | --- |
| Node 24/npm 11 and installed locked dependencies | Local development environment; developer checks availability | Unknown until checked | B1–B3 checkpoints and final checks | Use approved existing toolchain; obtain permission only if required installation/escalation arises; no fabricated result |
| Available local database or SQL execution tooling for populated migration evidence | Developer/quality verification environment | Unknown until inspected | B1 conversion checks; final migration evidence | Deliver artifact and bounded fixture/static evidence; label database execution unverified if unavailable; never claim static tests prove real RLS |
| Playwright browser/runtime and local app port/configuration | Developer/quality verification environment | Unknown until checked | B2 teacher flow; final integrated browser/a11y | Use existing project test setup; diagnose actual failures; no synthetic replacement for a failed browser assertion |
| Dependency registry/audit access | Existing registry tooling | Network availability unknown | Final high/critical dependency gate | Run actual existing check when authorized; report failures/blockers without treating unavailable as clean |
| Linked production auth/database/RLS/provider/Vercel targets and Safari environment | Future target/environment owner; not assigned in this local-only intent | Not scheduled | Real-target proof only; not local code generation | Keep existing OUTSTANDING evidence; no provisioning, target credentials or live migration introduced here |
| Human design/plan/checkpoint approvals | User | Response time not estimated | Applicable stage/initial plan/verified checkpoints | Respect required stops; chosen solo staffing does not imply autonomy |

No external dependency has been confirmed provisioned or tested by this document. The selected checkpoint command `npm run typecheck && npm test` has a human-authorized receipt but has not executed. Additional broad verification follows the existing final quality requirements.

## Scope Boundaries and Evidence

Existing synthetic repositories/fixtures provide local behavior; they do not establish production durability or identity. SQL migration delivery is in scope, live application is not. A real target check remains outstanding until executed against the actual authorized integration. Keep the repository private and existing unsigned CI evidence; no external signing service or deployment workflow is added. Preserve next-env.d.ts locally, historical audit/evidence and actual business records.

## Sources

[requirements.md](../requirements-analysis/requirements.md), [stories.md](../user-stories/stories.md), [mockups.md](../refined-mockups/mockups.md), [components.md](../domain-design/components.md), [unit-of-work.md](../units-generation/unit-of-work.md), [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md), [unit-of-work-story-map.md](../units-generation/unit-of-work-story-map.md), [contract-summary.md](../contract-design/contract-summary.md), [team-practices.md](../practices-discovery/team-practices.md), [delivery-planning-questions.md](delivery-planning-questions.md), package.json script inspection and [bolt-plan.md](bolt-plan.md). No API calls, tests, browser runs, installations or migrations occurred in planning.
