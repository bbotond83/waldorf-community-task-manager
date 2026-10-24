# Security Requirements: U3 Directory, settings and coordination

Source: NFR1 of the requirements, rules BR30.1 to BR30.8, BR31.5, BR31.8, BR31.9, BR32.2, BR32.3, BR32.6, BR33.1, BR35.1 and BR35.2, U2's security requirements, and the first reviews of the functional design.

| ID | Requirement | Check |
|---|---|---|
| NFR1.25 | Contact details are readable only by the parent, the other parents of the same active family and admins in reach, enforced by row-level policy on `ParentContact` and in every function that touches it; parents of other families, teachers and signed-out requests get nothing (BR30.5) | A policy test per role, including the co-parent, over the table and over every function and view |
| NFR1.26 | Every policy and function of U3 is tested per role: parent of the family, co-parent, parent of another family, teacher of the group, teacher of another group, group admin of the group, group admin of another group, super admin, signed-out, deactivated account (BR32.6) | The role matrix test, extended to all U3 tables and functions |
| NFR1.27 | Every U3 function is security definer, pins its search path, is not executable by anon, checks its caller and is on the elevated-function catalogue with its allowed roles and reason (BR32.6) | U2's catalogue test, extended |
| NFR1.28 | The service-role key gets no table rights on any U3 table and may execute only the lifecycle and invitation functions it needs (U2 NFR1.4) | U2's privilege test, extended to U3 objects |
| NFR1.29 | Contribution notes, allergen notes and event notes follow BR31.8 and BR31.9: other families' parents and teachers never read them | Policy tests per role and per read path, including the schedule |
| NFR1.30 | The teacher schedule returns no contacts, notes or people's ids (BR33.1) | A shape test on the function result and a policy test |
| NFR1.31 | Cross-organization isolation: no U3 function accepts or returns a record of another organization, and an id of another organization behaves as not found | Two-organization tests for every use case |
| NFR1.32 | Group reach is exact (entities.md, Placeholder tables): a group admin reaches a family only through an active membership in a group they hold a grant for, and an assignment through its task's group; U2's rewritten functions keep U2's identity tests, including every group-admin case, green | U2's identity test suite re-run on the new tables, plus new reach tests |
| NFR1.33 | Swaps and decisions cannot be forged: only the requester's own assignment can be the source, only the other family can confirm, and only an admin in reach can decide; all stored versions and task ids are rechecked (BR31.4, BR31.5) | Database tests for each actor and each stale case |
| NFR1.34 | Inputs are validated at the boundary: lengths, dates, capacity and enumerations (entities.md), and all text is stored as text, never executed; screens escape output | Validation tests per field and a markup-injection test on names and notes |
| NFR1.35 | Personal data stays out of logs and audit events: no names, contacts or notes; audit details stay code-shaped (U1) | Output scans with fake personal data for every server action |
| NFR1.36 | The lifecycle (BR35) deletes or anonymizes completely: contacts, optional profiles, memberships, note and reason text, account links, and the parents' accounts are deactivated; one audit event is written; nothing personal remains in the anonymized family | A database test that searches every U3 table for the original values after each lifecycle path |
| NFR1.37 | Dependency and secret scans stay green; no new library is added without exact pinning and audit | The existing scans and the dependency audit (high and critical block) |

Threat considerations: reading another family's contacts or notes (NFR1.25, NFR1.29), reaching another group (NFR1.26, NFR1.32), forged swap or decision (NFR1.33), overbooking and double places (NFR3.7), data left after deletion (NFR1.36).
