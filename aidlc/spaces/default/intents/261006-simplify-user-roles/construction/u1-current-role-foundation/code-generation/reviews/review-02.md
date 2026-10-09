## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-07T06:37:37Z
**Iteration:** 2

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | src/application/admin-facade.ts > matrixRowFor and invokeAdmin; src/application/authorization.ts > AUTH-SUPER-ADMIN and matchesRow | matrixRowFor selects AUTH-SUPER-ADMIN whenever any unrevoked Super administrator grant exists, without considering the requested scope. An actor with Super administrator in organization A and Group admin in organization B is routed to the Super administrator row for a core task/record request in group B. matchesRow excludes the Group admin grant by role and rejects the Super administrator grant by organization. The request therefore denies although grantAllows independently permits the complete Group admin grant. This contradicts C1 retained group-core permissions and U1 functional-spec Current Access Workflow steps 4–5. | Select the applicable row using the requested scope and operation, or evaluate all applicable complete grants without a global Super administrator preference. Add a regression for Super administrator in A plus Group admin in B: core B operations succeed while advanced B operations remain denied. Resolve this U1 policy-consumer gap before release, coordinating U3 integration. | Unresolved |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| aidlc engine sensor-required-sections, code-summary.md | Fresh PASS: 6 H2 headings, zero findings | Updated summary includes Verification Retry. |
| aidlc engine sensor-traceability | Fresh FAIL: 16 missing_from_upstream_ids; no gaps, orphans, invalid entries or invalid targets | Missing IDs remain AC1.1.2, AC2.1.1–6, AC2.2.1, AC4.1.1–4, AC4.2.1–4. Initial review established that the resolver expands every AC in stories assigned to U1, while the U1 plan allocates an exact 20-AC subset and leaves other portions with U2/U3. The unchanged raw ownership mismatch is not a new implementation finding. Account for this result without fabricating completed coverage or reducing targets. |
| Source/manifest differential inspection | Both changed tests explicitly added to source-manifest writes | The changes are claimed. The four newly required production paths were already U1 manifest entries. |
| R-01 cited policy inspection | Unchanged global Super administrator preference | Prior finding remains Unresolved. |
| Application tests, inventory execution, lint/type-check and database checks | Not run in this recovery review | No fresh passing verification or inventory total is asserted. The summary reports preceding checkpoint type checking passed and delivery tests failed. Fresh checkpoint results remain outstanding. |

### Recovery Delta Assessment

This is a bounded advisory recovery, limited to tests/coverage/app-entrypoints.test.tsx, tests/coverage/production-inventory.test.ts, the refreshed code-summary/source-manifest, and the cited R-01 policy location. Initial architectural conclusions and evidence limitations are carried forward; no whole review or test execution was repeated. No source/artifact edits were made other than this review file.

The session-unavailable assertion now expects 503, matching app/api/synthetic/session/route.ts and C5. Reset still expects 404, matching app/api/synthetic/reset/route.ts. This corrects a stale test expectation without changing production response behavior.

The inventory expectation increases from 141 to 145 and explicitly requires src/access/role-policy.ts, src/access/legacy-role-conversion.ts, src/access/session-grants.ts and src/runtime/synthetic/access-state.ts. Existing declaration/test exclusions and missing/empty/malformed coverage-counter checks remain. The correction adds production denominator entries rather than excluding source or lowering coverage floors. The exact total is a pending execution expectation, not an independently measured result from this reviewer.

The Verification Retry section accurately records the failed preceding checkpoint, the human Retry, the two corrections and outstanding R-01. It leaves fresh checkpoint results tool-owned and does not claim success. No new architectural defect is introduced by these deltas.

### Continuing Evidence Limits

The mandatory whole-project checkpoint has no fresh passing result in the reviewed evidence. Integrated 80% line/branch/function coverage, build/start/browser/accessibility and security/dependency evidence remain outstanding; no target waiver is inferred. Static SQL assertions and synchronous fixture rollback tests do not prove PostgreSQL execution, locking, RLS or production compatibility. Real-target proof must verify the issuer precondition, migration/repeatability, rollback/locking and direct RLS behavior before deployment.

U2 still owns teacher source/projection/routes/screens; U3 owns retained-workflow dispatch, archive metadata and final executable cleanup. The future teacher route and documented generic admin_operation denial remain intermediate integration boundaries. The approved Units form one release; this advisory verdict does not certify independent release readiness.

### Summary

READY under the advisory verdict rule: zero Critical findings and one Unresolved Major finding. The retry corrections match declared behavior and preserve quality floors; proceed to the authorized checkpoint, fix R-01 before release, and preserve outstanding later-Unit and database evidence obligations.
