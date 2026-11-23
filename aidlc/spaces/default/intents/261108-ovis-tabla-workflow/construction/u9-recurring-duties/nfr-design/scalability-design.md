# Scalability Design: u9-recurring-duties

Sources: `scalability-requirements.md`, `performance-requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1 and C9 in `contract-summary.md`.

## Scaling Approach

One community of about 20 families gives about 20 schedules and a few hundred open or recent occurrences, so no scaling mechanism is added. The design work here is about concurrency, not volume. Every read returns one JSON document, so the data API's 1000-row limit is never reached; overdue occurrences older than 60 days are cut in the read (BR146.3).

## Concurrency Design

### Idempotency and versions (NFR5.1, NFR5.4)

Every command takes an idempotency key and looks it up before any write; a repeated key returns the stored result. Schedule saves also send the version the caller saw, and a different version is refused as VERSION_CONFLICT (BR141.2).

### Done, undo and skip on one occurrence (NFR5.2, NFR5.3)

Each command locks the occurrence row, then re-checks its state under the lock. The first of two simultaneous mark-dones wins, the second sees "already done" and gets a conflict. Mark done against skip ends either done then skipped refused, or skipped then mark refused with RECURRING_CLOSED. Undo against mark done ends done then open. The table check (done and skipped never both) is the last line of defence.

### Decision D-SCAL-1: the lock order, with a C1 amendment (settles review finding R-01)

C1 lists the steps: family, rota week, weekend pick, change request, duty, place, checklist task, to-do task, book. This Unit adds two steps **at the end**: **schedule, then occurrence**. Reasons: no other unit's command locks these rows, the removal contract already says U9's rows are never locked by another block (contract-summary, removal section), and the end of the list is the one place that cannot create a cycle with existing orders.

```
family -> rota week -> weekend pick -> change request -> duty -> place
  -> checklist task -> to-do task -> book -> schedule -> occurrence
```

Rules for this Unit's functions:

1. Within the schedule step and the occurrence step, rows are locked by ascending id.
2. The owner of a schedule is fixed. Owner kind and owner id are never changed by any command (the save function refuses to change them), so a command may read them without a lock and the answer cannot go stale.
3. A command that needs a family or rota-week lock reads the schedule's owner without a lock, takes the family lock, then the rota-week lock, then the schedule row, then re-reads under the lock. Because the owner is immutable the re-check of the owner always passes; only the live state (active, version, done or skipped) is checked again.
4. For a rota-week occurrence the responsible family is the live holder of the week. The command reads it with `rota_family_for`, locks that family, then the rota week, then re-reads `rota_family_for`. If the holder changed in between (a swap committed), the command is refused with VERSION_CONFLICT and the screen reloads; no half state is written (NFR5.7, NFR3.9).
5. The daily check and the removal apply take schedules by ascending id and never lock a family or rota week after a schedule row. The daily check takes no family or rota-week lock at all: it only reads published weeks.
6. The occurrence table has a unique key on schedule and due date, and the daily check inserts with "do nothing on conflict", so two runs, or a save racing with a run, create each occurrence once (NFR5.5, NFR5.6).

The C1 text gets the two added steps recorded as an amendment note in the Unit's code-generation record, so other units see them. BR141.2 is read as "the schedule row is locked after any family or rota-week lock the command needs, then the occurrences it changes" (the earlier wording "locked first" applies only to commands with no family or rota-week lock).

### Removal pair

`recurring_removal_apply` runs after the family lock the caller (U14) already holds, then takes schedules and occurrences by ascending id, per rule 1.

## Capacity Thresholds

| Measure | Expected | Review point |
|---|---|---|
| Schedules | about 20 | Above 200 the daily check and the list reads are re-timed |
| Open or recent occurrences | a few hundred | The 60-day history cut and the 14-day lead keep this bounded |
| Notices per day | a handful | Above 100 in one run the email sweep (U5) is re-timed |

## Verification

The two-at-once tests (one per NFR5.2 to NFR5.7) run with the existing shuffled database run. The lock order above is written into the Unit's test notes, and the tests repeat each race enough times to catch a deadlock.
