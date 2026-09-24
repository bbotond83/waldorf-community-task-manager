# Business Rules

## Workflow Rules

- Assignments belong to Family; linked parents act within permissions.
- Qualified confirmed swaps are atomic; non-qualified swaps require authorized approval.
- Parents edit only their own contribution notes; authorized participants see allergens.

## Validation

Capacity, scope, assignment state, and entity version must pass before mutation; conflicting requests leave all assignments unchanged.
