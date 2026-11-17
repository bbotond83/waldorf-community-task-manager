# Functional Design Questions: u6-full-rotas-and-weekend-picks

The requirements, stories, contracts, mockups and the answers already given for the first rota slice settle most of this piece of work. These five points are still open. Contains no names or contact details.

## Q1. [Product owner] One family with two jobs in the same week

The only clash the stories forbid is indoor cleaning and front garden in the same week (AC5.1.3). With four rotas, the draft could still give one family two other jobs in one week, for example indoor cleaning and weekend animal care. That family would then have to pick a weekend slot "from itself".

A. The draft avoids giving a family two jobs in the same week whenever there are enough families. It is not a rule: the administrator may still set it by hand and sees a warning. A family that is both a picking family and the weekend family that week needs no pick (Recommended)
B. It is a rule: a family can never hold two of the four jobs in the same week, in the draft or by hand. Weeks that cannot be filled stay empty with the reason
C. Only the indoor cleaning and front garden clash matters. The draft does not look at other combinations
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Changing a weekend pick

A family picks one of the four openings or closings (AC6.1.1). The stories do not say whether it can change its mind afterwards.

A. A family can change its pick to another free slot until Friday noon of that week. After that only the administrator can change it (Recommended)
B. A pick is final. Only the administrator can change it
C. A family can change its pick until the slot itself starts
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] A slot nobody picked by the time the weekend starts

On Wednesday the family is reminded, and from Friday noon the administrator is told and can assign a slot (AC6.2.1, AC6.2.2). It can still happen that neither the family nor the administrator acts before Saturday morning.

A. The family can still pick after Friday noon, until the administrator assigns one or the first weekend slot starts. If nothing happens by then, the weekend animal-care family does all four, as for a missing family (AC6.1.3), and the missed pick stays on the administrator's list (Recommended)
B. From Friday noon only the administrator can assign. If the administrator does nothing, the weekend family does all four
C. At Friday noon the app gives the family the earliest free slot by itself and tells the family and the administrator
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] A reminder before a family's rota week

The stories remind families about weekend picks, but not about the rota week itself (indoor cleaning, front garden, water carrying, weekend animal care). The first rota slice left this open for this piece of work.

A. Each family gets one notice and email on the Friday before its week starts, naming the job and the week (Recommended)
B. No reminder. Families were told their weeks when the rota was published and can see them in the app
C. Two reminders: one week before and on the Friday before
X. Other (please specify)

[Answer]: A

## Q5. [Developer] The indoor-cleaning rota already published on your computer

From this piece of work on, one plan holds all four rotas and they are published together. The first rota slice published indoor cleaning alone, and a published rota cannot be changed until the swaps and duty changes work. Your local database only holds invented data.

A. Start again locally: reset the local database after this work is merged and draft all four rotas together. An unpublished draft simply gets the three new rotas added as empty weeks (Recommended)
B. Keep a published indoor-cleaning rota, and let the administrator fill and publish the three new rotas beside it. This adds a "publish the additions" step that is needed only this once
X. Other (please specify)

[Answer]: A
