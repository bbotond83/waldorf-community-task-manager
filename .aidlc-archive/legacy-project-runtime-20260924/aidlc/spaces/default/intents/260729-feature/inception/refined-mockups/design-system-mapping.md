# Design System Mapping

## Foundations

- Hungarian `hu-HU` copy, `Europe/Budapest` dates, semantic status colors with text labels.
- Mobile-first spacing and 44×44 px minimum touch targets.

## Components

- App shell: skip link, role-aware navigation, `main` landmark, page H1.
- Task/event cards: status badge, capacity, scoped action group, inline feedback.
- Detail workflows: labelled fields, validation summary, submit/cancel controls, outcome panel.
- Admin tables: responsive card alternative, scope filter, empty/loading/error states.
- Notifications: privacy-safe status cards; no contact data.

## Access Rules

Render prohibited controls absent and enforce the same rule server-side; read-only staff see schedule and necessary coordination names only.

Sources: `mockups.md`, `../requirements-analysis/requirements.md`, `../practices-discovery/team-practices.md`.
