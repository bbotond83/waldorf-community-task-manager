# Admin Core Web Technology Decisions

## Sources

Implements [business logic](../functional-design/business-logic-model.md), approved [requirements](../../../../inception/requirements-analysis/requirements.md), and extends the brownfield [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

## Selections

- Next.js App Router server components for authorized page loads; server actions/route handlers for mutations.
- React client components only for progressive disclosure, pending/focus enhancement, and responsive interactions.
- Shared application façade types and runtime AppShell/form/state primitives.
- CSS modules/global tokens; native HTML tables/forms/details/dialog patterns before custom ARIA.
- Playwright/axe critical role flows plus component/route integration tests; domain rules remain in existing Node tests.

## Constraints

No direct repository/Supabase/domain-adapter import, no client role-based policy, no raw exceptions, no generic dashboard substitute. No deployment configuration belongs to this unit.

## Acceptance

All core routes/states compile and render from authorized models, pass keyboard/zoom/mobile/browser/accessibility/security tests, meet the local two-second target, and retain required coverage.
