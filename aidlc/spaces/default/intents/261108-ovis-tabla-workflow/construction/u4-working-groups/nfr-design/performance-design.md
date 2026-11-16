# Performance Design: u4-working-groups

This file sets out how the targets in `performance-requirements.md` are met. It follows `functional-spec.md`, `tech-stack-decisions.md` and `technology-stack.md`, and contains no names or contact details.

## Read Path

`working_group_detail` returns the whole page in one call: the group, whether it has a coordinator, the member rows, and the caller's own membership id and version (NFR9.9).

- **How the query works.** It is one set-based query. It starts from the group's active memberships, joins parents, families and the parent profile, and works out the coordinator flag from one join on the group's unrevoked group-admin grants.
- **Who the viewer is.** The function decides once per call whether the viewer is a parent, a teacher or a super admin.
- **Phone and email.** These come from the two shared contact helpers that `directory_list` also uses. The helpers are security-definer functions with a pinned search path, so Postgres does not fold them into the query; they run once per member row. At about 40 rows that is well inside the 2-second target, and the timing test confirms it.
- **Size.** At about 40 member rows, the result is far below the data API's limit of 1000 rows.
- **Indexes.** The existing indexes serve every lookup: `group_memberships_one_active` and `group_memberships_parent` for the memberships, and `app_role_grants_scope` for the group's grants. No new index is added.

No cache is used. A cached row could show a phone number after its parent unticked sharing, which NFR2.3 forbids, and a fresh read at this size is cheap.

## Commands

Join, leave, appoint and revoke each lock at most two rows and write a handful of rows: the membership, the grant, the audit row, the notice and the queued email. Each finishes well under the 2-second target (NFR9.10). The email itself is sent later by U5's delivery run, so no command waits for the mail server.

## Other Changes

`directory_list` moves onto the shared helpers without changing its query shape. `lifecycle_run_core` gains one update on the family's grants before its deletes. The existing timing tests on the large seed show both stay as fast as before (NFR9.11).

## Measurement

A database test times `working_group_detail` as a parent, a teacher and a super admin, and times each command, all on the `db:seed:large` set of 30 invented families with every parent a member of one group. A browser test measures the two group pages on the same seed (NFR9.8, NFR9.9, NFR9.10).

## Screens

Both group pages use the existing Next.js app and `app/globals.css`.

- **Styling.** The pages use the classes `parent-group-*`, `teacher-group-*` and `admin-group-*`. Long names wrap.
- **Language.** All text is Hungarian, including the refusal texts, the confirmation before leaving and the notice titles (NFR8.3).
- **Checks.** Each page is designed in Stitch first and checked at phone width and by keyboard, with no serious or critical accessibility violations (NFR8.4).
