# Code Summary — U3 Retained Workflows and Cleanup

## Current Build and Test Record Repair — 2026-10-08

This approved repair attempt started2026-10-08T14:23:41Z. It executes only Steps13–15 against retained implementation, with unchanged Testing Contract `sha256:5f582ac45759862dc64c88fa4a4d2b6ad903e3cae677ff61fe998e255ad40751`. The supplied verbatim brief includes both required markers. No application, test, configuration, dependency or other source changed. U1/U2 frozen source, local-only next-env.d.ts, ignored TypeScript cache, existing historical reports and append-only Build and Test failure ledger remain untouched. The later sections preserve earlier attempts; their statements about current results/counts refer to those historical attempts.

Readiness confirmed current Node24/npm11 commands and unchanged Node/Vitest/Playwright configurations, exact scoped discovery includes, all-production reporter linkage and80% line/branch/function floors. U3 has no functional/NFR/infrastructure design directories; this work consumes the existing shared inception requirements/contracts/unit assignments and component ownership without inventing U3 design receipts. No framework behavior or code changed. Read-only production discovery reports151 files, including U1's genuine database verification helper. The historical150 count below is preserved as earlier inventory evidence, not the present denominator.

All actual current commands used `PATH=/opt/homebrew/opt/node@24/bin:$PATH`:

| Exact command | Actual current result / output |
| --- | --- |
| R0: `node --experimental-strip-types --test src/admin-experience/admin-service.test.ts src/import-migration/import-service.test.ts` | exit0;16 passed,0 failed/cancelled/skipped/todo;102.370167ms; outpute3e93f |
| R0: `npm run test:delivery -- tests/unit/verification-core.test.ts` | exit0;8 passed in1 file;7.63s; session85687, final output8e4c7b |
| D3: `node --experimental-strip-types --test src/import-migration/import-service.test.ts src/admin-experience/admin-service.test.ts src/application/admin-facade.test.ts` | exit0;23 passed,0 failed/cancelled/skipped/todo;103.094667ms; outputc41bd1 |
| I3: `npm run test:delivery -- tests/integration/retained-workflows.test.ts tests/unit/current-role-references.test.ts tests/unit/verification-core.test.ts tests/coverage/verification-entrypoints.test.ts` | exit0;64 passed in4 files (7/7/8/42);1.60s; session92345, final outpute6153c |
| `node --experimental-strip-types --input-type=module -e 'import {discoverProduction} from "./tests/coverage/support/production-inventory.ts"; console.log(JSON.stringify({productionSourceCount:discoverProduction().length}));'` | exit0;151 production sources; output033b2c |
| B1/B2 commands in unchanged unit-test-instructions.md | Not executed: retained production build is Next16.3.6, while installed patched framework is16.3.8. A conductor-supplied current production build is required. Historical72 browser/9 accessibility passes below are not current evidence. |

### NFR2 Implemented Verification Mapping

The aggregate requirement is inception/requirements-analysis/requirements.md NFR2: test-after, green strict types/applicable tests/build/start/browser/accessibility/security before merge,80% production line/branch/function floors, paired positive and scope/privacy/mutation-denial regressions, and honest real-target evidence. traceability.json preserves21 upstream IDs and20 other rows; its NFR2 row now targets existing tests/coverage/verification-entrypoints.test.ts with OK. This means genuine implemented verification coverage, not independent final quality acceptance.

Inspected scripts/verification/core.ts, tests/unit/verification-core.test.ts and tests/coverage/verification-entrypoints.test.ts. Core validates required inherited/local/NFR/browser inventory; rejects duplicate/missing references, stale/future metadata, missing artifacts, invalid source SHA and nonzero-exit PASS; retains linked-target/Safari OUTSTANDING; aggregation rejects duplicate/omitted records and mixed SHAs and fails on failed evidence. The decisive entrypoint tests exercise orchestration ordering and stop on failed lint before build/security, reject missing/duplicate aggregate evidence and improperly promoted target results, and test privacy/secret/SAST/no-deploy scanners on invented files. The subprocesses in the orchestration test are explicitly simulated: their green status verifies control behavior, not actual project typing/build/security/browser success. These42 control cases and the8 verification-core cases passed in current I3. Existing package scripts/configuration continue enforcing80% coverage and blocking security thresholds; neither was changed. Retained D3/I3 also pair permitted scoped roles with actual zero-call/no-state-change denials.

All19 manifest claims remain exact and unchanged, with no new source claim. All21 trace targets exist. Unit-filter runs do not establish full-production coverage. Strict types, lint/format, full applicable tests/coverage, patched production build/start, critical browser/accessibility/performance and security/dependency gates remain independent Build and Test acceptance obligations. Step16 and conductor review/checkpoint remain separate from this record repair.

