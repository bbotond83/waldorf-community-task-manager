# Teacher Tracking Entities

## Entity Model

The following YAML is the source of truth. References to external entities describe dependencies and do not transfer write ownership.

```yaml
entities:
  - name: TeacherContext
    description: Request-local current authenticated teacher authority supplied by the access unit.
    owner: Access
    attributes:
      - {name: actorId, type: identifier, required: true, unique: false}
      - {name: authorizationVersion, type: integer, required: true, unique: false, min: 0}
      - {name: assignedGroups, type: group-reference-list, required: true, unique: false, constraints: distinct current active grants with organization identity}
    constraints: [Never durable in the tracking unit, Revalidate on every request]
    relationships:
      - {target: GroupScope, cardinality: one-to-many, direction: outgoing, description: current authorized groups only}
  - name: GroupScope
    description: Existing business group identity and its organization.
    owner: Directory
    attributes:
      - {name: groupId, type: identifier, required: true, unique: true}
      - {name: organizationId, type: identifier, required: true, unique: false}
      - {name: displayName, type: text, required: true, unique: false}
    constraints: [Preserve existing identity, Never fabricate group membership]
    relationships:
      - {target: TrackingSourceRecord, cardinality: one-to-many, direction: outgoing, description: source schedule ownership}
  - name: TrackingQuery
    description: Validated single-group inclusive date filter.
    owner: TeacherTracking
    attributes:
      - {name: groupScope, type: GroupScope-reference, required: true, unique: false, references: GroupScope}
      - {name: from, type: calendar-date, required: true, unique: false, constraints: real YYYY-MM-DD date}
      - {name: to, type: calendar-date, required: true, unique: false, constraints: real YYYY-MM-DD date}
    constraints: [from is not after to, Elapsed date difference at most 31 days]
    relationships:
      - {target: GroupScope, cardinality: many-to-one, direction: outgoing, description: queried current authorized group}
  - name: TrackingSourceRecord
    description: Current source record owned by the existing schedule and task coordination domain.
    owner: Coordination
    attributes:
      - {name: id, type: identifier, required: true, unique: true}
      - {name: sourceRecordId, type: identifier, required: true, unique: false}
      - {name: groupId, type: identifier, required: true, unique: false, references: GroupScope.groupId}
      - {name: organizationId, type: identifier, required: true, unique: false, references: GroupScope.organizationId}
      - {name: startsAt, type: instant, required: true, unique: false}
      - {name: endsAt, type: instant, required: true, unique: false}
      - {name: title, type: text, required: true, unique: false}
      - {name: location, type: text, required: true, unique: false}
      - {name: coordinationDisplayName, type: optional-text, required: false, unique: false}
      - {name: ownerDisplayName, type: nullable-text, required: true, unique: false}
      - {name: assigneeDisplayNames, type: text-list, required: true, unique: false, default: empty-list}
      - {name: currentStatusLabel, type: nullable-text, required: true, unique: false}
    constraints: [No inferred owner from coordinator, No invented status vocabulary, endsAt is not before startsAt, Existing source identities dates and groups preserved]
    relationships:
      - {target: GroupScope, cardinality: many-to-one, direction: outgoing, description: owning business group}
      - {target: TrackingEntry, cardinality: one-to-zero-or-one, direction: outgoing, description: authorized allowlist projection}
  - name: TrackingEntry
    description: Request-local browser-safe read model with no mutation lifecycle.
    owner: TeacherTracking
    attributes:
      - {name: id, type: identifier, required: true, unique: true}
      - {name: groupId, type: identifier, required: true, unique: false, references: GroupScope.groupId}
      - {name: startsAt, type: instant, required: true, unique: false}
      - {name: endsAt, type: instant, required: true, unique: false}
      - {name: title, type: text, required: true, unique: false}
      - {name: location, type: text, required: true, unique: false}
      - {name: coordinationDisplayName, type: optional-text, required: false, unique: false}
      - {name: ownerDisplayName, type: nullable-text, required: true, unique: false}
      - {name: assigneeDisplayNames, type: text-list, required: true, unique: false}
      - {name: currentStatusLabel, type: nullable-text, required: true, unique: false}
    constraints: [Explicit allowlist only, No sourceRecordId or organization metadata in browser model, No financial allergen private contact or unrelated fields]
    relationships:
      - {target: GroupScope, cardinality: many-to-one, direction: outgoing, description: authorized scope}
```

## Ownership and Relationships

Access owns session and grants; Directory owns group/person identity; Coordination owns writable schedule, tasks and assignments. TeacherTracking owns only validated queries and transient projections. There is no new store or event history. Source-to-projection cardinality allows excluded records; malformed or mismatched scope fails the request without partial output.

