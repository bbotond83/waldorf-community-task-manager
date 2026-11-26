# Performance Requirements: u14-removal-and-anonymisation

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR9 in `requirements.md`, contract C16 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

The community is about 20 families. The targets below follow NFR9 (list pages under 2 seconds on invented data for 20 families and one school year, on the owner's computer).

## Targets

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.1 | The removal confirmation page, with its preview of every step, loads in under 2 seconds for a family with a full year of duties, picks, claims, loans and sign-ups. | Measured on the invented 20-family seed. |
| NFR9.2 | Removing a parent or a family, including all eleven steps, finishes in under 2 seconds on the same data. | Measured in a database test on the seed's busiest family. |
| NFR9.3 | The removal result page and its flagged-items list load in under 2 seconds. | Measured on the seed. |
| NFR9.4 | The later delete or anonymise finishes in under 2 seconds. | Measured in a database test. |
| NFR9.5 | The changed name helpers (C6) add no noticeable time to existing list pages: every list page still meets NFR9's 2 seconds. | The existing list-page measurements stay under 2 seconds. |

## Resource Notes

- Removal is rare (a few times a year), so no batching or background job is needed; everything runs in the request.
- The preview reads without locking, so it never slows other users.
