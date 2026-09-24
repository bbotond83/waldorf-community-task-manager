# Technology Stack Decisions

## Decisions

Use Supabase Postgres durable job tables, scheduled authenticated workers, and an EU-compliant email adapter.

## Rationale

Durable idempotent jobs meet retry, recovery, privacy, and observability requirements.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
