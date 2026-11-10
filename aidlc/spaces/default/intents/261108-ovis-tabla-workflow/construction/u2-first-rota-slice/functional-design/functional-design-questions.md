# Functional Design Questions: u2-first-rota-slice

The requirements, stories, contracts and mockups settle most of this piece of work. These six points are still open. Contains no names or contact details.

## Q1. [Product owner] How the draft spreads each family's turns through the year

The draft gives every family about the same number of indoor-cleaning weeks (no two families differ by more than one). That still leaves the order open: a family could get two weeks in a row, or its weeks could be spread out.

A. Spread each family's weeks as evenly as possible through the year. The same families and break weeks always give the same draft, so it can be repeated and explained (Recommended)
B. Shuffle at random. Asking for a draft again gives a different one, and two turns close together can happen
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Asking for a draft when one already exists

The administrator has already changed some weeks of the draft by hand and then presses "Tervezet készítése" (make a draft) again, for example because a family joined.

A. The app refuses and says a draft already exists. The administrator first discards it, and the discard asks for confirmation naming how many hand changes would be lost (Recommended)
B. The app makes a new draft over the old one at once, losing every hand change, after one confirmation
C. The app keeps the weeks changed by hand and fills only the other weeks
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] Publishing a draft that still has empty weeks

When there are too few families to fill a week without breaking a rule, the draft shows that week as empty with the reason (AC5.1.5). The stories do not say whether such a draft may be published.

A. Publishing is refused while any duty week is empty, and the screen lists the empty weeks. The administrator fills them or marks them as break weeks first (Recommended)
B. Publishing is allowed. Parents see the empty weeks as "Még nincs család", and the administrator fills them later
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] What happens when an administrator moves a week to another family

Moving a week by hand can leave one family with more weeks than another. The stories refuse a change only when it breaks a rule (AC5.2.2). Evenness is a property of the draft the app proposes, but the administrator may have a reason, such as one family asking to do more.

A. Evenness is a warning only. The screen shows each family's number of weeks and marks a family more than one week above the lowest, but the change is saved (Recommended)
B. The change is refused when it would leave any family more than one week above the lowest
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] Who is told when the rota is published

Publishing notifies the families (AC5.2.3), using today's in-app notices. Each family has one or more parents, and the rota lists every family's weeks.

A. Each family on the rota is told its own weeks (for example "Ti vagytok a belső takarításon a 12. és a 31. héten"), and nobody else gets a notice. Everyone can still open the overview (Recommended)
B. Every family gets the same general notice that a rota was published, with a link to the overview
X. Other (please specify)

[Answer]: A

## Q6. [Product owner] Adding or removing a break week after the rota is published

A break week is recorded in the school calendar (AC4.1.1). This unit cannot change a published duty yet (changing one belongs to the swaps and duty changes work later). An administrator might add a break week on a week that already has a published duty, or remove a break week from a week that has no duty.

A. Adding a break week is refused while a published duty sits in it, with the reason shown. Removing a break week is allowed, and the empty week stays empty until the administrator changes the rota later (Recommended)
B. Both are allowed. A duty in a new break week is shown with a warning and stays with the family until it is changed later
X. Other (please specify)

[Answer]: B
