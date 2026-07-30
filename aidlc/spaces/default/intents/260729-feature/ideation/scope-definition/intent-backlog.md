# Intent Backlog

## Prioritization Basis

This backlog derives from the approved [intent statement](../intent-capture/intent-statement.md), [feasibility assessment](../feasibility/feasibility-assessment.md), and [constraint register](../feasibility/constraint-register.md). All listed MVP capabilities remain committed; ordering follows the confirmed privacy-first sequence. [Q1] [Q2] [Q3]

## Must-Have Proto-Units

| ID | Proto-unit | Value | Dependencies | Sequence |
| --- | --- | --- | --- | --- |
| PB-01 | Authentication, roles, family membership, and privacy controls | Protects family/contact data and enables every role-specific workflow. | Supabase baseline | 1 |
| PB-02 | Core family, child, school-year, group, task, event, and assignment records | Establishes the shared coordination model. | PB-01 | 1 |
| PB-03 | Parent dashboard, self-signup, family-owned assignment, swaps, and cancellation requests | Delivers the primary parent value. | PB-01, PB-02 | 2 |
| PB-04 | Email reminders and notification visibility | Reduces missed commitments and manual follow-up. | PB-02, PB-03 | 2 |
| PB-05 | Admin assignment, approval, dashboard, and archive workflows | Enables coordinators to operate the community workflow. | PB-01–PB-04 | 3 |
| PB-06 | One-time Excel import with mapping preview and validation | Enables controlled migration from the current baseline. | PB-02, PB-05 | 3 |

## Explicit Deferrals

Native apps, SMS/WhatsApp, payments, automatic rotation, completion tracking, live Excel synchronization, and unapproved integrations remain out of scope. Dashboard refinements are not approved for deferral in this MVP; delivery planning must protect the full committed set within the agreed boundary.

## Value Stream

`Privacy and roles → shared coordination records → parent self-service and reminders → admin operation → validated Excel migration`

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [feasibility] `../feasibility/feasibility-assessment.md`
- [constraints] `../feasibility/constraint-register.md`
- [Q1]–[Q3] `scope-definition-questions.md`
