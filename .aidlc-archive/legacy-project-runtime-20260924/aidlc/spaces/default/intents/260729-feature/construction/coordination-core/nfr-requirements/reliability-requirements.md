# Reliability Requirements

## Integrity

Swap/assignment mutations are atomic; conflict or failure changes neither assignment. Durable events replace reminders after commit and retain redacted audit evidence.

## Verification

Run competing signup/swap/cancellation tests and assert transaction rollback.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
