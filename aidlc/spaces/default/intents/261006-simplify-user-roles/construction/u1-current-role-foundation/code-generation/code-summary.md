# Code Summary — U1 Current Role Foundation

## Loop-Back 1 — Current Repair Handoff

Current U1 repair began2026-10-08T11:57:13Z after fresh human Plan Approval. Testing Contract `sha256:5f582ac45759862dc64c88fa4a4d2b6ad903e3cae677ff61fe998e255ad40751` remains authoritative; test-after ordering was followed for tooling, harness/tests, then configuration. Repair Steps15–22 are complete; Step23 fresh review/recorded whole-project checkpoint remains conductor-owned and pending. Same-attempt plan/instruction edits are permitted by the lowered fence and are not described as freshly approved.

### Implementation and Current Source

- Patch Next/@next/env/eslint-config-next/@next/eslint-plugin-next to16.3.8 and sharp to0.35.5 by ordinary compatible resolution; no sharp override, omitted optional dependencies, audit waiver or unrelated package-version changes. Platform sharp/libvips/SWC packages follow their parent repairs.
- Add `scripts/verification/current-role-database.ts`, `tests/database/current-role-migration.test.ts`, invented `tests/database/fixtures/current-role-baseline.sql`, and10 seam tests in `tests/unit/current-role-database.test.ts`. The private disposable cluster has no TCP listener, uses explicitly selected binaries/user/socket, never reads deployment credentials, and has15s process/8s statement/5s lock deadlines plus cleanup. Missing tools/version mismatch fail instead of skipping.
- Actual PostgreSQL exposed reserved identifier `current_role` in the new migration. It is now quoted consistently without changing the stored evidence key. Static SQL regression matches the quoted syntax. The new invented historical-helper scaffold uses alias `g` instead of reserved `grant`; frozen `20260806_access_rls.sql` is untouched. Minimal diagnosed repair estimate10–20minutes,$0,low semantic risk.
- Wire mandatory `test:database:roles` into `verify:local`; CI installs PostgreSQL18 tools through the official Apt mechanism, disables default-cluster creation and exposes the binary path without starting a service or adding an action. Existing private unsigned evidence,14-day retention and immutable action pins remain. Remote CI has not run.
- Complete production inventory rises from150 to151 for the one genuine executable harness; all80% line/branch/function floors remain. The harness itself measures100% lines/functions and95% branches.

Current source manifest has55 unique existing claims: all47 prior surviving U1 claims plus8 actual new/changed repair paths. Existing migration/static regression/inventory/package.json claims remain. `next-env.d.ts` and ignored `tsconfig.tsbuildinfo` are excluded and untouched. U2/U3 product behavior and existing staged/uncommitted work are preserved.

### Actual Disposable PostgreSQL Evidence

PostgreSQL18.6(Homebrew) executes the unmodified success migration against invented supported populated schema.9/9 cases pass: complete nonrole/user-activity/business/history preservation; once-per-changed-subject invalidation and missing generation2; repeat with zero new evidence/version/history; seven negative issuer/schema/role/scope/version/overflow preconditions with unchanged full snapshots; six separately instrumented phase failures with full data/policy/constraint/function rollback; an observed actual ExclusiveLock and second-connection Lock wait followed by removed-role constraint rejection after commit; Parent/Group/Super scoped RLS plus teacher raw-table read/mutation denial; governance-only redacted evidence and ordinary write denial; explicit missing tools and failure cleanup.

The final passing phase-fault run reaches every intended boundary after fixing SQL syntax; earlier failures at the syntax defect are not counted as intended fault proof. Database permissions are exercised through nonowner `authenticated`, never superuser bypass. Privileged production writer/final-admin semantics are not invented: existing Access transaction/final-administrator tests remain separate application/fixture evidence. Persisted baseline lacks activity/family-assignment relationships; test activity is preserved as passive fixture state, not a new SQL activity policy. Actual disposable RLS is distinct from synthetic/static proof and does not certify an unlinked deployment/issuer or arbitrary privileged writer.

### Current Commands and Outcomes

All npm/node commands use `PATH=/opt/homebrew/opt/node@24/bin:$PATH` (Node24.21/npm11). Counts overlap and must not be summed.

