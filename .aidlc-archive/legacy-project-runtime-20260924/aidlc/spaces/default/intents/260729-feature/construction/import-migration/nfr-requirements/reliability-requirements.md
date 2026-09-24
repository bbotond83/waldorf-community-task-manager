# Reliability Requirements

## Integrity

Commit is atomic and idempotent. Confirmed defects freeze the run, roll back to prior state, and require corrected preview/re-import; outcome evidence is redacted and access-controlled.

## Verification

Run interruption, repeated-workbook, changed-row, rollback, and recovery drills.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
