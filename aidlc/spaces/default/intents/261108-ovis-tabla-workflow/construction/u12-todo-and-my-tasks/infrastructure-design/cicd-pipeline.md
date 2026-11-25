# CI/CD Pipeline: u12-todo-and-my-tasks

Sources: `team.md` (Testing Posture, Deployment, Code Style), `project.md`, and `reliability-design.md` and `security-design.md` of this Unit. The pipeline is the existing one; this Unit adds files to it and changes no workflow.

## Pipeline

The `Validate` job runs `npm run verify:local` on every pull request, in Chromium, Firefox and mobile Chrome, and GitHub requires it before merge into `main`. This Unit is one short-lived branch, one pull request and one squash commit.

| Stage | What runs | Gate for this Unit |
|---|---|---|
| Format and lint | Prettier, ESLint, and Stylelint on `app/globals.css` | New `todo-` classes are kebab-case and pass Stylelint; colour tokens keep the `--name: #rrggbb` form |
| Types | Strict type checking | New code is typed |
| Unit tests | Vitest with 80/80/80 coverage thresholds | Application code keeps the thresholds (NFR6.9); a test counts the data calls each new page makes (NFR9.17) |
| Database tests | `test:database:*` scripts and the shuffled run on the real local stack | Each new file (named `todo-*.test.ts`) is listed by hand in `test:database:directory` in `package.json` and in `DATABASE_TEST_FILES` in `scripts/db/shuffled-tests.ts` (NFR6.11); the daily-check test (`todo-checks.test.ts`) goes in `test:database:directory` and in `DATABASE_TEST_FILES`, as `recurring-check.test.ts` does; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended. They hold the fixed-list tests acting as real roles (NFR3.21 to NFR3.30), the repeated-click and two-at-once tests (NFR5.15 to NFR5.22), the constraint tests as database owner (NFR7.20), the daily-check double run, failing-task and stopped-run tests (NFR7.21), the clock-change tests (NFR7.22), the load-twice test (NFR7.23), the removal-pair, `checklist_task_done_state` and load owner-level tests (NFR6.12, NFR11.5, NFR11.6). Race cases repeat inside the test file, because the shuffled run shuffles files once per run |
| Build and start smoke | Production build, then the start smoke | Unchanged |
| Browser flow | Critical flow with accessibility checks | New specs `tests/browser/todo.spec.ts` (list, task page, My tasks, management page, form, pull list, as each role), `todo-timing.spec.ts` (NFR9.11 to NFR9.13) and `todo-screenshots.spec.ts` (the owner's Stitch comparison); existing specs change in the same pull request where today's duties page and group page change (NFR11.7). No serious or critical violations on the new screens (NFR8.6) |
| Dependency scan, secret scan, SAST | As today | No new dependency; high and critical findings block |
| Privacy scan | `scripts/verification/scan-artifacts.ts` with `scripts/verification/privacy-allowlist.json` | Every test address or phone number is on the allowlist; the invented workbook holds no real task text (NFR1.8) |
| Build records | CycloneDX SBOM, placeholder-settings archive, unsigned metadata and SHA256 checksums, kept 14 days, on each merge to `main` | Unchanged; unsigned build records only |

## Deployment and Rollback

Nothing deploys: the owner runs the app locally. The tested git SHA is the artifact claim. The migration reaches a database only through `npm run db:migrate`, in file-name order. Rollback is forward-only: an applied file is never edited, and a defect is fixed by a new file (NFR7.24). Staging and production promotion belong to the later hosting work.

## Secrets

No new secret. CI keeps installing from `package-lock.json` and uses placeholder settings for the build.

## Before the Owner Reviews

Leftover app servers are stopped (`pkill -f next-server`), the local settings are loaded before `npm run verify:local`, and the screenshots for the owner's Stitch comparison are checked for error pages first (project rules).
