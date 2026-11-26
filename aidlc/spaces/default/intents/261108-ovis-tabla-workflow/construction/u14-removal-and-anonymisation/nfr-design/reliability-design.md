# Reliability Design: u14-removal-and-anonymisation

Sources: this Unit's `reliability-requirements.md`, `security-requirements.md`, `performance-requirements.md`, `scalability-requirements.md`, `observability-requirements.md` and `tech-stack-decisions.md`, its `functional-spec.md`, contracts C1 and C16 in `contract-summary.md`, and both earlier reviews. Contains no names or contact details.

## Lock Order (NFR5.1)

Every removal and later run takes its locks in this order, inside one transaction:

1. The family row (`for update`).
2. The family's task rows ascending, through the existing `reminder_lock_family_tasks(family_id)`, which retries until the set of tasks is stable. This is the same call today's `family_archive` makes.
3. The family's place rows ascending, through the existing `coordination_lock_assignments(ids)`.
4. Version and state checks (BR200.3), self-removal and last-super-admin checks.
5. The steps in the C16 order; each step locks its own rows ascending (C1).

No new wrapper-level lock is added: steps 2 and 3 reuse the helpers already in `family_archive`, so the existing lock tests keep their timing. Those tests run unchanged in this Unit's pull request (NFR6.2).

```text
remove(subject):
  lock family; lock family tasks asc; lock family places asc
  check version, state, self, last super admin
  accounts := active accounts of subject parents (asc)
  for step in C16 order: counts += step.apply(subject)
  if subject is parent: set stored name 'Anonimizált szülő'
  audit(counts); store idempotency result
```

## All or Nothing (NFR11.1)

- The commands run inside the use-case template's block; any `U3R00` refusal from a step, or any error, ends the transaction with nothing written.
- A step that finds nothing returns zeros, so a later run after a removal is safe (NFR11.3).

## Concurrency Cases

| Case | Behaviour | Test |
|---|---|---|
| Two removals of the same subject | Second waits on the family row, then fails BR200.3 (VERSION_CONFLICT) | two sessions, both commit attempts |
| Parent removal during family removal | Same | two sessions |
| Removal against a swap, sign-up or slot give-up on the family's duty | The other command locks the duty and place in the C1 order; the removal holds the family, tasks and places first; one waits, none deadlocks, the result equals one after the other | three tests |
| Another family's sign-up during removal | Not blocked unless it touches the same duty row | NFR5.7 test |

## Delete or Anonymise Decision (NFR11.4)

- After the steps, one internal read `lifecycle_family_still_referenced(family_id)` checks each kind of record that can keep a family or parent link (places, rota weeks, picks, swap requests, recurring schedules and marks, family-owned to-do tasks, event sign-ups and offers, loans, books, checklist claims). True means anonymise.
- A test deletes a family and then scans every table with a family or parent column for the deleted ids.

## Restore (NFR11.5)

- `family_restore` is unchanged in its checks; its confirmation page lists what does not come back, including the emptied texts and the stored name of any parent removed on their own earlier.

## Tests Changed in the Same Pull Request (NFR6.2)

- The tests that expect `korábbi tag` for a family.
- The test that expects `family_archive` to refuse DUTY_ROTA_MANAGED.
- `tests/database/identity-catalogue.test.ts` and `src/data/notification-use-cases.test.ts` for the new functions.
