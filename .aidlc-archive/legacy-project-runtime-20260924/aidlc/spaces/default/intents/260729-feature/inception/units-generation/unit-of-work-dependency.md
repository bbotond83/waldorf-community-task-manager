# Unit Dependency DAG

## Topology

The DAG records only dependency relationships; Delivery Planning selects the economic sequence. `family-directory` depends on `access-foundation`; UI units depend on the domain contracts they expose. Import and privacy share audit evidence but have no direct dependency on each other.

```yaml
units:
  - name: access-foundation
    kind: library
    depends_on: []
  - name: family-directory
    kind: service
    depends_on: [access-foundation]
  - name: coordination-core
    kind: service
    depends_on: [access-foundation, family-directory]
  - name: notification-jobs
    kind: service
    depends_on: [coordination-core]
  - name: import-migration
    kind: service
    depends_on: [access-foundation, family-directory, coordination-core, notification-jobs]
  - name: privacy-audit
    kind: service
    depends_on: [access-foundation, family-directory, coordination-core, notification-jobs]
  - name: parent-experience
    kind: ui
    depends_on: [access-foundation, family-directory, coordination-core, notification-jobs]
  - name: admin-experience
    kind: ui
    depends_on: [access-foundation, family-directory, coordination-core, import-migration, privacy-audit]
  - name: staff-schedule
    kind: ui
    depends_on: [access-foundation, family-directory, coordination-core]
```

## Integration Points

Access produces authorization/revocation decisions for every unit; Directory produces relevance-filtered family references; Coordination produces assignment-change events consumed by Jobs for reminder replacement; Import produces recovery jobs; all mutations produce redacted audit events consumed by Privacy/Audit. Import and Privacy remain parallel only after Access, Directory, Coordination, and Jobs.
