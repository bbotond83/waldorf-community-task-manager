# Delivery Planning Questions: Real backend, sign-in and seed data

Delivery Planning chooses the order and size of the Bolts. A Bolt is one build pass over a piece of the work, ending in something that runs. The five units form a single chain (U1 to U5), so only one build order respects the dependencies; these questions decide how big each Bolt is, how to treat outside prerequisites, and what to tackle early.

## Q1. How big should one Bolt be?

A. One Bolt per unit (five Bolts, in the order U1 to U5). Each unit already ends in something that runs, and the three XL units are split by owning block inside their design stages.
B. Split each XL unit (U2, U3, U4) into two Bolts, for eight Bolts: smaller runs and more checkpoints, but more ceremony.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. One Bolt per unit (five Bolts, in the order U1 to U5). Each unit already ends in something that runs, and the three XL units are split by owning block inside their design stages.

## Q2. How should the build order be chosen?

A. Dependency order only (U1, U2, U3, U4, U5): the chain leaves no other valid order, so no scoring model is needed.
B. Dependency order, but record a simple risk-first note per Bolt (what could go wrong and how the Bolt checks it), without a numeric scoring model.
C. Formal WSJF scoring (value and urgency against size) on top of the chain.
D. Not yet defined.
X. Other (please specify)

[Answer]: B. Dependency order, but record a simple risk-first note per Bolt (what could go wrong and how the Bolt checks it), without a numeric scoring model.

## Q3. Outside prerequisites: which of these hold us up, and what happens if they slip?

The prerequisites found so far: Docker Desktop installed with its licence checked (needed before U1 can run anything), Node 24, and the owner removing the workbook from the whole git history (a manual step reported at the end, which does not block building).

A. Docker Desktop must be installed by the owner before the U1 build starts; the history rewrite is tracked as an open item reported at the end. If Docker is not ready, Construction stops at U1 and does not start with mocks.
B. Same, but if Docker is not ready, U1 starts with a Homebrew PostgreSQL instance and switches to the local Supabase stack later.
C. Not yet defined.
X. Other (please specify)

[Answer]: A. Docker Desktop must be installed by the owner before the U1 build starts; the history rewrite is tracked as an open item reported at the end. If Docker is not ready, Construction stops at U1 and does not start with mocks.

## Q4. What worries you most about this build, so we tackle it early?

A. Row-level security getting the access rules wrong (a parent seeing another family's contact details), so the policy tests per role come early in U2.
B. Moving about 40 test files and 50 source files off synthetic mode in U5, so every unit leaves a reusable real-database test helper behind.
C. Both A and B.
D. Not yet defined.
X. Other (please specify)

[Answer]: C. Both A and B.

## Consolidated Summary Confirmation

- Bolt size: one Bolt per unit, five Bolts in the order U1 to U5.
- Order: dependency order, with a short risk note per Bolt and no numeric scoring.
- Outside prerequisites: Docker Desktop installed by the owner before U1 starts (construction stops at U1 if not); history rewrite tracked as an open item reported at the end.
- Early focus: policy tests per role early in U2, and a reusable real-database test helper left by every unit.

Does this all look correct before I generate the artifacts?

Looks correct
Request changes

[Answer]: Looks correct
