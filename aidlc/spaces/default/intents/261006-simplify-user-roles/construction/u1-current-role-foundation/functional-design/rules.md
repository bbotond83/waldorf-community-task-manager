# Current-role Foundation Rules

## Authoritative Business Rules

```yaml
rules:
  - id: BR1.1
    statement: Only four current roles may be selected, assigned or authorized.
    category: validation
    applies_to: Current role and profile input
    trigger: Normal selection, assignment or protected request
    logic: IF a value is unknown or removed THEN reject it before creating a grant or session; never use a fallback role.
    violation: Denied with no protected data or mutation.
    source: [FR1, FR13]
  - id: BR1.2
    statement: Current catalogs preserve the history boundary and established localization.
    category: policy
    applies_to: Catalog and profile resolution
    trigger: Current role presentation
    logic: IF presenting current roles THEN use four categories and Kindergarten teacher technical names with Óvónő UI copy; retain legacy text only as explicit historical or migration evidence.
    violation: Catalog or naming check fails.
    source: [FR2, FR14, NFR3]
  - id: BR2.1
    statement: Access requires current active subjects and matching authorization generations.
    category: authorization
    applies_to: Protected requests and navigation
    trigger: Each request
    logic: IF activity, signature, expiry, current profile, current generation or valid current grants are missing or stale THEN invalidate before protected rendering.
    violation: Safe existing recovery without protected content.
    source: [FR12, FR13, NFR1]
  - id: BR2.2
    statement: Permissions require the appropriate role, organization, scope, operation and fields.
    category: authorization
    applies_to: Domain, application, runtime and intended persistence policies
    trigger: Each permission decision
    logic: IF any required role, organization, scope, action or field check fails THEN deny; group identifiers alone and unrelated grants cannot combine into authority.
    violation: Redacted denial with no mutation or data leakage.
    source: [FR3, FR4, FR5, FR6, FR8, FR9, FR13, NFR1]
  - id: BR2.3
    statement: Kindergarten teachers can only read assigned-group tracking fields.
    category: authorization
    applies_to: Teacher permission checks
    trigger: Teacher read or command request
    logic: IF the request is not an authorized group schedule or permitted coordination display read THEN deny, including every mutation and raw private-family access.
    violation: No business state change and no forbidden fields.
    source: [FR6, FR8, FR9, FR13]
  - id: BR2.4
    statement: Retained-role permissions follow the approved matrix.
    category: authorization
    applies_to: Parent, Group admin and Super administrator
    trigger: Existing workflow request
    logic: IF Parent THEN retain own-family permissions; IF Group admin THEN retain granted-group core permissions; IF organization advanced or governance operation THEN require Super administrator in that organization.
    violation: Denied before downstream command dispatch.
    source: [FR3, FR4, FR5, FR13]
  - id: BR3.1
    statement: Explicit conversion preserves grant scope, identity and state.
    category: constraint
    applies_to: Legacy grant conversion
    trigger: Explicit migration
    logic: IF supported group staff THEN change role to kindergarten_teacher; IF supported organization kindergarten admin THEN change role to super_admin; preserve all other grant fields and subject activity.
    violation: Unsupported role or scope blocks the entire conversion.
    source: [FR10, FR11, FR15, NFR1]
  - id: BR3.2
    statement: Equivalent rows remain historical records without duplicated effective permissions.
    category: calculation
    applies_to: Conversion and effective grant resolution
    trigger: Conversion or current-grant projection
    logic: IF equivalent current rows exist THEN retain row identities and deduplicate only effective valid active access; repeated conversion with no legacy rows changes nothing.
    violation: Duplicate or reactivated effective permission fails verification.
    source: [FR10, FR11, FR15]
  - id: BR3.3
    statement: Conversion and current-role enforcement commit atomically.
    category: constraint
    applies_to: Grants, versions, redacted evidence and constraints
    trigger: Explicit migration
    logic: IF all schema, scope and version preconditions pass THEN convert populated grants, invalidate each changed subject once, append evidence and enforce current roles under one writer-exclusive transaction; ELSE roll everything back.
    violation: Blocked or failed result, original state intact.
    source: [FR12, FR13, FR15, NFR1]
  - id: BR3.4
    statement: Removing the final qualifying Super administrator is prohibited.
    category: constraint
    applies_to: Normal grant revocation and downgrade
    trigger: Grant mutation
    logic: IF the operation removes the final active nonrevoked organization Super administrator THEN deny under the same transaction lock as the mutation.
    violation: Existing protected outcome with no grant or version changes.
    source: [FR12, NFR1]
  - id: BR4.1
    statement: Failures and evidence minimize sensitive information.
    category: policy
    applies_to: Authorization and conversion results
    trigger: Denial, invalidation, migration or dependency failure
    logic: IF producing a failure or audit record THEN include safe state and redacted identifiers/reason only, never protected business payloads, session tokens or contact fields.
    violation: Privacy verification fails.
    source: [FR9, FR12, NFR1]
```

## Derived Rule Summary

| Rules | Outcome |
| --- | --- |
| BR1.1–2 | Four current roles and accurate history/localization |
| BR2.1–4 | Current scoped permissions, read-only teacher and retained role boundaries |
| BR3.1–3 | Repeat-safe atomic conversion without record loss |
| BR3.4 | Final qualifying administrator remains |
| BR4.1 | Safe explicit failures and redacted evidence |

## Sources

[requirements.md](../../../inception/requirements-analysis/requirements.md), [components.md](../../../inception/domain-design/components.md), [unit-of-work.md](../../../inception/units-generation/unit-of-work.md), [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md). This document defines behavior, not executed checks.