Read-only validation exited0 (outputbd596f):19 unique manifest claims/19 expanded paths,21 upstream IDs/coverage rows, all claimed paths and all OK targets exist, embedded Testing Contract remains verbatim unchanged. Final testing-posture verify exited0 (output4098f9): `ok:true`, reason `approved`, fingerprint/receipt/contract valid and `execution_allowed:true`. No instruction correction was needed. Before/after SHA256 checks remain identical for next-env.d.ts (`0f70629890b72a0a82e91972cc032c04b658b26c265373cb711cf576bfbf8fcc`) and tsconfig.tsbuildinfo (`f1bb711ba39a70309a561e3220616b81bcb5b8b2cb037f8bef0f2252495f7837`). Owned records and retained source are frozen for conductor handoff.

The conductor supplied actual U1 disposable local PostgreSQL fixture proof,9/9 passed; this worker did not run those database cases. Local fixture proof is separate from synthetic retained workflows and does not establish deployment or linked production DB/RLS. Production targets remain unlinked/outstanding. Historical results and failure sequences below are preserved without upgrading their evidence date.

## Historical Redo Attempt — Reused Implementation Handoff

The current approved reuse attempt started on 2026-10-08 at10:27:16UTC under the redo begun2026-10-07T15:49:05Z, with approved fingerprint `8094db7aa3864a1e985b05895a9d124f45326144c4ba394dcaa930e4ea7314e5` and unchanged Testing Contract `sha256:5f582ac45759862dc64c88fa4a4d2b6ad903e3cae677ff61fe998e255ad40751`. This attempt reconciles U3 records only. All completed U1/U2/U3 application/test source and existing cache bytes remain frozen; no typecheck, tests, browser runs or checkpoint were executed by this worker. All D/I/B1/B2/build/typecheck results below and earlier checkpoints/reviews are historical evidence, not fresh redo execution. Current U3 architecture review and conductor Node24 checkpoint remain pending. U1 owns the completed package.json nonincremental verification typecheck repair; U3 does not change it or the ignored cache. No review or lifecycle receipt is claimed here.

## Implementation and Ownership

Implemented eight assigned ACs: AC4.1.1–4 and AC4.2.1–4. The approved test-after contract remains unchanged. Shared U1 current role/session/policy and U2 teacher source/routes are preserved; no database migration, backend linkage, new repository/service, dependency or application route was introduced.

Resolved U1 administration R-01 in src/application/admin-facade.ts: Super selection now requires the same subject, valid unrevoked organization grant and request-contained organization/scope. An unrelated Super grant cannot shadow a valid Group core grant, and mixed organizations cannot combine into advanced authority. Existing current-version/activity and per-resource authorization remain pipeline-owned. Exhaustive AdminExperience dispatch now uses record/approval/archive for core commands and role_grant/import/lifecycle for advanced commands; unsupported requests deny and never call execution. No generic policy allow was added.

Five archive process-owner labels changed to super-admin. Complete seventeen-sheet mode/destination/coverage and unrelated finance/library/workgroup/water owners remain. Tests assert explicit unchanged business IDs/owners and snapshots on denied/failed operations. Parent existing signup/request/notifications and Group fixture workflows are exercised through current authorization; populated legacy administrator conversion uses the existing U1 converter and preserves original identity/state.

Current verification fixtures now match exactly four runtime profiles. Current teacher matrix/scenario names/routes replace obsolete staff entries; former kindergarten administrator workflows use Super, including governance, paired with explicit non-Super advanced denial. All39 scenarios and required inherited/local/NFR/browser inventories remain. Sensitive-field labels now refer to teachers with identical restriction/retention classes. Current RUNBOOK/AUTHORIZATION docs match the catalog; historical reports/audits/SQL stay unchanged. Manifest validation rejects fifth/removed/unknown current roles, catalog role/home drift, obsolete routes/rows and dangling references without weakening evidence freshness/SHA/artifact/privacy/OUTSTANDING checks.

Admin browser consumers use current Super selectors and governance visibility. Direct Parent/Teacher/Group advanced routes test generic denial/no privileged content. Existing Parent tests and U2 runtime-foundation repair are preserved. Browser timing, keyboard/zoom/touch, privacy and Axe assertions are retained.

## Historical Actual Commands and Results — Implementation Attempt

All prior commands used `PATH=/opt/homebrew/opt/node@24/bin:$PATH`. Evidence is local invented/synthetic/static; no real DB/RLS or linked target pass is claimed. None of these commands was rerun in the current reuse attempt.

