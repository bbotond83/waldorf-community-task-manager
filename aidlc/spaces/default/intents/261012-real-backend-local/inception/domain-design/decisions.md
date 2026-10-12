# Architecture Decision Records: Real backend, sign-in and seed data

Revision 2, after the architecture review (`reviews/review-01.md`). Source: `requirements.md`, the confirmed answers in `domain-design-questions.md` (cited as "design Q1 to Q11"; the requirements file's own questions are cited as "requirements Q1 to Q14"), and the code knowledge base. Status of every ADR: Proposed until the Domain Design gate is approved.

## ADR-001: Eight domain blocks mirroring the existing module names

- **Context** — The app has an application layer, four in-memory adapters that run and nine domain modules nobody calls. Every area needs a database adapter behind the existing ports, and ownership of each entity must be unambiguous. (design Q1)
- **Decision** — Cut the target by domain area into eight blocks: Identity, Access, Directory, Coordination, Notifications, Import, PrivacyAudit and Settings, with the ApplicationKernel in front of them, the WebApp on top and DevelopmentTooling beside them.
- **Consequences** — Rules in the unused modules map one-to-one onto a block, so carrying them over is reviewable; more blocks mean more ports to keep consistent and a larger initial migration set; the blocks stay independent because cross-block writes live in the kernel (ADR-011).
- **Alternatives Rejected** — Four coarse blocks (Core Data, Workflows, Identity, PrivacyAudit): fewer ports, but ownership boundaries blur and the existing module names stop mapping; a single database layer with no blocks: no ownership at all.

## ADR-002: The teacher schedule is a read model inside Coordination

- **Context** — The teacher sees a schedule built from events, tasks and assignments for the groups granted to them, and must never see parent contact details. (design Q2)
- **Decision** — Coordination owns the data and exposes a teacher schedule read model without contact fields; there is no separate TeacherSchedule block.
- **Consequences** — One owner of the data with two views, so the teacher view cannot drift from the parent and admin views; Coordination gets a second, read-only port whose policy test is part of the per-role list (ADR-010).
- **Alternatives Rejected** — A separate TeacherSchedule block: it would read another block's tables or duplicate its data.

## ADR-003: PrivacyAudit is the single owner of the audit log, written in the same transaction

- **Context** — Role changes, approvals, imports, lifecycle actions and settings changes need audit events; the product requires audited role changes. (design Q3)
- **Decision** — PrivacyAudit owns the audit entity and its port; every other block records events through it, inside the same transaction as the audited change, so an audit failure rolls the change back and is reported through the calling use case's result state. Actor and target ids in audit rows are intentionally unconstrained typed ids.
- **Consequences** — One shape and one place for audit queries and retention; every change and its audit row commit or fail together; audit rows survive the removal of what they describe; a failing audit write blocks the change (accepted, because an unaudited change is not allowed).
- **Alternatives Rejected** — Each block with its own audit rows: different shapes, no single log to protect; audit written asynchronously: a change could exist without its audit event.

## ADR-004: Identity owns invitation state; acceptance is a kernel use case

- **Context** — An invitation carries an email, a role, a scope, an expiry and a token state, and points at the person or family it is for. Accepting it must create a sign-in user, an Account, the Parent link and the grants, and audit all of it. (design Q4, Q6)
- **Decision** — Identity owns the Invitation entity (the target and scope are typed unconstrained references). Acceptance is a kernel use case implemented as one database function that links the Account to the Parent, creates the grants and writes the audit event in one transaction; the sign-in user is created first through the sign-in service, and if the function fails afterwards the user is removed or deactivated (ADR-011).
- **Consequences** — Token and expiry logic stays next to sign-in and password reset; Directory stays free of credential-related state; Identity does not depend on Directory or Access; acceptance has one transaction and a defined compensation.
- **Alternatives Rejected** — Directory owning invitations: mixes people data with token state; Identity calling Directory and Access ports: creates dependency cycles and no single transaction.

## ADR-005: Development Tooling is separate from the app runtime and works from outside

- **Context** — The seed creates accounts with known test passwords and the reset empties the database; neither may ever exist in a deployed app. Parallel tests need their own data and accounts. (design Q5, requirements Q13)
- **Decision** — Seed, reset, start, stop, migrate, per-worker setup, the operator command and the privacy scan live in DevelopmentTooling. It creates accounts through the sign-in service's admin access and writes other rows with SQL; it imports nothing from the app runtime (a test checks this), and the seed refuses to run unless the database address is a local one (loopback host and the local stack's port). The per-worker databases and the first-super-admin command are explicitly allowed paths with their own checks (ADR-012, ADR-013).
- **Consequences** — A deployed app cannot contain test passwords or a reset path; the tooling must be kept in step with the schema (the SQL it writes is covered by a seed test); no account-creation method exists in shipped Identity code.
- **Alternatives Rejected** — Seed code inside the persistence layer or calling block ports: one wrong import could ship it, and ports would need a direct-create account method.

