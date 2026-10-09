# Current-role Foundation Entities

## Authoritative Entity Model

```yaml
entities:
  - name: User
    owner: Access
    description: Existing subject activity and authorization generation.
    attributes:
      - {name: id, type: identifier, required: true, unique: true}
      - {name: isActive, type: boolean, required: true}
      - {name: authorizationVersion, type: integer, required: true, min: 1}
    constraints:
      - Conversion never changes activity.
      - Version must be representable and increases without wraparound.
    relationships:
      - {target: RoleGrant, cardinality: one-to-many, direction: outbound}
      - {target: Session, cardinality: one-to-many, direction: outbound}
  - name: RoleGrant
    owner: Access
    description: Existing permission grant; conversion changes only role.
    attributes:
      - {name: id, type: identifier, required: true, unique: true}
      - {name: subjectId, type: identifier, required: true, references: User.id}
      - name: role
        type: enumeration
        required: true
        allowed_values: [parent, group_admin, kindergarten_teacher, super_admin]
      - {name: scopeType, type: enumeration, required: true, allowed_values: [organization, group, family]}
      - {name: scopeId, type: identifier, required: true}
      - {name: organizationId, type: identifier, required: true}
      - {name: grantedAt, type: timestamp, required: false}
      - {name: revokedAt, type: timestamp, required: false}
    constraints:
      - Parent requires family scope; Group admin and Kindergarten teacher require group scope; Super administrator requires organization scope.
      - Historical equivalent grants retain independent identity and revocation state.
      - Organization scope identifier denotes the granted organization.
    relationships:
      - {target: User, cardinality: many-to-one, direction: outbound}
  - name: Session
    owner: Access
    description: Existing signed reference resolved against current subject and grants.
    attributes:
      - {name: subjectId, type: identifier, required: true, references: User.id}
      - {name: authorizationVersion, type: integer, required: true, min: 1}
    constraints:
      - Activity and current generation must match before protected access.
      - Removed profile identifiers never become aliases for current profiles.
    relationships:
      - {target: User, cardinality: many-to-one, direction: outbound}
value_objects:
  - name: Scope
    attributes: [scopeType, scopeId, organizationId]
    constraints: [Same organization and supported role-specific scope are mandatory.]
  - name: ConversionEvidence
    attributes: [operationId, grantId, subjectId, originalRole, currentRole, outcome]
    constraints: [No credentials or personal display/contact fields; append only; transaction-bound.]
```

## Model Summary and Persistence Boundary

User, Session and RoleGrant retain Access ownership from components. Scope and ConversionEvidence are supporting values, not newly owned business entities. Directory and Coordination retain their records. The existing persisted grant shape has no grant timestamp or subject activity column; do not manufacture these fields during migration. The domain shape retains grantedAt where present and activity in its existing subject repository. Persisted version state corresponds to User authorizationVersion through the existing boundary; it is not a second independently authoritative generation.

Effective grants deduplicate active, valid rows by subject, role, scope type, scope identifier and organization. Deduplication never deletes a historical row or turns a revoked row active. The normal grant input accepts only current roles; a separate explicit migration input admits the two documented legacy values.

## Sources

This model derives from [components.md](../../../inception/domain-design/components.md), [unit-of-work.md](../../../inception/units-generation/unit-of-work.md), [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md), [requirements.md](../../../inception/requirements-analysis/requirements.md) and C1/C2 in [contract-summary.md](../../../inception/contract-design/contract-summary.md). Existing shapes were checked at src/access/types.ts and the initial persistence migration. No implementation or migration execution is claimed.
