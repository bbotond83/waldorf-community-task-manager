# Code Summary: u5-approval-screens

## Files created, modified and deleted

- Created: `tests/browser/teacher-style.spec.ts` (8 checks per browser) and `tests/browser/admin-approvals-style.spec.ts` (8 per browser); both call `bindSeededSchema` and reseed before each test.
- Modified: `app/globals.css` (shared pill, back-link, header and detail-panel selector lists extended; old teacher card and padding rules trimmed; one new "U5" block); `app/admin/jovahagyasok/page.tsx` and `app/admin/jovahagyasok/[id]/page.tsx` (one class hook, `admin-approvals-page`, on the section); `DESIGN.md` ("Data tables (teacher)" bullet replaced by "Teacher schedule", plus an "Admin approvals" bullet); the plan file (steps 1 to 9 ticked).
- Deleted: nothing in the project (a temporary screenshot spec was created and removed). No font, `layout.tsx`, token or Stylelint change; no hex outside `:root`.

## Key implementation decisions

- Teacher list: filter is a cream panel with shadow and a Vollkorn legend; the table is a cream panel with a Vollkorn caption, a muted Karla capitals header row on the info wash, a whole-row link kept; under 44rem the same entries are cream cards (the 44rem switch and the markup are unchanged). Status uses the shared pill and stays on one line in the table.
- Teacher detail reuses the U3 detail-panel rules (`.teacher-detail-grid` shares `.parent-detail-grid`).
- Admin list: cream cards with shadow and Vollkorn title; the state pill sits beside the title from 36rem and below it on phones; pager items are quiet outlined pills of at least 44px.
- Admin detail: the request is one cream panel; the decision form is a second cream panel with a Vollkorn "Döntés" legend, 44px radio rows and the pill primary button. A decision gives a green status message; a second decision on an already decided request gives the terracotta `role=alert` message that takes focus.
- Not built (no matching element in the app): tabs, avatars, round icons, bulk actions, counters, extra buttons.

## Shared rules changed, and which other pages they reach

- Admin-wide (chosen as "right for all", for owner confirmation): `.admin-filter`, `.admin-card`, `.admin-card-link strong`, `.admin-pagination span` reach every admin list (tasks, records, archive, approvals); `.admin-action-state` and its states, `.admin-form-success-link`, `.admin-back-link` reach every admin form and detail page (validation, conflict and invalidated now use the terracotta bar like denied and terminal; success is green; the success link is an outlined pill).
- Parent pages: `.parent-back-link`, `.parent-detail-header h1` and the shared pill selector lists were only extended with teacher and admin selectors; parent pages look the same.
- Scoped by `admin-approvals-page`: the detail panel, the decision form and the pill selectors for the detail panel.
- Looked at 320 px: admin tasks list, task detail form and records list (records screenshot not viewed by the developer). Admin import and settings were not looked at.

## Test coverage summary

- New specs: 32 passed (16 in Chromium, 16 in Firefox), 0 failed, against the real local database. One first-run Firefox failure (card background read as the hover fill because the pointer rested on the card) was a spec issue, fixed by moving the mouse away and polling.
- Existing specs (`teacher-web`, `admin-core`, `directory-coordination`, `functional-fixes`, `list-polish`, `navigation-polish`, `visual-overhaul`, `parent-web`) in Chromium and Firefox: 245 passed, 9 skipped, 0 failed (the skips match the known Firefox skips in `directory-coordination`; not individually listed).
- Gate checks passed: `lint`, `lint:css`, `format:check`, `typecheck`, `test:coverage` (130 files, 1660 tests; 96.95% statements, 91.09% branches, 95.66% functions, 97.92% lines), `build`, `smoke:start`.

## Tests written but not executed in this stage

- WebKit and mobile-chrome, widths between 320 and 1280 px, the dependency scan and CI: for Build and Test.
- The existing-spec batch ran before the last DESIGN.md and spec-only edits; the gates were re-run after them.
- Not asserted: the admin form's invalid-field error state (no approvals screen shows it); the pager is the static "1. oldal" placeholder, restyled only.
- The owner's comparison with the Stitch screen is manual.
