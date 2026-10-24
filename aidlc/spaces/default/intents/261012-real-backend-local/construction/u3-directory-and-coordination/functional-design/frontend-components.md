# Frontend Components: U3 Directory, settings and coordination

The owner approved screen changes only for the swap flow and the admin forms (answers Q6 and Q7, BR32.7). Every other screen keeps its text, route and behaviour. All new copy is Hungarian, every control is labelled, errors are announced and linked to their field, and the flows must pass the automated accessibility check (WCAG 2.2 AA, NFR5). Source: `functional-spec.md` workflows W2, W6, W7, W10, W11 and rules BR32.1, BR32.7, BR32.8.

## Parent screens

| Route | Component | Change |
|---|---|---|
| `/szulo/feladatok/[id]/csere` | SwapRequestPage | Changed: shows a list of partner tasks (task title, date, family display name) from the candidates function; the chosen assignment replaces the fixed placeholder value; empty state when no partner exists |
| `/szulo/cserek` (new) | IncomingSwapsPage | New: lists swap requests addressed to the family (swap.incoming) with Confirm and Decline buttons, and the family's own open requests with a Withdraw button; result messages for conflicts and stale data; empty state |
| `/szulo/feladatok/[id]` and list | duty pages | Unchanged in layout; they now show swap-pending and cancellation-pending from real data |
| `/szulo/ertesitesek` | notifications | Unchanged; shows the empty state for real parents until U4 (BR32.9) |

## Admin screens

| Route | Component | Change |
|---|---|---|
| `/admin/nyilvantartasok` (records form) | RecordForm | Changed: fields depend on the record type (group: school year, name; school year: start and end date; family: name, group, its parents with contact details and optional profile consent, and an end-membership action; child: family; task: group, event, category, capacity, start, end, location; event: group, title, location, coordinator, start, end) |
| `/admin/feladatok` (assign) | AssignForm | Changed: adds a family selector; shows ASSIGNMENT_INELIGIBLE and ASSIGNMENT_CAPACITY_FULL messages |
| `/admin/feladatok` (notes) | NotesForm | Changed: edits the event's allergen, supply and food notes |
| `/admin/jovahagyasok`, `/admin/beallitasok`, `/admin/archivum`, `/admin/adatvedelem` | approvals, settings, archive, lifecycle | Unchanged in layout; wired to real data |

## Component Hierarchy and State

- Pages stay server components that read the session and call the facades; small client forms hold only field values, a pending flag and one error region.
- Forms post to server actions that return the explicit result states (success, validation, denied, conflict, invalidated, retryable, terminal); each code in BR32.8 maps to one Hungarian message; stale data reloads the page.
- New messages to add: DUTY_CLOSED, DUTY_ALREADY_ASSIGNED, ASSIGNMENT_INELIGIBLE, ASSIGNMENT_CAPACITY_FULL, and for the incoming swap page: SWAP_REQUEST_NOT_OPEN (the request is no longer open) and SWAP_CANNOT_BE_APPLIED (the swap can no longer be applied).
- Keyboard order follows reading order; Confirm and Decline are separate buttons with the partner task named in their accessible label.
