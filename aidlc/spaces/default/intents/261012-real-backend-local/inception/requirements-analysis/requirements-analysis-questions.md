# Requirements Analysis Questions: Real backend, sign-in and seed data

The scope is fixed (see the scope document). These questions settle the open design-level decisions that the code scan and the product requirements document (`source-materials/waldorf-community-app/waldorf-community-task-manager-prd-v1-en.md`, the authoritative source) raise.

## Q1. Which container tool should run the local database, since Docker is not installed yet?

A. Docker Desktop (the standard choice; needs an installer and a licence check for the owner's use).
B. Colima with the Docker command line (free, command-line only).
C. OrbStack (light and fast on a Mac; commercial licence for some uses).
D. Not yet defined; decide at infrastructure design.
E. Not applicable.
X. Other (please specify)

[Answer]: A. Docker Desktop (the standard choice; needs an installer and a licence check for the owner's use).

## Q2. Is the final hosted stack the one in the product requirements (Supabase for database and sign-in, Vercel for hosting), so that the local environment should be the local Supabase stack (Postgres, Auth and a local mail catcher)?

A. Yes: the local environment is the local Supabase stack, as close to the hosted one as possible.
B. Yes for the database and sign-in, but the local environment may use plain PostgreSQL plus a separate sign-in component.
C. No: the final stack is different; describe it in your answer.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: A. Yes: the local environment is the local Supabase stack, as close to the hosted one as possible.

## Q3. How should accounts be created, as the product requirements describe (FR-001, FR-002)?

A. An admin invites a person by email and role, the person opens the invitation link and sets a password; locally the invitation email lands in a local mail catcher (no real delivery).
B. A, and the seed also creates ready-made accounts with known test passwords for the roles.
C. B, and an admin can also create an account directly with a temporary password.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: A. An admin invites a person by email and role, the person opens the invitation link and sets a password; locally the invitation email lands in a local mail catcher (no real delivery).

## Q4. Is password reset (FR-002) part of the first version?

A. Yes, through the local mail catcher.
B. No, it comes later.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. Yes, through the local mail catcher.

## Q5. Which role set should the real database use?

A. The four roles the app uses today (parent, teacher, group admin, super admin), as the earlier role simplification decided.
B. The five roles in the product requirements (super admin, kindergarten admin, group admin, parent, read-only staff).
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. The four roles the app uses today (parent, teacher, group admin, super admin), as the earlier role simplification decided.

## Q6. How should record ids work in the real database? Today the SQL uses uuid and all TypeScript fixtures and the session use readable text ids such as `family-boroka`.

A. All ids become database-generated uuids; the text ids in code and tests go away (the seed and tests refer to records by lookups or fixed seed uuids).
B. Keep readable text ids as primary keys for the new tables, and keep uuid only for the people who sign in.
C. Not yet defined; decide at domain design.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. All ids become database-generated uuids; the text ids in code and tests go away (the seed and tests refer to records by lookups or fixed seed uuids).

## Q7. The first existing migration (`20260806_access_rls.sql`) does not run on real PostgreSQL (a reserved word is used as an alias), and a unit test pins its checksum. Nothing has been deployed anywhere. What should happen?

A. Fix the file and update the pinned checksum test (the history is rewritten; fine because nothing is deployed).
B. Replace both existing migrations with one new, complete baseline migration, and retire the old files and their tests.
C. Keep both files and add new migrations on top (the first one would still have to be fixed for the local stack to start).
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: A. Fix the file and update the pinned checksum test (the history is rewritten; fine because nothing is deployed).

## Q8. Nine domain modules under `src/` (access, coordination, directory, import-migration, notifications, parent-experience, privacy-audit, admin-experience, teacher-tracking service) have their own rules and in-memory stores but nothing in the app uses them; the app runs on four separate in-memory adapters. What should the real adapters build on?

A. The application ports the app already calls; the database adapters implement them, and the unused modules are removed once their rules are carried over.
B. The unused modules become the real domain layer and the application ports delegate to them.
C. Decide at domain design, after looking at both.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: A. The application ports the app already calls; the database adapters implement them, and the unused modules are removed once their rules are carried over.

## Q9. Tests run against the local database (scope decision). How should they be isolated from each other, given three browser projects that run in parallel?

A. One database (or schema) per test worker or browser project, reset between test files.
B. One shared database, tests run one at a time, reset between tests.
C. Decide at infrastructure design.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: A. One database (or schema) per test worker or browser project, reset between test files.

## Q10. Checks must be green before merge, and the tests will need a database. May the CI workflow be changed in this work to start a database service for them?

A. Yes: update the CI workflow to start the database service and run the database-backed tests (deployment workflows stay disabled).
B. No: CI stays as it is; database-backed checks run locally only for now (merging then relies on local results).
C. Decide at infrastructure design.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: A. Yes: update the CI workflow to start the database service and run the database-backed tests (deployment workflows stay disabled).

## Q11. What should the seed contain, and what data must never be in it?

A. A small fixed set: 2 groups, about 6 families with parents and children, a group admin, a super admin, a teacher, and a few events and tasks. Fictitious data only.
B. The 30-family size of the Excel import sample, with fictitious names.
C. Both: the small set for tests and the 30-family set for demonstrations, selectable. Fictitious data only.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: C. Both: the small set for tests and the 30-family set for demonstrations, selectable. Fictitious data only.

## Q12. The committed Excel workbook (`source-materials/.../Ovis tábla v2.xlsx`) is the import's real source. Does it contain real names, emails or phone numbers of real people?

A. No: it is fictitious or structure only, and it may be used as the import's test source.
B. Yes: it holds real personal data; it must not be used as a seed or test source, and the import is tested with a fictitious workbook of the same structure.
C. Not sure; check it first.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: B. Yes: it holds real personal data; it must not be used as a seed or test source, and the import is tested with a fictitious workbook of the same structure.

## Q13. Accounts are created by invitation only (Q3), yet the seed must create people who can sign in at once for testing. How should the seed's people get their accounts? (follow-up to Q3 and Q11)

A. The seed creates their accounts directly with known test passwords, for development and tests only; the production path stays invitation only.
B. The seed creates them as invited people and then accepts the invitations automatically with known test passwords (the same path as a real invitation).
C. Not yet defined; decide at functional design.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. The seed creates their accounts directly with known test passwords, for development and tests only; the production path stays invitation only.

## Q14. The workbook with real personal data (Q12) is committed in the repository (`source-materials/waldorf-community-app/Ovis tábla v2.xlsx`). What should happen to it? (follow-up to Q12)

A. Stop tracking it from now on and keep it only on the owner's machine (listed in the ignore file); it stays in the repository's earlier history.
B. Stop tracking it and also remove it from the repository's whole history (rewriting history and replacing the remote copy; the owner does this step).
C. Leave it as it is.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: B. Stop tracking it and also remove it from the repository's whole history (rewriting history and replacing the remote copy; the owner does this step).

## Consolidated Summary Confirmation

- Container tool: Docker Desktop (installer and a licence check for the owner's use are prerequisites).
- Hosted stack: Supabase and Vercel as in the product requirements; the local environment is the local Supabase stack (Postgres, Auth, a local mail catcher).
- Accounts: invitation only (admin invites by email and role, the person sets a password); locally the email lands in the mail catcher. Password reset is in the first version, also through the mail catcher.
- Seed accounts: the seed creates its people's accounts directly with known test passwords, for development and tests only; the production path stays invitation only.
- Roles: the four roles the app uses today (parent, teacher, group admin, super admin).
- Ids: database-generated uuids everywhere; the readable text ids in code and tests go away.
- First migration: fix the file and update the pinned checksum test (nothing is deployed).
- Domain layer: the database adapters implement the application ports the app already calls; the nine unused modules are removed once their rules are carried over.
- Tests: one database (or schema) per test worker or browser project, reset between test files.
- CI: the workflow is updated to start the database service and run the database-backed tests; deployment workflows stay disabled.
- Seed: a small fixed set for tests and a 30-family set for demonstrations, selectable; fictitious data only.
- Workbook: the committed Excel workbook holds real personal data; it is never a seed or test source (the import is tested with a fictitious workbook of the same structure), it is no longer tracked, and it is removed from the repository's whole history (the owner performs the history rewrite).

Does this all look correct before I generate the artifact?

Looks correct
Request changes

[Answer]: Looks correct
