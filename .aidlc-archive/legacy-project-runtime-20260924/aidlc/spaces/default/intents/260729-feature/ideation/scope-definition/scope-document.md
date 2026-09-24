# Scope Definition

## Scope Basis

This scope applies the approved [intent statement](../intent-capture/intent-statement.md), [feasibility assessment](../feasibility/feasibility-assessment.md), and [constraint register](../feasibility/constraint-register.md). It retains the lean three-month target, Vercel/Supabase baseline, GDPR-aligned planning requirement, and full approved MVP boundary.

## In Scope

- Role-aware access for super admins, kindergarten admins, group admins, parents, and read-only staff.
- Family, child, school-year, group, task, event, assignment, signup, swap, cancellation, dashboard, archive, and one-time Excel-import workflows, covering all 17 legacy workbook sheets and preserving their operational meaning.
- Family-owned assignments; parent self-service signup; auto-approvable parent swaps; approval-bound cancellations.
- 7-day and 24-hour email reminders, with Hungarian parent-facing experience, duplicate suppression, rescheduling, retry, stale-message cancellation, and `Europe/Budapest` time handling to be specified.
- Role-bounded participant display-name visibility; email, phone, residence/location, occupation, hobbies, and other restricted personal details remain permission-controlled.
- Repeat-safe import with stable identity strategy, visible outcomes for duplicate/changed rows, and preservation of imported maintenance/cleaning status values; mapping, atomicity, rollback, and recovery remain requirements/design decisions.
- Hungarian (`hu-HU`) formatting, Hungarian-aware search/sorting, UTF-8 normalization, RFC 3339 timestamps, E.164 phone canonicalization, and equivalent validation across UI, API, invitations, profiles, and import.
- Annual personal-data review and child-leaving deletion workflow, including sibling-family and audit-retention treatment.
- Vercel-hosted Next.js application with Supabase backend/authentication/database planning baseline.

## Out of Scope

- Native mobile apps, SMS/WhatsApp notifications, payments, automatic rotation, new ongoing task-completion tracking, and live Excel synchronization. Preservation of imported legacy completion/status values remains in scope.
- New external integrations beyond one-time Excel import and email delivery.
- Broad generic volunteer-management feature parity beyond the approved community workflow.

## Delivery Boundary

Sequence delivery as: (1) role and privacy foundation, (2) parent signup and reminder flow, (3) administrative operations and import. The release is successful only when families can securely manage responsibilities and administrators can operate core assignments and reminders. No additional capability group is approved for deferral. [Q1] [Q2] [Q3]

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [feasibility] `../feasibility/feasibility-assessment.md`
- [constraints] `../feasibility/constraint-register.md`
- [Q1]–[Q3] `scope-definition-questions.md`
