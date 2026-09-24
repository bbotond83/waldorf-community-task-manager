# Technology Stack Decisions

## Decisions

Use durable Supabase staging/run records, authenticated worker processing, and EU-region storage; Next.js provides admin preview routes.

## Rationale

This supports immutable preview, idempotency, audit, and recovery requirements.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
