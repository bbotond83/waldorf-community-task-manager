# Business Overview

## Purpose
"Waldorf közösségi feladatkezelő" is a Hungarian-language, role-based community task manager for the Cinkotai Waldorf Óvoda (kindergarten). Families sign up for duties and events, teachers read the schedule, and administrators manage records, tasks, approvals, reminders, imports and data lifecycle. All user-facing copy is Hungarian; identifiers are English.

## Actors (four roles)
| Role | Synthetic profile id | Label | Main surface |
|---|---|---|---|
| parent | parent-local | Szülő | /szulo (duties, notifications, swap/cancel requests) |
| kindergarten-teacher | kindergarten-teacher-local | Óvónő | /teacher/schedule (read-only) |
| group-admin | group-admin-local | Csoportadminisztrátor | /admin core pages, scoped to one group |
| super-admin | super-admin-local | Szuperadminisztrátor | /admin plus import, reminders, privacy, settings |

## Key functionality
- Parent: list/filter family duties, sign up, request swap or cancellation, contribution notes, read notifications (reminders at 7 days / 24 hours, simulated provider status).
- Teacher: schedule table/cards with coordination, owner, assignees, status; detail page; no mutations.
- Admin: dashboard (open approvals, records, tasks), records, tasks and events, approvals, archive, reminders, privacy lifecycle, settings/governance, spreadsheet import with conflict resolution.
- Runtime is synthetic only (invented local data, profile chooser, no real login); production mode is a stub boundary ("Biztonságos bejelentkezés").

## Current intent (second visual overhaul, scope bugfix)
Whole-card list items without "Részletek" links, Hungarian state words, notification card redesign with a separate read checkbox, no heading focus box, pill-style top menu, per-role landing pages, one consistent menu. Findings are in architecture.md and code-quality-assessment.md.

## Constraints
Privacy-first (kitalált data only), 80 percent coverage, accessibility (axe, serious/critical blocking), Vercel two-environment release model with deployment workflows intentionally disabled until a linked target exists.
