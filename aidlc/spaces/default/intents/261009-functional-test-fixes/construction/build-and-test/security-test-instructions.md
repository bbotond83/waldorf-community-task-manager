# Security Test Instructions

## Scope

No authentication, authorization matrix or data model changed. The security-relevant surface of this change is: the `?ertesites=<id>` notification context (must be validated against the signed-in parent's own notifications and the task id from the address), the `?vissza=` back-link parameter on admin pages (allowlisted to `q` and `state`, used only with fixed admin paths), the `SYNTHETIC_TEST_COPIES` switch (test servers only), and the reset route now clearing the parent facade cache.

## Commands

- `npm run verify:security` runs, in order: privacy scan, secrets scan, SAST, no-deploy scan, and `npm audit --audit-level=high` (blocks on high and critical findings).
- Context validation: `src/parent-web/notification-context.test.ts` and `tests/coverage/parent-functional-fixes.test.tsx` (part of `npm test` and `npm run test:coverage`) assert that a foreign, unknown, other-task or list-targeted notification id is ignored and the page behaves as opened from the task list.
- Back link: `tests/coverage/admin-functional-fixes.test.tsx` asserts that only `q` and `state` survive in the back link.
- Content security policy: `proxy.ts` is unchanged (`git diff --stat proxy.ts` must be empty).

## Expected result

All scans pass, `npm audit` reports 0 high or critical vulnerabilities, and the access tests in the unit and browser suites stay green.
