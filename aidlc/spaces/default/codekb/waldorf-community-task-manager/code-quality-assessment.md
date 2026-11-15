# Code Quality Assessment

## Summary

The code is careful and disciplined, especially around concurrency, privacy and failure states. The main costs are the size of the SQL layer, repeated boilerplate and functions redefined across many files. This scan did not run any checks, so nothing here states a current pass or a coverage figure.

## Quality Gates

| Gate | Tool | Blocking in CI |
|---|---|---|
| Format | Prettier | Yes, through `verify:local` |
| Lint | ESLint, zero warnings | Yes |
| CSS | Stylelint on `app/globals.css` | Yes (`lint-css` step in `scripts/verification/run-local-verification.ts`) |
| Types | `tsc --noEmit`, strict | Yes |
| Tests | Node test runner, Vitest | Yes |
| Coverage | 80% lines, branches, functions | Yes |
| Database | Per-group suites, shuffled run, timing | Yes |
| Browser | Playwright with three browsers, axe | Yes |
| Security | Privacy, secret, SAST and no-deploy scans, `npm audit` for high and critical | Yes |

`src/access/` is outside the `lint` and `format` paths in `package.json`.

## Rating

| Aspect | Rating | Evidence |
|---|---|---|
| Naming | Good | Clear, consistent identifiers; SQL comments cite business rules |
| Function size | Fair | SQL use cases are long (for example `directory_save`, about 300 lines, and `import_match`) but follow one template |
| Error handling | Good | Explicit result states; no raw database text reaches a screen |
| Test presence | Good | Tests at every layer, including concurrency races and privacy checks |
| Duplication | Fair | The idempotency preamble is copied into every function; `invitation_create` and others repeat whole bodies when replaced |
| Dead code | Fair | Placeholder tables and test-only access classes remain |

## Test Coverage

- Test layers: `src/**/*.test.ts`, `scripts/**/*.test.ts`, `tests/unit`, `tests/integration`, `tests/coverage`, `tests/database`, `tests/browser`.
- Coverage: Istanbul with 80/80/80 thresholds over production source.
- Browser specs assert computed styles, sizes, layouts and class hooks, so visual or structural changes to screens can fail them.
- Last recorded acceptance report: 33 pass, 0 fail, 6 outstanding, bound to older commit `8f1cefa`. Treat current executable results as authoritative.
- Outstanding evidence: Safari desktop and mobile, hosted Supabase auth and persistence, scheduler and provider, Vercel preview or staging.

## Defects Found

| Severity | Finding | Location |
|---|---|---|
| Medium | The reason a parent must type for a swap or cancellation is validated, then dropped: the action never passes it to the facade, so `change_requests.reason` stays empty | `app/szulo/actions.ts` lines 33 to 47 and 136 to 146 |
| Low | Text limit mismatches: contribution note 300 in the screen and 500 in the database; title 120 in the action and 200 in the database | `app/szulo/actions.ts` line 184, `app/admin/actions.ts` line 32 |
| Low | Leftover demo wording on the parent list ("kitalált család") | `app/szulo/feladatok/page.tsx` line 32 |

## Technical Debt

| Item | Effect | Location |
|---|---|---|
| Function bodies spread across files (`lifecycle_run` five times, `identity_housekeeping` four times) | Hard to find the current behaviour, easy to copy an old body | `supabase/migrations/` |
| Copied use-case preamble | Mechanical cost per function; future change touches about 40 functions | `supabase/migrations/` |
| `app_import_runs` still read by `scope_probe` although imports use `import_runs` | The `import_run` probe answers from an empty placeholder | `20261033` |
| `app_audit_events`, `organization_settings` unused by application code (schema tests and privilege statements name them) | Clutter | `20260806`, `20261024` |
| `AccessService` and in-memory adapters only used by tests | Second, unused model of grants | `src/access/` |
| Admin list reads capped at 1000 rows; task detail fetches the whole list | Silent truncation once rotas add thousands of rows | `src/data/admin-tasks.ts`, `src/data/admin-records.ts`, `app/admin/feladatok/[id]/page.tsx` |
| `duty_list` returns all tasks of the group, past included; filtering happens in the browser | Grows with each year of rotas | `20261028`, `app/szulo/feladatok/page.tsx` |
| Group-admin scope picks the first grant only for the page scope | Multi-group admins depend on database reach, not on the chosen scope | `src/runtime/production/access.ts` |
| Page file exports a helper used by others | Fragile with framework rules | `app/szulo/feladatok/page.tsx` |

## Known Limits Recorded by the Project

From `verification/reports/u5-workbook-and-known-limits.md`:

- Reminders are not re-planned when a family changes group.
- Staged import data expires only when someone signs in or the screen is opened; no scheduler.
- Invitations cannot be sent from a screen.
- Hungarian notice titles have not been reviewed by the owner.

## Risk Notes for the Ovis Tábla Intent

- The group concept reaches into policies, helpers, the import and tests, so its change needs a careful migration and broad test updates.
- A new bulk rota function must follow the fixed lock order and respect the 50-capacity and one-place-per-family rules.
- Adding a role requires updating the constraint, helpers, matrix, navigation and verification manifests together.
- Privacy scan and team rules forbid real names in the repository, and the one-off migration script must be developed against the anonymised copy only.