| Command/check | Actual outcome |
| --- | --- |
| Approved baseline policy/access/authorization command |39 passed before dependency changes |
| Approved baseline runtime/endpoint/presentation command |50 passed before dependency changes |
| `npm install --save-exact next@16.3.8 @next/env@16.3.8 eslint-config-next@16.3.8` |exit0; initial sandbox npm-cache EPERM retried with granted escalation |
| `npm update sharp` |exit0; resolves0.35.5 normally |
| `npm audit --audit-level=high` |exit0;0 vulnerabilities |
| Approved model/migration command |17 passed after repair |
| Approved repository/conversion command |41 passed after repair |
| Approved business-policy command |73 passed after repair, including existing final-administrator/rollback checks |
| Approved expanded runtime/endpoint/presentation command |64 passed under patched tools |
| Node scoped database command / `npm run test:database:roles` |9 actual PostgreSQL cases passed; final configured run19.94s,0 skipped/cancelled |
| Vitest scoped harness/inventory/verification-entrypoint command |58 passed;10 harness seam/6 inventory/42 entrypoint checks |
| `npm run typecheck` |exit0 after explicit isolated NODE_ENV/UTF8 typing repair |
| Typecheck cache before/after |same SHA `f1bb711ba39a70309a561e3220616b81bcb5b8b2cb037f8bef0f2252495f7837` |
| U1 changed-file Prettier/ESLint |exit0, max-warnings0 |
| `npm run test:coverage:delivery` |exit0;594 tests/59 files;151-file inventory;94.91% lines,83.75% branches,93.96% functions |

Exact legacy scoped commands are retained in unit-test-instructions.md. Current database and full-coverage logs are in `repair-evidence/database-roles.log`, `repair-evidence/database-finalized-runner.log` (final isolated NODE_ENV/UTF8 runner,9/9,18.28s), and `repair-evidence/coverage-delivery.log`. An earlier single-file coverage diagnostic exited1 because it measured only the harness against the complete application denominator; it did not lower or exclude any target, and final full coverage above supersedes that diagnostic. Initial PostgreSQL sandbox shared-memory rejection was rerun with authorized normal escalation. New test-scaffold alias error and genuine migration reserved-identifier error were repaired before passing evidence. No failing checks are waived.

### Traceability and Review Boundary

All20 assigned ACs,11 BRs and11 detailed NFR IDs remain; add exact FR10 targeting real conversion assertions.43 coverage entries exist with all OK targets present. NFR1.4 now targets actual disposable database checks. NFR2.2/2.3 retain final integrated ownership, with current local coverage/audit evidence described accurately. Fresh named review, recorded whole-project checkpoint and final integrated build/start/browser/performance/security gates remain conductor/Build and Test obligations. No completion receipt, live migration, deployment, commit or push is claimed.

## Historical Previous Attempt Record

The following record is retained as historical provenance. References to “current” within it refer to the preceding cache-repair attempt, not this loop-back repair; its47/150 inventories and outstanding disposable-database status are superseded by the current55/151 inventories and9 passing PostgreSQL scenarios above.


## Restarted Attempt — Current Handoff

The current fresh approved reuse attempt started on 2026-10-08 at07:06:39UTC under the redo begun2026-10-07T15:49:05Z, following human Request Changes to account for the generated TypeScript cache and refresh the affected review. Its earlier approved plan fingerprint is `sha256:v3:b386f5074f8ea3ce18fdec832802e8529837cd58e448ca13627877548e3889c0`; the tool brief retains Testing Contract `sha256:5f582ac45759862dc64c88fa4a4d2b6ad903e3cae677ff61fe998e255ad40751`. The authorized same-attempt configuration repair changes only package.json verification typecheck to disable incremental writes. Application/test implementation and restored cache bytes are preserved. Current typecheck passed as recorded below; no tests or full checkpoint were executed by this worker. Earlier reviews, checkpoints and execution counts remain historical. Current named architecture review and conductor checkpoint remain pending.

