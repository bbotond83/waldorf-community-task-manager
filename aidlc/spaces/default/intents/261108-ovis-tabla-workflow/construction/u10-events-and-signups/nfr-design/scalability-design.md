# Scalability Design: u10-events-and-signups

How the targets in `scalability-requirements.md` are met, following `functional-spec.md` and C1 in `contract-summary.md`. One community with about 30 events a year needs no scaling mechanism; the design is about correct behaviour when two people act at once.

## Locking

Every command that changes an event or its rows takes the event row first, then its notice, role, sign-up and offer rows by ascending id, then task rows ascending (NFR5.6). Sign-up and offer commands never lock a family row, so they cannot meet a family-first command in the opposite order. The cancel command takes the event row, so an add that arrives meanwhile waits and then sees the closed event (NFR5.4).

Row-based commands (change and withdraw of a sign-up or offer, a manager's removal, role clear) first read the row's event id without a lock, lock the event row, then lock the row and re-check that it still belongs to that event. The removal pair locks the event rows it touches in ascending id order, then their sign-up, offer and role rows ascending. Closing tasks on cancel locks the open task rows in ascending id order after the event row.

## Repeated and concurrent actions

| Requirement | Design |
|---|---|
| NFR5.1 | Each command takes an idempotency key and stores its result; a repeat returns it. |
| NFR5.2 | The limits (10 sign-ups, 20 offers) are counted after the event lock is held, so the last allowed add succeeds for one caller and the other is refused. |
| NFR5.3 | Saving notices checks the event's version under the lock; the second saver gets VERSION_CONFLICT. Positions are rewritten as 1 up to the count in the same statement. |
| NFR5.5 | A change and a withdraw both lock the sign-up row after the event row and check its version; the loser gets VERSION_CONFLICT or not found. |

## Capacity

The 1000-row limit of the data API is not reached because each read returns one document.
