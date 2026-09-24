# Scalability Requirements

## Capacity

Use streamed/batched staging and indexed source hashes; never load the full workbook into an interactive request transaction.

## Trigger

Split parsing/validation workers when preview delay threatens the recovery objective.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
