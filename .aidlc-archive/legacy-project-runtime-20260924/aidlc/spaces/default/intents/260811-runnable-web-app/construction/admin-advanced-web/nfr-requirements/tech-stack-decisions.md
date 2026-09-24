# Administrator Advanced Web Technology Decisions

## Sources

Implements [business logic](../functional-design/business-logic-model.md), approved [requirements](../../../../inception/requirements-analysis/requirements.md), and extends the brownfield [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

## Selections

Use Next.js App Router server components for authorized reads and server actions/route handlers for import, retry, grant, lifecycle, recipient, and settings commands. React client islands provide file selection, progressive disclosure, step/pending/focus behavior only. Shared admin façades, `ApplicationResult`, runtime composition, AppShell/form/state primitives, CSS tokens/modules, semantic native controls, Playwright/axe browser flows, and existing domain Node tests form the implementation boundary.

## Constraints

No UI import of repositories, Supabase/provider clients, raw domain aggregates, job stores, workbook parsing internals, or authorization policy. Synthetic adapters deterministically model commit/recovery/jobs/revocation/lifecycle outcomes; production composition is mutually exclusive and not exercised here. No deployment configuration or action belongs to this unit or intent.

## Acceptance

All advanced routes and explicit states build and start locally, preserve idempotency/recovery and privacy boundaries, pass performance/accessibility/browser/security/coverage gates, and label Supabase/provider/Safari/hosted-target verification as outstanding.
