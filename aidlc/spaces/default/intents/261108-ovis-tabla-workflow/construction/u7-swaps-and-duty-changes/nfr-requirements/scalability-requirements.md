# Scalability Requirements: u7-swaps-and-duty-changes

Sources: NFR5 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1, C5 and C11 in `contract-summary.md`. Stack limits are in `technology-stack.md`.

## Load Projection

One community of about 20 families: a few hundred duties a year and a few dozen change requests a term, with a handful open at a time. The candidate list is limited to future places and can take a date range, so it stays well below the data API's limit of 1000 rows. The daily check reads only open requests. No scaling mechanism is needed.

## Concurrency Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.1 | A repeated click on any command of this Unit (propose, accept, decline, withdraw, cancel, decide, reassign, reverse) returns the stored result and changes nothing again. | Fixed-list "repeated click" test. |
| NFR5.2 | Two proposals naming the same place at once give one request and one REQUEST_DUPLICATE, whether the place is the source of one and the target of the other or the same side of both (BR71.3). | A two-at-once test for each combination counts open requests. |
| NFR5.3 | An acceptance at the same moment as a withdrawal, a reassignment of either place or another change to either place ends as if one came first; the later one is refused (AC8.2.9, BR72.1). | A two-at-once test for each pair, in both orders. |
| NFR5.4 | A reversal at the same moment as a reassignment of either place gives one success and one refusal (SWAP_CHANGED_SINCE or VERSION_CONFLICT). | A two-at-once test. |
| NFR5.5 | An acceptance that moves a weekend pick at the same moment as that family changing its pick (U6) gives one consistent result: the pick is changed and then moved, or the change is refused because the slot moved. | A two-at-once test in both orders. |
| NFR5.6 | Every command locks duty rows, then place rows by ascending id, then the request row, in one pass that already includes the weekend slot rows C11 will touch; C11's rota week and pick locks follow (BR77.1). No command locks a family row to check a standing. | The race tests pass; no deadlock appears in repeated runs together with U6's pick race tests. |
| NFR5.7 | The daily check run twice at once ends each request once and sends each notice once, by the once key. | A two-at-once test counts the notices. |
