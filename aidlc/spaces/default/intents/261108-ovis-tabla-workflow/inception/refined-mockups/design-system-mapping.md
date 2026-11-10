# Design System Mapping

New screens from `mockups.md` use the system in `DESIGN.md`, whose source of truth is `app/globals.css`. Colours and type are unchanged. Delivery rules are in `team-practices.md`, and the features come from `stories.md` and `requirements.md`.

## Reused Components

| Need | Existing element |
|---|---|
| Lists of duties, books, tasks, events | Parent task cards and the shared status pill |
| Week-by-job table | Teacher schedule table, replaced by cards below 44rem |
| Duty and event detail | Task detail panel, 44px back link |
| Forms | Cream form panel, labels above fields, standard primary pill |
| Filters | Filter fieldset with primary and secondary buttons |
| Notices | Success, Danger and Info wash panels with a coloured left bar |
| Allergen and cup notices | Info Wash callout with an Ochre bar |
| Pager | Admin pager items |

## New Components

| Component | Built from | CSS prefix |
|---|---|---|
| Bottom navigation bar | Nav pill styles, fixed bar on Cream Surface | `parent-bottom-nav-` |
| Slot row | Card row with a primary pill | `parent-slot-` |
| Fair-share panel | `details` panel | `parent-fair-` |
| Rota table cell editor | Table cell with a select | `admin-rota-` |
| Weekend pick | Radio rows from the approvals decision form | `parent-pick-` |
| Checklist | Card rows with section headings | `event-checklist-` |
| Food sign-up | Form panel and category groups | `event-food-` |
| Directory card | Clickable card without hover lift | `directory-` |
| Library card | Parent task card | `library-` |
| Info accordion | `details` panel with Vollkorn summary | `info-` |
| Template editor | Form panel with repeated rows | `admin-template-` |

## Status Words

Status is always an icon and a word (rule in `DESIGN.md`).

| Word | Colour role |
|---|---|
| Kész | Success |
| Folyamatban, Üres | Ochre on Info Wash |
| Elhalasztva, Szünet | Quiet read surface |
| Sürgős, Lejárt | Terracotta on Danger Wash |

## Stitch

The design reference remains Stitch project `projects/14373287019289018119`. Each screen is designed there just before its piece is built, and approved by the owner (Q1).
