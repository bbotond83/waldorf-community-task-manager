# Scalability Design: u2-first-rota-slice

How the targets in `scalability-requirements.md` are met. The load is one community with about 40 rota weeks a year, so the design is about correctness under concurrency, not capacity.

## Concurrency

| Requirement | Design |
|---|---|
| NFR5.1 | Every new command takes an idempotency key and returns the stored result for a repeated key before it changes anything, following the existing use-case template. |
| NFR5.2 | Each week row and the plan row carry a version. A change sends the version it saw; a mismatch returns VERSION_CONFLICT. |
| NFR5.3 | Publish locks first and checks the plan's state afterwards, so the second of two simultaneous publishes waits, then sees `published` and returns ROTA_PLAN_PUBLISHED. A unique index on the duty's origin means a second duty for one week cannot exist even if a check were missed. |
| NFR5.4 | Hand changes and discards take the same locks in the same order as publish, so each pair runs one after the other. |
| NFR5.5 | Lock order: every active family row of the community ascending (about 20 rows, so the set is known before any read and needs no look-up of the weeks), then the plan row, then its week rows ascending, then duty rows ascending, then place rows ascending. Every function that changes a plan takes locks in that order and only forward. Locking all active families is the deliberate way to fix the family set; the plan row's place is noted for C1. |
| NFR5.1, NFR5.5 | Two simultaneous requests for a draft get one plan: a unique index on the plan's school year stops a second plan row, and the loser returns ROTA_PLAN_EXISTS (BR21.1). Making a draft locks the family rows first, as every other command does. A two-at-once test for making a draft joins the fixed list. |

## Capacity

No scaling mechanism is designed. Lists stay far below the data API's 1000-row limit, and the largest set-based statement is about 40 rows.
