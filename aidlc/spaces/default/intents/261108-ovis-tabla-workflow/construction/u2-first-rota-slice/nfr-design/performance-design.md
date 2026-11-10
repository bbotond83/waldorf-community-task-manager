# Performance Design: u2-first-rota-slice

How the targets in `performance-requirements.md` are met. About 40 weeks and 40 duties per year on one database make set-based statements enough; no cache is added.

## Reads

| Requirement | Design |
|---|---|
| NFR9.1 | The overview is one function with one query over rota weeks, their duties and the families' display names, ordered by week. The duty card is one query by duty id. The school-year page reads one year and its break weeks. Each page makes one call. |
| NFR9.3 | Today's list functions filter out rota duties with the origin column, which the new index on `origin_kind`, `origin_id` also serves, so their cost does not grow with the plan. |

## Writes

| Requirement | Design |
|---|---|
| NFR9.2 | Making a draft inserts all week rows in one statement from a generated series of weeks. Publishing locks the rows once, then calls `duty_create` and its place step for each filled week in ascending week order, as the functional design says (BR23.2, BR26.1), so rota duties come only through the shared path that U7, U8 and U9 rely on. About 40 calls inside one transaction cost little. Notices are one insert per parent. |

## Screens

| Requirement | Design |
|---|---|
| NFR8.1 | Hungarian text lives with the screens; refusal codes map to Hungarian messages in one table. |
| NFR8.2 | Screens use the existing layout classes with new `admin-` and `parent-` rules. Designs come from Stitch first; the overview is a stacked list at phone width and keeps visible focus by keyboard. |

## Budget

A full-year publish touches about 40 duties, 40 places and about 20 notices, so a few hundred rows in one transaction through about 40 function calls; the 5-second target has a wide margin and is checked on the large seed.
