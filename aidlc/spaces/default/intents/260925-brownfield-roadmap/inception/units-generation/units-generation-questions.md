# Units Generation Questions

## Sources

- [requirements] `aidlc/spaces/default/intents/260925-brownfield-roadmap/inception/requirements-analysis/requirements.md`.
- [architecture] `aidlc/spaces/default/codekb/waldorf-community-task-manager/architecture.md`.
- [components] `aidlc/spaces/default/codekb/waldorf-community-task-manager/component-inventory.md`.
- [scope] `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/scope-definition/scope-document.md`.

## Context

This intent produces planning documents only. Domain Design was skipped because no application change or new software component was selected. There is no user-stories artifact. Units therefore describe the planning deliverables as `spec` work, and traceability will map requirements IDs rather than inventing software components or user stories.

## Q1. How should the planning deliverables be divided into Units?

The current scope includes a project baseline, an archive assessment, and a future feature/bug-fix workflow recommendation. The archive assessment can be one Unit or split into inventory and evidence comparison.

A. Three outcome Units — current baseline, archive assessment, and workflow recommendation.
B. Four focused Units — baseline, archive inventory, archive comparison, and workflow recommendation.
C. One integrated planning Unit covering all deliverables.
X. Other (please specify)

[Answer]: A

## Q2. Which work should the dependency graph allow to proceed independently?

The topology should show true dependencies; Delivery Planning will decide economic order separately.

A. Baseline and archive inventory may run in parallel; comparison depends on both, then the recommendation follows.
B. Complete the baseline first, then inventory and compare the archive, then write the recommendation.
C. Keep all Units sequential because one developer will execute the work.
X. Other (please specify)

[Answer]: A

## Q3. How should the future workflow recommendation be packaged into Units?

Requirements call for shared intake plus separate feature and bug-fix paths, with a prioritization method.

A. Keep intake, both delivery paths, and prioritization together in one recommendation Unit.
B. Give shared intake and prioritization one Unit, then separate feature and bug-fix path Units.
C. Give the feature path and bug-fix path separate Units, with shared intake and prioritization included in both.
X. Other (please specify)

[Answer]: B

## Q4. How should the archive assessment boundary align with the dependency graph?

You chose one archive-assessment Unit, while also choosing to run archive inventory alongside the project baseline and make comparison depend on both. A single Unit cannot express a dependency between its own inventory and comparison steps in the Unit-level DAG.

A. Keep three outcome Units and make the archive-assessment Unit depend on the baseline, so the comparison has its evidence before it starts.
B. Split archive inventory and comparison into separate Units, preserving parallel inventory and baseline work and the comparison dependency on both.
X. Other (please specify)

[Answer]: A

## Q5. How many actual Units should cover the three planning outcomes?

You chose three outcome Units, then chose to split the workflow recommendation into a shared intake-and-prioritization Unit plus separate feature and bug-fix path Units. That creates three additional Units within the recommendation outcome, for five actual Units overall.

A. Use five actual Units: baseline, archive assessment, shared intake and prioritization, feature path, and bug-fix path.
B. Keep exactly three actual Units by combining shared intake, prioritization, and both future paths into one workflow-recommendation Unit.
X. Other (please specify)

[Answer]: B

## Assumptions & Open Questions

- No `stories.md` exists because User Stories is skipped; map every functional requirement ID to one or more Units.
- Domain Design was skipped because this planning intent selected no new application components. Do not invent software components to fill that gap.
- Units are documentation/specification work products; complexity and boundaries describe this planning work, not application implementation effort.
- The dependency file records topology only. Delivery Planning chooses the economic sequence.

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
