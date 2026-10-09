# Requirements: Admin and schedule list polish

## Intent Analysis

After the last functional-fix round the person kept testing and found five more rough spots in the admin lists, the new-item entry points and the teacher schedule: clearing filters does not clear them, labels do not line up with their fields, two "create" links look like plain text, the word "Rekord" is wrong for what the screens hold, and the status words are easy to overlook. The goal is a tidier, more scannable list experience with working "Szűrők törlése", consistent label and field layout, proper buttons, the word "Elem" instead of "Rekord", and a small symbol next to every status word. Business rules, access rules and data flows do not change. [desc]

Type: UI usability fixes plus one small presentational feature on existing code (brownfield). Scope: teacher schedule filter, admin list filter bar, the two create entry points and their forms, status rendering everywhere, global stylesheet, tests and the user guide. Depth: Minimal.

## Functional Requirements

### FR1 Clearing filters

- FR1.1 On the teacher schedule, "Szűrők törlése" empties every filter field: the group select shows its empty first option "Minden csoport", and both date fields are empty. The results then show every entry of every group the teacher may see, with no date limit. [Q1]
- FR1.2 The teacher date fields are no longer required: an empty "Kezdő dátum" or "Záró dátum" means no limit on that side. A filled pair still has to be a valid range (a "Kezdő dátum" after "Záró dátum" keeps today's Hungarian validation message). The group and date defaults of the first visit (first group and the default window) are replaced by the unfiltered view on the first visit as well. [Q1]
- FR1.3 After "Szűrők törlése" no stale value remains in any field: typed but unsubmitted text, a previously chosen group, and values that came from the page address are all cleared, whether the page was reached by submit, by link, or by the Back button. [desc]
- FR1.4 The empty-state "Szűrők törlése" link of the teacher schedule does the same as the one in the filter form. [desc]
- FR1.5 The three admin lists (Nyilvántartások, Feladatok és események, Jóváhagyások) get a visible "Szűrők törlése" control next to "Szűrés": it empties the search field, sets the status to "Minden állapot", and shows the unfiltered first page. The Archívum list has no filter and gets none. [desc]
- FR1.6 Clearing keeps working without client-side JavaScript (it is a link or a reset that reloads the page without filter values) and never loses the user's place in the app: the menu, the back links and focus stay as they are, and focus moves to the heading or the filter's first field after clearing. [assumption]
- FR1.7 Links that carry filters (pagination, detail back links, existing bookmarked addresses with `groupId`, `from`, `to`, `q`, `state`) keep working as today. [assumption]

### FR2 Label and field alignment

- FR2.1 In every filter form (teacher schedule, admin lists) each label sits above its field, as a stacked pair, on every screen size from 320 px to desktop. [Q2]
- FR2.2 The pairs line up in a clean grid: equal field heights (at least 44 px), labels left-aligned with their field's left edge, consistent spacing, and the buttons ("Szűrés", "Szűrők törlése") aligned to the bottom of the row on wide screens and stacked full-width-capable on a phone. [Q2]
- FR2.3 Each label stays programmatically tied to its field (same accessible names as today: "Keresés", "Állapot", "Csoport", "Kezdő dátum", "Záró dátum"). [desc]

### FR3 Create entry points as buttons, "Elem" wording

- FR3.1 On Nyilvántartások the "Új rekord" link becomes a button with the same look as the primary pill buttons ("Szűrés"), with the text "Új elem". [desc]
- FR3.2 On Feladatok és események the "Új feladat vagy esemény" link becomes the same kind of button, keeping its text. [desc]
- FR3.3 Both remain links in the page (they navigate to a form), are at least 44 px tall, have a visible focus ring and a hover and pressed state, and keep their `data-testid` values. [desc]
- FR3.4 Every user-facing use of "Rekord" or "rekord" becomes "Elem" or "elem", with correct Hungarian grammar: page title "Új elem", select label "Elem típusa", submit button "Elem létrehozása", detail page title "Elem részletei", archived detail eyebrow and texts, back links ("Vissza a nyilvántartásokhoz" stays, it names the list), validation and success messages, import outcome messages ("3 elem módosult"), the user guide and its checklist rows. [desc]
- FR3.5 The list name "Nyilvántartások" and the menu stay unchanged; code identifiers, route paths, `data-testid` values and fixture ids keep their English names. [desc]

### FR4 Status symbols

- FR4.1 Every status word shown to a person gets a small symbol before it: in list items, detail pages (the "Állapot" lines), reminder and privacy screens, the parent task list and task page, and the teacher schedule's status column. [Q4]
- FR4.2 The symbol mapping is one shared table next to the Hungarian label table. The three approval states use a check mark (Jóváhagyva), a cross (Elutasítva) and a clock (Függőben); every other status has its own fitting symbol (the design stage lists the full table, for example Aktív a filled dot, Archivált an archive box, Nyitott an empty circle, Ütemezve a calendar). A status without a symbol is not allowed: a test fails if a status that has a Hungarian label has no symbol. [Q4]
- FR4.3 The word always stays; the symbol is decoration only, hidden from assistive technology, so the accessible text of an item does not change. [desc]
- FR4.4 In the status filter dropdown the option text carries the same symbol as a plain character before the word (for example "✓ Jóváhagyva"); "Minden állapot" has no symbol. The `value`s stay unchanged. [Q3]
- FR4.5 Symbols look the same on chromium, firefox and mobile Chrome (no emoji-font surprises): lists and detail pages use inline vector symbols drawn with the text colour; the dropdown uses the matching plain characters that exist in the system fonts. [assumption]
- FR4.6 The teacher schedule's status column text is shown through the shared label source instead of free text, so it gets a symbol and Hungarian wording like everywhere else. [assumption]

## Non-Functional Requirements

- NFR1 Accessibility: text contrast at least 4.5:1; symbol and control contrast at least 3:1; focus ring on every new or changed control; the automated accessibility checks on the admin, parent and teacher flows report no serious or critical violations. [memory:M1]
- NFR2 Keyboard and screen reader: "Szűrők törlése", both create buttons and the filter fields are reachable by keyboard in a sensible order; symbols are hidden from the accessibility tree; each control has one accessible name. [desc]
- NFR3 Touch and layout: every changed control is at least 44 px high and wide enough to tap, and every changed screen works from 320 px to desktop without horizontal scrolling. [desc]
- NFR4 Quality gates: strict type checking, lint, format, unit, component and browser tests and the production build pass; line, branch and function coverage stay at or above 80%; each fix has a regression test in the same change. [memory:M1]
- NFR5 Tests: a browser test checks, for the teacher schedule and each admin list, that "Szűrők törlése" empties every field and shows the unfiltered results (including after typing without submitting and after a filtered address), and checks label and field alignment at 320 px and desktop (labels above their fields, no overflow). [desc]
- NFR6 No regression: access rules, filters, pagination, bookmarked filter links, create forms and the approval flows behave as before; tests that match changed texts or option texts are updated; stable `data-testid` hooks stay wherever an element survives. [desc]
- NFR7 Copy: every word added or changed is Hungarian; identifiers stay English. [memory:M1]

## Constraints

- All user-facing text is Hungarian; code identifiers are English. [memory:M1]
- No change to business rules, authorization or data flows; no profile gains access to a page it did not have. [desc]
- Keep the existing design: terracotta palette, logo, cards, pill buttons. New colours, if any, are added as tokens and pass the contrast test. [desc]
- Node 24 and npm 11 are required to run the project. [desc]
- Work happens on branch `feature/admin-list-polish` and merges to `main` through a pull request. [memory:M1]

## Assumptions & Open Questions

- [assumption] The answer to the teacher clear question ("All fields should be cleared.") is read as: empty group choice ("Minden csoport"), empty dates, unfiltered results for all groups the teacher may see, and the same unfiltered view on the first visit. The group select therefore gains an empty first option, and the date fields stop being required. If the person meant a reset to today's default window and first group, FR1.1 and FR1.2 change.
- [assumption] The admin "Szűrők törlése" is a link back to the list without filter values (works without scripts), and the filter form is re-keyed by the address so no stale typed value survives.
- [assumption] Symbols: lists and detail pages use inline vector icons coloured from existing or new design tokens; only the dropdown uses plain characters, because a native dropdown cannot show anything else.
- [assumption] "Rekord" inside the import outcome messages and the synthetic workbook texts also becomes "elem", with the tests and the user guide updated together.
- Open: none that block design.

## Out of Scope

- New filters, new sort options, new pages, new roles, or changes to who may see which page.
- Redesign of the pages beyond the items listed; the parent duty filter keeps its current controls (it only gets the shared status symbols and label alignment if it uses the same filter styles).
- Removing the remaining demo wording ("Tesztprofil váltása", "kitalált", "Szimulált szolgáltató", "OUTSTANDING", the `?scenario=` selector on the request pages) seen during the scan: noted for a later round.

## Sources

- [desc]: Initial description: the five findings in the request text and the user's screenshots of the teacher schedule filter, the Nyilvántartások, Jóváhagyások and Feladatok és események lists.
- [Q1] to [Q4]: answers in `requirements-analysis-questions.md` (teacher clear: "All fields should be cleared."; labels always above fields; symbol characters in the dropdown; symbols for all statuses).
- [memory:M1]: the team's practices in `aidlc/spaces/default/memory/team.md` and `project.md` (Hungarian copy, quality gates, accessibility, 80% coverage).
- Codebase facts: code knowledge base `aidlc/spaces/default/codekb/waldorf-community-task-manager/` and the scan handoff `inception/reverse-engineering/developer-scan.md` (including the browser-verified teacher clear behaviour).
