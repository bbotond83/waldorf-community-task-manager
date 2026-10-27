# Hungarian notice titles: owner review (F3, 2026-10-27)

Source: `notification_list()` in `supabase/migrations/20261037_notifications_functions.sql`. Each title is the text below followed by the task title (or "Feladat" when the task is unknown). Reminder titles in the coordinator list are built separately (last row).

Please correct the "Your wording" column (or write "OK"); the assistant then applies it in a forward-only migration with updated tests.

| # | When it appears | Current text | Your wording |
|---|---|---|---|
| 1 | A parent signed up for a task | Jelentkezés megerősítve: | |
| 2 | Another family asked to swap a task with this parent | Cserekérés érkezett: | |
| 3 | Swap request approved or applied | Csere jóváhagyva: | |
| 4 | Swap request rejected **or withdrawn by the requester** | Csere elutasítva: | Withdrawn by the requester: Csere kérelem visszavonva: (rejected keeps Csere elutasítva:) |
| 5 | Swap request in any other state | Csere döntés: | Csere függőben: |
| 6 | Cancellation request approved | Lemondás jóváhagyva: | |
| 7 | Cancellation request rejected | Lemondás elutasítva: | |
| 8 | Cancellation request in any other state | Lemondás döntés: | Lemondás függőben: |
| 9 | The parent's place was removed | A helyed törölve: | |
| 10 | Reminder, 7 days before | Egy hét múlva: | |
| 11 | Reminder, 24 hours before | Holnap: | |
| 12 | Coordinator reminder list: "<task> — 7 napos / 24 órás emlékeztető" | 7 napos / 24 órás emlékeztető | |

Point to decide, row 4: a swap request that the requester withdrew is shown to the other parent as "rejected" (elutasítva). A neutral wording such as "Csere visszavonva:" for withdrawn would be more accurate. Changing it alters which text is shown for that state, so say if you want it.

Owner input recorded 2026-10-27: rows 4, 5 and 8 changed as shown; all other rows are OK as they are. Interpretation to confirm when applying: in row 4 only the withdrawn case gets the new wording, rejected keeps "Csere elutasítva:"; the new texts end with a colon like the others because the task title follows.
