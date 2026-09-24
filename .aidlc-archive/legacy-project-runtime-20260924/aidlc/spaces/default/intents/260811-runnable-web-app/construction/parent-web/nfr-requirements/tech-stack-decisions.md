# Parent Web Technology Decisions

## Sources

Implements [business logic](../functional-design/business-logic-model.md), [requirements](../../../../inception/requirements-analysis/requirements.md), and extends [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

## Selections

Next.js server components/actions, React client islands for pending/disclosure/focus, shared façade/runtime components, CSS modules/tokens, native semantic forms/cards/details, Playwright/axe plus route/component integration tests.

## Constraints

No direct domain adapter/repository/Supabase import, raw token/error/provider content, or client-owned authorization/eligibility. No deployment configuration.

## Acceptance

All invitation/auth/parent routes and states render accessibly, meet performance/privacy contracts, pass critical browsers/a11y/security/coverage, and build/start locally.
