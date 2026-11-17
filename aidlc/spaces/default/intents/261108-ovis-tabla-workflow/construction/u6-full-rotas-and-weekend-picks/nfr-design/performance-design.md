# Performance Design: u6-full-rotas-and-weekend-picks

How the targets in `performance-requirements.md` are met, following `functional-spec.md` and `tech-stack-decisions.md`. About 200 rota weeks and 400 duties a year on one database make set-based statements enough; no cache is added.

## Reads

| Requirement | Design |
|---|---|
| NFR9.1 | Each page makes one call to one read function that returns one document. The overview joins rota weeks, weekend slots, their places and the families' display names once, ordered by week. The planning read computes per-rota counts and the warnings in the same pass. The calendar read computes flagged duties with one query that joins future places and draft weeks to the standings. The unpicked list is one query over picking weeks of the current school year with no pick. The duty card reads its duty and, for a weekend, the five slots of that week. |
| NFR9.4 | Today's list functions already filter on the duty's origin; the filter now excludes `weekend_slot` as well as `rota_week`, served by the existing origin index, so their cost does not grow with the plan. |
| NFR9.5 | `family_may_hold_duty` reads at most the family row and its few standing rows by primary and unique keys. A family has no standing row in the usual case, so the check is one indexed lookup. |

## Writes

| Requirement | Design |
|---|---|
| NFR9.2 | Making a draft inserts all week rows in one statement, then fills each rota in one loop over its duty weeks, keeping the running counts in memory instead of counting rows again for every week. The evening-out step works on the same in-memory counts. Publishing locks once, then calls `duty_create` for each weekly duty and each weekend slot in week order, so every duty still comes through the shared path. About 400 calls in one transaction is well inside 5 seconds. Notices are one `notice_send` call per family. |
| NFR9.3 | Each check is one query that finds what is due in the current week (or the next, for the rota-week reminder) and one `notice_send` call per family. The once key makes a second run a cheap no-op. |

## Screens

| Requirement | Design |
|---|---|
| NFR8.1 | Hungarian text lives with the screens. The new refusal codes, empty-week reasons and warnings are added to the existing code-to-message table. |
| NFR8.2 | Screens are designed in Stitch first and use the existing layout classes with new `admin-` and `parent-` rules. The picker is a fieldset of native radio buttons; the planning table scrolls sideways inside its own region at phone width while the overview is a stacked list of week cards. |

## Budget

A full-year publish touches about 400 duties, 400 places, 260 weekend slots and about 40 notices: under two thousand rows in one transaction. The 5-second target keeps a wide margin and is checked on the large seed.
