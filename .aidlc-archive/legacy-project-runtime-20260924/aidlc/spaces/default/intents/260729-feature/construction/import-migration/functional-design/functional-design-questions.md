# Import Migration Functional Design Questions

## Q1 — Post-Commit Defect

When a later-discovered import defect is confirmed, what recovery action applies?

- A. Freeze affected import run, present audited rollback/recovery options to an authorized admin, and restore verified service within one hour. *(Recommended)*
- B. Continue and repair rows silently.
- C. Delete all imported data automatically.
- X. Other (please specify)

[Answer]: A — Freeze affected import run, roll back to the prior state, then require a corrected preview before re-import; restore verified service within one hour.
