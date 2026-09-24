# Scalability Requirements

## Capacity

Workers claim jobs in bounded batches using indexes on state and due time; idempotency keys prevent duplicate active jobs.

## Trigger

Add workers when queue delay exceeds 60 seconds under the 30-family profile.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
