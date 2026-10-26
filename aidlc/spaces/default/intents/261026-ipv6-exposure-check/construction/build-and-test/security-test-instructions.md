# Security Test Instructions: IPv6 coverage of the stack exposure check

The change strengthens a security control (the check that the local stack's ports, which use public default keys, are not reachable from other machines).

## Checks

- **Behavioural tests** in `scripts/db/stack.test.ts`: a fake IPv6 address that answers makes `startStack` refuse, name the bracketed endpoint and stop the stack; with the owner's acknowledgement it warns and goes on; a probe that fails on one address never hides a reachable port on another.
- **Repository scans**: `npm run verify:security` (privacy, secrets, SAST, no-deploy, and `npm audit --audit-level=high`); any high or critical finding fails the run.
- **Acknowledgement rule**: the change reads `DB_ALLOW_ALL_INTERFACES` exactly as before and sets it nowhere. The existing CI workflow sets it for its throwaway runner; that predates this change.

## Outstanding (owner)

The real `db:start` run on a machine with an IPv6 address (see `integration-test-instructions.md`). A DAST or network scan of a running stack is not part of this change.
