# Functional Design Questions: u3-directory-and-profile

The requirements (FR3), the stories (US3.1 to US3.7), the visibility decision (ADR-008) and the directory and account mockups settle most of this piece of work. Settled without a question: search in the directory matches only what the viewer can see on the card; a working-group coordinator sees the directory as a parent does, because FR3.5 names only teachers and super admins; invitations keep today's single-use link, valid for 7 days. These seven points are still open. Contains no names or contact details.

## Q1. [Product owner] Which email address the directory shows

Today the app keeps two addresses for a parent: the sign-in email and a separate contact email that an administrator types in. The stories let a parent edit their phone, place of residence and profile fields (AC3.3.1), and change their email only through the confirmed sign-in change (AC3.4.2).

A. One address. The directory shows the parent's sign-in email; for a parent without an account, the address the administrator entered for the invitation. After a confirmed email change, the directory shows the new address (Recommended)
B. Two addresses. The sign-in email stays private, and the directory shows a separate contact email that the parent edits under Adataim without confirmation
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] What the other parent of the same family sees

Today the parents of one family can always read each other's contact details. The new rule says other parents see only the full name unless the tick box is on (FR3.3), and it does not mention the family's own other parent. Some families have parents who live apart.

A. The other parent of the same family follows the same tick-box rule as everyone else (Recommended)
B. Parents of the same family always see each other's full details, whatever the tick box says
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] Whether teachers see the children's names

A family's children are shown only when every parent of the family has ticked sharing (AC3.1.3, AC3.1.4). Teachers always see phone and email (AC3.5.1), but the stories do not say whether teachers also always see the children's names.

A. Teachers see the children's names under the same rule as parents. The database hands out as little as possible, and teachers know the children from the kindergarten anyway (Recommended)
B. Teachers always see every family's children's names
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] What unticking the sharing box does to the saved details

Unticking hides the profile from other parents at their next page load (AC3.2.3). Today's single profile text is deleted when consent is withdrawn. The new fields are place of residence, occupation, hobby and how the parent supports the community (FR3.4).

A. Unticking only hides. The parent's entries stay saved, visible to the parent and to administrators, and are shown again if the parent ticks the box later (Recommended)
B. Unticking deletes occupation, hobby and "how I support the community"; phone and place of residence stay saved but hidden
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] Removing a family's only parent

An administrator can remove one parent of a family with several parents (AC3.6.4). Removing the whole family is a separate action. The stories do not cover a family that has a single parent.

A. Removing the only parent is refused, with the reason that the family itself should be removed instead (Recommended)
B. It is allowed. The family stays in the directory with no parent until an administrator adds one
X. Other (please specify)

[Answer]: A

## Q6. [Security] Safeguards for changing the sign-in email

The new address takes effect only after its confirmation link is opened, and until then the old address still works (AC3.4.2, AC3.4.3). Taking over an account usually means changing its email, so the remaining choices decide how hard that is.

A. The parent enters their current password to request the change. The link is valid for 24 hours, only one change can be pending (a new request replaces the old one), and the old address gets an email saying the address was changed (Recommended)
B. The same, but without entering the current password
C. The same as A, but the link is valid for 7 days, like an invitation
X. Other (please specify)

[Answer]: A

## Q7. [Security] Other sign-ins after a password change

A parent may be signed in on a phone and a computer. Changing the password needs the current one (AC3.4.1). The stories do not say what happens to the parent's other signed-in devices.

A. Every other signed-in device is signed out; the device used for the change stays signed in (Recommended)
B. All devices stay signed in
X. Other (please specify)

[Answer]: A
