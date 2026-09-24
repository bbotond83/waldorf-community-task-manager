**Collaborator:** aidlc-developer-agent

## Contribution

The story set is implementable as a local-delivery increment only if its unresolved contracts are treated as real prerequisites rather than implementation details. The strongest parts are the explicit synthetic-versus-real-target boundary, the preservation of existing module ports, and the observable authorization, privacy, failure, and recovery outcomes. The stories do not decompose work by Next.js page, API layer, database layer, or test framework, so they generally avoid framework-layer task stories.

### Implementability and dependencies

- **FR-LR-14 is a blocking dependency, not merely a trace.** US-LR-03, US-LR-05, US-LR-06, and US-LR-07 all require an approved role × scope × route × action × resource × field matrix, while Requirements still lists completion and approval of that matrix as an open design question. Those stories cannot receive stable acceptance fixtures, route guards, field projections, or negative-test estimates until the matrix is versioned and approved.
- **The adapter-selection boundary must be decided before US-LR-02 and the role journeys are implemented.** Requirements leaves the synthetic-versus-Supabase composition mechanism open. The implementation contract should select adapters at the composition root, keep synthetic adapters contract-compatible with production ports, and ensure synthetic mode cannot be enabled by production configuration.
- **Application-facing query/view contracts are an explicit discovery dependency.** US-LR-04 through US-LR-06 should map each read and mutation to an existing domain public contract or to a named contract addition. UI/server components must not reproduce eligibility, authorization, lifecycle, import, reminder, or approval rules. Missing read projections should be added behind the owning module's port rather than exposing persistence models.
- **The current dependency chain is directionally sound but over-serializes delivery.** After US-LR-01 and a thin identity/shell seam, Parent, Staff, and Administrator slices can be developed independently against stable ports and synthetic fixtures. US-LR-07 and US-LR-08 should accumulate evidence per completed slice instead of waiting for all three journeys before any security or browser checks begin.
- **The inherited-story references obscure bounded scope.** US-LR-04 and US-LR-06 cite multiple inherited stories and large requirement inventories without restating the precise locally executable scenarios. Implementation should not estimate them as single stories based on those references alone; each child slice needs a finite scenario list and named contract dependencies.

### Relative sizing and split recommendations

| Story | Size | Developer assessment |
|---|---:|---|
| US-LR-01 | M | Coherent technical-enablement slice; package/runtime validation, development start, production build/start, smoke, and runbook can be accepted together. |
| US-LR-02 | M | Bounded if session reset, profile scope, production exclusion, and adapter selection are one identity boundary. |
| US-LR-03 | L | Implementable after FR-LR-14; shell accessibility and role navigation are cohesive, but cross-role authorization fixtures add material breadth. |
| US-LR-04 | XL | Must split by independently testable parent outcomes: duties/signup; swap/cancellation lifecycle; reminder/notification visibility; privacy/negative authorization. |
| US-LR-05 | M | Good vertical slice with read, empty/failure recovery, field filtering, and denial behavior. |
| US-LR-06 | XXL | Must split before delivery planning at least into scoped records, task/event and assignment, approvals, import/recovery, reminders, archive/lifecycle, and settings/governance; apply Group/Kindergarten/Super scope variants to each relevant slice. |
| US-LR-07 | L | Cross-cutting evidence capability; implement incrementally alongside each role slice. Real-target checks remain explicitly outstanding. |
| US-LR-08 | L/XL | Gate size depends on existing tooling; separate automated local CI/browser evidence from the externally provisioned Safari release-evidence activity. |
| US-LR-09 | M | Bounded handoff slice once earlier evidence exists; fresh-checkout verification should be executed by an independent environment/person. |

US-LR-04 and US-LR-06 are not independently testable at their current breadth and should not be deferred as single items merely because Delivery Planning may split them later. Splitting now preserves traceability and produces acceptance-sized work.

### Framework-task boundary

US-LR-02 through US-LR-06 are user-observable workflow slices despite using synthetic infrastructure. US-LR-01, US-LR-07, US-LR-08, and US-LR-09 are legitimate delivery-enablement outcomes for the Developer/Product Owner, but they are not vertical product-value stories. Label them explicitly as **enabler/evidence stories** and keep their criteria outcome-based. Do not decompose them into stories such as "install Next.js," "create middleware," "build repositories," or "configure Playwright"; those belong in design and delivery tasks.

## Positions

1. **Split US-LR-04 and US-LR-06 before approval or estimating delivery.** Their current scenario breadth is epic-sized and contradicts the claim that every delta story is independently testable.
2. **Treat approval of FR-LR-14 as a hard predecessor** for role navigation, staff/admin authorization, field filtering, and negative evidence; do not let implementation invent the matrix.
3. **Retain the existing-domain integration rule as non-negotiable:** every route/action maps to an existing public port or an explicit owning-module contract addition; framework code performs composition and translation, not business decisions.
4. **Recast US-LR-01/07/08/09 as enabler/evidence stories.** They are valuable and testable, but calling every item a vertical workflow slice overstates their product independence.
5. **Move security, accessibility, and browser evidence left.** Build the relevant US-LR-07/08 assertions with each Parent, Staff, and Administrator child slice; keep the final gate as aggregation and fresh-environment verification.
6. **Keep real-target evidence outside synthetic completion.** Supabase RLS/persistence, scheduler/provider behavior, Safari execution availability, and Vercel deployment evidence must remain outstanding until exercised against their actual targets; local adapters cannot satisfy them.
