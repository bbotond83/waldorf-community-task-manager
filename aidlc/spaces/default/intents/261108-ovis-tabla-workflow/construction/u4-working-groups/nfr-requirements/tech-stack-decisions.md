# Tech Stack Decisions: u4-working-groups

This Unit stays inside the stack in `technology-stack.md`, as the constraints in `requirements.md` require. It follows `functional-spec.md`, `rules.md` and `contract-summary.md`.

## Decisions

| Area | Decision | Reason |
|---|---|---|
| Rules | Named Postgres functions behind row-level security, in one forward-only migration file for U4 | `team.md`; keeps every check on the database side |
| Changes to earlier functions | U4's migration redefines `end_admin` (adding a reason, and dropping the old signature), the general role-change function (adding the BR41.7 refusal), `lifecycle_run_core` (ending grants first) and `directory_list` (moving onto the shared contact helpers) | The second functional-design review showed each is needed for a U4 rule. Redefining them keeps the earlier migration files unchanged. |
| Membership version | An integer `version` column on the membership table, checked under a row lock, as the other C1 commands do | No new mechanism |
| Notices | U5's `notice_send` with two new kinds and one new target, added as registry rows by the migration | C8; no change to U5 |
| Group page read | One database function builds the page and leaves out withheld fields; no view and no filtering in the browser | ADR-008 |
| Screens | The existing Next.js app and `app/globals.css`, with `parent-`, `teacher-` and `admin-` classes as `team.md` requires | No new area prefix |
| Tests | The existing database, Vitest and Playwright suites | No new tool |

No new package, service or scheduler is added.
