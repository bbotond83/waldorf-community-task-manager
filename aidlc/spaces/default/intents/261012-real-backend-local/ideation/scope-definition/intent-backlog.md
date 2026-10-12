# Intent Backlog: proto-units in dependency order

Prioritization: MoSCoW. The owner put every capability below into the first version (Scope Definition Q1, Q2 and Q7), so each is a Must for this version; the order follows dependencies (Q3), not importance.

| # | Proto-unit | MoSCoW | Depends on | What it delivers |
|---|---|---|---|---|
| P1 | Local environment | Must | none | Container-based local database, the two existing migrations applied, configuration and secret handling that never commits secrets |
| P2 | Identity and sessions | Must | P1 | Email and password accounts, real sessions, roles and scopes from the existing access model, several people signed in at once |
| P3 | Directory data | Must | P1, P2 | Groups, families, children and school years as real records with scoped access |
| P4 | Events and tasks | Must | P3 | Events, tasks, assignments and capacity as real records |
| P5 | Parent interaction | Must | P2, P4 | Task sign-up, swaps, cancellations and approvals between real people |
| P6 | Notifications and reminders records | Must | P2, P5 | Per-parent notification and reminder records in the real database; delivery stays simulated |
| P7 | Invitation sign-up | Must | P2, P3 | New parents join through the existing invitation link and get an account |
| P8 | Teacher schedule | Must | P2, P3, P4 | The teacher schedule on real data |
| P9 | Excel import | Must | P3, P4 | The Excel import writing real records |
| P10 | Seed and reset | Must | P3 to P9 | A repeatable seed of parents, families, groups, a group admin, a super admin and a teacher with events and tasks, and a reset |
| P11 | Test migration and synthetic removal | Must | P3 to P10 | Automated tests run against the local database; synthetic mode is removed from the code |

## Dependency Notes

- P1 and P2 are the foundation: nothing else can be tested without a running database and real sign-in.
- P3 and P4 carry the working data; P5 to P9 build on them.
- P10 needs the schemas of everything it seeds; P11 comes last because moving the tests and removing synthetic mode needs the real adapters in place.

## Assumptions & Open Questions

- Whether some proto-units can run in parallel is decided at Units Generation and Delivery Planning, not here.
- The final unit boundaries may merge or split these proto-units at Domain Design and Units Generation.
