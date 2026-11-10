## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-09T17:37:26Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u1-community-foundation/code-generation/code-summary.md > Limitations; supabase/migrations/20261047_community_foundation.sql > identity_linked_parent, has_core_scope | In the database, a group-admin grant counts while the linked parent and family are active. It does not need a parent grant on the family. The pages also need the parent grant (holdsParentRole in src/runtime/production/access.ts). An account with a group-admin grant and no parent grant is refused on the pages but still passes the database checks (tasks_read, task_save_core and the other group-scoped commands). The summary notes the page side and says it fails closed. It does not say the database side is looser. | Decide whether the group-admin reach should also require the parent grant in the database (the same predicate as current_parent_id). Otherwise state the difference in the Limitations section and add a test that pins the chosen behaviour. | New |
| R-02 | Minor | git status of the working tree; aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u1-community-foundation/code-generation/source-manifest.json > writes | The working tree holds changes the manifest does not claim and the Unit does not need: ten files under aidlc/spaces/default/codekb/, the audit files of intents 261102, 261104 and 261106, intents.json, aidlc/spaces/default/memory/team.md and project.md, and the aidlc/.aidlc-subagent-inflight marker. The manifest also lists whole folders (tests/, src/runtime/, src/data/, app/teacher/) instead of the files changed. | Keep those workflow-record files out of this Unit's squash commit. Or list the actual changed paths in the manifest so the claimed scope can be checked. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u1-community-foundation/code-generation/code-summary.md; verification/reports/u1-community-foundation/ | The new /szulo, /teacher and /admin munkacsoportok screens and the new .workgroup-* CSS follow the team rule of a Stitch design plus owner screenshot comparison. Screenshots exist in verification/reports/u1-community-foundation/, but nothing records that the owner has compared them with the Stitch design. | Report the owner's screenshot comparison as outstanding evidence at the approval gate, not as done. | New |
| R-04 | Minor | supabase/migrations/20261047_community_foundation.sql > assignment_assign_core | A caller who is not a super admin gets a refusal when the family id does not exist and a normal result path when the family exists, provided the task is in reach. This is a small way to test whether a family id exists. The caller can already read family names through family_name_list, and the ids are UUIDs, so the exposure is negligible. | Optionally add a test, or a comment, confirming that this difference is accepted. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| node --experimental-strip-types --test --test-concurrency=1 tests/database/community-structure.test.ts tests/database/community-roles.test.ts tests/database/community-duties.test.ts | PASS: tests 199, suites 7, pass 199, fail 0, skipped 0 | All fixed-list titles ran on the live local stack, including the BR2.5, BR3.3, BR3.4 and BR3.5 refusal cases and the BR1.4 forced-failure rollback. |
| node --experimental-strip-types --test src/access/role-policy.test.ts src/access/access-matrix.test.ts | PASS: tests 10, pass 10, fail 0 | Role pairs, scope shapes, the working-group read rule and the group-admin core matrix hold. |
| npm run verify:local | Not rerun, as instructed; its logs were not opened | The pass claimed in code-summary.md is the orchestrator's evidence, not something I observed. |

**Security core: what I checked**

- A group administrator reaches only groups they hold. has_core_scope allows a super admin, or a non-null group with an unrevoked group_admin grant while the linked parent and family are active. coordination_reach_groups and coordination_reach_task_ids add community-wide tasks only for a super admin. The tasks_read, events_read and assignments_read policies use these.
- task_save_core, event_save_notes, assignment_assign_core, reminder_retry, reminder_list, dashboard_get, schedule_get and scope_probe are all scoped to the caller's groups. A missing item and an out-of-reach item give a non-super caller the same denial.
- A group with no group id (community-wide) is reached only by a super admin. Family records and role grants are super-admin-only.
- Function privileges, checked live: grant_admin, end_admin, identity_linked_parent, reminder_plan and the display-name helpers have no execute right for authenticated, anon or public.
- role-policy.ts, authorization.ts, access.ts and authorization-matrix.json agree with each other and with the database. There is one new forward-only migration, numbered after 20261046, and the three new test files are in the directory script and the shuffled run.

### Summary

A group administrator reaches only the tasks, events, assignments, approvals, reminders and schedule entries of groups they hold, and community-wide items stay with the super admin. Both validation commands passed (199 of 199 database tests, 10 of 10 access-policy tests). The remaining findings are Minor.
