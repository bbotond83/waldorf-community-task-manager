# Functional Design Questions: u14-removal-and-anonymisation

The story (US3.6, criteria AC3.6.2 and AC3.6.5 to AC3.6.7), the requirements (FR3.7, NFR1, NFR11), the removal contract (C16) and the removal steps every earlier unit already built settle most of this piece of work. These eight points are still open. Contains no names or contact details.

What exists today, for context:

- Removing one parent (U3) ends their sign-in, empties their contact details and sharing choice, and refuses the family's last parent. It does not yet reach the other kinds of records.
- Archiving a family (removing it) frees its manual future duties, but is refused while the family holds a place on a rota duty, "until U7 and U14 define what happens".
- After 30 days a super admin can delete an archived family, or anonymise it when it has duty history. The check for "has history" looks at duties only.
- Eleven earlier units each provide a removal step (preview and apply). Nothing calls them yet.

## Q1. [Product owner] Removing a family's only parent

U3 refuses to remove the last parent of a family and points the administrator to removing the whole family instead (open point C16).

A. Keep U3's rule: the last parent cannot be removed on their own; the administrator removes the family, which removes every parent with it (Recommended)
B. Allow it: removing the last parent removes the whole family in the same step, after a warning on the confirmation screen
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Removing a working group's only coordinator

U4's removal step ends the removed parent's coordinator role. If they were the group's only coordinator, the group is left with none; super admins can still manage it and appoint a new one (open point C16).

A. Removal goes ahead. The confirmation screen says beforehand which groups will be left without a coordinator, and the result screen repeats it with a link to each group (Recommended)
B. Removal is refused until another coordinator is appointed for that group
C. Removal goes ahead with no warning; super admins see the missing coordinator on the group page
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] A removed family's future duties

AC3.6.2 says a removed family's future duties are flagged for reassignment. Today a family holding a rota-duty place cannot be archived at all. For a family marked as leaving, the agreed rule (AC4.2.3) is that its duties are flagged and it keeps them until an administrator reassigns them.

A. Removal is allowed. Rota, weekend and sign-up places stay with the removed family, shown as "korábbi család", and are flagged on the existing flagged-duties list until an administrator reassigns them. Manual duties are freed as today (Recommended)
B. Removal is allowed and every future place is freed at once, so it shows as an open place anyone can take
C. Keep refusing removal while the family holds a rota place; the administrator reassigns first
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] Deleting or anonymising: what counts as history

After the 30-day wait, today's process deletes a family that never held a duty and anonymises one that did. Now a family can also appear in weekend picks, swaps, to-do history, checklists, events, food offers, books and loans (open point C16 for U6).

A. Anonymise when the family or any of its parents appears in any of these records, past or present; delete only a family that appears nowhere. Its leaving/new standings are deleted either way; past rota weeks and picks keep their rows and show "korábbi család" (Recommended)
B. Keep today's rule (duties only), and let the other records simply lose their link to the family before it is deleted
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] When history starts showing "korábbi tag"

AC3.6.5 says history stays readable with the removed person shown as "korábbi tag". Today the name helper only does this after a family is anonymised, so a removed parent's name still shows in history in the meantime.

A. From the moment of removal: a removed parent shows as "korábbi tag" and a removed family as "korábbi család" everywhere other people see history. Only super admins keep seeing the name, on the archive and data-lifecycle screens, until the family is deleted or anonymised (Recommended)
B. A removed parent shows as "korábbi tag" at once, but a removed family keeps its name in history until it is deleted or anonymised
X. Other (please specify)

[Answer]: A

## Q6. [Product owner] What the administrator sees before and after a removal

Every removal step can count what it would clear and what it would flag, without changing anything. Flagged items are future duties, held books and claimed open to-do tasks (AC3.6.2, AC3.6.7).

A. The confirmation screen lists, per kind of record, how many will be cleared and how many flagged. After removal a result screen lists each flagged item with a link to where it is handled (flagged duties, the library, the to-do list). The flags also stay on those screens until handled (Recommended)
B. The confirmation screen shows the totals only; the flags are found later on the screens where they are handled
X. Other (please specify)

[Answer]: A

## Q7. [Product owner] Restoring a removed family

Today a super admin can restore an archived family within the 30 days. Removal now ends memberships, frees claims, ends open swaps and removes notices, and those do not come back.

A. Restoring stays possible within the 30 days. It brings back the family, its parents and the directory record; sign-ins, memberships, claims, swaps and notices do not return, and the restore screen says so. Parents need a new invitation (Recommended)
B. Removal can no longer be undone; the restore button goes away for families removed under the new process
X. Other (please specify)

[Answer]: A

## Q8. [Developer] Running the removal as one step

The contract fixes the order of the eleven removal steps and that they run in one transaction after the family row is locked.

A. One command per subject (remove a parent, remove a family) runs the preview, then every step in the fixed order, then writes one audit row with the counts, all in one transaction; any refusal rolls everything back. The later delete or anonymise runs the same steps again before it, so nothing created in the 30 days is missed (Recommended)
B. As A, but the steps run only at removal; the later delete or anonymise relies on what removal already cleared
X. Other (please specify)

[Answer]: A
