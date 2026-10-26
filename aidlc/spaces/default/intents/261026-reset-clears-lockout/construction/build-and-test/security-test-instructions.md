# Security Test Instructions: Password reset clears the lockout

- Authorization order: `src/identity/reset.test.ts` ("never clears the lockout without a valid code and a changed password") proves that on a rejected password rule, a malformed or used code, a refused password and an unavailable service no admin call at all is made, so the lockout cannot be cleared without the one-time link and a changed password.
- Failure behaviour: tests prove the clear happens before and despite a failing session removal, and that a failing clear changes no outcome.
- Repository scans: `npm run verify:security` runs the privacy, secret and SAST scans, the no-deploy check and `npm audit --audit-level=high`.
