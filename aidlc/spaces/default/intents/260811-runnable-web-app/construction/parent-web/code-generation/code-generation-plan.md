# Parent Web Code Generation Plan

## Scope

Implement the complete inherited Parent acceptance journey in the shared Next.js runtime using authorized application façade models only. The unit owns invitation/authentication entry, linked-family duties and signup, swap/cancellation requests, notifications, own contribution notes, responsive/accessibility states, and synthetic scenarios. It does not own domain rules, persistence, administrator workflows, or deployment.

## Plan

- [x] **Step 1 — Implement invitation and authentication entry routes.** Add `/meghivas/[token]` and `/belepes` with valid/expired/used/invalid invitation states, non-enumerating resend, authentication success/failure, intended destination, upcoming-duty notice, empty destination, safe focus/announcements, and stable `data-testid` controls. Trace: US-LR-04e, inherited US-14, FR-LR-04/10a.
- [x] **Step 2 — Implement Parent route shell and duty collection/detail views.** Add `/szulo/feladatok` and detail routes with authorized linked-family projections, loading/empty/available/full/ineligible/assigned states, URL filters/context preservation, semantic card/list rendering, and unrelated-family generic denial. Trace: US-LR-04a, inherited US-01/02, FR-LR-08/14.
- [x] **Step 3 — Implement eligible signup action and exact failure states.** Add server action with session re-resolution, origin/input/version/idempotency validation, immediate pending/duplicate disable, one-effect success, full/ineligible/conflict/invalidated/denied/retryable/terminal results, original-key retry, and targeted revalidation. Trace: US-LR-04a, inherited US-01/02.
- [x] **Step 4 — Implement swap and cancellation request flows.** Add dedicated request detail/forms, protected reason input boundaries, validation summary, pending/success/rejected/conflict/invalidated/denied/dependency states, safe back/context recovery, and no unrelated assignment/family exposure. Trace: US-LR-04b, inherited US-03/04.
- [x] **Step 5 — Implement notification centre and reminder states.** Add `/szulo/ertesitesek` list/read/link actions, unread/read/stale/cancelled/empty states, Hungarian timing/status, simulated-provider label, idempotent read, authorized links, and provider-error redaction. Trace: US-LR-04c/04e, FR-LR-10a.
- [x] **Step 6 — Implement Parent contribution-note behavior.** Add permitted allergen visibility and own-note editing on event detail, field-specific authorization, safe validation/idempotency, admin-owned fields excluded, and denied Staff/unrelated attempts unchanged and redacted. Trace: US-LR-04f, inherited US-07.
- [x] **Step 7 — Extend deterministic Parent synthetic adapters and fixtures.** Add invented families/duties/assignments/requests/invitations/notifications/events, success and every named business/dependency state, reset support, version/idempotency transitions, and simulated provider status through façade ports only. Trace: US-LR-02/04a–04f, NFR-LR-05.
- [x] **Step 8 — Add Standard-strategy component, route, and action tests.** Cover invitation enumeration resistance, linked/unrelated privacy, each duty/request/notification/note state, representative success plus two edge/failure cases per component, duplicate/idempotency, revocation, XSS/output encoding, forbidden-field DOM/accessibility/log absence, focus and announcements. Trace: US-LR-04a–04f/07/08, NFR-LR-02/03/05.
- [x] **Step 9 — Extend Playwright critical Parent flows.** Exercise profile selection, invitation/auth entry, duty signup, full/ineligible denial, swap/cancellation outcomes, notification read/link, contribution note allow/deny, retry, keyboard/focus/zoom/mobile behavior, axe gate, and two-second response target across Chromium/Firefox/mobile Chrome. Trace: Bolt 1 Parent demo, NFR-LR-03/04/07.
- [x] **Step 10 — Validate and summarize Parent Web.** Run format, lint, strict typecheck, focused/aggregate tests and coverage, production build, start smoke, and Parent browser suite on Node 24; fix unit-owned failures; mark steps complete; document files, decisions, evidence, coverage, and deviations in `code-summary.md`. Trace: NFR-LR-02/06 and Bolt 1.

## Boundaries

- Routes/actions import Parent/session application façades and authorized models only, never repositories, Supabase, raw aggregates, or provider clients.
- Unrelated-family, contact, optional-profile, protected-reason, and raw provider/error data never enter unauthorized props, HTML, accessibility output, logs, screenshots, or evidence.
- Provider and persistence effects are deterministic and explicitly labelled synthetic; linked-target evidence stays `OUTSTANDING`.
- No executable deployment workflow or target invocation is added.
