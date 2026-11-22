# Performance Design: u7-swaps-and-duty-changes

Sources: `performance-requirements.md` and `tech-stack-decisions.md` of this Unit, `functional-spec.md`, and C1, C9 and C11 in `contract-summary.md`.

## Reads

| Read | Design | Requirement |
|---|---|---|
| `swap_candidates(place, from, to)` | One query over future places of open duties, excluding the family's own, weekend slot places, places not active and duties the family already holds; joins the family display name once; optional date range defaults to the next 8 weeks on the screen | NFR9.1, NFR9.4 |
| `swap_incoming()` | One query over the family's open and recently ended requests (current school year), both sides, returned as one document | NFR9.1, NFR9.4 |
| `swap_list(school_year)` | One query over the year's swaps with both duties and families joined, newest first; the "can be reversed now" flag is computed in the same query by comparing applied versions with the places' current versions | NFR9.1, NFR9.4 |

Existing indexes cover these reads: places by duty and family, requests by source place and status, by target place and by community and status. No new index is added; the large seed's timings decide whether one is needed, and only then.

## Commands

- Each command is one function call and one transaction: locks, checks, C5 and C11 calls, request update, notices queued through `notice_send`, audit entry (NFR9.2).
- The rule checks call C10 once per receiving family and C11 once for the whole change set.
- Emails are queued inside the transaction and sent by U5's mail step afterwards, so a command never waits on email.

## Daily Check

`dutychanges_swap_expiry_check` ends all due requests in one set-based update per kind (swaps by the earlier duty's start, cancellations by their duty's start), returns their places to active in one update, and queues the notices with once keys (NFR9.3).

## Measurement

`db:seed:large` gains a published year of all four rotas, invented event and manual duties, and 200 change requests in every status, all invented and on the privacy allowlist. Timings are the median of 5 warm runs after one warm-up run (NFR9.1 to NFR9.3); a test counts the calls each page makes (NFR9.4).

## Screens

- All new copy, refusal texts and status marks live in the existing Hungarian copy module (NFR8.1).
- The parent swaps page, the proposal form, the administrator swap list, the reassign action and the approvals screen are designed in Stitch first, use native form controls with visible labels, work at phone width and by keyboard, and use the `parent-` and `admin-` class prefixes (NFR8.2).
