# Requirements Analysis Questions

Decisions the requirements still need. Everything already settled in `ovis-tabla-tab-review.md` and `ovis-tabla-gap-analysis.md` is not asked again.

## Q1. [Product owner] How the yearly rota is created

Today someone fills the yearly cleaning, water and weekend animal rotas by hand. In the app the administrator plans the whole school year at once. How should the plan come about?

A. The app proposes a fair draft (each family gets about the same number of weeks, respecting school breaks and the 1 July rule), and the administrator adjusts it before publishing (Recommended)
B. The administrator fills every week by hand on a yearly grid
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Who must agree to a swap

Today in the app, the other family confirms a swap and no administrator is needed, but an administrator can also decide. On the spreadsheet, families arrange swaps among themselves. Should that stay?

A. The two families agree and the swap applies at once; the administrator can see it and step in (Recommended)
B. The two families agree, then the administrator must also approve it
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] What "fair share" does for weekday animal care

Every family must contribute more or less evenly to the weekday morning and afternoon sign-up slots. What should the app do about that?

A. Show everyone how many slots each family has taken, and remind families that are below the average; nothing is blocked (Recommended)
B. Set a minimum number of slots per family for a period, and alert the administrator about families below it
C. Only show the counts, with no reminders
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] Warning about unfilled animal-care slots

Chasing empty slots by hand is one of the main reasons for the app. When should the app raise the alarm, and to whom?

A. 3 days before an empty slot, notify all families; 1 day before, also notify the administrator and the Animal Care working group's coordinator (Recommended)
B. 1 day before an empty slot, notify the administrator only
C. Another timing or audience (please specify under Other)
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] The mandatory weekend opening or closing duty

The family on indoor cleaning and the family on front garden must each pick one weekend opening or closing. What if a family has not picked in time?

A. Remind the family on Wednesday; if it still has not picked by Friday noon, notify the administrator, who assigns one (Recommended)
B. If it has not picked by Friday noon, the app assigns a remaining slot automatically and tells the family
X. Other (please specify)

[Answer]: A

## Q6. [Product owner] The 1 July joining and leaving date

A leaving family cannot be assigned a duty after 1 July, and a new family cannot be assigned one before it. Is that date fixed?

A. 1 July is the default, and the administrator can change it for each school year (Recommended)
B. Always 1 July, not changeable
X. Other (please specify)

[Answer]: A

## Q7. [Product owner] Who claims tasks and signs up: a person or a family

Duties belong to a family today. Working-group membership is per parent. For event sign-ups and to-do tasks, who is recorded?

A. The parent who claims it is recorded and shown, and it also counts as their family's (Recommended)
B. Only the family is recorded
X. Other (please specify)

[Answer]: A

## Q8. [Product owner] The working-group coordinator role

The teachers' documents say each group elects a coordinator from among its members. How does that person get the working-group admin rights in the app?

A. The group decides outside the app, then an administrator grants the rights; a group can have more than one coordinator (Recommended)
B. The group decides outside the app, then an administrator grants the rights; exactly one coordinator per group
C. Members vote inside the app
X. Other (please specify)

[Answer]: A

## Q9. [Product owner] What teachers can see of parents' profiles

Other parents see only a full name unless the parent ticks the box allowing their full profile to be shown. Does the same limit apply to teachers?

A. Teachers always see parents' phone and email, because they need to reach them; the rest of the profile follows the tick box (Recommended)
B. Teachers follow the tick box like other parents
C. Teachers always see the full profile
X. Other (please specify)

[Answer]: A

## Q10. [Release engineer] How reminders are delivered

Reminders are only simulated today, and the app has no email service. Real delivery is in version 1, but this work ends on your computer, and a real mail service belongs with hosting.

A. Build real email delivery and in-app notices now; check email against a local test mailbox, and connect a real mail service in the hosting work (Recommended)
B. In-app notices only for version 1; email comes with hosting
X. Other (please specify)

[Answer]: A

## Q11. [Developer] The old import screen

The current import screen (`/admin/import`) reads a fixed template made for the old structure. You chose a one-off migration script instead. What should happen to the import screen?

A. Remove it, and its database functions, once the new structure replaces it (Recommended)
B. Keep it and update it to the new structure
X. Other (please specify)

[Answer]: A

## Q12. [Developer] The bug that loses the swap and cancellation reason

The swap and cancellation forms require a reason, but the app never saves it, so administrators never see it. It is outside the gap analysis. Should it be fixed in this work?

A. Yes, fix it here and show the reason to whoever decides the request (Recommended)
B. No, remove the reason field from the forms
C. Leave it for a separate fix
X. Other (please specify)

[Answer]: A
