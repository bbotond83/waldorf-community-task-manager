# Security Test Instructions

## Scope

No authentication, authorization matrix or data model changed. The security-relevant surface of this change is the teacher schedule's unfiltered view: it reads only the groups the teacher is granted (one authorized read per grant), and an unknown or not-permitted `groupId` in the address is still denied. The detail links of the all-groups list carry the entry's own `groupId`.

## Commands

- `npm run verify:security` runs, in order: privacy scan, secrets scan, SAST, no-deploy scan, and `npm audit --audit-level=high` (blocks on high and critical findings).
- Teacher grants: `tests/unit/teacher-schedule.test.ts`, `src/application/teacher-facade.test.ts`, `src/teacher-web/synthetic-teacher-repository.test.ts` and `tests/unit/teacher-filters.test.ts` (part of `npm test`) assert that a group outside the grant is never read and that an unknown or not-permitted `groupId` is denied.
- Content security policy: `proxy.ts` is unchanged (`git diff --stat proxy.ts` must be empty).

## Expected result

All scans pass, `npm audit` reports 0 high or critical vulnerabilities, and the access tests in the unit and browser suites stay green.
