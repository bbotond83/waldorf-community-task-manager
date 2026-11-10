# Unit Test Instructions: u1-community-foundation

Standard test strategy: five to eight tests per component, with integration tests at the key boundaries. Security tests are required by NFR3. Contains no names or contact details.

## Setup

The local stack must be running and migrated:

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
node --experimental-strip-types --test --test-concurrency=1 tests/database/community-structure.test.ts tests/database/community-roles.test.ts tests/database/community-duties.test.ts
```

Access policy:

```bash
node --experimental-strip-types --test src/access/role-policy.test.ts src/access/access-matrix.test.ts
```

Screens and navigation:

```bash
npx vitest run --config vitest.config.ts tests/integration/working-groups.test.tsx tests/unit/navigation-access.test.ts tests/unit/teacher-filters.test.ts
```

Role walk:

```bash
npx playwright test --config playwright.config.ts tests/browser/community-roles.spec.ts
```

## Coverage Targets

At least 80% line, branch and function coverage across application code, unchanged. SQL is covered by the fixed list below.

## Mocking and Test Data

Database tests act as real database roles and signed-in accounts on the local stack, with no mocks. Application tests use the existing in-memory adapters. All data is invented. The fixtures name a group administrator who is also a parent, one with two groups, a teacher, and a super admin without a family.

## Security and Performance Tests

- Direct calls and table reads as a group administrator of another group (NFR3.2).
- The same refusal for an item out of reach and a made-up id (NFR3.3).
- A revoked grant and an archived parent or family stop the next request, in the database and on the page and navigation (NFR3.4, NFR3.5).
- The 1500 ms ceiling in `tests/database/directory-timing.test.ts` on lists including community-wide tasks (NFR9.1, NFR9.2).

## Fixed Test List

One row per database rule. A test title is the name shown, in the file named by its group. A case with no meaning for a rule says so with its reason.

Files: BR1 and BR2 in `community-structure.test.ts`; BR3 and BR5 in `community-roles.test.ts`; BR4 in `community-duties.test.ts`; BR7 in `community-structure.test.ts`.

| Rule | Allowed | Refused | Out of reach | Outdated screen | Repeated click | Two people at once |
|---|---|---|---|---|---|---|
| BR1.2 group on an item | BR1.2 allowed | BR1.2 refused archived | BR1.2 other community | BR1.2 stale version | BR1.2 repeat | nem értelmezhető: a verzióellenőrzés dönt, BR3.3 két adminja fedi |
| BR1.3 task has event's scope | BR1.3 allowed | BR1.3 refused mismatch, direct write | BR1.3 other group's event | BR1.3 stale version | BR1.3 repeat | nem értelmezhető: egyetlen sor ellenőrzése, nincs versengés |
| BR1.4 clean start | BR1.4 removes all listed | BR1.4 forced failure rolls back | nem értelmezhető: nem hívó fél szerinti szabály | nem értelmezhető: nincs képernyő | BR1.4 runs once | nem értelmezhető: a migráció egyszer fut |
| BR2.1 six groups | BR2.1 six listed | nem értelmezhető: betöltés, nincs hívó | nem értelmezhető: betöltés, nincs hívó | nem értelmezhető: nincs képernyő | BR2.1 seed twice | nem értelmezhető: a betöltés egyszer fut |
| BR2.2 group validation | BR2.2 allowed | BR2.2 refused empty, duplicate | nem értelmezhető: BR2.5 fedi | BR2.2 stale version | BR2.2 repeat | BR2.2 two editors |
| BR2.3 list reads | BR2.3 each role | BR2.3 no role denied | BR2.3 other community | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas |
| BR2.5 group writes | BR2.5 super admin | BR2.5 group admin refused | BR2.5 other community | BR2.5 stale version | BR2.5 repeat | BR2.5 two editors |
| BR3.1 role pairs | BR3.1 each pair | BR3.1 refused other pair | nem értelmezhető: szerkezeti szabály | nem értelmezhető: nincs verzió | nem értelmezhető: szerkezeti szabály | nem értelmezhető: szerkezeti szabály |
| BR3.2 manage group | BR3.2 true | BR3.2 revoked, archived parent | BR3.2 other group | nem értelmezhető: minden kérésnél friss adat | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas |
| BR3.3 own group's items | BR3.3 allowed, two groups | BR3.3 parent refused | BR3.3 ungranted group | BR3.3 stale version | BR3.3 repeat | BR3.3 two admins |
| BR3.4 no other reach | nem értelmezhető: tiltó szabály, BR3.3 fedi | BR3.4 every command | BR3.4 direct calls and reads | nem értelmezhető: tiltás verzió előtt | nem értelmezhető: nem változtat | nem értelmezhető: nem változtat |
| BR3.5 community-wide | BR3.5 super admin | BR3.5 group admin refused | BR3.5 other community | BR3.5 stale version | BR3.5 repeat | BR3.5 two editors |
| BR3.6 granting group admin | BR3.6 allowed | BR3.6 no parent, invitation refused | BR3.6 other community | nem értelmezhető: nincs verzió a kérésben | BR3.6 repeat | BR3.6 two grants |
| BR3.7 teacher reads | BR3.7 whole community | BR3.7 writes refused | BR3.7 other community | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas |
| BR3.8 teacher grant | BR3.8 super admin | BR3.8 group admin refused | BR3.8 other community | nem értelmezhető: nincs verzió a kérésben | BR3.8 repeat | BR3.8 two grants |
| BR3.9 family records | BR3.9 super admin, own family | BR3.9 group admin, teacher refused | BR3.9 other community | BR3.9 stale version | BR3.9 repeat | BR3.9 two editors |
| BR3.10 name list | BR3.10 exact fields | BR3.10 parent refused | BR3.10 other community | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas |
| BR3.11 revocation | BR3.11 active until revoked | BR3.11 next request denied | nem értelmezhető: BR3.2 fedi | nem értelmezhető: minden kérésnél friss adat | BR3.11 repeat revoke | BR3.11 revoke while acting |
| BR3.12 audit | BR3.12 event written | BR3.12 failed audit rolls back | nem értelmezhető: a szabály nem hívó fél szerinti | nem értelmezhető: nincs verzió | BR3.12 one event on repeat | nem értelmezhető: BR3.6 fedi |
| BR3.13 no family | BR3.13 parent allowed | BR3.13 teacher, super admin denied | nem értelmezhető: a hívó saját családjáról szól | nem értelmezhető: tiltás verzió előtt | nem értelmezhető: nem változtat | nem értelmezhető: nem változtat |
| BR4.1 any open task | BR4.1 any group | BR4.1 full, closed refused | BR4.1 other community | BR4.1 stale version | BR4.1 repeat | BR4.1 last place race |
| BR4.2 assign any family | BR4.2 allowed | BR4.2 archived family refused | BR4.2 other group's task | BR4.2 stale version | BR4.2 repeat | BR4.2 last place race |
| BR4.3 swap across groups | BR4.3 allowed | BR4.3 pending refused | BR4.3 other community | BR4.3 stale version | BR4.3 repeat | BR4.3 two proposals |
| BR4.4 reminder recipients | BR4.4 group, community | nem értelmezhető: belső számítás, nincs tiltás | nem értelmezhető: belső számítás, nincs hívó | nem értelmezhető: nincs verzió | BR4.4 plan twice | nem értelmezhető: egy feladat tervezése zárolt |
| BR5.1 display names | BR5.1 name, removed label | nem értelmezhető: belső függvény | nem értelmezhető: belső függvény, nincs hívói jog | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas | nem értelmezhető: csak olvas |
| BR7.1 import gone | BR7.1 catalogue | nem értelmezhető: a funkció megszűnt | nem értelmezhető: a funkció megszűnt | nem értelmezhető: a funkció megszűnt | nem értelmezhető: a funkció megszűnt | nem értelmezhető: a funkció megszűnt |
