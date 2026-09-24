# Technology Stack Decisions

## Decisions

- Next.js server route handlers host protected endpoints.
- Supabase Auth and Postgres RLS provide identity and data boundary defense.
- TypeScript domain policy evaluates resource/field rules before retrieval.

## Rationale

This aligns immediate revocation, atomic policy checks, and the established Vercel/Supabase baseline.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
