# Personas

## Inherited Product Personas

The following approved personas remain normative from `260729-feature`. [prior-personas] [requirements]

### Parent — Primary Product User

Views linked-family duties, signs up, manages swaps/cancellations, and receives Hungarian reminders without exposure to other families' restricted data. Locally, needs representative success, full/ineligible, pending, failure, and invalidated states. [prior-personas] [requirements]

### Kindergarten Administrator — Primary Operator

Operates organization-scoped records, assignments, approvals, privacy lifecycle, imports, reminders, and reporting. Needs deterministic recovery and privacy-safe evidence. [prior-personas] [requirements]

### Group Administrator — Scoped Operator

Coordinates only granted groups, families, tasks, events, assignments, and permitted approvals. Needs clear denial outside granted scope. [prior-personas] [requirements]

### Read-only Staff — Secondary Product User

Views relevant schedules and required coordination display names without contact, sensitive-profile, unrelated-family, or mutation access. [prior-personas] [requirements]

### Super Administrator — Governance Operator

Administers cross-organization configuration, roles, imports, and audit access including super-admin governance where permitted. [prior-personas] [requirements]

## Delivery Persona

### Developer / Product Owner — Primary Intent Beneficiary

**Goals:** install and start the application locally; choose synthetic identities; exercise inherited flows; run all quality commands; understand real-target evidence still outstanding.  
**Pain points:** repository currently lacks a web entry point, scripts, environment contract, routes, UI, and reproducible browser acceptance.  
**Context:** high technical comfort; uses the application during implementation and pre-deployment acceptance. [requirements] [business] [components]

## Relationships and Priority

The Developer/Product Owner enables acceptance but does not replace product personas. Parent and Kindergarten Administrator remain primary value journeys; Group Administrator and Read-only Staff prove authorization scope; Super Administrator proves governance boundaries. [requirements] [prior-personas]

## Sources

- [requirements] `../requirements-analysis/requirements.md`
- [prior-personas] `../../../260729-feature/inception/user-stories/personas.md`
- [business] `../../../codekb/waldorf-community-task-manager/business-overview.md`
- [components] `../../../codekb/waldorf-community-task-manager/component-inventory.md`
