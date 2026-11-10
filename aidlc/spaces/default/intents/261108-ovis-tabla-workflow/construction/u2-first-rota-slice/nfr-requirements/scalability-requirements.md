# Scalability Requirements: u2-first-rota-slice

Sources: NFR5 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1 in `contract-summary.md`. Stack limits are in `technology-stack.md`.

## Load Projection

One community of about 20 families and one school year at a time: about 40 rota weeks, 40 duties and 40 places per year, plus one notice per parent at publishing. Every list stays far below the data API's limit of 1000 rows. No scaling mechanism is needed.

## Concurrency Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.1 | A repeated click on any new command (make a draft, change a week, discard, publish, calendar change) returns the stored result and creates no duplicate (BR22.4, BR23.3). | Fixed-list "repeated click" test. |
| NFR5.2 | Two administrators editing the same week get one success and one version conflict. | Fixed-list "outdated screen" and "two people at once" tests. |
| NFR5.3 | Two administrators publishing the same plan get one success and one ROTA_PLAN_PUBLISHED refusal, with one duty per week and one notice per parent. | A two-at-once publish test counts duties, places and notices. |
| NFR5.4 | Publishing racing with a hand change or a discard leaves either the old or the new state, never a mix. | A two-at-once test for each pair. |
| NFR5.5 | The lock order holds: family rows, then, as the first lock of the rota week step, the plan row and then the week rows ascending, then task rows ascending, then place rows ascending. This adds the plan row and week rows to the team's lock order (family, task, place); the plan row's place is recorded as a note for C1 (`rules.md`, BR22.4). | The race tests pass; no deadlock appears in repeated runs. |
