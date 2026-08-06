# Import Migration Construction Contract

## Allowed Transitions

`uploaded → validating → preview_ready|blocked → approved → committing → committed`; `committed → frozen → rolled_back → preview_ready` after confirmed defect. Only `preview_ready` with zero blocking conflicts may approve; commit requires the preview hash and mapping version.

## Mapping and Recovery

Each mapping-register row returns `mapped`, `optional_omitted`, `conflict`, or `invalid`; conflict resolutions persist aliases/decisions. Commit is one transaction. Confirmed defects freeze the run, audit redacted evidence, roll back canonical writes, and require corrected preview/re-import; service restoration is verified within one hour.

Sources: `../../../inception/units-generation/unit-of-work.md`; `../../../inception/units-generation/unit-of-work-story-map.md`; `../../../inception/requirements-analysis/requirements.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/component-methods.md`; `../../../inception/application-design/services.md`.
