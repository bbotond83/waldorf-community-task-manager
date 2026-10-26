# Cross-Unit Traceability: Real local backend

Source: `aidlc engine sensor-traceability --stage build-and-test`, run 2026-10-25.

## Verdict: FAIL (bookkeeping only)

The check reports `pass: false`. Every functional requirement that the five units recorded is traced to built files. The failures are of two kinds, and neither means missing code or missing tests; the code and tests exist, run and pass (`test-results.md`).

1. **Six requirements built by U5 are not recorded in U5's `traceability.json`**: FR2.6, FR2.7, FR9.1, FR9.2, FR9.3, FR10.1. U5's plan traces its steps to these ids (Steps 6, 7, 8, 11 to 15), but its `traceability.json` carries only the NFR ids.
2. **The non-functional requirement groups NFR1 to NFR8 roll up as uncovered** because some per-unit targets are `not_built`: in U2, U3 and U5, one target field lists several files separated by commas, and the check expects one existing file per target, so it reports "target file does not exist" for the whole string. All the files named exist (checked: `tests/database/coordination-schema.test.ts`, `directory-schema.test.ts`, `schedule.test.ts` and `tests/unit/record-payload.test.ts` are on disk).

## Evidence that the uncovered requirements are built and tested

| ID | Requirement | Built in (files) | Tests |
|---|---|---|---|
| FR2.6 | Profile picker, hard-coded profiles, cookie secret, `parent-local` login and `/api/synthetic/*` removed | deleted: `src/runtime/synthetic/`, `src/runtime/session/`, `app/api/synthetic/`, `app/belepes/`, `ProfileSelector` | `tests/unit/removed-synthetic-mode.test.ts`, `scripts/verification/replaced-modules.test.ts` |
| FR2.7 | Seed creates accounts directly with test passwords, local only | `scripts/db/seed/accounts.ts`, `scripts/db/seed/write.ts`, `scripts/db/local-guard.ts` | `scripts/db/seed/accounts.test.ts`, `local-guard.test.ts`, `tests/database/seed.test.ts` |
| FR9.1 | One command seeds the small set; another the 30-family set | `scripts/db/seed.ts`, `scripts/db/seed/data.ts` | `scripts/db/seed/data.test.ts`, `commands.test.ts`, `tests/database/seed-timing.test.ts` |
| FR9.2 | One command resets; seeding twice is repeatable; a failed seed leaves nothing | `scripts/db/reset.ts`, `scripts/db/seed/write.ts` | `tests/database/reset.test.ts`, `seed.test.ts` |
| FR9.3 | Seed and reset refuse a database that is not local | `scripts/db/local-guard.ts` | `scripts/db/local-guard.test.ts` (17 tests), `tests/database/reset.test.ts` |
| FR10.1 | Synthetic code, fixtures, reset endpoint, test copies and `scenario` hooks removed; data tests run on the local database | deleted modules and routes; `playwright.config.ts`, `tests/browser/support/` | `tests/unit/removed-synthetic-mode.test.ts`, `tests/unit/browser-harness.test.ts`, the migrated browser specs |

## Per-ID coverage of the functional requirements

| ID | Covered | Built in |
|---|---|---|
| FR1.1 to FR1.5 | yes | U1 `scripts/db/stack.ts`, `20260806_access_rls.sql`, `src/runtime/database/config.ts`; U5 `src/runtime/config.ts`, `README.md` |
| FR2.1 to FR2.5, FR2.8 | yes | U2 `src/identity/*`, `20261015` to `20261018`; U3 `20261030_kernel_family.sql`, `src/runtime/production/access.ts` |
| FR3.1 to FR3.6 | yes | U1 `20261012`, `20261013`; U2 `20261015`; U3 `20261024`, `20261032`; U4 `20261036`, `20261039`, `20261041` |
| FR4.1 to FR4.4 | yes | U1 `client.ts`; U3 `src/data/*-port.ts`, `admin-tasks.ts`; U4 `src/data/imports.ts`, `20261042` |
| FR5.1 to FR5.5 | yes | U3 `20261025`, `20261026`, `20261028` to `20261030`; U4 `20261038` |
| FR6.1 | yes | U3 `20261031_schedule.sql` |
| FR7.1 to FR7.3 | yes | U4 `20261040`, `20261041`, `tests/support/workbook.ts` |
| FR8.1 | yes | U4 `20261036_notifications_schema.sql` |
| FR9.1 to FR9.3 | recorded no; built yes | see the table above |
| FR10.1 | recorded no; built yes | see the table above |
| FR10.2, FR10.3 | yes | U1 `scripts/db/worker.ts`, `.github/workflows/ci.yml` |
| FR11.1, FR11.2 | yes | U1 `scan-core.ts`; U4 `scan-artifacts.ts`; U5 `verification/reports/u5-workbook-and-known-limits.md` |
| FR12.1 | yes | U5 `HASZNALATI_UTMUTATO_HU.md` |

## Non-functional requirements

| Group | Units that recorded targets | Targets flagged `not_built` | Reason |
|---|---|---|---|
| NFR1 | U1, U2, U3, U4, U5 | U2 (NFR1.1 to 1.16, 1.22 to 1.24), U3 (1.4, 1.26, 1.28, 1.29, 1.31, 1.34, 1.35, 1.38, 1.40, 1.41), U5 (1.62) | multi-file target field, or the unit's trace row has no single file |
| NFR2 | U1, U3, U4, U5 | U3 (2.10, 2.14 to 2.17), U5 (2.22, 2.27) | same |
| NFR3 | U1, U2, U3, U4, U5 | U2 (3.1 to 3.4), U3 (3.6 to 3.9), U5 (3.16, 3.17) | same |
| NFR4 | U1, U2, U3, U4, U5 | U2 (4.1 to 4.5), U3 (4.2, 4.6), U5 (4.16) | same |
| NFR5 | U3, U4, U5 | U3 (5.5), U5 (5.7) | same |
| NFR6 | U1, U2, U3, U4, U5 | U2 (6.1 to 6.8), U3 (6.10 to 6.12), U5 (6.17, 6.26) | same |
| NFR7 | U3, U4, U5 | U3 (7.3), U5 (7.4) | same |
| NFR8 | U1, U3, U4, U5 | U5 (8.3) | same |

Two targets are marked not applicable with reasons: U1 NFR1.10 (enforced by U5's local-only guard) and U1 NFR6.3 (documented and exercised by U5's reset).

The measured NFR targets (coverage, accessibility, timings, isolation, repeatability, privacy) are verified directly in the Target Verification Matrix of `build-and-test-summary.md`: all Met.

## Finding for the approval gate

Uncovered ids are surfaced as the stage asks. Options at the gate:

- **Approve**, accepting the recording gaps as a known limit. The follow-up plan (`follow-ups/minor-findings-plan.md`) is extended with this item: after the intent is closed, correct the `traceability.json` files of U2, U3 and U5 (one file per target, add FR2.6, FR2.7, FR9.1 to FR9.3, FR10.1 to U5), then re-run this check.
- **Request changes**, to correct the three `traceability.json` files now. This edits files the units claim, so under the strict change policy it withdraws the approvals of U2, U3 and U5 and means another re-check lap for each.
