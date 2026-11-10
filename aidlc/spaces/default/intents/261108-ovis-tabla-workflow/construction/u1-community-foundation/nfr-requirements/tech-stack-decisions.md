# Tech Stack Decisions: u1-community-foundation

This Unit stays inside the stack in `technology-stack.md`, as the constraints in `requirements.md` require. It follows `functional-spec.md`, `rules.md` and `contract-summary.md`.

## Decisions

| Area | Decision | Reason |
|---|---|---|
| Rules | Named Postgres functions behind row-level security, as forward-only migration files | `team.md`; keeps every check on the database side |
| Screens | The existing Next.js app and `app/globals.css`, with a new `workgroup-` class prefix | `team.md` requires an area prefix for a new area |
| Tests | The existing database, Vitest and Playwright suites | No new tool is needed |
| Technical names | Keep `groups`, `group_id` and scope `organization` | A rename adds risk and changes no behaviour |
| `@e965/xlsx` | Removed with the import parser. U15 adds it back as a development tool if its script needs it | ADR-009; a production dependency with no production use only adds exposure |

No new package, service or scheduler is added.
