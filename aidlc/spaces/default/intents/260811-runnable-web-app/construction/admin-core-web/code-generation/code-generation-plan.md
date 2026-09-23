# Administrator Core Web Code Generation Plan

## Scope

Implement the complete scoped administrator core surface inside the existing Next.js modular monolith. The unit consumes authorized application façade models and owns dashboard, records, tasks/events, assignments/capacity, approvals, archive/restore, event notes, responsive presentation, and explicit outcome states. It does not own domain rules, repositories, advanced import/reminder/governance/lifecycle workflows, or deployment.

## Plan

- [x] **Step 1 — Establish administrator route layout and authorized shell integration.** Add `/admin` route group/layout, scope-aware Hungarian navigation, safe home routing, loading/error/denied states, one-H1/main/status structure, and generic deep-link denial without protected counts or fields. Trace: US-LR-03, US-LR-06a1, FR-LR-07/10/14.
- [x] **Step 2 — Implement dashboard and shared administrator presentation primitives.** Add bounded independent dashboard panels, scope/filter context, responsive collection/table-card components, async state panels, error summary, mutation controls, pagination/filter utilities, and stable `data-testid` attributes. Trace: US-LR-06a1, NFR-LR-03/04.
- [x] **Step 3 — Implement scoped records and archive/restore routes.** Add list/filter/detail/create/edit flows for permitted record families, explicit loading/empty/validation/pending/success/denied/retryable/terminal states, expected-version/idempotency actions, archive list/detail, restore conflict, and safe state preservation. Trace: US-LR-06a1/06a2, inherited US-05/06, NFR-08 archive.
- [x] **Step 4 — Implement task/event and assignment/capacity routes.** Add scoped task/event list/detail/forms and assignment actions using façade results for eligible/ineligible/full/conflict/stale/denied/dependency outcomes; prevent duplicate pending mutations and keep filters/context. Trace: US-LR-06b1/06b2, inherited US-05, FR-LR-03/10.
- [x] **Step 5 — Implement approval queue, detail, and exact decision outcomes.** Add filters, selection/detail, protected-reason projection, approve/reject server actions, and exact `approved`, `rejected`, `already-decided`, `invalidated`, `denied`, retryable, and terminal render/retry contracts using the original idempotency key. Trace: US-LR-06c, inherited US-06.
- [x] **Step 6 — Implement event participant notes and authorization-negative rendering.** Add authorized allergen/supply/food/contribution note views/actions, Parent/Admin field differences, Group Administrator import navigation absence/direct denial, outside-scope and crafted-ID cases, and no forbidden fields in DOM/accessibility output. Trace: US-LR-04f, US-LR-06h, inherited US-07, FR-LR-14.
- [x] **Step 7 — Add synthetic administrator façade adapters and fixture scenarios required by core routes.** Extend deterministic synthetic composition with invented scoped dashboard/record/task/assignment/approval/archive/note data, version/idempotency changes, conflicts, revocation, and classified failures through existing application ports only. Trace: US-LR-06a1–06c, FR-LR-04/10a, NFR-LR-05.
- [x] **Step 8 — Add Standard-strategy component, route, and action tests.** Cover each administrator role/scope, permitted and forbidden navigation/routes/actions/fields, representative success plus at least two edge/failure cases for each core component, exact approval outcomes, duplicate/idempotency/version behavior, next-request revocation, redaction, focus/announcement, mobile/card and 200%-zoom semantics. Trace: US-LR-06a1–06c/07/08, NFR-LR-02/03/05/07.
- [x] **Step 9 — Extend Playwright critical Administrator Core flows.** Exercise Group Administrator in-scope record/task/assignment/approval success, outside-scope and import denial, archive/restore conflict, keyboard/focus, Chromium/Firefox/mobile Chrome, axe serious/critical gate, and two-second synthetic response evidence. Trace: Bolt 3 demo/DoD, NFR-LR-03/04/07.
- [x] **Step 10 — Validate and summarize Administrator Core.** Run format, lint, strict typecheck, focused/aggregate tests and coverage, production build, start smoke, and focused browser suite on Node 24 where required; fix unit-owned failures; mark steps complete; record files, decisions, evidence, coverage, and deviations in `code-summary.md`. Trace: NFR-LR-02/06 and Bolt 3.

## Boundaries

- UI and server actions consume authorized application façade contracts only; no repository, Supabase, raw aggregate, or domain-adapter import.
- Group Administrator import and super-administrator governance remain absent/denied; advanced workflows belong to `admin-advanced-web`.
- Synthetic fixtures contain invented identifiers and no contact, optional-profile, protected-reason, or unrelated-scope leakage.
- No executable deployment workflow or target invocation is added.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback after two pinned-model dispatch failures)

**Verdict:** READY

The plan and summary align with the scoped administrator contracts: route and action authorization use the façade, client models are allowlisted, mutations carry version/idempotency controls, and Group Administrator import/governance access is denied. Tests cover negative scope cases, exact approval outcomes, privacy, and recovery; aggregate production coverage exceeds the affirmed threshold. Advanced workflows remain assigned to their separate unit, and no deployment action is introduced. No blocking mismatch was found.
