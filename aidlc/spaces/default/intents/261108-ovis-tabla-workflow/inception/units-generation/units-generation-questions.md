# Units Generation Questions

These decide how the agreed work (`components.md`, `requirements.md`, `stories.md`) is cut into separately built and merged pieces, called units. The order in which the units are built is decided later, in Delivery Planning.

Settled without a question: the app stays one application with one database and nothing is deployed in this work (`team.md`, Deployment), so every unit ships into the same running app. The pieces talk to each other through database functions and ids, as `decisions.md` records (ADR-010). The thin first slice is already agreed: one community-wide rota from the database to the parent's screen, which the owner checks before the rest is built (`team.md`, Walking Skeleton).

## Q1. [Delivery] How should the work be cut into units?

Each unit becomes something built, checked and merged on its own, so the cut decides what you can look at and judge after each one.

A. By feature area that a person can try out, such as "weekly rotas" or "lending library", each with its database rules and its screens together (recommended)
B. By technical layer: all the database work first, then all the screens
C. One unit for each of the 19 building blocks in the design
X. Other (please specify)

[Answer]: A

## Q2. [Delivery] How large should a unit be?

The team's rule is that each piece fits a short-lived branch and becomes one commit on the main line. Larger units mean fewer review rounds for you, but each one is harder to check.

A. About 12 to 15 medium units, each checkable in one sitting (recommended)
B. About 6 large units, with fewer rounds but much more to check each time
C. 25 or more small units, with many rounds and little to check each time
X. Other (please specify)

[Answer]: A

## Q3. [Delivery] May independent units be built at the same time?

Database changes are applied strictly in file-name order and you are the only reviewer, so building side by side saves less than it usually would. The plan will still record which units do not depend on each other.

A. One at a time, so the main line always runs and you check one thing at a time (recommended)
B. Side by side wherever the units do not depend on each other
X. Other (please specify)

[Answer]: A

## Q4. [Product] Should removing the kindergarten groups be part of the first rota slice?

The agreed first slice is one community-wide rota, but a community-wide rota cannot exist until the kindergarten groups are replaced by one community (the first requirement group, FR1). That conversion touches every access rule and is the riskiest change in the design.

A. Separate unit first: convert the app to one community, with today's screens still working, then build the rota slice on it. The rest still waits until you have checked the rota (recommended)
B. One combined unit: the conversion and the first rota together, as one large piece to check
X. Other (please specify)

[Answer]: A
