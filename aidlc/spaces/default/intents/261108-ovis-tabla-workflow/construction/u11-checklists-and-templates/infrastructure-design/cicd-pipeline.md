# CI/CD Pipeline: u11-checklists-and-templates

Sources: `team.md` (Testing Posture, Deployment, Code Style), `project.md`, and `reliability-design.md` and `security-design.md` of this Unit. The pipeline is the existing one; this Unit adds files to it and changes no workflow.

## Pipeline

The `Validate` job runs `npm run verify:local` on every pull request that touches more than workflow records, in Chromium, Firefox and mobile Chrome, and GitHub requires it before merge into `main`. This Unit's change is one short-lived branch, one pull request and one squash commit.

| Stage | What runs | Gate for this Unit |
|---|---|---|
| Format and lint | Prettier, ESLint, and Stylelint on `app/globals.css` | New `checklist-` classes are kebab-case and pass Stylelint; colour tokens keep the `--name: #rrggbb` form |
| Types | Strict type checking | New code is typed |
| Unit tests | Vitest with coverage thresholds of 80/80/80 | Application code keeps the thresholds (NFR6.5); a test counts the data calls the event page makes (NFR9.10); `src/data/admin-port.test.ts` passes unchanged (NFR11.4) |
| Database tests | `test:database:*` scripts and the shuffled run on the real local stack | Each new file (named `checklists-*.test.ts`, beside the `events-*` and `recurring-*` files) is listed by hand in `test:database:directory` in `package.json`, where the events, library and recurring files already are, and in `DATABASE_TEST_FILES` in `scripts/db/shuffled-tests.ts` (NFR6.7); the daily-check tests also go in that script, as `recurring-check.test.ts` does; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended. They hold the fixed-list tests acting as real roles, a teacher and an organiser-only parent included (NFR3.10 to NFR3.20), the repeated-click and two-at-once tests (NFR5.7 to NFR5.14), the constraint tests as database owner (NFR7.11), the daily-check double run, failing-event and stopped-run tests (NFR7.12, NFR7.17), the clock-change tests (NFR7.13), the U10 cancellation-with-helpers test (NFR7.14), the install-twice test (NFR7.15), the legacy-linked task edit (NFR11.4) and the owner-level tests of the delivered functions (NFR6.8). Race cases repeat inside the test file, because the shuffled run shuffles files once per run |
| Build and start smoke | Production build, then the start smoke | Unchanged |
| Browser flow | Critical flow with accessibility checks | New specs `tests/browser/checklists.spec.ts` (event checklist block, template field on the event form, checklist editor, template screens, as each role), `checklists-timing.spec.ts` (NFR9.5, NFR9.6) and `checklists-screenshots.spec.ts` (the owner's Stitch comparison), following the existing `events-*` and `recurring-*` specs; `events.spec.ts` changes in the same pull request where the event page and form change. No serious or critical violations on the new screens (NFR8.4) |
| Dependency scan, secret scan, SAST | As today | No new dependency is added; high and critical findings block |
| Privacy scan | `scripts/verification/scan-artifacts.ts` with `scripts/verification/privacy-allowlist.json` | The scan reads `supabase/migrations/` (an allowed path for SQL files, still scanned for email addresses and phone numbers), so the starting-template texts in the migration are checked for contact details like any other file. The scan does not look for names; the template texts come from the review appendices, where names were already removed, and the owner checks them at review. Every test address or phone number is on the allowlist (NFR1.5) |
| Build records | CycloneDX SBOM, placeholder-settings archive, unsigned metadata and SHA256 checksums, kept 14 days, on each merge to `main` | Unchanged; unsigned build records only |

## Deployment and Rollback

Nothing deploys: the owner runs the app locally. The tested git SHA is the artifact claim. The migration reaches a database only through `npm run db:migrate`, in file-name order. Rollback is forward-only: an applied migration file is never edited, and a defect is fixed by a new file. The two replaced functions keep their earlier behaviour, which their existing tests check. Staging and production promotion belong to the later hosting work.

## Secrets

No new secret. CI keeps installing from `package-lock.json` and uses placeholder settings for the build.

## Before the Owner Reviews

Before the build is shown, leftover app servers are stopped (`pkill -f next-server`), the local settings are loaded before `npm run verify:local`, and the screenshots for the owner's Stitch comparison are checked for error pages first (project rules).
