# Requirements Analysis Questions: Visual overhaul, second round

Most of your eight points are clear and will be written up as you stated them. Three decisions are needed first.

## Question 1: Which admin menu should every admin page show?

Today the menu changes after the first click. The group admin sees 3 items on the welcome page and 5 on every other page; the super admin sees 8, then 9. The 5-item and 9-item menus are the fuller ones, with the labels you see after clicking.

A. The fuller menu everywhere. Group admin: Áttekintés, Nyilvántartások, Feladatok és események, Jóváhagyások, Archívum. Super admin: those five plus Importálás, Emlékeztetők, Adatvédelem, Beállítások
B. The short menu everywhere. Group admin: Áttekintés, Feladatok, Jóváhagyások. Super admin: the 8 items from the welcome page (no Archívum)
X. Other (please specify)

[Answer]: A

## Question 2: Where should a real parent land after signing in?

Test profiles will open the new default page (Szülő opens Értesítések). The real parent sign-in page (`/belepes`) currently sends a parent to the task list (Családi feladatok) unless the link they followed asked for another page.

A. Same default as the test profile: Értesítések (a destination the parent was sent to by a link still wins)
B. Keep the task list (Családi feladatok) for real sign-in and change only the test profile
X. Other (please specify)

[Answer]: A

## Question 3: What should the "mark as read" checkbox do on a notification?

The notification card becomes one clickable element that opens the notification. "Olvasottnak jelölöm" becomes a separate checkbox on the right side of the card.

A. Ticking it marks the notification as read at once (no extra button). A read notification shows the box ticked and disabled, since there is no "mark as unread" today
B. Ticking it only selects the notification; a separate button marks all selected ones as read
X. Other (please specify)

[Answer]: A
