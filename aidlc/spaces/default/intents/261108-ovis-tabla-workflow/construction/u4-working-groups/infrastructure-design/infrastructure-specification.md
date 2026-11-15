# Infrastructure Specification: u4-working-groups

Nothing is hosted. The app and the database run on the owner's computer (`team.md` Deployment). This Unit adds no cloud resource, command, scheduled job or setting. It changes the database structure and adds three screens to the existing app.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | Unchanged: the Next.js app on the owner's computer | Hosting is separate later work |
| Networking | Unchanged: the local stack answers on loopback only | Project correction on the local stack's ports |
| Storage strategy | One local Postgres and one new forward-only migration file | `team.md`: an applied file is never edited |
| Environments | Local only | No staging or production exists |
| IaC approach | A SQL migration plus app code, with no cloud templates | Nothing to provision |
| Resource sizing | About 40 parents, six groups, a few hundred membership rows a school year | `scalability-design.md` |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Postgres | Database | **One migration file in its own transaction.** It holds every change below.<br>**Membership table.** It gets a `version` column and an `end_reason` column, the backfill `end_reason = 'left'` on rows that already ended, and a check that `end_reason` is set exactly when the status is ended.<br>**New functions.** The new page read, the four commands, the C7 facts functions, the C16 removal steps, the two contact helpers and the `working_group` facts function.<br>**Changed functions.** `end_admin` is replaced: the old signature is dropped and a three-parameter version is created. The general role-change function, `directory_list` and `lifecycle_run_core` are redefined.<br>**Function rights.** `revoke all` and the intended grants are restated after every new and redefined function. Only the page read and the four commands are granted to signed-in users.<br>**Notice registries.** U5's registries gain one target type and two notice kinds.<br>**Indexes.** None are added; the existing ones are enough (`performance-design.md`). | No new table |
| WebApplication | Screens | Three routes: `/szulo/munkacsoportok/[id]`, `/teacher/munkacsoportok/[id]` and `/admin/munkacsoportok/[id]`. They get links from the existing list pages, entries in `role-policy.ts`, `authorization.ts` and the navigation, and exact rows in `verification/authorization-matrix.json`. | No new setting |
| Mail catcher | Delivers the coordinator emails in tests | Reached through U5's existing delivery command and mailer | No new variable |
| Seed and reset | Invented data | The seed's working groups get invented members and one invented coordinator per group, so the pages can be seen on the local stack. Test addresses go in `scripts/verification/privacy-allowlist.json`. | No real person |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| `group_members`, `group_coordinators` (C7) | u4-working-groups | U6 to U13 as they need group facts | Internal database functions, granted to nobody, called by same-owner functions |
| Working-groups removal steps (C16) | u4-working-groups | U14 | Internal; U14 calls U4's block before U3's directory block |
| `end_admin` with its reason | u1-community-foundation (changed here) | U4, and U14 through the removal steps | Internal, granted to nobody |
| Contact helpers | u3-directory-and-profile (moved out of `directory_list` here) | U3, U4 | Internal, granted to nobody |
| `notice_send` and its registries (C8) | u5-reminders-and-email | U4 | Used unchanged; U4 adds registry rows in its migration |
| Audit log | u1-community-foundation | All Units | `role.grant` and `role.revoke` only |
