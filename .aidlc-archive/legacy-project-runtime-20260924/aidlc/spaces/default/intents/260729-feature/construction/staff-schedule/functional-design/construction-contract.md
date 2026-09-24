# Staff Schedule Construction Contract

## Projection API

`GET /schedule?groupId&from&to` validates ISO dates, active staff scope, and maximum date range. It returns task/event ID, title, start/end, location, and necessary coordination display name only; it omits contacts, family IDs, assignments, sensitive profile fields, and mutations.

## UI States

`loading`, `empty`, `ready`, `invalid-filter`, and `denied` are explicit. UI renders responsive cards with no edit affordances; generic denial hides record existence.

Sources: `../../../inception/units-generation/unit-of-work.md`; `../../../inception/units-generation/unit-of-work-story-map.md`; `../../../inception/requirements-analysis/requirements.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/component-methods.md`; `../../../inception/application-design/services.md`.
