# Coordination Core Functional Design Questions

## Q1 — Concurrency Rule

How should competing signup/swap/cancellation changes be applied?

- A. Use an atomic transaction with optimistic version checks; conflicting requests change nothing and return a retryable outcome. *(Recommended)*
- B. Last write wins.
- C. Queue all requests without conflict checks.
- X. Other (please specify)

[Answer]: A — Use an atomic transaction with optimistic version checks; conflicting requests change nothing and return a retryable outcome.
