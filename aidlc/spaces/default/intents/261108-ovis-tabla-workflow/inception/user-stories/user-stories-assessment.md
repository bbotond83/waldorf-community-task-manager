# User Stories Assessment

## Decision

Execute.

## Rationale

The work (`requirements.md`) is almost entirely user-facing, serves four kinds of user with different rights, and contains complex business rules, such as linked weekend duties and privacy choices about children's data. Stories give each behaviour a checkable outcome before design begins.

## Factors Considered

- **Project type:** enhancement of a live codebase, described in `business-overview.md` and `component-inventory.md`.
- **User-facing scope:** directory, rotas, sign-ups, events, to-do list, library and information page are all new or changed screens.
- **Complexity signals:** access rules differ by role, and many rules interact with the school calendar and with each other.
- **Delivery practice:** `team-practices.md` requires a thin first slice and owner checks, which need clearly separated stories.

## Where Stories Add the Most Value

- Privacy and access outcomes for the directory.
- Linked weekend duties and the changeover-date rule.
- Reminders and alerts, which replace chasing families by hand.
