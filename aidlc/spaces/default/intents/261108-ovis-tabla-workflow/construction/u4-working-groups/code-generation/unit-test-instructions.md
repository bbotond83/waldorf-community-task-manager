# Unit Test Instructions: u4-working-groups

This Unit uses the standard test strategy: five to eight tests per component, plus integration tests at the key boundaries. NFR3 and NFR1 require security tests, and NFR5 requires concurrency tests. This file contains no names or contact details.

## Setup

The local stack must be running and migrated, with the local settings loaded. Run `source .env.database.local`, and for builds also export `APP_SESSION_SECRET`, `APP_PUBLIC_URL` and `SMTP_FROM`. Stop any leftover app servers first with `pkill -f next-server`.

```bash
npm run db:start
```

```bash
npm run db:migrate
```

No new test framework or configuration is needed.

## How to Run This Unit's Tests

Database rules, races, migration and timing:

```bash
node --experimental-strip-types --test --test-concurrency=1 tests/database/working-groups.test.ts tests/database/working-groups-races.test.ts
```

Changed role, grant and catalogue database tests:

```bash
node --experimental-strip-types --test --test-concurrency=1 tests/database/community-roles.test.ts tests/database/identity-grants.test.ts tests/database/identity-catalogue.test.ts
```

Seed tests:

```bash
npm run test:database:seed
```

Data port and access policy:

```bash
node --experimental-strip-types --test src/data/working-groups.test.ts src/access/role-policy.test.ts
```

Matrix, navigation and screens:

```bash
npx vitest run --config vitest.config.ts tests/unit/working-group-matrix.test.ts tests/unit/navigation-access.test.ts tests/integration/working-groups.test.tsx
```

Role walk and timing:

```bash
npx playwright test --config playwright.config.ts tests/browser/working-groups.spec.ts tests/browser/working-groups-timing.spec.ts
```

The final file names follow the files this Unit changes. If an existing test file already covers an area, the plan step edits that file and this list is corrected in the same step.

## Coverage Targets

Application code keeps at least 80% line, branch and function coverage, as today. SQL is covered by the fixed list below.

## The Fixed List for Database Rules

Each command gets six cases: allowed, refused, out of reach, outdated screen, repeated click, and two people at once.

| Rule | Allowed | Refused | Out of reach | Outdated screen | Repeated click | Two at once |
|---|---|---|---|---|---|---|
| BR40.1 to BR40.3 join | Parent joins | Archived group; teacher; super admin without a parent | Other community | Not meaningful: join carries no version | Same key returns stored result | Two joins of one parent; two parents; join against removal |
| BR40.4 to BR40.6 leave | Member leaves; coordinator leaves and loses the right; archived group | Already left | Someone else's or a missing membership (same denied result) | VERSION_CONFLICT after appoint or revoke | Same key | Leave against appoint; leave against revoke; leave against the lifecycle step |
| BR41.1 to BR41.6 appoint, revoke | Appoint, several coordinators, revoke; two notices and two emails for one grant | NOT_A_MEMBER, ACCOUNT_REQUIRED, ALREADY_COORDINATOR, NOT_COORDINATOR, GROUP_UNAVAILABLE | Parent, teacher, coordinator of the same group | VERSION_CONFLICT | Same key | Two appoints; two revokes; appoint and revoke each against the lifecycle step |
| BR41.7 old path | Other roles unchanged | group_admin add and revoke as a super admin | A non-admin denied first | Not meaningful: no version | Same key | Not meaningful: refuses before any write |
| BR41.8 invariant | Helper finds no grant without an active membership after each writer | — | — | — | — | Covered by the race tests |
| BR42.1 to BR42.5 page | Each role reads, with each cell of the "who sees what" matrix | Signed out | Other community; archived group | Not meaningful: a read | Not meaningful: a read | Not meaningful: a read |
| BR43.1 facts | Ids only, ordered | — | Not granted to signed-in roles | Not meaningful | Not meaningful | Not meaningful |
| BR44.1, BR44.2 removal | Coordinator; member without a grant; parent without an account; family | — | Not granted to signed-in roles | Not meaningful | Applying twice ends nothing twice | Join against removal |

The header of `tests/database/working-groups.test.ts` records each "not meaningful" with its reason.

## Mocking and Test Data

Database tests act as real database roles and signed-in accounts on the local stack, with no mocks. Port tests use the existing fake gateway. All data is invented:
- a super admin
- a teacher
- parents of at least four families, some without an account
- coordinators with linked accounts

Every test address is listed in `scripts/verification/privacy-allowlist.json`.

## Security and Performance Tests

- **Direct calls.** Each command called directly as each role gets the refusal of BR40.1, BR40.4 and BR41.1. The internal functions are not executable by any application role, and the catalogue test lists their grants (NFR3.10 to NFR3.15).
- **Old grant path.** The general role-change function refuses group_admin for adding and revoking. A non-admin is denied first (NFR3.12).
- **Next request after revoking.** A revoked coordinator is refused as a group administrator on their very next request, within the same session (NFR3.13).
- **Unavailable groups.** Missing, archived and other-community groups give one answer; leave and revoke on an archived group are allowed (NFR3.14).
- **Contact details.** A withheld phone or email is absent from the result, and the directory and the group page agree for the same viewer and member (NFR1.9, NFR1.10).
- **Audit.** Rows hold opaque ids and the reason. A repeated key writes no second row (NFR4.15 to NFR4.17).
- **Notice and email content.** They carry only the title, the group name and the link (NFR10.5).
- **Races.** The four race tests each run 50 times with no deadlock error (NFR5.12).
- **Migration.** Applying the migration over a seeded database keeps the membership and grant counts. Ended rows get `end_reason = 'left'`, and exactly one `end_admin` remains (NFR7.17, NFR7.18).
- **Timing.** The group page read and the commands run in under 2 seconds on `db:seed:large`, and the two pages load in under 2 seconds in the browser (NFR9.8 to NFR9.10).
