# CI/CD Pipeline: u14-removal-and-anonymisation

Sources: `team.md` (Testing Posture, Deployment, Code Style), `project.md`, and this Unit's `reliability-design.md`, `security-design.md`, `performance-design.md`, `scalability-design.md`, `observability-design.md`, `logical-components.md`, `functional-spec.md`, `components.md` and `contract-summary.md`. The pipeline is the existing one; this Unit adds files and changes no workflow. Contains no names or contact details.

## Pipeline

The `Validate` job runs `npm run verify:local` on every pull request, in Chromium, Firefox and mobile Chrome, and GitHub requires it before merge into `main`. This Unit is one short-lived branch, one pull request and one squash commit.

| Stage | What runs | Gate for this Unit |
|---|---|---|
| Format and lint | Prettier, ESLint, Stylelint on `app/globals.css` | New classes use the `admin-` prefix |
| Types | Strict type checking | Result types for the preview, report and flagged items |
| Unit tests | Vitest, coverage 80/80/80 | Server actions, including the session-ending retry and warning, keep the thresholds |
| Database tests | `test:database:directory` and the shuffled run | New files (for example `lifecycle-removal.test.ts`, `lifecycle-removal-races.test.ts`, `lifecycle-later-run.test.ts`, `lifecycle-texts.test.ts`) are added by hand to `test:database:directory` in `package.json` and to `DATABASE_TEST_FILES` in `scripts/db/shuffled-tests.ts`. They hold the fixed list for every rule, the race tests of `reliability-design.md`, one test per emptied text kind, the session tests and the timing tests. `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended. The changed existing tests (family "korábbi tag", DUTY_ROTA_MANAGED on archive) change in the same pull request; the existing lock tests run unchanged |
| Build and start smoke | Production build, start smoke | Unchanged |
| Browser flow | Critical flow with accessibility checks | No serious or critical violations on the confirmation, result and restore pages |
| Dependency, secret and SAST scans | As today | No new dependency |
| Privacy scan | `scripts/verification/privacy-allowlist.json` | Every test address or phone number listed |
| Build records | SBOM, placeholder archive, unsigned metadata, checksums, 14 days | Unchanged |

## Before Merge

- Before a full `npm run verify:local`: stop leftover app servers (`pkill -f next-server`) and load the local settings (`project.md`).
- The new and changed pages are designed in Stitch first and compared in the owner's screenshot review.

## Deployment and Rollback

Nothing deploys. The migration is forward-only; a mistake is fixed by a new migration file, and on the owner's computer by resetting the local stack, which holds invented data only.
