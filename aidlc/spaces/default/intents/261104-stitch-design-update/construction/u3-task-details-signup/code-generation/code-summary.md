# Code Summary: u3-task-details-signup

## Files created, modified and deleted

- Created: `tests/browser/parent-detail-style.spec.ts` (9 checks per browser; calls `bindSeededSchema` and reseeds before each test).
- Modified: `app/globals.css`; `app/szulo/feladatok/[id]/page.tsx` (two class hooks only: `parent-back-link` on the back link, `parent-detail-header` on the header); `DESIGN.md` (the "Detail grids" bullet is replaced by a "Task detail panel" bullet, plus one bullet on the signup confirmation, notices and actions).
- Deleted: nothing in the project (a temporary screenshot spec was created and removed). `ParentMutationForm.tsx` and `PendingRequestNotice.tsx` were not touched.

## Key implementation decisions

- Detail panel: `.parent-detail-grid` is one cream panel (1px sand border, 16px radius, `--shadow`) with three stacked rows (muted Karla label above a larger value, thin sand dividers); the rows have no card of their own.
- Status pill shared with the U2 list pill by adding `.parent-detail-grid .status-badge` to the same selectors; no colour logic is duplicated. Pending text stays dark terracotta with an ochre icon.
- Notices (`.parent-notice`, `.parent-pending-notice`): info wash with the blue bar, as today. Full and ineligible notices keep the blue bar; only refusals are terracotta. Allergen note: info wash, ochre bar, Vollkorn heading. Follow-up links: outlined pills with a 2px dark terracotta border, at least 44px, wrapping.
- Signup confirmation: green wash with a green left bar and a Vollkorn bold message, `role=status` kept; refusals keep `role=alert` with the terracotta bar on the danger wash.
- No hex outside `:root`, no new tokens, and the Stylelint disabled-rule list is unchanged. Not built (no matching element in the app): hero photo, participant list, progress bar, calendar and message buttons, avatars, round icons.

## Shared rules changed (also affect the swap and cancellation pages)

- `.parent-form`: gap 1rem (was 0.75rem), padding 1.25rem (was 1rem), adds `--shadow`; `.parent-form button:disabled` uses the muted fill and a busy cursor; `.parent-form .form-hint` margin 0 and 0.9rem.
- `.parent-notice` and `.parent-action-state`: margin-block 1rem (0 inside a form), 0.75rem radius; `.parent-notice` has the info wash and weight 600; `.parent-action-state strong` is Vollkorn headline-sm; links in its error list are at least 44px; `.parent-action-state-success` has the green bar and wash.
- `.parent-detail-grid > div` was removed from the shared card border and padding rules (detail page only).
- The swap and cancellation checks inside `parent-web` and `functional-fixes` pass, but no screenshots of the swap and cancellation pages were taken: U4 must check how they look at 320 px.

## Test coverage summary

- New spec: 9 passed in Chromium and 9 in Firefox, against the real local database. Checks: panel look, status pill text contrast (4.5:1) in the "Jelentkezésre nyitott" and "Vállalt feladat" states, signup confirmation (status role, green wash, contrast, pill button at least 44px, 3px focus ring), refused attempt (alert role, terracotta bar), full and pending notices, follow-up links, label above the textarea, no sideways scroll at 320 px, axe with no serious or critical findings.
- Existing specs (`parent-web`, `functional-fixes`, `directory-coordination`, `notifications-import`, `parent-list-style`, `list-polish`, `visual-overhaul`, `navigation-polish`) in Chromium and Firefox: 246 passed, 18 skipped, 0 failed. The skips are explicit in the specs (single-browser production-server specs, one identity case, a mobile-only case), checked by the conductor.
- Gate checks passed: `lint`, `lint:css`, `format:check`, `typecheck`, `test:coverage` (domain 511 of 511; 130 files and 1655 tests; 96.96% statements, 91.11% branches, 95.66% functions, 97.92% lines), `build`, `smoke:start`.

## Tests written but not executed in this stage

- WebKit and mobile-chrome, widths between 320 and 1280 px, the dependency scan and CI: for Build and Test.
- The ineligible notice has no seeded task, so the spec injects a `p.parent-notice` and checks its bar and contrast; the full and pending-cancellation notices are real states.
- The pending-cancellation pill ("Lemondási kérelem folyamatban") is only checked by axe and in the screenshot, not by the pill contrast assertion; it uses the same dark terracotta text rule as the pending pill from U2.
- The existing-spec batch ran just before the last small edits (DESIGN.md, one assertion in the new spec, removal of the temporary spec); the new spec was re-run after them.
- The owner's comparison with the Stitch screens is manual.

## Deviations from the plan

- The back-link height assertion uses `Math.round(height) >= 44` because Firefox reports 43.99998 for a 44px box; the threshold is unchanged.
- The "waiting" sentence in the U2 part of `DESIGN.md` ("ochre on Info Wash") is slightly out of date, since the pill text is dark terracotta and only the icon is ochre; to be corrected in a later unit's DESIGN.md update.
