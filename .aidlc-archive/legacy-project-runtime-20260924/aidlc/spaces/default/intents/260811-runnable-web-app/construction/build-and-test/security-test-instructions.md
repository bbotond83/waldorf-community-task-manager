# Security Test Instructions

## Upstream Coverage

Use the unit Code Generation plans/summaries and NFR security requirements for runtime-mode isolation, server-side route/action/object/field authorization, next-request revocation, idempotency, safe input, non-enumerating denials, output/log/evidence redaction, secret handling, and the no-deployment boundary.

## Commands and Acceptance

- Run `npm run verify:security`: privacy scan, secret scan, SAST scan, no-deploy scan, and `npm audit --audit-level=high`.
- Run `npm test` and `npm run test:browser` to exercise authorization, crafted routes/actions, privacy-negative assertions, XSS-safe rendering, and security-relevant recovery states.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` to ensure guards and server-only boundaries compile and pass static analysis.
- High or critical dependency/SAST findings, a privacy leak, unauthorized state change, or any deployment/real-target invocation is a blocker. Record the exact command and finding; never treat synthetic checks as real Supabase/provider verification.

## Safety Boundary

Use only invented fixtures and loopback services. Do not run DAST or load tests against external targets, include credentials in test data, or enable a deployment workflow. Keep Safari and all linked-target assertions OUTSTANDING when their environment is unavailable.
