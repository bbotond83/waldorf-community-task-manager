# Performance Design: u9-recurring-duties

Sources: `performance-requirements.md`, `functional-spec.md` of this Unit, and C9 and C14 in `contract-summary.md`.

## Approach

Speed comes from shape, not from caching. Each read function returns one JSON document built in a single query, so a page makes one call (NFR9.4). Nothing is cached; the data is small and must be live (a rota-week holder can change at any time).

## Read Design

| Read | Shape | Bound |
|---|---|---|
| Group duties page (`recurring_list`) | One document: schedules and their occurrences for the group | Occurrences from 14 days ahead back to 60 days overdue; done ones within the history window |
| Family duties page (`recurring_my_occurrences`) | One document of the family's own and rota-week occurrences | Same window |
| Duty card line (`recurring_bottle_for_duty`) | One small document for the water-week duty | One row |

The 60-day cut and the 14-day lead are applied in the query (NFR9.4, BR146.3), never on the screen.

## Indexes

- Occurrences: unique key on schedule and due date (also serves the daily check's conflict handling).
- Occurrences: index on due date for open rows, so the daily check scans only open rows near today.
- Schedules: index on owner kind and owner id for the family and group lists.

## Daily Check Budget (NFR9.3, settles review finding R-05)

The workload for the timing test is the worst case: every active schedule of the large seed (30 families, a school year of occurrences) due on the same day, notices created for all of them, with email sending replaced by the local test mailbox. Targets: first run under 5 seconds, second run the same day under 2 seconds. The second run is fast because the once keys and the unique occurrence key turn every insert into a no-op.

## Writes (NFR9.2)

Saving a schedule removes later unnoticed occurrences and creates today's in one statement set; mark done is one row update plus one audit row. Both finish under 2 seconds on the large seed, measured by a database test.

## Screens (NFR8.1, NFR8.2)

- New classes use the `recurring-` prefix in `app/globals.css`, kebab-case, checked by Stylelint and formatted by Prettier.
- All text is Hungarian, including refusals and the states "lejárt", "kihagyva" and "Kész".
- Kész and Mégsem are native buttons with visible labels; state is shown in words as well as colour; layout works at phone width and by keyboard.
- Screens are designed in Stitch first and compared with the built screen in the owner's screenshot review. Screenshots are checked for error pages before they are sent.
- Existing tests that read class names, sizes and the `--name: #rrggbb` token format keep passing; changed screens keep those hooks or update their tests in the same pull request.

## Regression Guard (NFR9.5)

Existing duty, rota and notice timing tests run on a seed that holds schedules and occurrences.
