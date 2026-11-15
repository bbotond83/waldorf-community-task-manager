# CI/CD Pipeline: u5-reminders-and-email

No pipeline is added or changed. The existing `Validate` job runs on every pull request; nothing deploys (`npm run verify:no-deploy`).

## Stages

| Stage | Gate | This Unit's addition |
|---|---|---|
| Install from lockfile | Blocking | None; no new package |
| Format, lint, CSS style check | Blocking | New `admin-` classes follow kebab-case |
| Strict type check | Blocking | None |
| Unit and component tests, 80% coverage | Blocking | Tests for the timed command, notice mailer (fake transport) and delivery-problems port, colocated with code |
| Database tests (`test:database:*`, shuffled run) | Blocking | Notice, delivery, run and failure-view tests go in new files added by hand to their `test:database:*` script and to the shuffled run |
| Production build, start smoke | Blocking | Needs `APP_SESSION_SECRET`, `APP_PUBLIC_URL`, `SMTP_FROM` |
| Critical browser flow, accessibility | Blocking in Chromium, Firefox, mobile Chrome | "Kézbesítési hibák" opened as each role; the old reminders screen path removed |
| Mail catcher integration check | Blocking | One real send read back from the local catcher; one no-session run of the command |
| Dependency scan, secret scan, SAST | Blocking on high and critical | None; test addresses in the privacy allowlist |

## Deployment and Rollback

None: no hosted site exists. The tested git SHA is the artifact record. The migration is forward-only; a defect found after merge is fixed by a new migration file. Tested by applying it over a seeded database and comparing notice counts, job states and titles (NFR7.8, NFR7.9). When hosting arrives it runs the same command on the schedule in `infrastructure-specification.md`.

## Secrets

No new secret. The command uses the service key the scripts already use, read from the environment and never committed. Test addresses and keys are invented.
