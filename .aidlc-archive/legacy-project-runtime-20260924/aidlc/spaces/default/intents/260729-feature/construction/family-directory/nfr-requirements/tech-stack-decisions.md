# Technology Stack Decisions

## Decisions

Use Next.js server handlers, TypeScript domain services, and Supabase Postgres/RLS; indexes support scoped relevance queries.

## Rationale

The shared stack preserves transactional links and field-level authorization.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
