# Units of Work: Stitch restyle

Five units, one pull request each, built in a fixed order. They group the six blocks of `components.md` (DesignFoundation, ShellAndNavigation, SignInScreens, ParentDutiesFlow, ApprovalScreens, StyleGuards) by the order the owner chose: a thin first slice, then one flow at a time [Q1 of `units-generation-questions.md`]. Requirements are in `requirements.md`; boundary decisions are in `decisions.md` (ADR-001 to ADR-004).

## Unit table

| Unit ID | Directory | Name | Kind | Complexity |
|---|---|---|---|---|
| U1 | u1-foundation-slice | Foundation and first slice | ui | L |
| U2 | u2-parent-task-list | Parent task list | ui | M |
| U3 | u3-task-details-signup | Task details and signup | ui | M |
| U4 | u4-cancellation | Cancellation | ui | S |
| U5 | u5-approval-screens | Teacher and admin approvals | ui | M |

All units are `ui`: they change what users see in the existing web app. None is a separately deployed service, and the whole app is deployed as it is today (one app, one deployment model: embedded in the existing app).

## U1 u1-foundation-slice: Foundation and first slice

- **Blocks:** DesignFoundation, ShellAndNavigation, SignInScreens, StyleGuards.
- **Delivers:** the CSS linter and the pinned versions first, so the stylesheet is checked before it is rewritten; then Vollkorn and Karla through Next.js built-in font loading (with Hungarian accented letters and the licence texts); named values for colour, font family and main type sizes in `app/globals.css`; the shared controls; removal of the unused profile-picker styles; the page frame (header, menu, skip link, brand mark); the sign-in page and the other centred panels; the updated `DESIGN.md`.
- **Owner check:** the sign-in page and the page frame, by screenshot, before U2 starts [ADR-003]. The "profile selector" of the Stitch design is the sign-in page itself, since the old profile-picker has no live screen.
- **Constraints:** colour tokens stay as `--name: #rrggbb` in `:root`; class names, test ids and measurements the specs rely on stay, or their specs change in the same pull request; text contrast of 4.5 to 1 (3 to 1 for large text and controls) is met by darkening only the colour that fails.

## U2 u2-parent-task-list: Parent task list

- **Blocks:** ParentDutiesFlow (list part).
- **Delivers:** the cards, status filter, empty and "no match" states on `/szulo/feladatok`, which serves as "Saját vállalásaim" (heading "Családi feladatok" is kept) [ADR-002]. No new section, query or route.
- **Owner check:** screenshots at 320 px and desktop against the Stitch task list, filter, empty-filter and own-commitments screens.

## U3 u3-task-details-signup: Task details and signup

- **Blocks:** ParentDutiesFlow (detail part).
- **Delivers:** the task detail grid, notices and the signup form with its confirmation.
- **Owner check:** screenshots against the Stitch task details and signup confirmation screens.

## U4 u4-cancellation: Cancellation

- **Blocks:** ParentDutiesFlow (cancellation part).
- **Delivers:** the cancel (change signup) form and the cancel confirmation. The confirmation naming the affected task stays.
- **Owner check:** screenshots against the Stitch cancel and cancel-confirmation screens.

## U5 u5-approval-screens: Teacher and admin approvals

- **Blocks:** ApprovalScreens.
- **Delivers:** the teacher schedule (table and card list) and the admin approvals list, detail and decision form. The table-to-cards switch under 44rem stays.
- **Owner check:** screenshots against the Stitch approvals screens for teacher and admin.

## Notes

- Notifications, swap requests, password reset, invitation and the other admin pages are not restyled on their own. They pick up the shared look from U1 [Q5 of `requirements-analysis-questions.md`].
- Each unit ends with the existing gates passing: type check, lint, format check, unit tests with 80% coverage, build, start smoke, browser specs in all three browsers, and the dependency scan.
