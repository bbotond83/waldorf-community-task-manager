# Code Quality Assessment

Full rescan 2026-10-12 (HEAD `80bd4f4`), focused update 2026-10-27 (HEAD `5d2b484`, intent `denied-audit-ratelimit`), focused update 2026-11-02 (HEAD `3456409`, intent `empty-nav-after-login`; section "Sign-in, shell and navigation area (2026-11-02)"). Revision 2 on 2026-11-02 (same intent, owner asked to also scan the audit area) re-read the audit migrations 20261012, 20261013, 20261015, 20261019, 20261044 and 20261045, `supabase/config.toml` and the database test support, `audit`, `audit-purge` and `migrations` tests; sections marked "(2026-11-02, audit re-verified)" come from it. The section "Database layer and audit area" was re-verified and extended. Both focused updates were read-only (no test, build or program run) and added "Database layer and audit area"; the 2026-10-12 sections below record results executed then and are not current (per project rule, current executable results are authoritative over these counts).

## Sign-in, shell and navigation area (2026-11-02)

Read-only run; nothing executed (no tests, build or server), so test results below are not re-measured.

### Findings
1. **Defect located (not fixed here)**: `signInAction` redirects to `/bejelentkezes` (`app/bejelentkezes/actions.ts:45`) and `SignInPage` renders a shell-less `signed-in-panel` for a signed-in visitor (`app/bejelentkezes/page.tsx:19-24`). The role home resolver exists and works (`app/_identity/production-home.ts`, used by `app/page.tsx:16-17`) but the sign-in flow never calls it. The role shells, menus and role access resolvers are correct for all four roles.
2. **Intended emptiness**: `TEACHER_NAVIGATION` is `[]` (`src/runtime/navigation.ts:13-14`), so a teacher home page shows header and sign-out but no menu. Not a defect.
3. **Tests pin the defect**: `identity-actions.test.ts:122` expects the redirect `/bejelentkezes`; `identity-screens.test.tsx:268-282` expects the signed-in panel; `signInAs` (`tests/browser/support/seeded-schema.ts:72`) and 12 spec lines wait for `signed-in-panel`. A fix must change these together; no test covers "after sign-in the person sees their role menu".
4. **Shared destination**: password reset (`jelszo-visszaallitas/uj/actions.ts:38`) and invitation acceptance (`meghivas/[token]/actions.ts:41,43`) also end on `/bejelentkezes`, with tests at `identity-actions.test.ts:243,282,299`.
5. **Inconsistency**: signed-out handling differs by area (admin and teacher `redirect("/")`; parent renders `ParentAccessState`).
6. **Naming**: `resolveProductionHome` relies on `resolveAdminAccess` being the generic resolver (its `denied` carries the strongest role's home); this is documented in a comment but easy to misread.

### Ratings (code-analysis guide scale)
| Aspect | Rating | Evidence |
|---|---|---|
| Naming clarity | good | `signed-in-panel`, `resolveProductionHome`, `ShellProfile`; Hungarian copy centralised in `src/identity/copy.ts` |
| Function size | good | actions and resolvers under 50 lines |
| Error handling | good | explicit state unions (`ready / signed-out / no-role / unavailable`); config problems become a Hungarian message |
| Test presence | good | colocated tests for every `src/identity` module, integration tests for actions and screens, browser specs for the flow |
| Duplication | fair | three role resolvers share the load pattern; menu lists are constants |
| Dead code | good | none seen in the area |

## Database layer and audit area (2026-10-27)

### Tests
| Layer | Runner | Size | Notes |
|---|---|---|---|
| Database (real local stack) | `node --experimental-strip-types --test`, `pg` client | 58 entries in `tests/database/` at HEAD (55 at 2026-10-27) (test files, support modules and one SQL fixture) | Every file runs against the started Supabase stack; files that share a schema serialize through advisory locks; each test starts from `resetWorkerData`; most audit files run twice, in `worker_1` and in `public` |

- The audit area is well covered: refused rights for every application role, append-only behaviour, actor attribution (including `none` and `system`), denied event committed with the denied result, atomic rollback, `details` format, check lists, indexes, overhead under 50 ms per operation (NFR4.5), purge boundaries and the 5000-row cap.
- Not covered by the files analyzed here: the denied-event limit (its tests are in `audit-denied-limit.test.ts`, not read), concurrent denials from one account.
- Re-verified 2026-11-02: `audit.test.ts` pins refused rights for `anon`, `authenticated` and `service_role`, the read policy, append-only (even for the owner), actor attribution, atomic rollback via an injected trigger, `details` format, check lists, indexes and the 50 ms overhead; `audit-purge.test.ts` pins the 365-day boundary, system-caller-only, setting scope, no leak, 5000 cap and security-definer pinning; `migrations.test.ts` pins ordering, second-run no-op, pinned search paths and platform privileges.
- Test hygiene: each test file builds its own session ids (`SESSION_NAMESPACE`) and takes a per-schema advisory lock, so files can run in parallel and shuffled; aged events are inserted with an explicit `occurred_at`, never by waiting.
- No SQL coverage measurement; the 80/80/80 coverage floor applies to TypeScript production files only.

### Ratings (code-analysis guide scale)
| Aspect | Rating | Evidence |
|---|---|---|
| Naming clarity | good | `platform_*`, `identity_*`, `audit_*` prefixes; header comments cite rule ids |
| Function size | good | audit write 15 lines; finish-operation 14 lines |
| Error handling | good | expected outcomes as `platform_result` states; unexpected as SQLSTATE exceptions (`28000`, `42501`, `22023`, `23505`) |
| Test presence | good | each migration unit and follow-up has real-stack tests and an ordering test in `migrations.test.ts` |
| Duplication | fair | follow-up files restate whole functions (for example `identity_housekeeping` in 20261044 and 20261045), which is the forward-only cost |
| Dead code | good | superseded `app_audit_events` dropped by catalogue check (20261019:7-19) |

### Audit-area findings, revision 2 (2026-11-02)
1. D1 The execute-right sweep of 20261019 is a one-time loop over existing functions; functions created later keep PostgreSQL's default PUBLIC execute unless their file restates the revoke (20261019:28-30, 42-53). Convention and `migrations.test.ts` cover it for the platform functions only.
2. D2 `identity_housekeeping` swallows every purge error (`exception when others`, 20261045:65-69) and reports only a boolean; a permanently failing purge shows as a flag in a result nobody may read.
3. D3 Whole-function restatement: `identity_housekeeping` is defined in full in 20261044 and again in 20261045 (and earlier in 20261043), so a reader must find the last definition by file order.
4. D4 `lifecycle_hold_place` and `_release` compute the request fingerprint from the arguments before authorization; a denied call is stored for replay, which is intended (BR3.6) but means the denied result of a later-authorized caller is replayed for 24 hours per key.
5. D5 Test code: `useSchema` / `bindSchema` duplicate one function; `stack-support.ts` mixes pure helpers and database access (247 lines, acceptable).
6. D6 The published store was stale by one migration: 20261046 exists at HEAD; items A1, A3 and A5 below describe the state before it and are addressed by it per its header (not analyzed here).
7. No finding in the audit area touches the sign-in redirect defect of this intent.

### Technical debt and risks for intent `denied-audit-ratelimit` (2026-10-27, state before 20261046)
1. A1 No volume limit on denied events per account; `audit_events` growth from repeated denials is bounded only by the 365-day purge.
2. A2 No outcome-aware index; counting an account's denials in the last hour can use `audit_events_actor (actor_account_id, occurred_at desc)` but must filter `outcome` row by row.
3. A3 No serialization for a count-then-insert cap; concurrent denials of one account can overshoot unless a per-account advisory transaction lock is taken (pattern: 20261013:38).
4. A4 `occurred_at` is the transaction start time (`now()`); denials in one transaction share a timestamp.
5. A5 Forward-only is enforced by checksum (`scripts/db/runner.ts:146-151`); a fix must be a new file, which must also restate `revoke all` on the function.
6. A6 Test registration is manual in two places (npm script and `scripts/db/shuffled-tests.ts`); a new test file missing from either does not run in `verify:local`.
7. A7 Existing tests that create 20 or more denials for one account inside one test would change behaviour under a cap; a grep found none (loops of 20 or more are reads or successes), but this is unverified until the database suites run.
8. A8 Four files share the prefix `20261035_`; ordering relies on the full file-name sort.

## Tests, layers and synthetic state (2026-10-12)

| Layer | Runner | Size then | Note |
|---|---|---|---|
| Domain unit | `node --test` (`npm run test:domain`) | 32 files, 258 tests, pass | In-memory adapters |
| Vitest delivery | Vitest 4.1.11, jsdom | 42 files, 531 tests, pass | About 40 files referenced synthetic state |
| Browser | Playwright 1.62.1 (chromium, firefox, mobile-chrome) | 11 specs | Nine specs called `POST /api/synthetic/reset` |
| Database | `node:test`, `psql` | 1 file, 9 cases | Superseded by the 55-file real-stack suite above |
| Accessibility | `@axe-core/playwright` | serious/critical violations block | Synthetic data |

Coverage: 80/80/80 lines/branches/functions with an honest denominator (`tests/coverage/support/production-coverage-reporter.ts`).

## Lint, format, types (2026-10-12)

- ESLint 9 flat config, `--max-warnings=0`; Prettier; `tsc --noEmit`. Other `src/*` modules were outside lint and format scope then.

## CI

- 2026-10-12: job `validate` runs `npm ci`, Playwright install, `npm run verify:local`; job `build_evidence` builds, CycloneDX SBOM, build tarball, metadata, SHA256SUMS, 14-day private artifacts (not cryptographic attestations). Actions pinned by SHA.
- 2026-10-27 skim: `validate` now starts the local Supabase stack (`npm run db:start`) before `npm run verify:local` and stops it after; `verify:local` runs every `test:database:*` script and the shuffled order run.

## Documentation

`README.md`, Hungarian user guide, `verification/RUNBOOK.md`, `AUTHORIZATION.md`, PRD. SQL migrations carry purposeful header comments with rule ids and forward-only notes (2026-10-27).

## Technical debt and risks recorded 2026-10-12 (not re-verified)

R1 first migration not applicable (since fixed, FR1.2); R2 thin SQL coverage (since extended); R3 uuid versus slug ids; R4 synchronous Family B ports; R5 Family B dead code; R6 fake behaviours; R7 single-parent design; R8 hardcoded session secret; R9 global mutable state; R10 test isolation for in-memory state; R11 evidence tooling encodes synthetic mode; R12 production config demands `https://`; R13 coverage and lint scope for new directories; R14 local environment constraints; R15 AI-DLC records coupled into a unit test; R16 no gating in `proxy.ts`; floating `latest` ranges; fake-feature hooks in production code; secret-like constant in source.

## Quality strengths

Strict TypeScript; explicit result states in TypeScript and SQL; enforced coverage floor; pinned CI actions; secret scanning and SAST per team rules; accessibility checks in the critical browser flow; forward-only, schema-neutral, checksum-tracked migrations with real-stack tests (2026-10-27).
