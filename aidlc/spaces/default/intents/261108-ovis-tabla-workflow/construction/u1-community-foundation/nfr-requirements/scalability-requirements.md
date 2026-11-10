# Scalability Requirements: u1-community-foundation

Sources: NFR5 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1 in `contract-summary.md`. Stack limits are in `technology-stack.md`.

## Load Projection

One community of about 20 families, six working groups and one school year at a time. Lists stay well below the data API's limit of 1000 rows. No scaling mechanism is needed.

## Concurrency Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.1 | A repeated click on any changed or new command returns the stored result and creates no duplicate (BR6.1). | Fixed-list "repeated click" test. |
| NFR5.2 | Two super admins editing one working group get one success and one version conflict. | Fixed-list "outdated screen" and "two people at once" tests. |
| NFR5.3 | With the membership condition gone, two families taking the last place on a task still give one success and one refusal (BR4.1). | Existing capacity race test, run on a task with a group and a task with none. |
| NFR5.4 | Existing lock order holds: family row, then task rows ascending, then assignment rows ascending. | Existing race tests pass. |
