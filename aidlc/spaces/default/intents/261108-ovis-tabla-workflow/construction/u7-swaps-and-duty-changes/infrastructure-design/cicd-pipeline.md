# CI/CD Pipeline: u7-swaps-and-duty-changes

Sources: `team.md` (Testing Posture, Deployment, Code Style), `project.md`, and `reliability-design.md`, `security-design.md` and `scalability-design.md` of this Unit. The pipeline is the existing one; this Unit adds files to it and changes no workflow.

## Pipeline

The `Validate` job runs `npm run verify:local` on every pull request that touches app or database files, in Chromium, Firefox and mobile Chrome, and GitHub requires it before merge into `main`. This Unit's change is one short-lived branch, one pull request and one squash commit.

| Stage | What runs | Gate for this Unit |
|---|---|---|
| Format and lint | Prettier, ESLint, Stylelint on `app/globals.css` | New classes use the `parent-` and `admin-` prefixes, kebab-case; colour tokens keep the `--name: #rrggbb` form |
| Types | Strict type checking | The ports and facades for the new and retired functions are typed |
| Unit tests | Vitest with coverage thresholds of 80/80/80 | Thresholds kept (NFR6.1); a test counts the data calls each page makes (NFR9.4) |
| Database tests | `test:database:*` scripts and the shuffled run on the real local stack | New files (`dutychanges-swaps`, `dutychanges-cancellations`, `dutychanges-admin`, `dutychanges-races`, `dutychanges-for-later-units`) are listed by hand in their `test:database:*` script and in `DATABASE_TEST_FILES` in `scripts/db/shuffled-tests.ts`; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended (NFR6.3). They hold the fixed-list rule tests (NFR6.2), the role tests including direct table selects (NFR3, NFR1.3), the key replay tests (NFR3.9), the race tests repeated inside the file and run together with U6's pick race tests (NFR5), the clock-change tests (NFR7.5) and the migration test over a seeded database (NFR7.6). The existing kernel swap tests and U6's tests stay green, with changed expectations named in the pull request (NFR11.2) |
| Build and start smoke | Production build, then the start smoke | Unchanged |
| Browser flow | Critical flow with accessibility checks | No serious or critical violations on the new and changed screens (NFR8.2) |
| Dependency scan, secret scan, SAST | As today | No new dependency; high and critical findings block |
| Privacy scan | `scripts/verification/privacy-allowlist.json` | Every test address or phone number is listed (NFR1.1) |
| Build records | SBOM, placeholder-settings archive, unsigned metadata and checksums, kept 14 days | Unchanged |

## Deployment and Rollback

Nothing deploys: the owner runs the app locally. The tested git SHA is the artifact claim. The migration reaches a database only through `npm run db:migrate`, in file-name order. Rollback is forward-only: an applied file is never edited, and a defect is fixed by a new file. Staging and production promotion belong to the later hosting work.

## Secrets

No new secret. CI keeps installing from `package-lock.json` and uses placeholder settings for the build.

## Before the Owner Reviews

Leftover app servers are stopped (`pkill -f next-server`), the local settings are loaded before `npm run verify:local`, and the screenshots for the owner's Stitch comparison are checked for error pages first (project rules).
