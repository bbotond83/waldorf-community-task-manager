# Requirements Analysis Questions: Admin and schedule list polish

Most of the five items are clear and will be written up as you stated them. Four decisions are needed first.

## Question 1: What should "Szűrők törlése" do on the teacher schedule?

Today the link goes to the bare schedule page, and the page re-applies the fixed default window (2026. 08. 12. to 2026. 08. 20.) and the first group. The fields also keep values you typed or chose before. The two date fields are required, so they cannot be submitted empty.

A. Reset to the default view: the first group and the default date window, and every field shows exactly that after clicking (stale typed values and a previously chosen group are cleared)
B. Show everything: all groups and no date limit; the date fields may be empty and an empty field means no limit (the date fields stop being required)
X. Other (please specify)

[Answer]: X. All fields should be cleared.

## Question 2: Where should the labels sit relative to their fields in the filter forms?

Today "Keresés" and "Állapot" (and "Csoport", "Kezdő dátum", "Záró dátum") sit beside their fields but do not line up with them.

A. Label above its field, stacked, on every screen size: the same layout on desktop and on a phone, each label and field a tidy pair
B. Label to the left of its field on a wide screen, stacked above on a phone (320 px)
X. Other (please specify)

[Answer]: A

## Question 3: Should the filter dropdown show the status symbols too?

A native dropdown can only show plain text, so a symbol would be a character in the option text (for example "✓ Jóváhagyva"). Lists and detail pages can show a proper styled symbol next to the word either way.

A. Yes: put a plain symbol character before the word in the dropdown options as well (the tests that match the option texts are updated)
B. No: symbols only in lists and on detail pages; the dropdown keeps the plain words
X. Other (please specify)

[Answer]: A

## Question 4: Which statuses get a symbol?

You asked for Jóváhagyva, Elutasítva and Függőben (a check mark, a cross and a clock).

A. Only those three approval states get symbols; Aktív, Archivált, Nyitott and Ütemezve stay words only
B. All statuses get a fitting symbol (for example Aktív a filled dot, Archivált an archive box, Nyitott an empty circle, Ütemezve a calendar), shown consistently everywhere
X. Other (please specify)

[Answer]: B
