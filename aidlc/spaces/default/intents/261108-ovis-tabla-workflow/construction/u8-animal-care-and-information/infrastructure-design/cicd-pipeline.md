# CI/CD Pipeline: u8-animal-care-and-information

Sources: `team.md` (Testing Posture, Deployment, Code Style), `project.md`, and `reliability-design.md`, `security-design.md`, `scalability-design.md` and `performance-design.md` of this Unit. The pipeline is the existing one; this Unit adds files to it and changes no workflow.

## Pipeline

The `Validate` job (`.github/workflows/ci.yml`) runs `npm run verify:local` on every pull request into `main` that is not a draft and does not touch only `aidlc/**` files, in Chromium, Firefox and mobile Chrome, and GitHub requires it before merge into `main`. This Unit's change is one short-lived branch, one pull request and one squash commit.

| Stage | What runs | Gate for this Unit |
|---|---|---|
| Format and lint | Prettier, ESLint, Stylelint on `app/globals.css` | New classes use the `parent-`, `admin-` and new `info-` prefixes, kebab-case; colour tokens keep the `--name: #rrggbb` form |
| Types | Strict type checking | The ports and facades for the new reads and commands, and the section-text renderer, are typed |
| Unit tests | Vitest with coverage thresholds of 80/80/80 | Thresholds kept (NFR6.1); the renderer's component tests cover each accepted form, each malformed form, script and style injection and the link list of NFR3.13 (NFR3.12, NFR3.13); a test counts the data calls each page makes: two, one and one (NFR9.5) |
| Database tests | `test:database:*` scripts and the shuffled run on the real local stack | The nine new files (`animal-calendar-slots`, `animal-table-rights`, `animal-sign-up-give-up`, `animal-slot-races`, `animal-fair-share`, `animal-checks`, `info-sections`, `info-links-duty-card` and `animal-migration`, each `.test.ts` in `tests/database/`; `animal-support.ts` is a helper and is not listed) are listed by hand in `test:database:directory`, where the earlier units' files are, and in `DATABASE_TEST_FILES` in `scripts/db/shuffled-tests.ts`; `identity-catalogue.test.ts` (elevated functions, policy tests, scope probes with the four tables and no right for `authenticated`) and `notification-use-cases.test.ts` are extended (NFR6.3, NFR3.8). They hold the fixed-list rule tests for BR80.1 to BR89.1 (NFR6.2), the role tests including direct table selects and hidden sections (NFR3), the key replay tests (NFR3.10), the race tests repeated inside the file and run together with U7's swap race tests (NFR5), the clock-change and first-weekday tests (NFR7.3, NFR7.4), the worked fair-share examples (NFR6.4), the audit-check test that reads the old list from the live check (NFR4.4), the forced-failure tests (NFR4.1, NFR7.1, NFR7.2, NFR7.7), the test that reads this Unit's two daily-run registry rows, and, in `animal-migration.test.ts`, the migration test over a seeded database with and without the named groups and the before-and-after duty card comparison (NFR7.6, NFR11.2). The existing kernel sign-up, swap, reminder and duty card tests stay green, with the new `info_links` field the one change named in the pull request (NFR11.2) |
| Build and start smoke | Production build, then the start smoke | Unchanged |
| Browser flow | Critical flow with accessibility checks | No serious or critical violations on the sign-up page, the information page and editor, the settings screen and the duty card (NFR8.2) |
| Dependency scan, secret scan, SAST | As today | No new dependency; high and critical findings block |
| Privacy scan | `scripts/verification/privacy-allowlist.json`, also over the migration's starting text | Every test address or phone number is listed, and the section text holds none (NFR1.1, NFR1.3) |
| Build records | SBOM, placeholder-settings archive, unsigned metadata and checksums, kept 14 days | Unchanged |

## Deployment and Rollback

Nothing deploys: the owner runs the app locally. The tested git SHA is the artifact claim. The migration reaches a database only through `npm run db:migrate`, in file-name order. Three migration files apply in file-name order: `20261068` (the Unit), `20261069` (replaces `schedule_get` so the teacher schedule leaves out animal slots) and `20261070` (replaces `animal_calendar_save` and `info_section_update` after owner review). Rollback is forward-only: an applied file is never edited, and `20261070` is such a forward fix. The read-only teacher page `/teacher/allatok` is covered by the browser and accessibility checks of `animal-care.spec.ts`. Staging and production promotion belong to the later hosting work.

## Secrets

No new secret. CI keeps installing from `package-lock.json` and uses placeholder settings for the build.

## Before the Owner Reviews

The new screens are designed in Stitch before they are built. Leftover app servers are stopped (`pkill -f next-server`), the local settings are loaded before `npm run verify:local`, a year's slots are created on the local stack so the sign-up page has content, and the screenshots for the owner's Stitch comparison are checked for error pages first (project rules).
