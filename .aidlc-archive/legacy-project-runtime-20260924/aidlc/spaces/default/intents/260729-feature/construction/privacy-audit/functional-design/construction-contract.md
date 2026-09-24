# Privacy Audit Construction Contract

## Policy and Lifecycle

DataCategoryPolicy stores lawful basis, visibility/edit rule, retention action, and audit treatment per imported field. Lifecycle states are `review_due`, `grace_period`, `held`, `delete_due`, `completed`. A sibling relationship keeps family data active; holds target specified records/categories only.

## Audit Access

Only super and kindergarten admins view redacted audit history. Events include actor/role/type/time/related ID/redacted summary; no raw phone, email body, optional text, or sensitive reason. Events expire after one year unless an authorized investigation hold applies.

Sources: `../../../inception/units-generation/unit-of-work.md`; `../../../inception/units-generation/unit-of-work-story-map.md`; `../../../inception/requirements-analysis/requirements.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/component-methods.md`; `../../../inception/application-design/services.md`.
