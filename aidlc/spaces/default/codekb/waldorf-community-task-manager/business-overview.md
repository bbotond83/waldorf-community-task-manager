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

## Current intent (functional-test fixes, scope bugfix)
Follows two shipped rounds (visual overhaul; navigation polish: whole-card lists, Hungarian state words, notification checkbox, one consistent menu per profile, per-role landing pages: parent lands on Értesítések). The functional test now reports defects in parent notifications (link target, read state, current menu item, back link), parent menu order, admin lists and filters, admin "new" forms, parent swap/cancel pending state, and demo/test wording visible to users ("– Firefox próba", "– mobil próba", "Korreláció", "Verzió", scenario selectors). Findings are in architecture.md and code-quality-assessment.md.

## Current intent (admin list polish, scope bugfix, depth Minimal)
Follows the functional-test fixes round. The user reports polish defects on filters and lists: the teacher schedule "Szűrők törlése" control does not clear the fields (it resets to the default group and dates), admin filter bars have no clear control and their labels and controls are not aligned, the "Új rekord" / "Új feladat vagy esemény" links are plain links rather than buttons, the word "rekord" appears in user-facing copy, and status words are plain text without a symbol or colour cue. Findings: architecture.md (List item pattern) and code-quality-assessment.md.

## Constraints
Privacy-first (kitalált data only), 80 percent coverage, accessibility (axe, serious/critical blocking), Vercel two-environment release model with deployment workflows intentionally disabled until a linked target exists.
