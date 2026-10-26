# Security Test Instructions: Worker local-only guard

- Local-only guard: `scripts/db/tooling.test.ts` proves a non-default password is refused before any connection; a database that does not identify itself is refused with its connection closed and only the identity read asked (no drop, create, truncate or delete); the refusal names the worker and the schema and never echoes the password. `tests/database/worker.test.ts` proves the same for a wrong password against the real stack, at step `guard`.
- Relaxed requirement: `scripts/db/local-guard.test.ts` proves that only the tracking-table reason is relaxed for the worker; the database name, the `supabase_admin` role and the JWT secret still refuse; seed and reset keep requiring the tracking table.
- Repository scans: `npm run verify:security` (privacy, secret and SAST scans, no-deploy check, `npm audit --audit-level=high`).
