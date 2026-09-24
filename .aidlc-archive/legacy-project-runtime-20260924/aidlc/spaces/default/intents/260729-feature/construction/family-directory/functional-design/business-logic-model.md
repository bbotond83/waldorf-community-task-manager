# Business Logic Model

## Relationship Updates

Scoped administrators create, update, archive, or restore family, parent, child, group, and school-year relationships in one transaction. Each change recalculates visibility references immediately and emits redacted audit evidence.

## Visibility

Parent reads resolve through active family links and relevant child/group scope; unrelated users receive no directory data.

Sources: `../../../inception/units-generation/unit-of-work.md`; `../../../inception/units-generation/unit-of-work-story-map.md`; `../../../inception/requirements-analysis/requirements.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/component-methods.md`; `../../../inception/application-design/services.md`.