The current manifest claims47 paths:46 surviving U1 foundation/shared consumer paths plus package.json. Ignored generated tsconfig.tsbuildinfo is excluded. Four former consumers are now U2-owned replacements: `app/munkatars/_lib/session.ts` → `app/teacher/_lib/session.ts`; `src/application/staff-facade.ts` → `src/application/teacher-facade.ts`; `src/staff-web/synthetic-staff.test.ts` → `src/teacher-web/synthetic-teacher.test.ts`; `tests/coverage/staff-pages.test.tsx` → `tests/coverage/teacher-pages.test.tsx`. Former paths were removed from current U1 claims; the teacher replacements are not claimed as U1 work. The historical inventory below remains provenance. Prior retry app-entrypoints and production-inventory tests remain current shared claims. Authored coverage tests are visible under the conductor's root-only `/coverage/` ignore correction. No literal bracket route or directory claim is needed for U1.

Current read-only JSON/path validation passed:47 claims are unique and exist; all42 trace entries are present and every OK target exists. Traceability contains no deleted staff targets:20 ACs,11 detailed NFRs and11 BRs still resolve to current U1 implementation/test paths. `OK` records retained implementation/test coverage, not fresh execution. NFR2.2/2.3 remain Deferred for current conductor checkpoint and integrated quality/security verification. No production linkage or live DB/RLS proof was introduced. Following refusal of ignored cache as source-review evidence, the authorized manifest repair replaces only its claim with package.json.

## Generated TypeScript Cache — Current Configuration Evidence

The conductor restored tsconfig.tsbuildinfo from `/private/tmp/waldorf-role-recovery-20261007-tsconfig.tsbuildinfo`. Existing tsconfig.json retains incremental:true/noEmit:true for Next tooling; no tsconfig or framework changes were made. Installed TypeScript5.9.3 `tsc --help --all` confirms --incremental is a boolean controlling saved .tsbuildinfo files. package.json now invokes `tsc --noEmit --incremental false`, preserving all strict compiler checks while overriding cache writes for verification only. Existing `.gitignore` rule `*.tsbuildinfo` still ignores the cache. It remains local generated state and is excluded from source-review claims. Production inventory remains150 and80% line/branch/function floors remain unchanged.

Historical cache stabilization typecheck passed in the prior attempt, session11412 exit0; that result remains historical. Current authorized `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run typecheck` passed with the new script, session67288 exit0. Cache SHA-256 before and after was exactly `f1bb711ba39a70309a561e3220616b81bcb5b8b2cb037f8bef0f2252495f7837`, with204455 bytes preserved. No test suite or full checkpoint was executed; conductor owns current review and Node24 checkpoint. Local-only next-env.d.ts remained untouched.

U3 implemented the administration R-01 mixed-organization selector repair in the shared claimed src/application/admin-facade.ts: selection now requires the actor subject, an unrevoked valid organization Super grant and request-contained scope. Its current regressions in src/application/admin-facade.test.ts cover mixed organizations, both grant orders, wrong subjects, revoked/inactive/stale authorities and zero downstream calls on denial. The historical R-01 finding remains Unresolved in its historical record; the current reviewer must assess that same ID against this implementation. U2 shared browser consumer cleanup is also implemented, with evidence retained in U2 records. U2/U3 results are not relabelled as current U1 execution. Local-only next-env.d.ts and U2/U3 outputs were untouched. Source is ready for fresh conductor review and checkpoint; no completion receipt is claimed.

## Implementation and Ownership

Implemented exactly four current domain roles: Parent, Group admin, Kindergarten teacher and Super administrator. Synthetic role/profile identifiers use `kindergarten-teacher` and `kindergarten-teacher-local`; Hungarian catalog copy is **Óvónő**. Removed profile identifiers have no aliases. Business groups, tasks, assignments, owners and historical baseline migration remain unchanged.

Access now validates role-specific scopes and evaluates each complete grant independently. Teacher commands/private fields, cross-organization scopes, unknown roles, stale generations and inactive subjects deny. Parent own-family signup remains supported; arbitrary assignment updates remain denied. Group core checks and organization-only Super administrator advanced/governance rows retain explicit no-data failure contracts. Application sessions carry activity and paired grants; copied `roles`/`scopes` lists cannot create authority.

Normal Access grant/revoke writes require an injected transaction; a missing transaction returns `transaction_failed` without writes. Snapshot transactions own grant/user generation/audit/conversion-evidence/enforcement rollback and reject nested writers. Normal mutations preserve grant identity, invalidate once, prohibit final active organization administrator loss, respect equivalent surviving grants and block overflow.

