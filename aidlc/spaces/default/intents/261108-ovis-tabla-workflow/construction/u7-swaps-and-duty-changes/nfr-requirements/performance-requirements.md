# Performance Requirements: u7-swaps-and-duty-changes

Sources: NFR8 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1, C9 and C11 in `contract-summary.md`, and `technology-stack.md`. About 20 families hold a few hundred duties a year across the rotas, events and other duties; a family asks for a few swaps a term, so the candidate list and the swap list are the things to measure.

## Response Times

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.1 | The swap candidate list (`swap_candidates`, with and without a date range), the parent's swaps page and the administrator's swap list each load in under 2 seconds on the owner's computer. | This Unit extends `db:seed:large` with a published year of all four rotas, invented event and manual duties, and 200 change requests in every status, on the privacy allowlist; the timing is the median of 5 warm runs after one warm-up run. |
| NFR9.2 | Proposing, accepting (with the pick moving through C11), reversing, reassigning and deciding a cancellation each finish in under 2 seconds. | A database test times each on the large seed, with a picking week that carries a pick. |
| NFR9.3 | The daily check `dutychanges_swap_expiry_check` finishes in under 5 seconds on the large seed with 100 open requests whose duties have started. | A database test times one run and a second run of the same day. |
| NFR9.4 | Each read returns one document, so a page needs one call and no call per row; family names come from the same read. | A test counts the calls a page makes. |

## Screens

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR8.1 | All text on new and changed screens is Hungarian, including refusal reasons from C10 and C11, the status marks (függőben, elfogadva, elutasítva, visszavonva, lejárt, törölve, visszafordítva) and "korábbi tag". | Reviewed in the screenshots. |
| NFR8.2 | The parent swaps page, the swap proposal form, the administrator swap list, the reassign action and the approvals screen are designed in Stitch first, work at phone width and by keyboard, and have no serious or critical accessibility violations. | Browser checks in all three browsers, and the owner's screenshot comparison. |
