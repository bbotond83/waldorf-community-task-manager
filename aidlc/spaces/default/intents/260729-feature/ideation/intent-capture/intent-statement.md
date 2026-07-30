# Intent Statement

## Problem Statement

The MVP replaces an Excel-based kindergarten parent-community coordination workflow with a structured, role-based web application. The current workflow is fragmented, manual, error-prone, lacks reliable reminders and granular permissions, and does not adequately protect parent contact details. [Q1] [Q4] [Q8]

## Target Customer

Parents need a mobile-friendly Hungarian experience for viewing and acting on family responsibilities. Administrators need an efficient operating tool for assignments, workflows, imports, and notification visibility; read-only staff need schedule visibility without editing or access to parent contact data. [Q2] [Q5]

## Success Metrics

The initiative targets at least 80% of active families logging in during the first active month, 70% viewing `Saját feladataim`, 90% of new task signups occurring in the application, a 40% reduction in administrative coordination time, and no known role-based access-control violations in production. [Q3]

## Initiative Trigger

The current spreadsheet workflow creates an operational and privacy need for a structured system that centralizes coordination, reminders, and role-based access. [Q4]

## Initial Scope Signal

The workflow-selected scope is `feature`. [scope]

The confirmed product boundary is a bounded feature: an MVP web application with a mobile-friendly parent experience for role-based parent-community coordination, including families, children, school years, groups, tasks, events, self-signup, admin assignment, swaps, cancellations, notifications, dashboards, and one-time Excel migration. [Q1] [Q2] [Q8]

The MVP keeps email addresses and phone numbers admin-only; parents may see assignment display names, while read-only staff may not. [Q15]

The MVP sends assignment reminders at both 7 days and 24 hours. Parent-to-parent swaps may auto-approve, while cancellations require approval. [Q10] [Q11]

Assignments belong to families so that any linked parent may act. Excel import uses preview-time admin column mapping to an import template. [Q12] [Q13]

The MVP excludes native mobile apps, SMS/WhatsApp notifications, payments, automatic rotation, task completion tracking, and live Excel synchronization. [Q16]

## Assumptions & Open Questions

- The final decision-maker for scope, priority, swap, cancellation, and privacy decisions is not yet identified. [Q6] [assumption]
- A stakeholder reporting cadence is not yet defined. [Q7] [assumption]