Explicit legacy conversion preserves every non-role field, inactivity/revocation and each historical row. Effective access alone deduplicates. Unsupported role/scope/schema/issuer inputs block; each affected subject advances once; repeat emits no new generation/evidence. The documented missing-generation initialization is 2 only with the verified baseline authoritative-lookup precondition.

A new transactional SQL artifact requires an explicit operator assertion of universal authoritative issuer lookup. It locks grant/version writers before supported-schema preflight, converts existing rows, advances distinct subject versions, appends restricted original/current role evidence, validates current-role scopes and replaces the entire old permissive policy inventory in the same transaction. Self-version resolution and exact role/scope RPCs replace broad scope helpers. Parent family read uses actual row identity; the baseline assignment table lacks family linkage, so unsupported Parent raw assignment access denies. Teacher receives no raw family/assignment table permission.

Runtime reads separate current synthetic activity/grant/version state for every resolution and signing operation. Existing page/session producers consume that complete actor. Removed-profile, revoked, inactive, malformed or stale sessions cannot render protected payloads. Existing advanced governance's known group-admin target now invalidates that same state, so its cookie is rejected at the root as well as admin gates. Cookie signatures, nonce rotation, eight-hour expiry, same-origin checks, security attributes, pure resolution, production unavailability and the Clear-Site-Data exclusion remain. C5 unavailability now returns the specified 503.

## Files Created or Modified

The following is historical first-attempt write inventory. No application files were deleted by U1 in that attempt. Current surviving U1 claims are in `source-manifest.json`; teacher rename/deletion work belongs to U2. Unrelated AI-DLC records and local-only `next-env.d.ts` are excluded.

- `app/admin/_lib/session.ts`
- `app/api/synthetic/reset/route.ts`
- `app/api/synthetic/session/route.ts`
- `app/munkatars/_lib/session.ts`
- `app/szulo/_lib/session.ts`
- `src/access/access-service.test.ts`
- `src/access/access-service.ts`
- `src/access/current-role-migration.test.ts`
- `src/access/in-memory-adapters.ts`
- `src/access/index.ts`
- `src/access/legacy-role-conversion.test.ts`
- `src/access/legacy-role-conversion.ts`
- `src/access/role-policy.test.ts`
- `src/access/role-policy.ts`
- `src/access/session-grants.ts`
- `src/access/supabase-route-adapter.ts`
- `src/access/transaction.test.ts`
- `src/access/types.ts`
- `src/admin-advanced/synthetic-advanced.test.ts`
- `src/admin-advanced/synthetic-advanced.ts`
- `src/admin-core/synthetic-admin.test.ts`
- `src/application/admin-facade.ts`
- `src/application/authorization.test.ts`
- `src/application/authorization.ts`
- `src/application/contracts.test.ts`
- `src/application/contracts.ts`
- `src/application/facades.test.ts`
- `src/application/session-facade.ts`
- `src/application/staff-facade.ts`
- `src/directory/directory-service.test.ts`
- `src/directory/directory-service.ts`
- `src/parent-web/synthetic-parent.test.ts`
- `src/parent-web/synthetic-parent.ts`
- `src/runtime/session/session.ts`
- `src/runtime/synthetic/access-state.ts`
- `src/runtime/synthetic/composition.ts`
- `src/runtime/synthetic/profiles.ts`
- `src/staff-web/synthetic-staff.test.ts`
- `supabase/migrations/20261006_current_roles.sql`
- `tests/browser/profile-login-performance.spec.ts`
- `tests/browser/support/profile-login-measurement.ts`
- `tests/coverage/app-session-boundaries.test.ts`
- `tests/coverage/parent-pages.test.tsx`
- `tests/coverage/staff-pages.test.tsx`
- `tests/integration/runtime-shell.test.tsx`
- `tests/integration/synthetic-route.test.ts`
- `tests/unit/current-role-session.test.ts`
- `tests/unit/runtime-boundaries.test.ts`

## Historical Executed Evidence and Test Coverage

Testing Contract `sha256:5f582ac45759862dc64c88fa4a4d2b6ad903e3cae677ff61fe998e255ad40751` was followed as test-after per layer. Installed Node 24/npm 11 was selected via PATH because the default shell Node is 26. No dependencies/configuration/coverage thresholds were changed.

