# Functional Design Questions: u4-working-groups

The stories US2.1 to US2.3, the requirements FR2.1 to FR2.4, the contracts C2, C7 and C16, and the U1 and U3 designs settle most of this piece of work. These four points are still open. Contains no names or contact details.

## Q1. [Product owner] What a group's member list shows

The story for seeing a group's members (US2.2) says a member who has not shared their profile shows as their full name only, and a teacher sees name, phone and email. It does not say what other parents see of a member who has shared. The directory (U3) shows such a parent's name, phone, email, place of residence, occupation, hobby and how they support the community.

A. Name for everyone; phone and email too where the directory would show them (a shared member, or any member to a teacher or super admin). The name links to the person's directory card for the rest. Coordinators carry a "Koordinátor" label (Recommended)
B. Exactly the directory card: every field the directory would show, on the group page as well
C. Names only on the group page, each linking to the directory card
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Whether a super admin can add or remove other people's memberships

The requirement says a parent joins and leaves a working group themselves (FR2.1). A coordinator must be a member before they are appointed, and a request to appoint a non-member is refused with a reason (AC2.3.3). So when an elected coordinator has not joined yet, someone has to wait for them to join.

A. No. Only the parent joins and leaves; the super admin asks the elected parent to press Csatlakozom first. The refusal on the appoint screen says so (Recommended)
B. Yes. A super admin can also add a parent to a group or take them off it, with the action in the audit log
X. Other (please specify)

[Answer]: A

## Q3. [Developer] The existing direct way of granting the group-admin right

Today the database still has a general role-change function, left from before (no screen uses it now), that lets a super admin give the group-admin right on a group without checking membership. If it stays open, a coordinator could be appointed who is not a member, which the story refuses (AC2.3.3).

A. Close that path for the group-admin right: it is refused there, and the only way to give or take it is the new appoint and revoke actions on the working group, which check membership (Recommended)
B. Keep both paths, and add the same membership check to the old function
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] Whether people are told when their coordinator right changes

The notice mechanism from U5 now exists. Nothing in the stories asks for a notice when someone is appointed or their right is revoked; the audit log records both either way.

A. Yes: the person gets an in-app notice "Koordinátor lettél: [csoport]" or "Megszűnt a koordinátori jogod: [csoport]", with no email (Recommended)
B. No notice; the person sees the change next time they open the app
C. In-app notice and email
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] The coordinator notice and email (follow-up to Q4)

Q4 chose an in-app notice with no email. The notice mechanism U5 built always queues one email with each in-app notice (its contract says "one notice and one queued email"), and it has no way to send a notice alone. So "no email" means changing U5's mechanism, not only adding two notice kinds.

A. Accept the email: the notice and its email go out together, as for every other notice. No change to U5 (Recommended)
B. Keep "no email": add a per-kind "no email" setting to U5's notice registry, set it for these two kinds, and update U5's contract and tests in the same pull request
C. Drop the notice: no notice and no email; the audit log records the change
X. Other (please specify)

[Answer]: A
