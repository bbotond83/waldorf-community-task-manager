# Staff Web Technology Decisions

## Sources

Implements [business logic](../functional-design/business-logic-model.md), [requirements](../../../../inception/requirements-analysis/requirements.md), and extends [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

## Selections

Use the approved Next.js App Router modular monolith with React server components for authorized schedule reads, small client islands only for filtering, retry, announcements, and focus behavior, shared application façades and runtime composition, CSS modules and design tokens, semantic tables/cards/forms, and Playwright plus axe-backed browser coverage.

## Constraints

Staff components never import domain adapters, repositories, Supabase clients, raw aggregates, or privileged administrator/parent models. The surface remains read-only; `APP_RUNTIME_MODE` selects one mutually exclusive synthetic or production composition; local acceptance uses synthetic data only. No deployment configuration or executable deployment action belongs to this intent.

## Acceptance

The staff list/detail, loading, empty, retryable, terminal, and denied states build and start locally; meet performance, accessibility, authorization, privacy, browser, and coverage requirements; and expose no mutation or sensitive-field path.