## ADR-006: Simplified application layer; database policies are the source of truth for visibility

- **Context** — Today the authorization contract, scope checks and projection guard run in application code in front of in-memory state; the requirements demand that contact details are protected by the database. (design Q6)
- **Decision** — Keep result states, the facade pipeline, idempotency (now stored in the database) and the projection guard; move who-may-see-what into row-level security policies owned by Access. The kernel keeps exactly four checks: the session is active, the authorization version is current, a scope probe for detail screens, and the idempotency record (ADR-009).
- **Consequences** — One enforcement point that holds even for a bug in a screen; less duplicated scope logic; every policy needs a per-role, per-read-path test (ADR-010); a policy mistake is a data exposure.
- **Alternatives Rejected** — Keeping the authorization contract unchanged in front of every block: duplicates the database's rules and can disagree with them.

## ADR-007: Sign-in users are external; Directory owns the person and the account link

- **Context** — The sign-in service owns users and passwords; the product ties a user to a family and roles; ids are uuids throughout. (requirements Q6)
- **Decision** — The sign-in user is an external dependency of Identity. Identity's Account entity mirrors it (id equal to the user's id) and has no outward references; Directory's Parent refers to the account; Access's grants refer to the account. The session carries the account id, which the kernel maps to the Parent and the grants on each request.
- **Consequences** — A person can exist before the account (imported or invited); one account per parent; the references run one way (Access and Directory to Identity), so the graph is acyclic; the per-request mapping adds lookups that must stay within the sign-in time budget, which is why every table carries the scope columns the policies need (ADR-006) and the mapping is measured at Build and Test.
- **Alternatives Rejected** — Storing credentials ourselves: security risk and no gain; making the sign-in user the person record: cannot represent people who have not signed up yet; Account referencing Parent: creates a cycle with Parent referencing Account.

## ADR-008: The nine unused modules are dissolved into the blocks, with a rule-disposition ledger

- **Context** — Nine modules hold rules and in-memory stores that nothing calls, while the same rules also exist embedded in the four running adapters. (design Q1 and the application-port decision of requirements Q8)
- **Decision** — Review every rule in the nine modules and in the four running adapters, carry the correct ones into the owning block (see "Where the Existing Modules Go" in `components.md`), record any rule consciously dropped with its reason in a rule-disposition ledger that Functional Design must produce, then remove the modules and their tests.
- **Consequences** — One implementation of each rule; the ledger makes loss visible and testable; the work includes a rule-by-rule review (a real effort at functional design); removing the modules reduces dead code.
- **Alternatives Rejected** — Making the unused modules the domain layer: synchronous ports, in-memory transactions and an unproven rule set would have to be rebuilt; leaving them in place: permanent duplication and confusion.

## ADR-009: Database identity and the kernel's four checks

