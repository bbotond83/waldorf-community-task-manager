# Scalability Design: u7-swaps-and-duty-changes

Sources: `scalability-requirements.md` and `tech-stack-decisions.md` of this Unit, `functional-spec.md`, and C1, C5 and C11 in `contract-summary.md`.

## Capacity

One community of about 20 families; a few dozen requests a term. Reads return one document and stay far below the data API's 1000-row limit. No scaling mechanism is added.

## Concurrency Design

| Case | Design | Requirement |
|---|---|---|
| Repeated click | The platform idempotency record returns the stored result before anything runs | NFR5.1 |
| Two proposals naming the same place | Both lock the place rows in ascending id order; the second waits, then finds the place swap_pending and is refused REQUEST_DUPLICATE. The source-side partial unique index is a backstop only | NFR5.2 |
| Acceptance against withdrawal, reassignment or another change | All lock the same place rows first; whichever commits second sees the changed version or status and is refused | NFR5.3 |
| Reversal against reassignment | The same place locks; the second sees a changed version (SWAP_CHANGED_SINCE or VERSION_CONFLICT) | NFR5.4 |
| Acceptance against a pick change (U6) | The command locks the weekend slot duty and place rows of the affected weekend in its first pass, before calling C11; U6's pick command locks the same rows, so one waits for the other | NFR5.5 |
| Daily check run twice | Once keys on the notices; the update only touches requests still open | NFR5.7 |

## Lock Order (NFR5.6)

1. Work out every row the change may touch: the two (or one) places, their duties, and, when a duty is a picking or weekend rota week, that weekend's slot duties and places.
2. Lock duty rows in ascending id order, then place rows in ascending id order, in one pass.
3. Lock the request row.
4. Call C5 and C11; their own `place_lock` and row locks find the rows already held. C11 then locks the rota week and pick rows.

No command locks a family row to check a standing (project correction of 2026-11-17). The race tests run repeatedly in the shuffled run together with U6's pick race tests to show no deadlock.
