Advisory pass, iteration 1. I read the plan, summary, manifest, traceability, the migration (key sections: tables, RLS, publish, grants), the three database test files, and the diffs of every edited existing test. I did not re-run `verify:local`; the pass and the counts in `code-summary.md` are the developer's own report.

Checks done:
1. Plan steps 1 to 14 are ticked and each has matching output. Every changed non-`aidlc/` file is in `source-manifest.json`, apart from the four page files, which the manifest lists by folder, and framework files outside the app (`.claude/agents/aidlc-developer-agent.md`, `.claude/tools/data/aidlc-manifest.json`, `aidlc.settings.json`). Nothing in the manifest is missing on disk.
2. The migration is forward-only and in its own transaction. The three new tables have RLS on, a `revoke all` and `select`-only grants to `authenticated`, and the draft plan is readable by a super admin only. The command and read functions are `revoke all` then an explicit `grant execute`, and the helpers are granted to nobody. Idempotency, the result envelope and `U3R00` refusals are present in `rota_plan_publish`. Its lock order is families, then plan, then weeks. `notifications` and `audit_events` are widened only through new check constraints.
3. The database tests carry the fixed list per rule (allowed, refused, other community, stale version, repeat, two at once), including the forced-failure publish, publish racing a change, and a two-publish race. All three files are in `test:database:directory` and in `shuffled-tests.ts`.
4. The CSS classes under `app/` and `src/runtime` are `admin-rota-` and `parent-rota-` prefixed. The only unprefixed classes (`button-link`, `eyebrow`, `form-hint`, `visually-hidden`) already existed. No colour tokens were added. I found no secrets or real names.
5. Edited existing tests were extended, not weakened. The removed lines are replaced by stricter or equivalent lines: the menu label lists, the inventory count 210 to 223 with its explanation, and `admin-port.test.ts`. The only relaxation is the `ROTA_DECIDED_ITSELF` exclusion in `notification-use-cases.test.ts`, which is explained in a comment and backed by BR23.4 and BR26.2 tests. The `_core` check was widened to cover the wrapper body as well.
6. The five N/A rows in `traceability.json` are justified (U6 rotas, U3 profile sharing, U5 email).

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| - | - | - | No findings | No action required | Resolved |

### Summary

I found no architectural defect. The rules sit in Postgres functions behind RLS with read-only application roles, the lock order and rollback are tested, and the access policy, matrix, navigation and tests were updated together. The open points are small: the super admin has no duty-card route, the group admin has no menu link, and the teacher route needs the owner's confirmation.
