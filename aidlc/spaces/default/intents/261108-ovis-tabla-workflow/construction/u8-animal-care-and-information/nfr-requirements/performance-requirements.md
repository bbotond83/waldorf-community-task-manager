# Performance Requirements: u8-animal-care-and-information

Sources: NFR8 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1 and C9 in `contract-summary.md`, and `technology-stack.md`. A school year has about 40 weeks, so about 400 slots for about 20 families; the information page has six sections of a few thousand characters each.

## Response Times

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.1 | The sign-up page (two weeks of slots plus the fair-share panel), the fair-share list opened in full and the information page each load in under 2 seconds on the owner's computer. | This Unit extends `db:seed:large` with a school year's slot calendar and slots, about 60% of them held by invented families, and a sample of section text; the timing is the median of 5 warm runs after one warm-up run. |
| NFR9.2 | Signing up, giving up, saving a section and saving the calendar each finish in under 2 seconds. | A database test times each on the large seed. |
| NFR9.3 | Creating a whole school year's slots finishes in under 10 seconds, and pressing it again (nothing to add) in under 2 seconds. A start-time change moving every coming slot finishes in under 5 seconds. | A database test times each on the large seed. |
| NFR9.4 | Each daily check (`animal_empty_slots_check`, `animal_fair_share_check` on a first weekday) finishes in under 5 seconds on the large seed. | A database test times one run and a second run of the same day. |
| NFR9.5 | No page makes a call per row. The sign-up page makes two reads (the slot list and the fair-share read), the information page one (the section list), and the settings screen one (the calendar read); family names, counts, shares and duty links come inside those reads. | A test counts the calls each page makes: two, one and one. |

## Screens

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR8.1 | All text on new and changed screens is Hungarian, including refusal reasons (Már foglalt, the changeover reason, the 24-hour limit), the slot parts (reggel, délután), "üres", "Ti", the fair-share figures with a decimal comma, and the information editor's help. | Reviewed in the screenshots. |
| NFR8.2 | The sign-up page, the information page with its editor, the animal-care settings screen and the duty-card links are designed in Stitch first, work at phone width and by keyboard, and have no serious or critical accessibility violations. Slot buttons are named with the day and part, results are announced in a status region, and focus stays on the row (refined mockups, Slot Row). | Browser checks in all three browsers, and the owner's screenshot comparison. |
