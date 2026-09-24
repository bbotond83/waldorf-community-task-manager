# Notification Jobs Functional Design Questions

## Q1 — Retry Policy

How should transient reminder delivery failures be retried?

- A. Exponential backoff with bounded attempts, then dead-letter status visible to authorized admins. *(Recommended)*
- B. Retry indefinitely.
- C. Never retry automatically.
- X. Other (please specify)

[Answer]: A — Retry after 5, 30, and 120 minutes, then dead-letter status visible to authorized admins.
