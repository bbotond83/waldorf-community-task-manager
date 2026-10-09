# Requirements Analysis Questions: Visual overhaul and UX fixes

Four decisions are needed before the requirements are written. The rest of your request is already clear and will be written up as stated: the chooser cards become the buttons, task cards become fully clickable, admin summary cards become links, and the kindergarten logo and cover photo are used.

## Question 1: How should Hungarian long words such as "Csoportadminisztrátor" be broken?

Right now the stylesheet allows breaking anywhere, which produces "Csoportadminisztrát / or". Browsers can hyphenate Hungarian automatically, but the result is not always at the right syllable. Role names are short and fixed, so they can also be written with explicit syllable break points (Cso-port-ad-mi-niszt-rá-tor).

A. Automatic hyphenation everywhere (browser rules for Hungarian), no manual break points
B. Automatic hyphenation everywhere, plus explicit syllable break points inside the fixed role names, so those always break correctly
C. No hyphenation: shrink the text and widen the cards so names fit on one line
X. Other (please specify)

[Answer]: B

## Question 2: What should the "Függőben lévő kérelmek" card on the admin overview do?

Today the "Nyitott jóváhagyások" card and the "Függőben lévő kérelmek" card both count the approvals that are waiting (the same list, `/admin/jovahagyasok?state=pending`). Making both clickable would send them to the same page.

A. Keep both cards; both open the list of waiting approvals
B. Merge them into one card, "Nyitott jóváhagyások", which opens the list of waiting approvals (three cards remain)
C. Keep both, but "Nyitott jóváhagyások" opens all approvals and "Függőben lévő kérelmek" opens only the waiting ones
X. Other (please specify)

[Answer]: B

## Question 3: Where should the logo and the cover photo appear?

The logo is the transparent purple emblem; the cover photo is the courtyard photo of the kindergarten building.

A. Logo in the header of every page; cover photo as a large banner only on the profile chooser (the first screen)
B. Logo in the header of every page; cover photo as a soft background behind all pages, under a light overlay so text stays readable
C. Logo in the header of every page; cover photo on the profile chooser and as a banner at the top of each area's home page
X. Other (please specify)

[Answer]: A

## Question 4: Which colour should lead the new look?

The building photo gives terracotta (roof and wood), warm ochre (walls), garden green and a few blue flowers; the logo is purple. Text and buttons must stay readable (accessible contrast). The current buttons are already terracotta.

A. Terracotta leads (buttons, links); ochre and cream as surfaces; green for success; purple only in the logo
B. Terracotta leads; green for success and secondary actions; purple used as a second accent (focus rings, highlights)
C. Logo purple leads (buttons, links); terracotta and ochre as warm accents and surfaces
X. Other (please specify)

[Answer]: A
