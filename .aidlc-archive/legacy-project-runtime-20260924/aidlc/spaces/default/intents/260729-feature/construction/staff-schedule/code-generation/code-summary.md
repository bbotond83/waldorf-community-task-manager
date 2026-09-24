# Staff Schedule Code Summary

## Delivered

- `src/staff-schedule/` provides a group-scoped `get` projection only: no create, edit, archive, or assignment mutation path exists.
- It validates bounded ISO date ranges and returns `ready`, `empty`, `invalid-filter`, or generic Hungarian `denied` states.
- Entries include only ID, group, time, title, location, and an optional coordination display name; contacts, family IDs, assignments, and sensitive profile fields are omitted.

## Validation

- `npm test` — 27 tests passed.
- `npm run typecheck` — passed.
