# Code Summary: u4-cancellation

## Files created, modified and deleted

- Created: `tests/browser/parent-cancellation-style.spec.ts` (7 checks per browser; calls `bindSeededSchema`; the sideways-scroll check runs at 320 and 1280 px).
- Modified: `app/szulo/feladatok/[id]/lemondas/page.tsx` (class hooks only: `parent-cancellation-page` on the section, `parent-back-link` on the back link, the `h1` wrapped in `header.parent-detail-header` with no new text, `parent-notice` on the ineligible paragraph); `app/szulo/_components/PendingRequestNotice.tsx` (the follow-up paragraph around "Vissza a feladathoz" gets `parent-page-actions`); `app/globals.css` (one scoped block, `.parent-cancellation-page .parent-form textarea`: min-height 7rem, radius 0.75rem); `DESIGN.md` (new "Cancellation request page" bullet); the plan file (steps 1 to 8 ticked).
- Deleted: nothing in the project (a temporary screenshot spec was created and removed).

## Key implementation decisions

- The page reuses U3's detail-page header, form panel, notice and outlined-pill link rules; only the taller textarea is new, scoped to the cancellation page. No shared rule was changed, no token added, no hex outside `:root`.
- The submit button stays the shared calm terracotta pill, not red.
- Not built (no matching element or new copy): Stitch's peach textarea (not an existing token), the radio list of reasons, the "more than 48 hours left" callout, the eyebrow text.

## Swap page check

- Looked at at 320 and 1280 px (form, success, refusal): no sideways scroll, submit button at least 44px, success looks right. Not restyled. The only change that reaches it is the shared `PendingRequestPanel` link, now the outlined pill.
- The swap refusal screenshot shows the browser's own "required field" bubble, not a server refusal. The swap partner list at 320 px has its radio above its label (cramped); this existed before and is untouched.

## Test coverage summary

- New spec: 14 passed (7 in Chromium, 7 in Firefox), 0 failed, against the real local database.
- Existing specs (`parent-web`, `functional-fixes`, `directory-coordination`, `notifications-import`, `parent-detail-style`, `parent-list-style`, `list-polish`, `visual-overhaul`) on every configured Playwright project including mobile-chrome: 318 passed, 36 skipped, 0 failed. The skips are explained (checked by the reviewer): `directory-coordination` and `notifications-import` skip outside Chromium, 18 tests x 2 non-Chromium projects = 36; the specs and config were not changed. Minor review gaps left for Build and Test: the reason field's 12px radius and the swap page's pending-notice pill link are not asserted.
- Gate checks passed: `lint`, `lint:css`, `format:check`, `typecheck`, `test:coverage` (130 files, 1655 tests; 97.92% lines, 91.11% branches, 95.66% functions), `build`, `smoke:start`.

## Tests written but not executed in this stage

- WebKit for the new spec (the existing batch covered it), widths between 320 and 1280 px, the dependency scan and CI: for Build and Test.
- The owner's comparison with the Stitch screens is manual.

## Notes

- Playwright serves the production build (`npm run start`), so `npm run build` must run after any source edit before browser specs.
