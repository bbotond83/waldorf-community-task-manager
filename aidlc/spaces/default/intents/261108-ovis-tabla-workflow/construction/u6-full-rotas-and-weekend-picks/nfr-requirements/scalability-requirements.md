# Scalability Requirements: u6-full-rotas-and-weekend-picks

Sources: NFR5 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1 and C9 in `contract-summary.md`. Stack limits are in `technology-stack.md`.

## Load Projection

One community of about 20 families and one school year at a time: about 200 rota weeks, 400 duties and places, at most 90 picks, and a few hundred notices a year (one publishing notice per parent, one rota-week reminder per family and week, and the pick reminders). Every read is returned as one document by its function, so the data API's limit of 1000 rows is not reached. No scaling mechanism is needed.

## Concurrency Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.1 | A repeated click on any new or changed command (set a standing, pick, change a pick, assign a pick, make a draft, change a week, publish) returns the stored result and creates no duplicate. | Fixed-list "repeated click" test. |
| NFR5.2 | Two families picking the same slot at once get one success and one WEEKEND_SLOT_TAKEN, with the slot's place held by the winner and exactly one pick (BR63.7). | A two-at-once test counts picks and reads the place. |
| NFR5.3 | A family's pick racing with an administrator's assignment for the same week, or with the other family's change of pick, leaves one consistent result: every picking week has at most one pick and every slot at most one. | A two-at-once test for each pair. |
| NFR5.4 | Two administrators setting the same family's standing get one success and one version conflict. | Fixed-list "outdated screen" and "two people at once" tests. |
| NFR5.5 | A check that runs twice, or two runs that overlap, send each notice once (BR64.5). | A test runs each check twice and in parallel, and counts notices and emails. |
| NFR5.6 | The lock order of C1 holds: family rows, then the plan row and rota week rows, then weekend pick rows, then duty rows, then place rows, each ascending. A pick locks both families first. | The race tests pass; no deadlock appears in repeated runs. |
