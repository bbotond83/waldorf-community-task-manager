# Scalability Design: u6-full-rotas-and-weekend-picks

How the targets in `scalability-requirements.md` are met, following `functional-spec.md` and C1 and C9 in `contract-summary.md`. One community and one school year need no scaling mechanism; the design is about people acting at the same time.

## Concurrency

| Requirement | Design |
|---|---|
| NFR5.1 | Every signed-in command takes an idempotency key and returns the stored result on a repeat, before it changes or audits anything. |
| NFR5.2 | A pick locks rows in the C1 order and then re-reads the slot's place. The loser of a race finds the place no longer held by the weekend family, or its version changed, and gets WEEKEND_SLOT_TAKEN. Unique indexes on the picking week and on the slot are the last line of defence. |
| NFR5.3 | A family's pick, the other family's change and an administrator's assignment all run through one internal step that takes the same locks in the same order, so any two of them queue and the second decides on the state the first left. |
| NFR5.4 | The standing row carries a version; the command locks the family row first and compares the version, with 0 meaning "no row yet", which the unique index on family and year backs up. |
| NFR5.5 | Each check sends through `notice_send` with a once key built from the kind and the picking week or duty; the notice's unique dedupe key makes a second or overlapping run create nothing. |
| NFR5.6 | Lock order, always ascending within a step: the two families, then the plan row and rota week rows, then weekend pick rows, then duty rows, then place rows. Publishing and the draft keep U2's order (all active families first). The checks take no row locks beyond what `notice_send` takes. |

## Load

About 200 rota weeks, 400 duties and at most 90 picks a year. Each read returns one document, so the data API's 1000-row limit is not reached and no paging is added.
