# CI/CD Pipeline: u3-directory-and-profile

No pipeline is added or changed. The existing `Validate` job runs on every pull request; nothing deploys (`npm run verify:no-deploy`).

## Stages

| Stage | Gate | This Unit's addition |
|---|---|---|
| Install from lockfile | Blocking | None; no new package |
| Format, lint, CSS style check | Blocking | New `parent-` and `admin-` classes follow kebab-case |
| Strict type check | Blocking | None |
| Unit and component tests, 80% coverage | Blocking | New tests colocated with code |
| Database tests (`test:database:*`, shuffled run) | Blocking | Directory and profile tests go in `test:database:directory`, email-change and resend-limit tests in `test:database:identity`; each added by hand there and to the shuffled run |
| Production build, start smoke | Blocking | Needs `APP_SESSION_SECRET`, `APP_PUBLIC_URL`, `SMTP_FROM` |
| Critical browser flow, accessibility | Blocking in Chromium, Firefox, mobile Chrome | New screens opened as each role |
| Dependency scan, secret scan, SAST | Blocking on high and critical | None |

## Deployment and Rollback

None: no hosted site exists. The tested git SHA is the artifact record. The migration is forward-only; a defect found after merge is fixed by a new migration file. Tested by applying it over a seeded database and comparing row counts (NFR7.4).

## Secrets

No new secret. Test passwords and keys are invented and live in seed files. The real workbook and any real contact detail stay out of the repository.
