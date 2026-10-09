# Design System Mapping

## Existing Visual System

Use the existing application CSS and components. No external component library or new theme is proposed. Development names are English, including Kindergarten teacher; Hungarian strings are UI copy only.

| Token / convention | Observed source value | Application to refined mockups |
| --- | --- | --- |
| Background | `--color-background: #f7f2e8` | Existing warm-neutral app backdrop. |
| Surface | `--color-surface: #fffdf8` | Profile cards, schedule table/cards and detail/state panels. |
| Main text | `--color-text: #29241d` | Headings and task/owner/status values. |
| Secondary text | `--color-muted: #655d53` | Read-only/scope and supporting labels; do not rely on muted color alone for state meaning. |
| Primary / hover | `#8c3f2f` / `#672d22` | Existing filter/profile buttons and navigation conventions. |
| Focus | `--color-focus: #165d8f`, 3px outline with 3px offset | Keep visible keyboard focus on filters, links and buttons. |
| Border / radius | `#d6c9b8`, `1rem` | Existing rounded surfaces; avoid using a border's color as the sole meaning cue. |
| Type | Existing system font, line-height 1.55 | Keep existing hierarchy and wrapping, including long Hungarian labels. |
| Interaction target | Existing minimum 44px height | Preserve button/link/input usability; verify actual hit area during implementation. |
| Narrow layout | Existing `max-width: 44rem` | Stacked filters and cards instead of table. |
| Reduced motion | Existing reduced-motion media rule | Preserve current behavior; no new animation added. |

These are inspected values, not measured accessibility results. Verify contrast and focus appearance against the actual rendered components in downstream checks.

## Component Mapping

| Design component | Existing source surface | Required adaptation |
| --- | --- | --- |
| Current role selection | `src/runtime/ProfileSelector.tsx` | Four current categories and translated role labels; English profile/role identifiers. No new management screen. |
| Authorized shell/profile summary | `src/runtime/AppShell.tsx` and role navigation | Kindergarten teacher name in development contracts, `Óvónő` in UI; current grant-derived scope/home. |
| Schedule filter | `app/munkatars/beosztas/_components/ScheduleFilter.tsx` | Retain native group/date form; group options authorized for the current teacher. Old directory names are current-source references, not prescribed future identifiers. |
| Tracking table/cards | `app/munkatars/beosztas/_components/ScheduleCollection.tsx` | Add owner/assignee/current-status presentation in both representations. Preserve date/title/group and existing detail information. |
| Read-only detail | `app/munkatars/beosztas/[id]/page.tsx` | Definition-list tracking fields and explicit absences; retained location/coordination; no mutation toolbar. |
| State panels | Existing StaffStatePanel, StaffAccessState and FocusedStateSection | Reuse error/empty/denied/retry hierarchy and safe recovery; updated current-role copy. |
| Parent/group/super-admin surfaces | Existing role-specific app screens | Preserve allowed flows; remove obsolete categories and retain Super administrator advanced operations. |

Mapping names refer to today's files. Domain/Functional Design will choose coherent English internal naming and routing while implementing the approved behavior. This specification does not preserve a separate staff role merely because a current file path contains `staff` or `munkatars`.

## Responsive Content Rules

Above 44rem, use the current table wrapper with local horizontal overflow where needed. At 44rem and below, show the card list and stacked filters. Preserve owner, assignments and status on both layouts. Long titles/names wrap without overlaying links. At zoom/narrow widths, critical content must remain reachable without page-wide clipping. Exactly one active table/card view participates in focus and accessible reading order.

## Sources and Scope

[stories.md](../user-stories/stories.md), [requirements.md](../requirements-analysis/requirements.md), [team-practices.md](../practices-discovery/team-practices.md), completed [refined-mockups-questions.md](refined-mockups-questions.md), and bounded reads of `app/globals.css` plus the source components above. Rough `wireframes` and `user-flow` are absent under classic; no design-system evidence is inferred from them. No repository-wide restyle, new component dependency or accessibility certification is implied.