| Command | Result |
| --- | --- |
| R0 `node --experimental-strip-types --test src/admin-experience/admin-service.test.ts src/import-migration/import-service.test.ts` |12 passed before edits |
| R0 `npm run test:delivery -- tests/unit/verification-core.test.ts` |7 passed before edits |
| D1 `node --experimental-strip-types --test src/import-migration/import-service.test.ts` |9 passed |
| D2 `node --experimental-strip-types --test src/application/admin-facade.test.ts src/admin-experience/admin-service.test.ts` |14 passed |
| I1 `npm run test:delivery -- tests/integration/retained-workflows.test.ts` |7 passed |
| I2 `npm run test:delivery -- tests/unit/current-role-references.test.ts tests/unit/verification-core.test.ts tests/coverage/verification-entrypoints.test.ts` |57 passed after accurate historical fixture correction |
| D3 `node --experimental-strip-types --test src/import-migration/import-service.test.ts src/admin-experience/admin-service.test.ts src/application/admin-facade.test.ts` |23 passed |
| I3 `npm run test:delivery -- tests/integration/retained-workflows.test.ts tests/unit/current-role-references.test.ts tests/unit/verification-core.test.ts tests/coverage/verification-entrypoints.test.ts` |64 passed; rerun64 passed after strict build detected missing core-port test arguments |
| Prior conductor `npm run build` |PASS session97535; compilation388ms and TypeScript1064ms, all routes |
| Prior conductor `npm run typecheck` |PASS session87860; refreshed after browser fixture repair PASS session47456 |
| B1 `npm run test:browser -- tests/browser/parent-web.spec.ts tests/browser/admin-core.spec.ts tests/browser/admin-advanced.spec.ts` |Final72 passed across Chromium/Firefox/mobile,42.3s, session91298 exit0 |
| B2 `npm run test:browser -- tests/browser/parent-web.spec.ts tests/browser/admin-core.spec.ts tests/browser/admin-advanced.spec.ts --grep @a11y` |9 passed across all three browsers,11.3s, session87257 exit0; zero serious/critical Axe violations |

Initial I2 failed one historical fixture assertion because the frozen SQL contains kindergarten_admin, not read_only_staff. The test now asserts the actual historical label and exact immutable source hash; history was not modified. Initial conductor build compiled production source but failed strict test typing: four advanced facade fixture constructions lacked the existing required core port. All four now inject real SyntheticAdminPort, preserving assertions, and that attempt's I3 rerun passed64. Conductor supplied its successful source-current production build before browser execution; subsequent browser changes were tests only. These build/test outcomes remain historical for this redo.

Initial B1 session86855 ended69 passed/3 failed59.2s: the revocation test tried signing a new already-revoked Group profile rather than exercising its existing session, then expected an administrator denial heading on the profile chooser. The repair establishes a separate Group context and proves its dashboard success before Super revocation. Second B1 session18593 ended69 passed/3 failed58.7s because the test incorrectly expected chooser redirection for that existing session; its actual protected next request returned the exact generic denial at /admin. Final assertions pin /admin and Nincs jogosultság, zero shell/dashboard/governance, preservation of the old signed cookie, fresh signing400 SYNTHETIC_PROFILE_INVALID with no replacement cookie, and repeated protected-request denial. Final full B1 passed72. No production change or security assertion waiver was needed. B2 approval was pending briefly before execution; its actual result passed9.

Owned source diff whitespace check passed. Browser import timing<2000ms, keyboard/focus/zoom/44px targets and serious/critical Axe floors remain unchanged.

Owned application/scripts/test/current verification paths were formatted with installed Prettier. Existing unrelated domain minified style was preserved. No thresholds/configuration, U1/U2 source or local-only next-env.d.ts changed.

## Manifest and Traceability

source-manifest.json retains19 exact implementation-attempt modified/created paths; three were new tests, no paths deleted. All claims exist and include every implementation source/test/manifest/doc write. This reuse attempt adds no source claim. No bracket route or broad directory claim is necessary. Production runtime inventory remains150 because no executable file was added; conditional discovery count assertion was not changed. Local-only next-env.d.ts and historical reports are excluded.

traceability.json maps8 assigned ACs,10 shared FRs and three aggregate NFRs using existing workspace-relative targets. NFR2 remains Deferred for integrated quality evidence; unit-filter runs do not establish production80% line/branch/function coverage. All current OK targets exist.

## Outstanding and Completion Boundary

Conductor owns current architecture review, workflow checkpoint, integrated strict type/lint/format/full-production coverage/build/start/security gates. High/critical dependency/SAST findings and serious/critical accessibility remain blockers. Actual linked targets/RLS remain unavailable. U1 administration R-01 is repaired and covered by current mixed-org/zero-call regressions; U2 shared browser R01 remains resolved separately, not relabelled as a U3 result. No review/lifecycle receipt, commit, push, deployment or live data operation was performed by this worker.

## Expanded Actual Inventory

```text
scripts/verification/core.ts
src/admin-experience/admin-service.test.ts
src/admin-experience/admin-service.ts
src/application/admin-facade.test.ts
src/application/admin-facade.ts
src/import-migration/import-service.test.ts
src/import-migration/import-service.ts
tests/browser/admin-advanced.spec.ts
tests/browser/admin-core.spec.ts
tests/coverage/verification-entrypoints.test.ts
tests/integration/retained-workflows.test.ts
tests/unit/current-role-references.test.ts
tests/unit/verification-core.test.ts
verification/AUTHORIZATION.md
verification/RUNBOOK.md
verification/authorization-matrix.json
verification/fixtures.json
verification/scenarios.json
verification/sensitive-fields.json
```
