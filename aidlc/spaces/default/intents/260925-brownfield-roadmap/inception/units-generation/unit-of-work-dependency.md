# Unit of Work Dependency

## Dependency Topology

The graph records prerequisite relationships only. It does not select a Bolt sequence, economic priority, or critical path; Delivery Planning makes those decisions from this topology.

Direct edges:

- Project baseline (U1) -> Archive assessment (U2)
- Project baseline (U1) -> Workflow recommendation (U3)
- Archive assessment (U2) -> Workflow recommendation (U3)

The baseline must be available before the archive assessment can classify historical claims against current code and rules. The workflow recommendation has explicit direct dependencies on both the baseline and archive findings; this lets downstream scheduling enforce every declared evidence input. This is the clarified three-Unit structure: archive inventory and comparison stay together in U2, and the workflow recommendation's intake, prioritization, feature path, and bug-fix path stay together in U3.

## Integration Points

| From | To | Information passed | Boundary |
|---|---|---|---|
| U1 Project baseline | U2 Archive assessment | Current architecture, runtime/integration boundaries, verification setup, source locations, and confidence/evidence limits | Evidence contract; U2 classifies archive claims against it |
| U1 Project baseline | U3 Workflow recommendation | Current project practices, quality gates, privacy/integration boundaries, and baseline limitations | Planning constraint input |
| U2 Archive assessment | U3 Workflow recommendation | Historical decisions worth retaining, contradicted or stale claims, unresolved version discrepancies, and archive evidence references | Historical-evidence contract; U3 does not treat archive claims as current without support |

There are no application APIs, shared runtime data stores, events, or deployment interfaces between these Units. Their integration is through reviewed planning documents and evidence references.

## Parallel Development Opportunities

There are no independent Units in the approved topology. U2 depends on U1, and U3 depends on U2. Work within a Unit may be organized into research tasks, but that internal subdivision does not alter the Unit-level DAG.

## Machine-Readable Dependency Edges

```yaml
units:
  - name: project-baseline
    kind: spec
    depends_on: []
  - name: archive-assessment
    kind: spec
    depends_on: [project-baseline]
  - name: workflow-recommendation
    kind: spec
    depends_on: [project-baseline, archive-assessment]
```

The graph is cycle-free. Each declared dependency names an existing Unit, and no Unit depends on itself.