- Initial runner baseline: 17 scoped Node tests and 44 scoped delivery Vitest tests passed before source edits.
- Model/migration layer: 16 tests passed, including 8 explicitly **static SQL** checks.
- Repository/conversion layer: 24 tests passed. Active/inactive/revoked/equivalent/repeat, missing/invalid/overflow version, issuer/schema rejection, redacted evidence and six rollback boundaries were exercised.
- Business layer: 66 tests passed after preserving the existing own-family signup create permission. Mixed grants, teacher mutation/private fields, last qualifying administrator, equivalent grants, wrong organizations and retained-role boundaries were exercised.
- Expanded changed-consumer Node regression: final rerun passed 147 tests. Includes RPC strict validation, normal audit failure rollback, Parent/teacher/admin fixture consumers and existing domain/application regressions. Later narrow governance synchronization run: 51 tests passed.
- Foundation runtime/endpoint/presentation: final scoped rerun passed 64 tests including the governance root-cookie invalidation regression. Catalog, removed-cookie recovery, authoritative activity/version/grants, C5 responses and accessible native controls are exercised. Three narrowly adapted existing coverage-test consumer files also passed 27 tests; this is a test run, not coverage measurement.
- Strict `npx tsc --noEmit` passed. Changed-file formatting applied; changed-file ESLint with `--max-warnings=0` passed after removing one obsolete unused scope import. Final checks follow the last changed boundary.

These are scoped execution results, not a claim of integrated coverage percentage. No thresholds were reduced. The workflow-owned `npm run typecheck && npm test` checkpoint has not been run by this subagent. No browser, build, start, integrated coverage/security scan, database or live target was executed.

## Deviations, Limitations and Downstream Handoff

The existing Application Parent signup command uses assignment create while the old domain policy allowed only assignment reads. Shared policy now retains own-family create as required by the approved existing signup/idempotency behavior; Parent update/delete/manage remain denied. Two existing consumer fixture assumptions were corrected to current complete grants, rather than weakening scope or governance policy. Version-only session facade successes now require current authorized navigation first.

The legacy-role fixture loader is an explicit conversion-only seam, separate from normal current-role repository save. In-memory writer exclusion proves synchronous fixture semantics, not PostgreSQL concurrency. Static migration checks do not prove SQL syntax/execution/RLS/privileged operator behavior on a real target. The SQL baseline lacks persisted activity and Parent assignment-family linkage; it does not manufacture those relations or widen teacher table access. Real database proof remains outstanding until an authorized disposable target exists.

U2 owns teacher source/projection/module rename/pages/detail/old-URL redirects and screen-specific browser acceptance. Its completed implementation is preserved; U1 does not claim U2 route delivery or browser evidence. U3 completed retained workflow integration, archive administrator metadata and current executable manifest cleanup. Its AdminExperience boundary now dispatches record/approval/archive core resources separately from role_grant/import/lifecycle advanced resources, preserving Group core authority and non-Super advanced denial. Those changes and their results remain U3-owned. The known synthetic revocation target was synchronized by U1 solely to stop stale root sessions.

Explicit migration/removed-role regression data retain old strings. Existing feature module names and scenario/history references remain for U2/U3 ownership. Historical migration and records stay frozen. Local-only `next-env.d.ts` has not been edited, formatted or claimed. No commits, pushes, deployments or live migrations were performed.

## Traceability and Completion Boundary

`traceability.json` enumerates all 20 assigned ACs, all 11 detailed NFRs and all 11 BRs with existing implementation/test targets. NFR2.2 and NFR2.3 are explicitly deferred to integrated Build and Test. Real-target persistence evidence and later-Unit criteria are not manufactured from fixture/static results. The conductor owns named architecture review, mandatory checkpoint, lifecycle receipts and ordinary Unit completion.

## Historical Verification Retry

On 2026-10-07, the human selected Retry after a prior authorized whole-project checkpoint failed. Type checking passed; delivery tests exposed two stale assertions: session unavailability expected 404 instead of contracted 503, and production inventory expected 141 instead of145 files. That retry updated those assertions and explicitly required the four new runtime source paths in the inventory. Both test paths remain claimed in source-manifest.json. These counts describe that historical retry, not the current executable inventory or a new checkpoint. Coverage thresholds and production behavior were unchanged. R-01 was unresolved at that historical review; U3 subsequently implemented its repair, which awaits assessment in the refreshed current U1 architecture review.
