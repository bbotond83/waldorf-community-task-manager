# Performance Design: u10-events-and-signups

How the targets in `performance-requirements.md` are met, following `functional-spec.md` and `tech-stack-decisions.md`. About 30 events a year with a few hundred sign-ups and offers fit set-based statements on one database; no cache is added.

## Reads

| Requirement | Design |
|---|---|
| NFR9.1 | Each page makes one call to one read function that returns one document. The events list returns each event with its group name and cancelled mark, filtered by end date unless the past-events switch is on. The event page returns the event with its notices, roles (with the C6 display of the people named), sign-ups and offers grouped by category, joined once and ordered by position or creation. The group page's events section is the same list limited to the group. |
| NFR9.3 | Today's task and reminder functions do not read sign-ups or offers, so their cost does not grow with them (BR111.1). |
| NFR9.4 | The page layer makes one read per page and no read per row; the display names come inside the document. |

## Writes

| Requirement | Design |
|---|---|
| NFR9.2 | Saving notices replaces the event's rows in one delete and one insert of at most 10 rows, under the event lock. Cancelling locks the event row, then the event's open task rows in ascending id order (BR122.1), and closes them in one statement over the locked rows. The change notice is one `notice_send` call per recipient batch, as U5 defines. |

## Screens

| Requirement | Design |
|---|---|
| NFR8.1 | Hungarian text lives with the screens. New refusal codes, the closed-event text, the allergen wording and the category names are added to the existing code-to-message table. |
| NFR8.2 | Screens are designed in Stitch first and use the existing layout classes with new `parent-` and `admin-` rules. The allergen ticks are native checkboxes in a fieldset with a legend; the past-events switch is a labelled native checkbox that reloads the list. |

## Budget

A school year holds under 30 events and well under two thousand sign-up, offer and role rows. Every read stays far inside the 2-second target and is checked on the large seed.
