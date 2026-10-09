# Requirements: Visual overhaul, second round (navigation, lists and notifications)

## Intent Analysis

The first round gave the app its branding, its colours and whole-card controls on the profile chooser, the parent task list and the admin overview. Using it showed what is still rough: list items elsewhere still carry a separate "Részletek" link, English state words leak into the Hungarian screens, notifications look cramped and have a clumsy "mark as read" button, a blue box sits around headings, the top menu is plain underlined text, every profile lands on a welcome page nobody needs, and the menu changes (3 items, then 5) after the first click. The goal is that every role gets a consistent, clearly clickable and fully Hungarian interface that opens straight on the page they use. Business rules, access rules and data flows do not change. [desc]

Type: UI usability fixes on existing code (brownfield). Scope: shared shell and menu, session landing, admin, parent and teacher lists, notifications, global stylesheet. Depth: Minimal.

## Functional Requirements

### FR1 Whole-card list items

- FR1.1 In every admin list (Jóváhagyások, Nyilvántartások, Feladatok és események, Archívum, and any other list built from the shared admin list component) each item is one link that opens the item; the separate "Részletek" link is removed. [desc]
- FR1.2 In the teacher schedule, each item is one link that opens the detail page, in both the table layout and the card layout; the separate "Részletek" link is removed. In the table layout the whole row is clickable through its title cell link; the table keeps its row and cell semantics and the link's accessible name is the same as in the card layout (checked by a keyboard and screen-reader-name test on the table layout). [desc]
- FR1.3 In the parent notification list, each notification card opens the notification; the separate "Megnyitás" link is removed. [desc]
- FR1.4 The behaviour is the same for every role. No "Részletek" or "Megnyitás" link text remains in any list. [desc]
- FR1.5 Each whole-card item exposes one link with one accessible name (title with its date or status), and contains no nested interactive element other than the notification checkbox in FR3.2, which sits beside the link and not inside it. [desc]

### FR2 Hungarian status words

