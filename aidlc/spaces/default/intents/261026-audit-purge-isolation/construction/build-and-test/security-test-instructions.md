# Security Test Instructions: Audit purge isolation

- Rights: `tests/database/audit-purge.test.ts` proves `audit_purge()` is executable by the system caller only (anon and signed-in accounts get 42501), is `security definer` with a pinned search path, and that no application role has a delete right on `audit_events`. `tests/database/identity-catalogue.test.ts` proves the elevated-function list and callers are unchanged.
- Append-only rule: updates stay refused (even with the purge setting on), deletes outside the purge stay refused, and recent rows stay refused while the setting is on.
- Privacy: the failure flag carries no error text; the housekeeping test asserts the result does not contain the injected error text.
- Repository scans: `npm run verify:security` runs the privacy, secret and SAST scans, the no-deploy check and `npm audit --audit-level=high`.
