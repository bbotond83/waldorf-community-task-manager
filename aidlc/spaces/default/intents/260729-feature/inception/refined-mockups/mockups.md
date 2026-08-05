# Refined Mockups

## Parent Experience

`Saját feladataim` is a mobile-first card list: task/date/status, family assignment, then context-safe `Jelentkezem`, `Csere`, and `Lemond` actions. Full or ineligible tasks disable signup with Hungarian explanation. Swap and cancellation open a detail flow with pending, approved, rejected, and invalidated states; notifications show reminder outcomes.

## Administration

Role-scoped dashboard cards link to records, tasks/events, approvals, archive, reminder monitoring, and import. Complex actions use detail screens: approval detail, task/event editor, assignment form, and import sequence `Upload → Parse → Mapping → Conflict queue → Immutable preview → Confirm → Result`. Group context remains visible; contacts and restricted fields are absent outside authorized scope.

## Required Detail Screens

- **Roles and access:** Super-admin role/scope editor shows current grants, confirmation, and redacted audit evidence; affected users see `Nincs jogosultság` on their next request after revocation.
- **Family reminder recipient:** Admin assignment detail lists active linked parents and permits one primary recipient selection; default sends to every active linked parent.
- **Event notes:** Parents edit only their own contribution; in-scope admins edit supply, food, and allergen notes; assigned, signed-up, or explicitly granted participants see allergen notes.
- **Privacy lifecycle:** Annual-review queue and family-departure detail show sibling/hold deferral, 30-day countdown, delete/anonymize outcome, and access-controlled redacted audit history.
- **Staff schedule:** Read-only group/date view exposes schedule and coordination display names only, with no edit controls, contacts, sensitive fields, assignment detail, or unrelated-family rows.
- **Import recovery:** Interrupted commit result shows recovery state, immutable preview reference, safe retry/rollback guidance, redacted outcome evidence, and verified-restoration status.

## Responsive States

At narrow widths, tables become labelled cards with progressive disclosure; primary actions remain reachable in one column. Every core screen defines loading, empty, validation-error, permission-denied, success, and recoverable failure states.

Sources: `../../ideation/rough-mockups/wireframes.md`, `../user-stories/stories.md`, `../requirements-analysis/requirements.md`, `../practices-discovery/team-practices.md`.
