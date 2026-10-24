# Infrastructure Design Questions: U3 Directory, settings and coordination

U3 adds tables, policies and functions (SQL migrations) and application code on the stack U1 and U2 already provide. No hosted infrastructure is created, no deployment workflow is added, and no stack setting changes. Every infrastructure choice is already fixed by U1, U2 and the NFR answers, so there are no open questions for you in this stage.

## Assumptions (no answer needed; tell me if one is wrong)

1. The local stack, mail catcher, configuration file and settings stay as U2 left them; U3 adds no environment variable.
2. U3's SQL goes into new migration files applied by U1's runner in the default schema and the four worker schemas; merged migrations are never edited.
3. The CI workflow keeps its job structure; U3 adds test stages inside the existing database, build and browser steps, plus a generated 150-family data set used only by tests.
4. No deployment, promotion or rollback procedure exists yet (the team rule: no deployment workflow before a deployable application and a linked target); a bad merge is reverted on `main`, and local recovery is a reset.
5. Monitoring stays structured server output and test timings.

## Consolidated Summary Confirmation

- No open infrastructure questions; five assumptions as listed above.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
