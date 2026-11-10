# Team Practices

> Integrated after the owner's interview for the Ovis tábla work. The reasons are in `evidence.md`.

## Way of Working

We use trunk-based development. We work in short-lived feature branches, squash-merge to `main` through a pull request, and require green automated checks before merge. GitHub enforces the pull request and the required `Validate` check on `main` and refuses force pushes and deleting the branch; squash-merging is our habit rather than something GitHub enforces.

The Ovis tábla work is large, so we split it into Bolts (small, separately merged pieces) that each fit a short-lived branch and become one squash commit. Half-finished features may be visible on `main` while only the owner runs the app, so we use no feature switches to hide unfinished work during that time.

## Walking Skeleton

We use a scope-dependent walking skeleton, which means a thin first slice that runs the whole way through, built first to prove the pieces connect. When the active scope enables it, we run a gated first Bolt that proves the browser, composition, production-build, start and smoke-test boundaries before broader delivery proceeds.

The scope of the Ovis tábla work turns the skeleton ceremony off, and we still build a thin first slice: one community-wide rota, from the database to the parent's screen. The owner checks it before the rest is built.

## Testing Posture

- **Methodology**: test-after
- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.
- **Methodology evidence**: Unchanged. Tests sit next to the code or in `tests/` in the same pull request, and each fix commit carries its regression test. Recent merges show this for screens (#2, #3, #6) and for the database (#45 added its migration and its test file together). No history shows tests written ahead of the code as a rule.

We write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source (Vitest with the Istanbul provider, thresholds 80/80/80 in `vitest.config.ts`). That figure counts application code, meaning TypeScript and JavaScript under `app/`, `src/` and `scripts/`; it does not see SQL.

Before merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. All of these run through `npm run verify:local`, which the `Validate` job runs on every pull request in Chromium, Firefox and mobile Chrome. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets.

Our database rules are tested on the real local database stack in `tests/database/`, with the tests acting as the real database roles and signed-in accounts. Each new test file must be added by hand to its `test:database:*` script and to the shuffled run; a file listed in neither never runs.

Because the coverage figure cannot see the database, every database rule gets a fixed list of must-have tests: allowed; refused; out of reach; outdated screen; repeated click; and two people acting at once.

The one-off spreadsheet migration script lives in the repository. Its automatic checks use only an invented workbook in `tests/fixtures/fictitious/`. The owner additionally does trial runs against the anonymised workbook, on the owner's computer only, to prove the script reads the real layout. The anonymised workbook stays outside the repository and is not used for anything until the anonymiser has been fixed and re-run and the owner has checked the result.

The existing gates react to styling: browser specs assert computed styles, element sizes, layout at several widths and class hooks, and `tests/unit/design-tokens.test.ts` reads colour tokens only in the form `--name: #rrggbb` inside `:root` of `app/globals.css`. Changed screens keep those class names, measurements and token format, or the matching tests change in the same pull request. New screens follow `DESIGN.md`.

We design new screens in Stitch before building them. We check how new or restyled screens look by owner review: the owner compares each built screen with its Stitch design using screenshots provided by the assistant. We do not add automatic picture-comparison tests.

Stylelint checks `app/globals.css` as a blocking step of `npm run verify:local`. `react`, `react-dom`, `zod`, `@axe-core/playwright`, `@playwright/test`, `stylelint` and `stylelint-config-standard` stay on exact versions, guarded by `tests/unit/dependency-pins.test.ts`. CI installs from `package-lock.json`, so the development tools still marked `latest` change only when the lockfile is refreshed.

## Deployment

Once a hosted site exists, we automatically build and deploy eligible changes to staging, and promote immutable deployments to production only after protected manual approval, keeping the prior deployment as the rollback target. No hosted site exists yet, so this is not in effect; setting one up is a separate piece of work after the Ovis tábla work.

Today nothing deploys automatically. The owner runs the app locally against a local backend and verifies changes there. The Ovis tábla work ends with everything working on the owner's computer. We keep executable deployment workflows disabled until both a deployable application and a linked target project exist; `npm run verify:no-deploy` checks this. Until then, the tested git SHA is our artifact-provenance claim.

Database changes reach a database only as forward-only migration files, applied in file-name order by `npm run db:migrate`. A file that has been applied is never edited; a change means a new file.

The one-off spreadsheet migration script is built and tested in the Ovis tábla work. Loading real data into a hosted app belongs to the later hosting work. The local stack does not hold real data for go-live purposes.

## Code Style

We use strict, idiomatic TypeScript with English technical identifiers and Hungarian user-facing copy. We use Prettier and ESLint as blocking checks. We preserve functional module boundaries, explicit ports, constructor injection at infrastructure seams, and colocated `*.test.ts` files.

We represent expected application failures as explicit result states and map unexpected infrastructure errors at the application boundary. CI includes secret scanning and SAST, with high and critical SAST findings blocking delivery. We pin CI actions to immutable revisions. For this repository, each commit merged to `main` produces a CycloneDX SBOM, a build archive made with placeholder settings, explicitly unsigned commit/run metadata and SHA256 checksums retained as Actions artifacts for 14 days. These are unsigned build records only, not cryptographic artifact attestations, and we do not add signing or attestation.

Prettier formats `app/globals.css` and Stylelint checks it; ESLint does not read CSS. CSS classes are kebab-case with an area prefix (`parent-`, `teacher-`, `admin-`, `filter-`), and new areas get their own prefix.

Business rules live in the database as named Postgres functions behind row-level security; the TypeScript layers authorize, translate and present. Application roles hold read access only, and every change to data goes through a named function. New functions follow the existing use-case template (active session, idempotency, result envelope, refusals through `U3R00`), start with `revoke all` followed by an explicit `grant execute`, and stay schema-neutral. Bulk work follows the fixed lock order: family row, then task rows ascending, then assignment rows ascending. A role change updates the grant constraint, the reach helpers, `role-policy.ts`, `authorization.ts`, navigation and `verification/authorization-matrix.json` together.

The real workbook and any real person's name or contact details stay out of the repository, including its tests and workflow records.
