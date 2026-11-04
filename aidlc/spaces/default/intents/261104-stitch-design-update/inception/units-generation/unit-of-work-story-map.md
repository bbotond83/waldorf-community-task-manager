# Requirement-to-Unit Map: Stitch restyle

No user stories were produced for this change, so the map is keyed by functional requirement (FR) from `requirements.md`. A requirement with sub-requirements is traced through its `FR{n}.{m}` IDs.

## Map

| Requirement | Unit | Directory |
|---|---|---|
| FR1.1 | U1 | u1-foundation-slice |
| FR1.2 | U1 | u1-foundation-slice |
| FR1.3 | U1 | u1-foundation-slice |
| FR1.4 | U1 | u1-foundation-slice |
| FR2.1 | U1 | u1-foundation-slice |
| FR2.2 | U1 | u1-foundation-slice |
| FR2.3 | U1 | u1-foundation-slice |
| FR2.4 | U1 | u1-foundation-slice |
| FR3.1 | U1 | u1-foundation-slice |
| FR3.2 | U2 | u2-parent-task-list |
| FR3.3 | U3 | u3-task-details-signup |
| FR3.4 | U4 | u4-cancellation |
| FR3.5 | U2 | u2-parent-task-list |
| FR3.6 | U5 | u5-approval-screens |
| FR4.1 | U1 | u1-foundation-slice |
| FR5.1 | U1;U2;U3;U4;U5 | u1-foundation-slice;u2-parent-task-list;u3-task-details-signup;u4-cancellation;u5-approval-screens |
| FR5.2 | U1;U2;U3;U4;U5 | u1-foundation-slice;u2-parent-task-list;u3-task-details-signup;u4-cancellation;u5-approval-screens |
| FR5.3 | U1;U2;U3;U4;U5 | u1-foundation-slice;u2-parent-task-list;u3-task-details-signup;u4-cancellation;u5-approval-screens |
| FR5.4 | U1;U2;U3;U4;U5 | u1-foundation-slice;u2-parent-task-list;u3-task-details-signup;u4-cancellation;u5-approval-screens |
| FR5.5 | U1;U2;U3;U4;U5 | u1-foundation-slice;u2-parent-task-list;u3-task-details-signup;u4-cancellation;u5-approval-screens |
| FR5.6 | U1;U2;U3;U4;U5 | u1-foundation-slice;u2-parent-task-list;u3-task-details-signup;u4-cancellation;u5-approval-screens |
| FR6.1 | U1 | u1-foundation-slice |
| FR6.2 | U1 | u1-foundation-slice |
| FR6.3 | U1 | u1-foundation-slice |

## Rows that span several units

FR5.1 to FR5.6 are behaviour that must not change (Hungarian copy, keyboard and focus behaviour, class names and test ids, wrapping and no sideways scroll, confirmation before cancelling, light mode and reduced motion). Every unit must keep them. U1 is the named owner in the traceability file because it sets the shared rules; each later unit proves them for its own screens with the existing specs.

## Order within each unit

- U1: the CSS linter and the pinned versions; then fonts and the named values; then shared controls and removal of the dead styles; then the page frame and the sign-in page; then `DESIGN.md`.
- U2 to U5: restyle the screen markup hooks in the order list, filter, empty states (U2); detail, signup form, confirmation (U3); cancel form, confirmation (U4); teacher schedule, admin list, admin detail and decision form (U5).

## Coverage check

All 24 sub-requirements of FR1 to FR6 are assigned. Every unit (U1 to U5) has at least one row.
