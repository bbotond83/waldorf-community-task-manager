# CI/CD Pipeline: u9-recurring-duties

Sources: `team.md` (Testing Posture, Deployment, Code Style), `project.md`, and `reliability-design.md` and `security-design.md` of this Unit. The pipeline is the existing one; this Unit adds files to it and changes no workflow.

## Pipeline

The `Validate` job runs `npm run verify:local` on every pull request that touches more than workflow records, in Chromium, Firefox and mobile Chrome, and GitHub requires it before merge into `main`. This Unit's change is one short-lived branch, one pull request and one squash commit.

| Stage | What runs | Gate for this Unit |
|---|---|---|
| Format and lint | Prettier, ESLint, and Stylelint on `app/globals.css` | New `recurring-` classes are kebab-case and pass Stylelint; colour tokens keep the `--name: #rrggbb` form |
| Types | Strict type checking | New code is typed |
| Unit tests | Vitest with coverage thresholds of 80/80/80 | Application code keeps the thresholds (NFR6.1); a test counts the data calls each page makes (NFR9.4) |
| Database tests | `test:database:*` scripts and the shuffled run on the real local stack | Each new file is listed by hand in its `test:database:*` script and in `DATABASE_TEST_FILES` in `scripts/db/shuffled-tests.ts` (NFR6.3); `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended. They hold the fixed-list tests acting as real roles (NFR3.1 to NFR3.5), the repeated-click and two-at-once tests (NFR5.1 to NFR5.7), the notice-window table of D-REL-1 (NFR7.4), the clock-change-week tests (NFR7.6), the rota-week republish and year-boundary tests (NFR7.7), the removed-flag constraint tests (NFR7.3, NFR7.8), the right-changed-between-requests test (NFR3.8) and the row-count test over a seeded database (NFR7.9). Race cases repeat inside the test file, because the shuffled run shuffles files once per run and does not repeat them |
| Build and start smoke | Production build, then the start smoke | Unchanged |
| Browser flow | Critical flow with accessibility checks | No serious or critical violations on the new screens (NFR8.2) |
| Dependency scan, secret scan, SAST | As today | No new dependency is added; high and critical findings block |
| Privacy scan | `scripts/verification/privacy-allowlist.json` | Every test address or phone number is listed (NFR1.1) |
| Build records | CycloneDX SBOM, placeholder-settings archive, unsigned metadata and SHA256 checksums, kept 14 days, on each merge to `main` | Unchanged; unsigned build records only |

## Deployment and Rollback

Nothing deploys: the owner runs the app locally. The tested git SHA is the artifact claim. The migration reaches a database only through `npm run db:migrate`, in file-name order. Rollback is forward-only: an applied migration file is never edited, and a defect is fixed by a new file. The migration only adds objects and rows and changes no existing row, which a test checks by comparing row counts of the existing tables over a seeded database (NFR7.9). Staging and production promotion belong to the later hosting work.

## Secrets

No new secret. CI keeps installing from `package-lock.json` and uses placeholder settings for the build.

## Before the Owner Reviews

Before the build is shown, leftover app servers are stopped (`pkill -f next-server`), the local settings are loaded before `npm run verify:local`, and the screenshots for the owner's Stitch comparison are checked for error pages first (project rules).
