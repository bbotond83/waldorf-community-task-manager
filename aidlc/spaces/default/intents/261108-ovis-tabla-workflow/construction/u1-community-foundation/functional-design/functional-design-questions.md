# Functional Design Questions: u1-community-foundation

The requirements, contracts and mockups settle most of this piece of work. These three points are still open. Contains no names or contact details.

## Q1. [Product owner] Who manages family records once families no longer belong to a group

Today a group administrator can open and change the families, parents and children of their kindergarten group on the Nyilvántartások screen. Under the new structure a family belongs to the whole community, so there is no longer a group that would limit which families they reach. The contract for roles says a group administrator "manages their own working group" and a super admin "administers the whole community", which would take this screen away from them.

A. Only super admins manage families, parents and children; the Nyilvántartások menu item disappears for group administrators. They can still see family names where they need them, such as when assigning a task (Recommended)
B. Group administrators keep the Nyilvántartások screen, read-only, for every family in the community
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] What the working-group cards say

The requirement for the six working groups (FR1.4) gives each a description. The teachers' documents exist for five of them and are long; there is no document for Állatgondozás.

A. I write a short Hungarian summary of two or three sentences for each of the five from the teachers' documents, and draft Állatgondozás from the animal-care duties we already know. You correct the wording in the screenshot review (Recommended)
B. The five cards carry the teachers' full text, and I draft only Állatgondozás
C. You give me the Állatgondozás text, and I summarise the other five
X. Other (please specify)

[Answer]: A

## Q3. [QA lead] How to record a must-have test case that makes no sense for a rule

Every database rule gets the fixed test list: allowed, refused, out of reach, outdated screen, repeated click, two people at once. Some cases have no meaning for some rules, for example "two people at once" on a rule that only reads. The contract leaves open how that is recorded, and this piece of work is the first to need it.

A. The test plan has a table with one row per rule and one column per case. Each cell names the test, or says "nem értelmezhető" with the reason. A reviewer can see at a glance that nothing was forgotten (Recommended)
B. Each such case appears in the test file as a skipped test carrying the reason, so it shows up in the test report
C. Both of the above
X. Other (please specify)

[Answer]: A
