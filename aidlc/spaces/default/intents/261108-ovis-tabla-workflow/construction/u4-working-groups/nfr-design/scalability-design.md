# Scalability Design: u4-working-groups

How the targets in `scalability-requirements.md` are met, following `functional-spec.md`, `rules.md` and C1 and C16 in `contract-summary.md`. The load is one community of about 20 families and six groups, so no scaling mechanism is used. This file is about acting at the same time.

## Repeats

Every command stores its result under its idempotency key through the C1 template. A repeated key returns the stored result before any lock or write, so it creates no second membership, grant, notice or audit row (NFR5.8).

## Two Joins at Once

Join checks for an active membership after taking its locks. If two joins by the same parent still race past the check, the one-active-membership index (`group_memberships_one_active`) refuses the second insert. Join catches that unique violation and answers success with ALREADY_MEMBER and the existing membership's id (NFR5.9).

## Outdated Pages

Leave, appoint and revoke carry the membership's version. Each locks the membership row with `for update` and runs its checks in the order set in `rules.md`, ending with the version check. Appoint and revoke raise the version, so a page loaded before either one gets VERSION_CONFLICT (NFR5.10).

## Lock Order

Every U4 path takes its locks in one order: family, then accounts, then parents, then memberships by ascending id, then grants by ascending id, then the accounts' authorization-version rows. The last level is easy to miss: `grant_admin`, `end_admin` and U1's account-status step all call `identity_bump_authorization_version`, which updates the account's row in `app_authorization_versions` and holds it until commit. A path may skip levels, but never takes a level before one it has already passed.

| Path | Locks, in order |
|---|---|
| Join | Family row `for share`, then parent row `for share`, then the insert |
| Leave, appoint, revoke | Membership row `for update`, then (through `grant_admin` or `end_admin`) the grant row, then the account's authorization-version row |
| Removal block (C16) | U4's block takes the family row, the account rows and the parent rows `for update` itself, in that order and by ascending id, before anything else. It does not rely on U14 or U3's block having taken them; taking a row the same transaction already holds is harmless. Then the subject's memberships `for update` by ascending id, then the grants and authorization-version rows through `end_admin`. U3's block, which runs after it, bumps the same version rows again, which is harmless within one transaction |
| Lifecycle step | U4's new step sits right after `lifecycle_run_core` locks the family row and before its account-deactivation loop (the loop that calls `identity_set_account_status` and so bumps every family account's version row). The step locks the family's linked accounts `for update` by ascending id, then the family's parents by ascending id, then their memberships `for update` by ascending id, and then ends the existing grants through `end_admin`, which takes the grant and version rows. Only then does the deactivation loop run, on rows the transaction already holds, followed by today's deletes |

Why no two paths can wait on each other:
- Join and removal meet on the family and parent rows, and both take the family first. A join either finishes first, and removal then ends its membership, or waits and is then refused because the parent is no longer active.
- Leave, appoint and revoke meet removal and the lifecycle step on the membership row, and all of them take the membership before the grant and the version row. Removal and the lifecycle step take the version row only after the memberships, so a coordinator's command holding a membership never waits for a version row that removal or the lifecycle step already holds. Whoever locks the membership first finishes; the other waits and then sees the new state.
- No path takes a version row and then a grant or membership, a grant and then a membership, or a membership and then a family (NFR5.12).

## Concurrency Tests

There is one two-at-once test per row of the concurrency table in `functional-spec.md` (NFR5.11). Four race tests each run 50 times in a loop in one test run and fail on any deadlock error: join against removal, a coordinator's leave against the lifecycle step on their family, revoke against the lifecycle step, and appoint against the lifecycle step. In the last three, every parent of the family has a linked account, so the lifecycle step really bumps their version rows. All of them also run in the shuffled run (NFR5.12).

The read rules have no "outdated screen" or "repeated click" case. The test plan records why.
