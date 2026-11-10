# Scalability Design: u1-community-foundation

How `scalability-requirements.md` is met, following `functional-spec.md`, `tech-stack-decisions.md` and the lock order in C1 of `contract-summary.md`. The app is one process and one database for one community, so no scaling mechanism is designed.

## Concurrency Design

| Requirement | Design |
|---|---|
| NFR5.1 | Every changed or new command keeps the platform idempotency check, so a repeated key returns the stored result. |
| NFR5.2 | `structure_save` compares the expected version under a row lock; the later writer gets the conflict result. |
| NFR5.3 | Removing the membership check leaves the task-row lock and the deferred capacity trigger untouched, and both work the same for a task with no group. |
| NFR5.4 | No lock is added or reordered. Family row, then task rows ascending, then assignment rows ascending. |

Revoking a grant while an administrator acts needs no lock: the command sees the grant as it stands when it runs, and the next request sees the revocation.
