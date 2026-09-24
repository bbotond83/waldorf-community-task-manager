# Prioritized Intent Backlog

## Basis

The backlog implements the approved [intent statement](../intent-capture/intent-statement.md), respects the [feasibility assessment](../feasibility/feasibility-assessment.md), and applies the [constraint register](../feasibility/constraint-register.md). [intent] [feasibility] [constraints]

## Proto-Units

| Order | ID | Proto-Unit | Outcome | MoSCoW | Relative Size | Dependencies | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PU-01 | Local runtime foundation | Developer starts the application with one documented command | Must | S | None | [Q1] [Q3] |
| 2 | PU-02 | Task application contract and seeded store | Browser-facing code can list and create synthetic tasks through a stable boundary | Must | S | PU-01 | [feasibility] [constraints] [Q3] |
| 3 | PU-03 | Task list and creation workflow | Developer views tasks, submits valid Hungarian input, and sees the new task | Must | M | PU-01, PU-02 | [intent] [Q1] [Q3] |
| 4 | PU-04 | Validation and automated verification | Invalid input is rejected and the agreed quality gates pass | Must | S | PU-02, PU-03 | [intent] [Q2] [Q3] |
| 5 | PU-05 | Local documentation | Developer can reproduce install, start, test, and type-check steps | Must | XS | PU-01, PU-04 | [intent] [Q2] [Q3] |
| 6 | PU-06 | Responsive polish and reset | The demonstration remains clear on common viewport sizes and can restore seeds | Should | S | PU-03 | [Q2] |

## Delivery Sequence Rationale

The sequence is dependency-first and reaches usable value immediately after PU-03; PU-04 protects quality before documentation closes the handoff. [Q3] [Q4]

PU-06 cannot displace any Must Have proto-unit and may be omitted if it threatens completion within the active workflow. [Q2] [Q5]

## Dependency Map

```text
PU-01 → PU-02 → PU-03 → PU-04 → PU-05
                    └──────→ PU-06 (Should Have)
```

## Completion Signal

The backlog is complete when the Must Have proto-units satisfy the scope document's acceptance boundary and the local workflow is documented. [Q1] [Q2] [Q5]

## Assumptions and Open Questions

None.
