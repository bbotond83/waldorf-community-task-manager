# Security Test Instructions

## Scope

No authentication, authorization, data or API behaviour changed. The security-relevant surface of this change is the menu consolidation and the new landing redirects: no profile may gain access to a page it did not have, and the server-side guards must stay in place.

## Commands

- `npm run verify:security` runs, in order: privacy scan, secrets scan, SAST, no-deploy scan, and `npm audit --audit-level=high` (blocks on high and critical findings).
- Access check for this change: `tests/unit/navigation-access.test.ts` (part of `npm test`) asserts that every menu link and default page of each profile resolves to a page that profile may open under the existing authorization matrix, and that the group admin menu excludes import, reminders, privacy and settings.
- Content security policy: `proxy.ts` is unchanged (`git diff --stat proxy.ts` must be empty).
- The authorization matrix (`src/application/authorization.ts`) changed in one value only: the parent's home path.

## Expected result

All scans pass, `npm audit` reports 0 high or critical vulnerabilities, and the existing access tests in the unit and browser suites stay green.
