# Business Overview

## Purpose

"Waldorf közösségi feladatkezelő" is a Hungarian-language community task manager for a Waldorf kindergarten. Families sign up for community duties (garden work, festival preparation), teachers see their group's schedule, and administrators manage tasks, records and approvals. The repository currently runs in a synthetic (fictitious data) local mode; production authentication is a placeholder (`app/page.tsx` renders "Biztonságos bejelentkezés" in production mode).

## Roles and Key Functionality

| Role (profile id) | Hungarian label | Home | Capabilities |
|---|---|---|---|
| `parent-local` | Szülő | `/szulo/feladatok` | List own family's duties, sign up, request swap or cancellation, edit own contribution note, notifications |
| `kindergarten-teacher-local` | Óvónő | `/teacher/schedule` | Read-only schedule of one group |
| `group-admin-local` | Csoportadminisztrátor | `/admin` | Dashboard, tasks/events, approvals for the assigned group |
| `super-admin-local` | Szuperadminisztrátor | `/admin` | All of the above plus records, import, reminders, privacy, settings |

Source: `src/runtime/synthetic/profiles.ts`.

## Domain Modules

Access/roles, directory (families, children, groups), coordination (duties and assignments), notifications, import/migration, privacy/audit, teacher tracking and the admin/parent experience services live under `src/` (see component-inventory.md).

## Locale and Copy

All user-facing copy is Hungarian; code identifiers are English (team rule). `<html lang="hu">` is set in `app/layout.tsx`. Long Hungarian compound words (role names such as "Csoportadminisztrátor") appear in cards, headers and status text.

## Intent Relevance (261009-visual-overhaul)

The visual overhaul touches the entry/profile chooser, parent duty list, admin dashboard summary cards, shared shell/header and the global stylesheet. Business rules, access boundaries and data flows must not change.