- FR2.1 Every status value shown to a person is Hungarian: in list items, detail pages, filters, badges, reminders and privacy pages. Examples: pending is "Függőben", approved is "Jóváhagyva", active is "Aktív", archived is "Archivált", open is "Nyitott", scheduled is "Ütemezve"; the design stage lists every value that can reach the screen and its label. [desc]
- FR2.2 A status value with no Hungarian label is shown as "Ismeretlen állapot" and never as the raw English value. [assumption]
- FR2.3 The status filter options and the labels shown on items use the same words. Only the displayed labels change: the filter values carried in page addresses stay as they are, so existing bookmarked or shared filter links keep working. [assumption]
- FR2.4 A test fails if any status value that the application can render has no Hungarian label (the test walks the label map against every value the synthetic data and the application's status types can produce). [desc]

### FR3 Notifications

- FR3.1 Each notification card is one clickable element that opens the notification (see FR1.3). [desc]
- FR3.2 "Olvasottnak jelölöm" is a checkbox on the right side of the card, beside the link, with the accessible name "Olvasottnak jelölöm" followed by the notification title. [desc]
- FR3.3 Ticking the checkbox marks the notification as read at once, with no extra button; a read notification shows the box ticked and disabled. [Q3]
- FR3.3a While the request is running the checkbox is disabled and marked busy; if it fails the box returns to unticked and a short Hungarian error message appears beside that card; a second request for an already read notification changes nothing. The error message is announced to assistive technology (an alert region) and the box is focusable again after a failure. [desc]
- FR3.3b Marking as read also works without client-side JavaScript: the checkbox sits in a form that carries a small Hungarian submit button ("Mentés") shown only when scripts are not available. [assumption]
- FR3.4 The card content has proper padding and alignment: the text no longer touches the card border, and the title, time, provider status and read state line up in a clear layout that works from 320 px wide to desktop. [desc]
- FR3.5 Marking as read keeps working through the existing action and keeps its existing result and error states (success, validation, denied, conflict, terminal failure), now shown as in FR3.3a. [assumption]

### FR4 Focus appearance

- FR4.1 When a page moves focus to its heading on load (for example after choosing a profile), no visible box appears around the heading. The focus move itself stays, so screen readers still land on the heading. [desc]
- FR4.2 Interactive controls (links, buttons, form fields, checkboxes, cards) keep a clearly visible focus ring when reached by keyboard. [desc]

### FR5 Top menu as buttons

- FR5.1 Top menu items look like buttons (pill or tab shape) with a hover state, a pressed state and a clearly marked current page, instead of underlined text links. [desc]
- FR5.2 The current page is also marked for assistive technology (`aria-current="page"`). [assumption]
- FR5.3 Menu buttons are at least 44 px tall, wrap cleanly on a phone, and keep the collapsible "Navigáció" panel on narrow screens. [desc]

### FR6 Default page per profile

- FR6.1 Choosing a test profile opens its default page: Szülő opens Értesítések (`/szulo/ertesitesek`), Óvónő opens Beosztás (`/teacher/schedule`), group admin and super admin open Áttekintés (`/admin`). The welcome page is no longer shown after choosing a profile. [desc]
- FR6.2 Opening `/` with an active session goes straight to that profile's default page; the welcome panel is removed from the code, so no address shows it any more (a test checks that `/` with a session redirects and that no "Üdvözlünk" heading is rendered). [desc]
- FR6.3 The teacher has no menu bar, because Beosztás is their only page; the "Navigáció" toggle is hidden too. [desc]
- FR6.4 A parent who signs in on the real sign-in page also lands on Értesítések, unless the link they followed asked for another page, which still wins. [Q2]
- FR6.4a Real sign-in for a teacher or an administrator also lands on that role's default page (Beosztás, Áttekintés); a destination they were sent to by a link still wins. [assumption]
- FR6.5 Because the teacher has no menu, every teacher page other than Beosztás offers a visible way back to Beosztás (a "Vissza a beosztáshoz" link) and the header logo links to Beosztás; a teacher opening a page they may not see gets the same denied page as today, and that denied page also links back to Beosztás. [desc]
- FR6.6 A session with an unknown role, an expired session, or no session on `/` keeps today's behaviour (the profile chooser, or the sign-in page for production mode); a default page that the role may not open is never used. [assumption]

### FR7 One consistent menu per profile

- FR7.1 Group admin: Áttekintés, Nyilvántartások, Feladatok és események, Jóváhagyások, Archívum. Super admin: those five, then Importálás, Emlékeztetők, Adatvédelem, Beállítások. Parent: Feladatok, Értesítések. Teacher: none. [Q1]
- FR7.2 A profile sees exactly the same items, labels and order on every page, including its default page. [desc]
- FR7.3 The menu of each profile is defined in one place; no page or layout replaces it with a different list. [assumption]
- FR7.4 A test checks, against the existing access rules, that every menu link and every default page of a profile resolves to a page that profile is allowed to open, and that no profile gains access to a page it did not have. [desc]

## Non-Functional Requirements

- NFR1 Accessibility: text contrast at least 4.5:1 and control and focus-indicator contrast at least 3:1 (WCAG 2.2 AA); the automated accessibility checks on the root flow, admin and teacher areas report no serious or critical violations, and now also cover the new default pages. [memory:M1]
- NFR2 Keyboard and screen reader: every whole-card control and menu button is reachable and operable by keyboard with a visible focus ring, has one accessible name, and the current menu page is announced; hover and press animation is off under `prefers-reduced-motion`. [desc]
- NFR3 Touch and layout: all clickable items and the notification checkbox have a target of at least 44 by 44 pixels, and every changed screen works from 320 px wide to desktop without horizontal scrolling. [desc]
- NFR4 Quality gates: strict type checking, lint, format, unit, component and browser tests and the production build pass; line, branch and function coverage stay at or above 80%; new components and behaviour have tests in the same change. [memory:M1]
- NFR5 No regression: access rules, session start, filters, mark-as-read and approvals behave as before; tests that mention removed controls, the welcome page, or the old menu counts are updated, and stable `data-testid` hooks stay wherever an element still exists. [desc]
- NFR6 Copy: every user-facing word added or changed is Hungarian; identifiers stay English. [memory:M1]

## Constraints

- All user-facing text is Hungarian; code identifiers are English. [memory:M1]
- No change to business rules, authorization or data flows; the menu change must not give any profile access to a page it did not have. [desc]
- Keep the existing design: terracotta palette, logo, cards. [desc]
- Node 24 and npm 11 are required to run the project. [desc]
- Work happens on branch `feature/visual-overhaul-navigation` and merges to `main` through a pull request. [memory:M1]

## Assumptions & Open Questions

- [assumption] The fuller admin menu in FR7.1 matches what each admin can already reach; the super admin's extra pages stay super-admin only and a group admin never sees them. FR7.4 turns this into a test.
- [assumption] There is no "mark as unread" today, so a read notification's checkbox stays ticked and disabled (FR3.3).
- [assumption] A status value outside the known list is rare; "Ismeretlen állapot" is acceptable wording for it.
- [assumption] The page the teacher and each admin lands on keeps its current heading; only the menu and landing change.
- Open: the exact Hungarian label for every status value is chosen at design time from the values that can reach the screen; any word you prefer to change can be changed at the code gate.

## Out of Scope

- New features, new pages, new roles, or changes to who may see which page.
- A "mark as unread" action, notification settings, or changes to when notifications are created.
- A visual redesign of the pages themselves beyond the items listed (palette and logo stay as they are).
- The production sign-in content and any change to real authentication.

## Sources

- [desc]: Initial description: the eight points in the request text and the user's screenshots of the current admin lists, parent notifications, welcome heading and menus.
- [Q1] to [Q3]: answers in `requirements-analysis-questions.md` (admin menu: the fuller 5 and 9 item menus everywhere; parent landing: Értesítések on real sign-in too; checkbox: marks as read at once).
- [memory:M1]: the team's practices in `aidlc/spaces/default/memory/team.md` and `project.md` (Hungarian copy, quality gates, accessibility, 80% coverage).
- Codebase facts: code knowledge base `aidlc/spaces/default/codekb/waldorf-community-task-manager/` and the scan handoff `inception/reverse-engineering/developer-scan.md`.
