# Unit Dependency DAG

## Design Sources and Scope

The topology mirrors Application Design [components](../application-design/components.md), [component methods](../application-design/component-methods.md), [services](../application-design/services.md), [component dependency](../application-design/component-dependency.md), and [decisions](../application-design/decisions.md), with [requirements](../requirements-analysis/requirements.md) and [stories](../user-stories/stories.md). It records dependency only; Delivery Planning chooses economic sequence.

## Machine-Readable Topology

```yaml
units:
  - name: runtime-foundation
    kind: packaging
    depends_on: []
  - name: application-facades
    kind: library
    depends_on: [runtime-foundation]
  - name: parent-web
    kind: ui
    depends_on: [runtime-foundation, application-facades]
  - name: staff-web
    kind: ui
    depends_on: [runtime-foundation, application-facades]
  - name: admin-core-web
    kind: ui
    depends_on: [runtime-foundation, application-facades]
  - name: admin-advanced-web
    kind: ui
    depends_on: [runtime-foundation, application-facades, admin-core-web]
  - name: verification-handoff
    kind: packaging
    depends_on: [runtime-foundation, application-facades, parent-web, staff-web, admin-core-web, admin-advanced-web]
```

## Integration Points

| Provider | Consumers | Contract |
|---|---|---|
| runtime-foundation | all units | runtime config, composition, session cookie boundary, AppShell/state components, synthetic fixture/reset guard |
| application-facades | role UI units | `ApplicationResult`, authorized screen models, role ports, UX-AUTH rows, events/evidence |
| admin-core-web | admin-advanced-web | administrator shell, scoped context/filter/detail/action layout contracts |
| all runtime/UI units | verification-handoff | stable scenario IDs, fixture IDs, route/action entry points, coverage/evidence commands |

Existing domain modules supply their public constructors/types/services to `application-facades`; they are pre-existing dependencies rather than new graph units.

## Parallel Topology

After their shared dependencies are satisfied, `parent-web`, `staff-web`, and `admin-core-web` have no edges between them and are topology-parallel. This states valid DAG concurrency only; it does not recommend an implementation order or critical path. `admin-advanced-web` depends on admin core patterns. Verification aggregates all units.

## Cycle Verification

Every edge points from packaging/contracts toward consuming UI and finally verification. No UI supplies a dependency back to runtime or façades; advanced admin does not feed admin core. The graph is acyclic.

