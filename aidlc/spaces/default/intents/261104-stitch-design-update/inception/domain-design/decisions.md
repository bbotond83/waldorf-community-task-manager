# Architecture Decisions: Stitch restyle

Decisions made in Domain Design. Inputs: `requirements.md`, `component-inventory.md`, `architecture.md`, `team-practices.md`.

## ADR-001: Keep one stylesheet

- **Context** — All styling is in `app/globals.css` (1,418 lines). The colour-token test reads `:root` in that file, and the new CSS linter (FR6.1) will check it. The owner was asked whether to keep one file or split it by area [Q1].
- **Decision** — Keep one file. Mark sections per area (shell, sign-in, parent, teacher, admin).
- **Consequences** — Least change and one place for the token test and the linter. The file stays long, and some rules are shared across areas (grouped selectors), so each flow must check the groups it touches.
- **Alternatives Rejected** — One file per area, loaded from the main layout: shorter files, but it changes how every page loads styles, adds load-order risk, and the token test and linter would need to find several files.

## ADR-002: "Saját vállalásaim" is the existing parent task list, heading unchanged

- **Context** — The Stitch screen "Saját vállalásaim" has no page in the app. FR3.5 maps it to the existing list. The page `/szulo/feladatok` already lists the family's own linked tasks with a status filter, headed "Családi feladatok". It needs no new section, query or route, so the UI-only constraint holds. This also answers the reviewer's second finding on `requirements.md`. The owner chose to keep the heading [Q2].
- **Decision** — Restyle `/szulo/feladatok` as the "Saját vállalásaim" screen and keep the heading "Családi feladatok". Where Stitch wording differs from the app, the app's wording wins and the difference is shown to the owner at screenshot review.
- **Consequences** — No copy change and no test change for the heading. The Stitch title is not visible in the app.
- **Alternatives Rejected** — Rename the heading to "Saját vállalásaim": matches Stitch, but is a wording change that tests asserting the old heading would need to follow. Leaving the screen out: unnecessary, since the page already exists.

## ADR-003: The first slice is the sign-in page and the page frame

- **Context** — The team practice is a thin first slice that the owner checks before the flows start. The owner was asked which screen proves it [Q3].
- **Decision** — The first slice is DesignFoundation (fonts, shared values, shared controls) plus the sign-in page and the page frame (header and menu). It also carries the removal of the dead styles and the CSS linter and version pins.
- **Consequences** — The owner sees the new fonts and look on the first screen everyone uses, with few elements to compare. Cards, filters and status badges are first seen in the parent flow.
- **Alternatives Rejected** — The parent task list as first slice: shows more element types at once, but a larger first review and more risk before the base is accepted.

## ADR-004: Decompose by screen group, not by styling layer

- **Context** — The owner reviews one flow at a time and each flow is its own pull request (team practice). The code map shows hooks (class names and test ids) grouped by flow.
- **Decision** — Six blocks: DesignFoundation, ShellAndNavigation, SignInScreens, ParentDutiesFlow, ApprovalScreens, StyleGuards. The dependency order is the delivery order: foundation first, then the rest.
- **Consequences** — A flow's change stays inside one block and one review. Shared grouped selectors in the stylesheet still couple blocks, so each flow checks the groups it changes (a known risk from the code review).
- **Alternatives Rejected** — By styling layer (base, layout, components): each flow would touch every block. A single block for the whole restyle: hides the order the owner chose and the thin first slice.
