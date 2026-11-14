# Unit Test Instructions: u3-directory-and-profile

Standard test strategy: five to eight tests per component, with integration tests at the key boundaries. Security tests are required by NFR3 and concurrency tests by NFR5. Contains no names or contact details.

## Setup

The local stack must be running and migrated, with the local settings loaded (`source .env.database.local`, and `APP_SESSION_SECRET`, `APP_PUBLIC_URL` and `SMTP_FROM` exported for builds):

```bash
npm run db:start
```

```bash
npm run db:migrate
```

No new test framework or configuration is needed.

## How to Run This Unit's Tests

Database:

```bash
node --experimental-strip-types --test --test-concurrency=1 tests/database/directory-profile.test.ts tests/database/directory-records.test.ts tests/database/identity-email-change.test.ts
```

Sign-in service:

```bash
node --experimental-strip-types --test "src/identity/*.test.ts"
```

(The files under `src/` are Node test files; the vitest configuration only includes `tests/`, so the original `npx vitest run ... src/identity` command found no tests. Corrected while building Step 8.)

Access policy:

```bash
node --experimental-strip-types --test src/access/role-policy.test.ts src/access/access-matrix.test.ts
```

Screens, navigation and data adapters:

```bash
node --experimental-strip-types --test src/data/admin-port.test.ts src/data/parent-port.test.ts src/data/teacher-port.test.ts src/data/directory.test.ts
npx vitest run --config vitest.config.ts tests/integration/directory.test.tsx tests/unit/navigation-access.test.ts
```

Role walk:

```bash
npx playwright test --config playwright.config.ts tests/browser/directory.spec.ts
```

## Coverage Targets

At least 80% line, branch and function coverage across application code, unchanged. SQL is covered by the fixed list below.

## The Fixed List for Database Rules

Each command gets: allowed; refused; out of reach; outdated screen; repeated click; two people at once. The read rules (BR30) record that "outdated screen" and "repeated click" have no meaning and instead get one test per row of the "Who sees what" matrix, as real roles, plus a parent who ticked and was then deactivated. The password change records why "outdated screen" and "two people at once" have no meaning.

## Mocking and Test Data

Database tests act as real database roles and signed-in accounts on the local stack, with no mocks. Application tests use the existing in-memory adapters; the mail path uses the local mail catcher or a test double that records messages. All data is invented: a super admin, a group administrator, a teacher, and parents of at least four families, some with accounts and some without. No real name or contact detail is used.

## Security and Performance Tests

- Every records command called directly as a parent, a teacher and a group administrator (NFR3.3).
- Sharing and own-details commands refused for every caller but the parent themself, a super admin included (NFR3.4).
- A hidden field is absent from the directory result and a search for its value finds nothing (NFR1.2).
- The pending address never appears in any read (NFR1.3); the taken-address refusal is identical whichever table matched (NFR1.4).
- The guard still refuses every sign-in email route but the confirmation step (NFR3.6).
- Finished email-change requests are deleted after 30 days and the resend table after 24 hours (NFR1.5, NFR10.3); a 4th email to one address in an hour is refused and refused tries do not extend the window.
- `email_change_request`, `email_change_cancel` and `email_change_confirm` called directly as a signed-in account are refused, so the password check cannot be skipped (NFR3.5, NFR3.6); no new table can be read directly by a signed-in account (NFR3.7).
- Deactivation against removal, deactivation against email confirmation, and removal started through the family-first path of U14, each repeated to show no deadlock (NFR5.6).
- Two confirmations at once, two requests at once, removal against own-details save, and two adds of one address at once, repeated to show no deadlock (NFR5).
- Directory, "Fiókom" and records pages in under 2 seconds on the 30-family seed (NFR9.1).
