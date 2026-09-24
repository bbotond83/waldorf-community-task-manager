# Family Directory Construction Contract

## Data and Invariants

Family has one-or-more ParentProfile/Child links; child has one active school-year/group assignment; a link cannot be duplicated or active after archive. Contact, locality, and optional fields enforce the approved field policy. Archive preserves minimal history; restore requires active authorized scope.

## Operations

`saveFamily`, `linkParent`, `linkChild`, `assignGroup`, `archive`, and `restore` run transactionally. They recalculate relevance projections, reject cross-scope links, and return field-level Hungarian validation errors. Every mutation emits redacted audit evidence.

Sources: `../../../inception/units-generation/unit-of-work.md`; `../../../inception/units-generation/unit-of-work-story-map.md`; `../../../inception/requirements-analysis/requirements.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/component-methods.md`; `../../../inception/application-design/services.md`.
