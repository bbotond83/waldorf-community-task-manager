# Unit Test Instructions: u2-first-rota-slice

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
node --experimental-strip-types --test --test-concurrency=1 tests/database/rota-calendar.test.ts tests/database/rota-plan.test.ts
```

Access policy:

```bash
node --experimental-strip-types --test src/access/role-policy.test.ts src/access/access-matrix.test.ts
```

Screens, navigation and data adapters:

```bash
npx vitest run --config vitest.config.ts tests/integration/rota.test.tsx tests/unit/navigation-access.test.ts src/data/rota.test.ts
```

Role walk:

```bash
npx playwright test --config playwright.config.ts tests/browser/rota.spec.ts
```

## Coverage Targets

At least 80% line, branch and function coverage across application code, unchanged. SQL is covered by the fixed list below.

## Mocking and Test Data

Database tests act as real database roles and signed-in accounts on the local stack, with no mocks. Application tests use the existing in-memory adapters. All data is invented. Fixtures name a super admin, a group administrator, a teacher, and parents of at least four families, with a school year that has a changeover date and invented break weeks.

## Security and Performance Tests

- Every calendar and rota command called directly as a parent, a teacher and a group administrator (NFR3.2).
- A draft read as a parent gives the same result as no draft (NFR3.3).
- Each refused change function on a rota duty returns DUTY_ROTA_MANAGED (NFR3.5).
- The exact field list of the overview and the notice text for each family's own weeks only (NFR1.2, NFR1.3).
- A full-year publish in under 5 seconds and the listed pages under 2 seconds on the 30-family set (NFR9.1, NFR9.2); the 1500 ms ceiling in `tests/database/directory-timing.test.ts` on a seed holding a published plan (NFR9.3).
- Forced failure of publish by a test-only trigger on `notifications`, which must leave a draft with no duty, place or notice (NFR7.1).

## Fixed Test List

One row per database rule. A test title is the name shown, in the file named by its group. A case with no meaning for a rule says so with its reason.

Files: BR20 in `rota-calendar.test.ts`; BR21 to BR27 in `rota-plan.test.ts`.

| Rule | Allowed | Refused | Out of reach | Outdated screen | Repeated click | Two people at once |
|---|---|---|---|---|---|---|
| BR20.1 break week | BR20.1 allowed | BR20.1 refused non-Monday, outside year, duplicate | BR20.1 other community | nem értelmezhető: nincs verzió a kérésben | BR20.1 repeat | BR20.1 two adds |
| BR20.2 who changes the calendar | BR20.2 super admin | BR20.2 parent, teacher, group admin refused | BR20.2 other community | nem értelmezhető: a BR20.3 verziója fedi | nem értelmezhető: nem változtat | nem értelmezhető: nem változtat |
| BR20.3 changeover date | BR20.3 default and change | BR20.3 before start refused, refused while a plan exists | BR20.3 other community | BR20.3 stale version | BR20.3 repeat | BR20.3 two editors |
| BR20.4 calendar functions | BR20.4 break week reads as no duty | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas |
| BR20.5 late calendar change | BR20.5 duty stays, warning shown | nem értelmezhető: nincs tiltás | nem értelmezhető: a BR20.2 fedi | nem értelmezhető: nincs verzió a kérésben | BR20.5 repeat | nem értelmezhető: a BR20.1 versenye fedi |
| BR21.1 one plan per year | BR21.1 super admin makes a draft | BR21.1 second plan refused | BR21.1 other community | nem értelmezhető: nincs korábbi állapot | BR21.1 repeat | BR21.1 two drafts |
| BR21.2 one row per school week | BR21.2 row count | nem értelmezhető: a vázlat felépítése, nincs tiltás | nem értelmezhető: a BR21.1 fedi | nem értelmezhető: nincs verzió | nem értelmezhető: a BR21.1 fedi | nem értelmezhető: a BR21.1 fedi |
| BR21.3 families used | BR21.3 active families only | BR21.3 empty weeks keep a reason | nem értelmezhető: a BR21.1 fedi | nem értelmezhető: nincs verzió | nem értelmezhető: a BR21.1 fedi | nem értelmezhető: a BR21.1 fedi |
| BR21.4 even and repeatable | BR21.4 even spread, same result twice | nem értelmezhető: számítás, nincs tiltás | nem értelmezhető: számítás | nem értelmezhető: nincs verzió | BR21.4 draft twice after discard | nem értelmezhető: a BR21.1 fedi |
| BR21.5 discard | BR21.5 discard with count | BR21.5 published plan refused | BR21.5 other community | BR21.5 stale version | BR21.5 repeat | BR21.5 discard racing publish |
| BR22.1 set a week | BR22.1 family and empty | BR22.1 archived family refused | BR22.1 other community, other plan | BR22.1 stale version | BR22.1 repeat | BR22.1 two editors |
| BR22.2 break week | nem értelmezhető: tiltó szabály, a BR22.1 fedi | BR22.2 family on break week refused | nem értelmezhető: a BR22.1 fedi | nem értelmezhető: tiltás verzió előtt | nem értelmezhető: nem változtat | nem értelmezhető: nem változtat |
| BR22.3 evenness warning | BR22.3 warning, change kept | nem értelmezhető: nincs tiltás | nem értelmezhető: a BR22.1 fedi | nem értelmezhető: a BR22.1 fedi | nem értelmezhető: a BR22.1 fedi | nem értelmezhető: a BR22.1 fedi |
| BR22.4 concurrency | BR22.4 sequential result | BR22.4 VERSION_CONFLICT | nem értelmezhető: a BR22.1 fedi | BR22.4 stale version | BR22.4 repeat | BR22.4 two admins on one week |
| BR22.5 drafts hidden | BR22.5 super admin sees it | BR22.5 parent, teacher see nothing | BR22.5 other community | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas |
| BR23.1 publish preconditions | BR23.1 complete plan | BR23.1 empty weeks, break week, ineligible family refused | BR23.1 other community | BR23.1 stale version | BR23.1 repeat | BR23.1 publish racing a change |
| BR23.2 duties and places | BR23.2 one duty and one place per week | BR23.2 forced failure rolls back | nem értelmezhető: a BR23.1 fedi | nem értelmezhető: a BR23.1 fedi | BR23.2 no duplicate duty | BR23.2 two publishes |
| BR23.3 publish twice | BR23.3 first publish | BR23.3 second refused ROTA_PLAN_PUBLISHED | nem értelmezhető: a BR23.1 fedi | nem értelmezhető: a BR23.1 fedi | BR23.3 same key returns stored result | BR23.3 two publishes |
| BR23.4 notices | BR23.4 each parent's own weeks | BR23.4 no other family named | nem értelmezhető: a BR24.1 fedi az olvasást | nem értelmezhető: nincs verzió | BR23.4 one notice per parent on repeat | BR23.4 two publishes, one notice |
| BR23.5 audit | BR23.5 publish and discard events | BR23.5 failed audit rolls back | nem értelmezhető: nem hívó fél szerinti | nem értelmezhető: nincs verzió | BR23.5 one event on repeat | nem értelmezhető: a BR23.3 fedi |
| BR23.6 no reminders | BR23.6 none planned | nem értelmezhető: nincs tiltás | nem értelmezhető: belső számítás | nem értelmezhető: nincs verzió | BR23.6 tick twice | nem értelmezhető: a BR23.6 fedi |
| BR24.1 overview | BR24.1 any signed-in role, published only | BR24.1 signed-out denied | BR24.1 other community | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas |
| BR24.2 duty card | BR24.2 holding family, super admin | BR24.2 other family refused | BR24.2 other community, made-up id | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas |
| BR24.3 fixed text | BR24.3 card text | nem értelmezhető: tartalom, nincs tiltás | nem értelmezhető: a BR24.2 fedi | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas |
| BR24.4 not a sign-up task | BR24.4 left out of lists | BR24.4 sign-up refused | nem értelmezhető: a BR24.1 fedi | nem értelmezhető: nincs verzió | nem értelmezhető: nem változtat | nem értelmezhető: nem változtat |
| BR25.1 protected duty | nem értelmezhető: tiltó szabály | BR25.1 every change function refused DUTY_ROTA_MANAGED | BR25.1 other community | nem értelmezhető: tiltás verzió előtt | nem értelmezhető: nem változtat | nem értelmezhető: nem változtat |
| BR26.1 duty_create | BR26.1 duty and places | BR26.1 invalid input refused | BR26.1 other community | nem értelmezhető: nincs verzió a kérésben | BR26.1 repeat returns same | BR26.1 two creates, one duty |
| BR26.2 done mark | BR26.2 family, coordinator | BR26.2 second mark, other family refused | BR26.2 other community | nem értelmezhető: a második jelölés tiltása fedi | BR26.2 repeat | BR26.2 two marks |
| BR26.3 place functions | BR26.3 exchange, reassign, release | BR26.3 passed duty refused | BR26.3 internal only, no caller grant | nem értelmezhető: belső függvény | BR26.3 repeat | BR26.3 two changes |
| BR27.1 convention | BR27.1 catalogue lists grants | BR27.1 no table write right | nem értelmezhető: szerkezeti szabály | nem értelmezhető: szerkezeti szabály | nem értelmezhető: szerkezeti szabály | nem értelmezhető: szerkezeti szabály |
| BR27.2 table access | BR27.2 reads as allowed | BR27.2 direct writes refused | BR27.2 other community | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas |
