# CI/CD Pipeline: u4-working-groups

No pipeline is added or changed. The existing `Validate` job runs on every pull request, and nothing deploys (`npm run verify:no-deploy`).

## Stages

| Stage | Gate | This Unit's addition |
|---|---|---|
| Install from lockfile | Blocking | None; no new package |
| Format, lint, CSS style check | Blocking | New `parent-group-*`, `teacher-group-*` and `admin-group-*` classes in kebab-case |
| Strict type check | Blocking | None |
| Unit and component tests, 80% coverage | Blocking | Tests for the group ports, the message map and the new matrix-row test, each placed next to its code |
| Database tests (`test:database:*`, shuffled run) | Blocking | New `tests/database/working-groups.test.ts` added to `test:database:directory` and to `DATABASE_TEST_FILES` in `scripts/db/shuffled-tests.ts`. The changed `community-roles.test.ts` and `identity-grants.test.ts` cases, and the new `identity-catalogue.test.ts` entries, go in the same pull request. |
| Production build, start smoke | Blocking | Needs `APP_SESSION_SECRET`, `APP_PUBLIC_URL` and `SMTP_FROM`, as today |
| Critical browser flow, accessibility | Blocking in Chromium, Firefox and mobile Chrome | Each group route opened as each role; join and leave as a parent; appoint and revoke as a super admin |
| Dependency scan, secret scan, SAST | Blocking on high and critical | None; test addresses are in the privacy allowlist |

## Deployment and Rollback

None, because no hosted site exists. The tested git SHA is the artifact record.

The migration is forward-only: a defect found after merge is fixed by a new migration file. It is tested by applying it over a seeded database and comparing the membership and grant counts (NFR7.17).

## Secrets

No new secret is added. Test keys and addresses are invented.
