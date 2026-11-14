# Approved Stitch Designs: u3-directory-and-profile

Approved by the owner on 2026-11-14. Stitch project `14373287019289018119`. Fetch a screen with `mcp__stitch__get_screen` (screenshot and HTML) and follow `DESIGN.md`.

| Screen | Route | Mobile screen id | Desktop screen id |
|---|---|---|---|
| Szülők (directory) | `/szulo/szulok`, `/teacher/szulok` (same page, teacher menu) | `bceca2868cf64b0783951231712b80d9` | `5a278b3a81c8421a8d890cc0afd5f5b6` |
| Fiókom | `/szulo/fiokom` | `57d7772a1a464b31a93a540e7939d24f` | `fcda9833651e4810a228431e9e0b1cc1` |
| Nyilvántartások, family page with removal and refusal states | `/admin/nyilvantartasok` | `f36cef311fdd40df880fdda9caf8d198` | `a75a2d08f6ee42f0a67328f72f4a4fc1` |
| E-mail confirmation, expired link, invalid invitation | `/email-megerosites/<token>` | `308e23fa57374ae4b3f71ee51a2d49e7` | `2be7316c3b90459db92f571b8873db7f` |
| Admin forms: new family, new parent, edit parent, error states | records area | `bfa3faa9ac3d4d9d91297b93073eac72` | `0b3ee2ea48b04dfa9a422bc5f5c4bb8b` |

## Not part of the design (Stitch invented these; do not build them)

- Registry numbers such as `#CS-2023-048`, and the named other administrator in the stale-screen notice.
- A class/group dropdown on children: children keep first names only.
- A 24-hour link expiry: use the real rules (invitations 7 days, email-change link as designed in NFR Design).
- Buttons and links not in `inception/refined-mockups/mockups.md`: "Saját családi adatlap kitöltése", "Kapcsolatfelvétel az adminisztrátorral", "Család törlése vagy archiválása".
- The designs' own bottom or top navigation labels: use the app's real navigation from `src/access`.
- Admin screens show no residence, occupation, hobby or support-offer fields as editable; a read-only note is allowed only where `mockups.md` says so.

Copy follows `mockups.md` where the two differ.

## Owner-accepted differences from the designs (screenshot review, 2026-11-14)

- Admin family page stays a parents-and-invitations list above one edit form, not one card per parent with a status legend, and the invitation badge has no "7 napig érvényes" text.
- Fiókom has no green/grey explanation boxes for the sharing tick box; the same explanation is plain text. The "Megerősített e-mail" and "Hitelesített szülő" badges were added.
- Desktop pages keep the app's shared navigation and page layout, not the designs' top bar; the admin forms stay one stacked form, not three side-by-side forms.
- The new-family form has no children list.
