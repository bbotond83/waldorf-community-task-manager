## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-22
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | src/data/admin-records.ts > detailsOf, the "records.profile" read (lines 207-216), together with src/runtime/database/client.ts > guard (lines 170-172) | The family edit page reads a parent's optional profile through the scalar function directory_parent_profile whenever the parent has given consent. The function returns NULL when consent is true and the text is empty. The database allows that state (parents check allows consent with a null profile, and the admin form accepts a ticked consent box with an empty text area). The data API answers a NULL scalar with data null, and the client's guard turns null data into an unexpected failure, so gateway.select throws a terminal failure and the whole family detail (records.get) fails. The admin cannot open the edit form of such a family to repair it. U2's session.ts already works around exactly this null behaviour (comment in readAuthorizationVersion), so the trap is known. The unit test src/data/admin-port.test.ts answers the profile call with a fake that bypasses the real guard, and no real-stack test covers consent with an empty profile. | Read the profile in a way that tolerates NULL (for example have the function return an envelope or a one-row table, or catch the null response for this one call and treat it as no profile). Add a regression test through the real client or the real stack for a parent with consent true and profile null, for records.get of that family. | Resolved (reviewer) |
| R-02 | Major | supabase/migrations/20261032_lifecycle.sql > lifecycle_run (lines 156-157, only a status update on invitations); tests/database/lifecycle.test.ts > "deactivates the parents' sign-in accounts ... revokes the family's open invitations" (lines 349-379) | The lifecycle claims that nothing personal remains after anonymize or delete (BR35.2, NFR1.36, code-summary), but the e-mail addresses of the family's invitations stay. lifecycle_run only sets status = 'revoked' on pending or accepting invitations of the family; accepted and replaced invitations are not touched at all, and the email column and target_id are never cleared. The test asserts the revoked row is still there. For the eligible-delete path the family, parents and contacts are removed while invitations.email (the parent's address) lives on with a dangling target_id. The leftover search in the lifecycle test only looks at the U3 tables, so it cannot see this. The deactivated accounts keep their e-mail as well (accepted by U2 design, but not stated as an exception in the summary). | Delete or blank the e-mail (and target) of every invitation whose scope is the family, in the same transaction, for both paths. Extend the leftover search to invitations. State in code-summary.md which identity data (accounts e-mail, sign-in service user) is deliberately kept after the lifecycle and why. | Resolved (reviewer) |
| R-03 | Minor | src/runtime/production/services.ts > RoutedAdminPort (lines 45-59); src/admin-advanced/synthetic-advanced.ts > AdvancedWorkflowStore.execute (lines 147-206); aidlc/spaces/default/intents/261012-real-backend-local/construction/u3-directory-and-coordination/code-generation/code-summary.md > Outstanding evidence and open points | In the production mode the operations that stay with U4 (import status, preview, resolve, commit, recover, reminders list and retry) are answered by the old in-memory synthetic store. A real admin sees fixture data ("Boróka csoport: 2 módosítás", a fixed conflict) and import commit reports success without changing anything. The store is one process-wide object, so one admin's preview is visible to the next admin. The summary says the parent notification page shows the empty state but never mentions this admin behaviour. | Record this interim behaviour as an open point in code-summary.md (and for U4), or make the interim adapter answer the empty state for a non-synthetic actor as BR32.9 says for notifications. | Resolved (reviewer) |
| R-04 | Minor | app/admin/actions.ts line 145 and src/data/admin-tasks.ts > decideApproval line 381 | The approval decision is fail-open: any decision value other than the exact word "rejected" (a missing field, a typo, a changed form) is read as approve and runs the swap exchange or removes the place. The database function takes the boolean as sent, so nothing downstream catches it. Only the admin's own authority is involved, but an approval is irreversible and audited as approve. | Accept only the two known words and answer a validation result for anything else, in both places. Add a test for a missing and an unknown decision value. | Resolved (reviewer) |
| R-05 | Minor | supabase/migrations/20261028_kernel_signup.sql > duty_get (lines 84-118) | duty_get returns title, location, start time and version of any task of the organization by id, including tasks of groups the family is not a member of (state ineligible), while duty_list hides them and BR31.11 lists only the family's group tasks plus assigned ones. The ids are not guessable, so the exposure is small, but the two read paths disagree. | Either return duty_not_found for a task outside the family's groups that the family holds no place on, or record this as an intended exception in the rules. | Resolved (reviewer) |
| R-06 | Minor | src/data/admin-records.ts > readChild (lines 434-445) | After creating a child the adapter finds it again by family and display name with no ordering and takes the last row. With two children of the same name in one family it can return another child's id and version to the screen. | Have directory_save return the ids of the created children (or read the newest by created_at) instead of matching by name. | Resolved (reviewer) |
| R-07 | Minor | Verification evidence (code-summary.md > Verification results) | I could not reproduce the test counts (346 directory, 328 identity, 110 stack, typecheck, lint, format) in this review: the shell tool in this session refused every npm and node command because of the plan-approval hook of another unit, so the stack was not started. The statements in the summary are therefore taken as stated; I verified by reading that the files named in source-manifest.json and the migrations it lists exist and that the notification-use-case test and the race test are not vacuous (20 contenders for 5 places, duplicate and stale-version cases, real stack). This is for the person to weigh and is not grounds for the verdict. | Run npm run test:database:directory, npm run typecheck, npm run lint and npm run format:check once outside this review and compare with the summary. | Resolved (reviewer) |

> R-01 Reviewer note: Migration 20261035_integrity_directory_reads.sql makes directory_parent_profile return an empty string instead of NULL for consent with empty profile text, with the same privacy gates. The family edit page no longer fails for that state.

> R-02 Reviewer note: Migration 20261035_integrity_lifecycle.sql deletes the family's invitations in the same transaction as the lifecycle run, so no invitation e-mail address is left behind.

> R-03 Reviewer note: The stateless interim port src/admin-advanced/interim-port.ts answers an empty state for reads and denies changes, so the shared synthetic store is no longer used in production.

> R-04 Reviewer note: app/admin/actions.ts and src/data/admin-tasks.ts now accept only 'approved' or 'rejected' for the approval decision; anything else is a validation result.

> R-05 Reviewer note: duty_get now follows the same visibility scope as duty_list.

> R-06 Reviewer note: readChild in src/data/admin-records.ts now takes the newest child of that family and name (ordered by created_at descending, then id descending). Re-read in this run.

> R-07 Reviewer note: The test counts were reproduced by the previous run of this review (see Validation Tool Results).

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Re-read of readChild in src/data/admin-records.ts (this run) | Ordered newest first by created_at, then id | Confirms R-06 is fixed |
| Check that the integrity migrations exist (this run) | 20261035_integrity_directory_reads.sql and 20261035_integrity_lifecycle.sql are present | Confirms the fixes for R-01 and R-02 are in the tree |
| Directory database tests on the real stack (previous run of this review, not re-run here) | 352/352 pass | Covers the R-01 and R-02 regressions |
| Identity database tests (previous run, not re-run here) | 328/328 pass | No regression |
| Stack tests (previous run, not re-run here) | 110/110 pass | No regression |
| npm test (previous run, not re-run here) | 727 pass | No regression |
| typecheck, lint, format check (previous run, not re-run here) | Clean | Meets the blocking checks |

### Summary

All seven earlier findings (two Major, five Minor) are resolved in the code, and no new findings were found. The unit is implementable and verified as stated. The test results come from the previous run of this review; this run re-checked R-06 and the existence of the two migrations. The iteration-1 review file was not present in the folder (only 1.json), so this file follows the template format.