- **Context** — Row-level security filters rows silently, so a denied read looks like "not found"; if adapters used the service-role key the policies would be bypassed. The screens need explicit denied states for privacy-sensitive details. (design Q7, review R-04)
- **Decision** — Normal reads and writes run as the signed-in user, so the policies apply. A short, named list of elevated, server-only functions runs with elevated rights: idempotency record writes, audit writes, invitation acceptance, import commit, lifecycle execution, the operator command and the seed. The elevated key exists only in a server-only module and never reaches the browser. A detail screen first calls the scope probe (a function owned by Access that returns allowed, denied or not-found using minimal columns), so a denied detail screen is told apart from a missing one.
- **Consequences** — The policies are real enforcement; denied states stay explicit; the elevated list is small, reviewable and tested (each function checks the caller's grants itself); every elevated function is a place where a mistake bypasses the policies, so each has a test with the wrong role.
- **Alternatives Rejected** — Everything elevated with application checks: one bug in a screen would leak data and the policies would be decoration.

## ADR-010: Parent contact details live in their own table with an admin-in-scope policy

- **Context** — A policy cannot hide one column of a row that other readers need (name, family, assignments). The product makes contact details admin-only and the requirements review asked for no contact fields on teacher, schedule, import and list reads. (design Q8, review R-03)
- **Decision** — Directory owns a separate ParentContact entity. Admins within their scope read and change it; a parent reads only their own entry; teachers and every other reader read none. Lists, the teacher schedule, import previews and exports read only the Parent row, never ParentContact. Access owns a policy test list with one case per role and per read path (parent, teacher, group admin of another group, group admin of the same group, super admin; schedule, import preview, family list, notification, any export).
- **Consequences** — The database makes it impossible to read contact data by mistake through other reads; contact screens need an explicit second read; a duplicated email on Account is allowed only because the sign-in service needs it and is excluded from every non-admin read.
- **Alternatives Rejected** — Views that omit the columns: every new read path must remember to use the view, and a missed one leaks.

## ADR-011: Cross-block writes are database functions called by the kernel

- **Context** — Import commit, invitation acceptance, sign-up with notification and swap or cancellation approval write through two to four blocks; "atomic commit" cannot hold across several round trips. Calls between blocks also created dependency cycles. (design Q9, review R-02 and R-05)
- **Decision** — Each such use case is one database function run in one transaction, audit event included, owned and called by the ApplicationKernel. The blocks do not call each other. A use case that also creates a sign-in user creates it first and removes or deactivates it if the function fails afterwards. A seed or import that fails leaves no partial data.
- **Consequences** — Atomic by construction; blocks stay independent and the graph acyclic; the kernel gets a list of named functions to review and test; business rules inside these functions are SQL, so the rule-disposition ledger (ADR-008) must say where each rule now lives.
- **Alternatives Rejected** — A unit of work in application code with step-by-step compensation: weaker guarantees, more failure modes, no single place to test atomicity.

## ADR-012: The first super admin is created by a one-time operator command

- **Context** — Invitations need an admin and the seed only runs locally, so a real hosted database would have no first administrator. (design Q10, requirements review R-02)
- **Decision** — A documented operator command, separate from the seed and run outside the app from the operator's own machine, creates the first super admin through the sign-in service's admin access, after the operator confirms the target, and records an audit event. It refuses to run when a super admin already exists.
- **Consequences** — A defined path to the first administrator on any database, including the hosted one later; the command needs the admin credentials only on the operator's machine; it is tested locally against the local stack.
- **Alternatives Rejected** — Out of scope: leaves the hosted step without a way in; the seed doing it: the seed must never run on a non-local database.

## ADR-013: Parallel tests use one shared stack with a schema and an account namespace per worker

- **Context** — The sign-in service is one shared service with one user table; three browser projects and many test files run in parallel. (design Q11, requirements Q9, review R-07)
- **Decision** — One local stack is shared. Each test worker gets its own database schema with the same migrations (policies reference the schema's tables) and its own account namespace (worker-specific email addresses), created and reset by the tooling between test files. Tests set up their data through the seed functions for their worker, not through removed hooks. The local-database guard allows these worker schemas because it checks the host and port, not the schema name.
- **Consequences** — Fast and independent; migrations must run per schema, and policies must not hard-code a schema name (a test checks this); the acceptance criterion is three consecutive runs of two parallel workers without interference.
- **Alternatives Rejected** — A complete stack per worker: heavy on memory and start-up time, with port management for every browser project.
