# Integration Test Instructions

## Local Contract Integration

Run `npm run typecheck && npm run test:coverage` to verify cross-module TypeScript contracts and behavioral seams. Required boundaries include access-to-directory policy, directory-to-coordination eligibility, coordination-to-notification events, import-to-admin destination presentation, and parent/admin façade delegation.

## Provisioned Integration

Against a disposable EU Supabase project, apply the migration and verify authorization-version RPCs, active/admin scope RPCs, scoped reads, denied parent/staff mutations, admin-only import access, and admin-only audit reads. Scheduler/email-provider integration must prove enqueue, due dispatch, retry, stale cancellation, and idempotency using synthetic recipients.

Sources: `../notification-jobs/code-generation/code-generation-plan.md`; `../import-migration/code-generation/code-summary.md`; `../admin-experience/code-generation/code-summary.md`.
