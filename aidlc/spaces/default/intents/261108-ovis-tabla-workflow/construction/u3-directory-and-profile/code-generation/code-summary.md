# Code summary: u3-directory-and-profile (steps 11 to 16 close-out)

Nothing is committed and no branch was created or switched. The earlier steps (database migration, sign-in service, access rules) are recorded in the plan; this file covers the screens, their tests and the close-out.

## Results (real counts, after the last change)

| Command                                                                                              | Result                                                               |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `npm run test:domain` (node)                                                                         | 555 of 555                                                           |
| `npm run test:scripts`                                                                               | 253 of 253                                                           |
| `npm run test:delivery` (vitest, 64 files)                                                           | 917 of 917                                                           |
| `npm run test:coverage:domain` (node, lines / branches / functions)                                  | 99.12 / 94.09 / 96.78 percent, threshold 80 each, passes             |
| `npm run test:coverage:delivery` (vitest, istanbul: statements / branches / functions / lines)       | 93.24 / 86.05 / 92.69 / 94.38 percent, thresholds 80 each, passes    |
| `tests/browser/directory.spec.ts`, `directory-account.spec.ts` (Chromium, Firefox, mobile Chrome)    | 11 and 5 tests per browser, all pass (directory-account: 15 of 15)   |
| Menu-affected browser specs after the CSS change (Chromium and mobile Chrome, 5 files)               | 96 of 96                                                             |
| `tsc --noEmit`, `eslint`, `npm run format:check`, `stylelint app/globals.css`                        | clean                                                                |

The coordinator's full `npm run verify:local` (all three browsers: 693 browser tests, 1719 delivery tests) passed before the close-out additions (the timing and account specs, the screenshot helper and the screen polish below). It was re-run in full on the final tree, after the owner's list-A changes (badges, side-by-side password fields, directory count and legend row), and passed (`LOCAL_VERIFICATION_PASS`).

## Step 14: test configuration

No change. `vitest.config.ts` and its 80/80/80 thresholds are untouched; `package.json` changed only to list the new database test files. The production inventory test count went from 226 to 243 for the seventeen new production files.

## Step 15: timings on the 30-family set

From `tests/browser/directory-timing.spec.ts` (`DIRECTORY_TIMING=1`, Chromium, production build, local stack): worst of three loads per page; the limit is 2000 ms (NFR9.1).

| Page                                            | Time   |
| ----------------------------------------------- | ------ |
| Szülők, parent (30 family cards)                | 68 ms  |
| Szülők, teacher                                 | 39 ms  |
| Szülők, super admin                             | 41 ms  |
| Fiókom                                          | 46 ms  |
| Nyilvántartások list, super admin               | 62 ms  |
| Family record page, super admin                 | 58 ms  |
| One search keystroke (browser only, no request) | 13 ms  |

## Browser coverage added in the close-out (`tests/browser/directory-account.spec.ts`, real stack and mail catcher)

- Password change: success message, the old password no longer signs in, the new one does.
- E-mail change: request, pending panel, link in the mail sent to the new address, confirmation button, success page, sign-in with the new address, second use of the link is "no longer valid".
- "Mégse" removes the pending request.
- Invitation: state badge changes from "Még nincs meghívó" to "Meghívó elküldve", button becomes "Új meghívó", the invitation mail arrives.
- Parent removal: the removed parent's sign-in no longer works, and the only parent of a family gets the refusal text with no form.

Not covered in a browser: the pending-follow-up line when ending the sign-in fails (covered by the component test with a failing sign-in service), and an expired invitation state badge (covered by the data adapter test).

## Screens against the Stitch designs

All ten approved screens (mobile and desktop) were downloaded into `screenshots/stitch/`; the built screens at 390 px and 1280 px are in `screenshots/built/` (helper: `tests/browser/directory-screenshots.spec.ts`, `DIRECTORY_SCREENSHOTS=<folder>`). Fixed after comparison: contact chips now carry phone and mail icons; Fiókom panels carry the eyebrow labels and full-width save buttons; the e-mail confirmation page no longer shows a card inside a card, has its eyebrow and a full-width button.

Remaining differences, left on purpose or for the owner's review:

- The design's family cards add a "Támogató család" badge, parent roles such as "Alapító tag", child classes and a "Ti" tag: invented or out of this Unit.
- The design's admin family page has a card per parent with edit and send buttons and a legend panel; the built page lists parents with the state badge, "Meghívó küldése" or "Új meghívó" and "Eltávolítás", above the existing record form. The invitation badge does not say "7 napig érvényes".
- The design's Fiókom shows a green and grey explanation pair for sharing on and off; the built page uses plain explanatory text.
- The e-mail page asks for a button press before confirming (scanner-safe); the design shows only the confirmed state, plus its invented 24-hour text and contact link.
- After a parent is removed, the removal page refreshes and shows "Ez a szülő már nem szerepel a családban." instead of the action's own success text.

## Documents

`README.md` and `verification/AUTHORIZATION.md` have a new section each. `source-manifest.json` lists every written file; `traceability.json` maps AC1.1.3, AC3.1.1 to AC3.7.2 and NFR1 to NFR11 to tests, with AC3.6.2, AC3.6.5 and AC3.6.7 marked N/A (they belong to the units that own duties, claims and books).

## Owner decision on the design gaps (applied afterwards, small changes only)

- Fiókom: green "Hitelesített szülő" badge beside the title and green "Megerősített e-mail" badge beside the sign-in address (icon plus text); the two new-password fields sit side by side from 44rem.
- Directory: "Aktív családok (N bejegyzés)" with a "Önkéntesen megosztott adatok" legend on one row, and the hint "A kereső automatikusan szűr a családnevekre és a megadott keresztnevekre is." under the search field (true of the current search: it matches family names, parent names and the children's names that are shown).
- Tests: `tests/integration/directory.test.tsx` and `tests/browser/directory.spec.ts` assert the badges, legend, hint, count text and the side-by-side layout.
