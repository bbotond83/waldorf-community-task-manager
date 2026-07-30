# Scope Definition

## Scope Basis

This scope applies the approved [intent statement](../intent-capture/intent-statement.md), [feasibility assessment](../feasibility/feasibility-assessment.md), and [constraint register](../feasibility/constraint-register.md). It retains the lean three-month target, Vercel/Supabase baseline, GDPR-aligned planning requirement, and full approved MVP boundary.

## In Scope

- Role-aware access for super admins, kindergarten admins, group admins, parents, and read-only staff.
- Family, child, school-year, group, task, event, assignment, signup, swap, cancellation, dashboard, archive, and one-time Excel-import workflows.
- Family-owned assignments; parent self-service signup; auto-approvable parent swaps; approval-bound cancellations.
- 7-day and 24-hour email reminders, with Hungarian parent-facing experience.
- Admin-only email and phone visibility; role-bounded assignment display-name visibility.
- Vercel-hosted Next.js application with Supabase backend/authentication/database planning baseline.

## Out of Scope

- Native mobile apps, SMS/WhatsApp notifications, payments, automatic rotation, task completion tracking, and live Excel synchronization.
- New external integrations beyond one-time Excel import and email delivery.
- Broad generic volunteer-management feature parity beyond the approved community workflow.

## Delivery Boundary

Sequence delivery as: (1) role and privacy foundation, (2) parent signup and reminder flow, (3) administrative operations and import. The release is successful only when families can securely manage responsibilities and administrators can operate core assignments and reminders. No additional capability group is approved for deferral. [Q1] [Q2] [Q3]

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [feasibility] `../feasibility/feasibility-assessment.md`
- [constraints] `../feasibility/constraint-register.md`
- [Q1]–[Q3] `scope-definition-questions.md`
