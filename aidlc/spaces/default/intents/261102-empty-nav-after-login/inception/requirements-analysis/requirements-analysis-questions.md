# Requirements Analysis Questions

Context: after a successful sign-in the app returns to the sign-in page, which for a signed-in person shows only a "signed in" note and a sign-out button. The person never reaches the home page of their role, where the menu is. The home page logic already exists at `/`. Reproduced for super admin, group admin, teacher and parent.

## Question 1

After a successful sign-in, where should the person land?

A. On the home page of their role (super admin and group admin: `/admin`, teacher: `/teacher/schedule`, parent: `/szulo/ertesitesek`), the same place `/` already sends a signed-in person
B. On the page they asked for before signing in, falling back to the home page of their role
X. Other (please specify)

[Answer]: A

## Question 2

What should a signed-in person see when they open the sign-in page directly (for example by typing the address or using the back button)?

A. They are sent straight to the home page of their role, so there is no dead-end screen
B. They keep seeing the "signed in" note and sign-out button, with a new "Continue" link to the home page of their role
X. Other (please specify)

[Answer]: A

## Question 3

The teacher's only page is the schedule ("Beosztás"), and the teacher has no menu by design. Should the teacher get a menu entry as part of this fix?

A. No. Keep it as designed: the teacher lands on the schedule page, with the header and sign-out button
B. Yes, add a one-item menu with the schedule
X. Other (please specify)

[Answer]: A
