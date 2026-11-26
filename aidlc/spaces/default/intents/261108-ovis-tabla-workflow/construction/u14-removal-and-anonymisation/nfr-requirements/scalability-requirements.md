# Scalability Requirements: u14-removal-and-anonymisation

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR5 and NFR9 in `requirements.md`, contract C16 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

## Load and Growth

- One community of about 20 families, a few removals a year, usually at the end of a school year when several families leave.
- Records per family grow by one school year at a time; a family that stayed several years has several years of places, picks and history.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.5 | Several families removed one after another on the same day each meet NFR9.2; nothing in a removal grows with the number of other families. | A test removes five families of the seed in a row and measures each. |
| NFR5.6 | A family with three school years of records still meets NFR9.2. | A test on a seed family given three years of history. |
| NFR5.7 | While a removal runs, other families' commands are not blocked: removal locks only the subject's family, its tasks and its places, and the rows each step owns for that subject. | A test runs another family's sign-up during a removal and sees no wait beyond the shared duty row. |
