# Code Summary: u2-parent-task-list

## Files created, modified and deleted

- Created: `tests/browser/parent-list-style.spec.ts` (11 tests per browser; calls `bindSeededSchema`).
- Modified: `app/globals.css` (one new block before `.parent-detail-grid`: `.parent-duty-card`, additions under `.parent-filter` and `.parent-state`, `.parent-empty`); `app/szulo/feladatok/page.tsx` (two class hooks only); `DESIGN.md` (one bullet on the parent task cards).
- Deleted: nothing in the project (a temporary screenshot spec and `test-results/` folders were removed).

## Key implementation decisions

- The card look is scoped to a new `.parent-duty-card` hook, because `.parent-card` is also used by notification and swap cards, which keep their old look. No change to the shared `.filter-field`, `.filter-actions` or `.parent-card` rules, so admin and teacher lists do not move.
- Status pill: coloured by meaning through `:has(.status-badge-icon-positive|pending|negative)`; the `StatusBadge` component is untouched; the icon and the Hungarian word stay together. From 36rem up the pill sits top right beside the title; below that it sits under the date. DOM order (title, date, badge) is unchanged.
- Card: cream `#fffaf1` surface, resting `--shadow`, Vollkorn 1.25rem underlined title (the underline is the existing link cue), muted date. Hover, pressed and reduced-motion behaviour come from the existing shared rules.
- Filter panel scoped under `.parent-filter`: 1.25rem padding, label Karla 600, cream select keeping the 2.9rem height and the shared primary button.
- Empty and error states: `.parent-state` has more room and a Vollkorn heading; behaviour change: `.parent-state[role="alert"]` now has a terracotta bar on the danger wash (it was the blue notice bar before). `.parent-empty` is a cream panel for "Nincs találat.". No Hungarian text changed.
- Not built (not in the app, UI-only change): Stitch's tabs, category chips, descriptions, place and head-count rows, "Jelentkezem" buttons, bottom navigation, footer note, Material Symbols icons.

## Test coverage summary

- New spec: 22 passed (11 in Chromium, 11 in Firefox), against the real local database.
- Existing specs unchanged (`parent-web`, `visual-overhaul`, `list-polish`, `functional-fixes`): 158 passed, 0 failed in Chromium and Firefox. `list-polish` ran unchanged, so the admin and teacher filter rows did not shift.
- Axe (serious and critical) on the list and on the "Nincs találat." state: no findings in either browser. No colour darkened, no threshold changed.
- Unit and gate checks passed: design-tokens and css-lint (23 tests), `lint`, `lint:css`, `format:check`, `typecheck`, `test:coverage` (130 files, 1651 tests; 96.95% statements, 91.09% branches, 95.66% functions, 97.92% lines), `build`, `smoke:start`.

## Fix after review

The reviewer found that the "waiting" status pill text (ochre on the beige wash) was about 3.9 to 1, below 4.5 to 1. The pill text now uses the dark terracotta token (the icon stays ochre), and a new test in `tests/browser/parent-list-style.spec.ts` checks the text contrast of every status pill on the list. The new spec now has 12 tests per browser and passes in Chromium and Firefox (24 passed). The earlier "no colour darkened" statement above is superseded by this fix.

## Tests written but not executed in this stage

- WebKit and mobile-chrome runs, the dependency scan and CI: for Build and Test.
- The 36rem breakpoint of the status pill was checked at 320 and 1280 px only, not at 768 px.
- The alert and status panel styles are tested by injecting a `.parent-state` element (the real states are hard to trigger); the real error states are not exercised in the browser.
- The owner's comparison with the Stitch screens is manual.

## Deviations from the plan

- Spec reads the 0.35rem bar as at least 4.5px because browsers round it to 5px (the spec was fixed, not the CSS).
- Open point from the plan: `/szulo/feladatok` shows the family's whole duty list, with the family's own signups marked "Vállalt feladat" (Takarítás, Sütés) beside open tasks ("Díszítés"). It is not a signups-only view, so as the Stitch "Saját vállalásaim" screen it is only a partial match. The owner decides at the screenshot review (ADR-002).
