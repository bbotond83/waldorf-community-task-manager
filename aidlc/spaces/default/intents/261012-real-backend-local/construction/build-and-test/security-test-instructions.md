# Security Test Instructions: Real local backend

Scope: NFR1 of the requirements (database rules, secrets, personal data), the team rule that dependency scanning blocks high and critical findings, and secret scanning plus SAST with high and critical SAST findings blocking delivery.

## Static and repository checks

```
npm run verify:security
```

This runs `scan:privacy` (emails, phone numbers, data-file extensions, JWT-shaped strings and service-role key names in git-tracked or staged files, with an allowlist of fictitious values), `scan:secrets`, `scan:sast`, `verify:no-deploy` (no executable deployment workflow) and `npm audit --audit-level=high`. Any high or critical finding fails the run. Moderate advisories are listed in the results, not blocking.

## Database-level security tests (real stack)

- Wrong-role refusal on the audit function and table; no update, and no delete outside `audit_purge()`; the purge deletes only events older than 365 days and only for the system caller (`tests/database/audit.test.ts`, `audit-purge.test.ts`).
- Row access rules per role and scope; other parents' contact details unreadable (`identity-grants.test.ts`, `identity-probe.test.ts`, `identity-catalogue.test.ts` for the list of elevated functions and who may run them).
- Sign-in lockout and rate limiting; invitation and reset tokens single-use (`identity-lockout.test.ts`, `identity-invitation.test.ts`, `identity-session.test.ts`).
- Import privacy (`import-privacy.test.ts`) and notification hand-off locks (`notifications-locks.test.ts`).
- Seed and reset guard: refuses non-loopback addresses, a hosted database behind a loopback tunnel (default-password check), a missing identity, a bad schema name; the output scan finds no password, key or personal value (`scripts/db/local-guard.test.ts`, `tests/database/seed.test.ts`, `reset.test.ts`).

## Client bundle

`npm run test:bundle` (after `npm run build`): the seed module and the service-role key are absent from client output.

## Accessibility

The browser suite runs the axe scan on the critical flows in three browsers (`npm run test:browser`); no serious or critical violation is allowed.

## Manual and out-of-scope items

- Penetration testing and DAST against a deployed target are not done: no deployed target exists. Recorded as outstanding evidence.
- Network exposure of the local stack (the Supabase CLI publishes on all interfaces) is checked by `db:start` for IPv4 only; IPv6 is a known gap (follow-up plan, group A).
- The real workbook remains in git history until the owner rewrites history (follow-up plan, group F).
