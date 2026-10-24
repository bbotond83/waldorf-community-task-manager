# Infrastructure Design Questions: U4 Notifications and Excel import

U4 adds tables, policies and functions (SQL migrations), a server-only workbook parser with one new library, and application code on the stack U1 to U3 provide. No hosted infrastructure is created, no deployment workflow is added, and no stack setting changes. The one application setting that changes is the server-action upload size. Every infrastructure choice is fixed by U1 to U3 and the NFR answers, so there are no open questions for you in this stage.

## Assumptions (no answer needed; tell me if one is wrong)

1. The local stack, mail catcher, configuration file and environment variables stay as U3 left them; U4 adds no environment variable.
2. U4's SQL goes into new migration files applied by U1's runner in the default schema and the four worker schemas, numbered after U3's last file; merged migrations are never edited.
3. `next.config.ts` gains the server-action body limit of 6 MB (the only configuration change); the xlsx library is added to `package.json` as one exactly pinned dependency chosen at code generation, and the dependency audit blocks high and critical findings.
4. The CI workflow keeps its job structure; U4 adds test stages inside the existing database, build and browser steps, plus a generator for the fictitious workbook and the 3000-notification data set used only by tests.
5. The reminder tick runs lazily from the server and from housekeeping; no scheduler, queue or worker process is added.
6. No deployment, promotion or rollback procedure exists yet (team rule); a bad merge is reverted on `main`, and local recovery is a reset.
7. Monitoring stays structured server output and test timings.

## Consolidated Summary Confirmation

- No open infrastructure questions; seven assumptions as listed above.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
