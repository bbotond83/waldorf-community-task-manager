# Units Generation Questions: Real backend, sign-in and seed data

The domain design fixed eleven building blocks and their dependencies; the construction phase will take each unit of work through functional design, NFR requirements, infrastructure design, code generation and build and test, one unit at a time. These questions decide how the blocks are grouped into units. The order in which units are built is decided later, at delivery planning.

## Q1. How should the units be cut?

A. By domain blocks, following the dependency order of the design: local platform; audit; identity and access; directory and settings; coordination; notifications; Excel import; seed and test migration.
B. By user-visible flows (vertical slices): sign-in and invitations; the parent task flow; admin records; teacher schedule; import. Each slice cuts through several blocks.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. By domain blocks, following the dependency order of the design: local platform; audit; identity and access; directory and settings; coordination; notifications; Excel import; seed and test migration.

## Q2. How coarse should the units be, given that every unit goes through all the construction design stages and checkpoints?

A. Eight units (one per group of blocks in Q1 option A): small and reviewable, but about eight rounds of construction stages.
B. Five units: local platform and audit together, identity and access, directory and settings with coordination, notifications and import together, seed and test migration.
C. Four units: foundation (platform, audit, identity, access), data (directory, settings, coordination, notifications), import, seed and test migration.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: B. Five units: local platform and audit together, identity and access, directory and settings with coordination, notifications and import together, seed and test migration.

## Q3. May independent units be built in parallel?

A. No: one unit at a time, strictly in dependency order (matches the current serial construction setting).
B. Yes, where the dependency graph allows it.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. No: one unit at a time, strictly in dependency order (matches the current serial construction setting).

## Q4. What is the deployment model for the units?

A. Everything ships in the one existing web application (a modular monolith); the local platform and the seed and test tooling are not deployed.
B. Some units become separately deployed services.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. Everything ships in the one existing web application (a modular monolith); the local platform and the seed and test tooling are not deployed.

## Q5. What is the contract between units, since they all share one database schema?

A. The application ports the screens call, plus the schema: each unit adds its own migration files and its own policy and function tests, and a later unit may rely only on what earlier units' migrations and ports provide.
B. A single shared migration set owned by the first unit; later units only add adapters.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. The application ports the screens call, plus the schema: each unit adds its own migration files and its own policy and function tests, and a later unit may rely only on what earlier units' migrations and ports provide.

## Consolidated Summary Confirmation

- Boundary strategy: by domain blocks, following the dependency order of the design.
- Granularity: five units: (1) local platform and audit, (2) identity and access, (3) directory, settings and coordination, (4) notifications and Excel import, (5) seed and test migration.
- Parallelism: none; one unit at a time in dependency order.
- Deployment: everything ships in the one existing web application; the local platform and the seed and test tooling are not deployed.
- Contract between units: the application ports plus the schema; each unit adds its own migrations and its own policy and function tests, and a later unit relies only on what earlier units provide.

Does this all look correct before I generate the artifact?

Looks correct
Request changes

[Answer]: Looks correct
