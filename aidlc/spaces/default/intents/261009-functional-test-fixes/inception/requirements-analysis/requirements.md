# Requirements: Functional test fixes

## Intent Analysis

A tester pass through the running app as all four profiles found problems that single-screen tests did not catch: opening a notification moves the parent into the task section, opening it does not mark it read, the admin screens have no way back, filters offer choices that can never match, a parent can file the same request again, and demo or technical text shows on normal screens. The goal is that each journey a person follows feels consistent: the menu stays on the section they came from, a notification that was read looks read, every page has a way back, and nothing in the screens is leftover test or developer material. Business rules, access rules and data flows do not change. [desc]

Type: bug fixes and usability fixes on existing code (brownfield). Scope: parent notifications and menu, parent task and request pages, admin lists, detail pages and forms, demo data, technical text, tests and user guide. Depth: Minimal.

## Functional Requirements

### FR1 Notifications stay under Értesítések

- FR1.1 A notification card opens the task page with the notification as context: the address carries the notification id. [Q1]
- FR1.2 On a page opened from a notification, the top menu marks "Értesítések" as the current item (not "Feladatok"), and the back link reads "Vissza az értesítésekhez" and goes to the notification list. The same task page opened from the task list keeps "Feladatok" current and the back link "Vissza a feladatokhoz". [desc]
- FR1.3 The notification page flow also works for `notice-stale` style notifications whose link already points to the notification list: they stay on the list and are not marked read by opening. [assumption]

### FR2 Opening a notification marks it read

- FR2.1 Opening a notification (following its card, FR1.1) marks that notification read for the signed-in parent. Returning to the list shows it read. [desc]
- FR2.2 The checkbox "Olvasottnak jelölöm" keeps working as today (FR3.3 of the previous round); marking read twice, by opening and by the checkbox, changes nothing and shows no error. [assumption]
- FR2.3 A notification id in the address that does not belong to the signed-in parent, or is unknown, is ignored: nothing is marked and the page shows as if opened from the task list. A failure to mark read never stops the task page from showing. [assumption]
- FR2.4 Opening the task page directly (from the task list, or by typing its address) does not mark any notification read. [assumption]

### FR3 Read notifications look read

- FR3.1 A read notification card is greyed out as a whole: muted text and a greyer card background, in addition to the ticked and disabled checkbox. An unread card keeps today's look. [desc]
- FR3.2 The read state is also available to assistive technology as text ("Olvasott") and not by colour alone. [assumption]
- FR3.3 Muted text on the greyed card keeps at least 4.5:1 contrast, and the focus ring and checkbox keep at least 3:1 (WCAG 2.2 AA). [memory:M1]

### FR4 Parent menu order

- FR4.1 The parent menu is "Értesítések", then "Feladatok", on every page. The parent's default page stays Értesítések. [desc]
- FR4.2 Other profiles' menus are unchanged. [assumption]

### FR5 Way back on admin pages

- FR5.1 Every admin detail page (Nyilvántartások, Feladatok és események, Jóváhagyások, Archívum) has a visible back link to its list, worded for that list (for example "Vissza a jóváhagyásokhoz"). [desc]
- FR5.2 The two "new" forms (Új rekord, Új feladat vagy esemény) have a visible back link to their lists. [desc]
- FR5.3 After a successful create the form shows its confirmation, and a link back to the list is shown with it; the form stays on the page. [assumption]
- FR5.4 The back link keeps the list's filter and page position when the list was opened with one. [assumption]

### FR6 Status filters only offer matching statuses

- FR6.1 Each admin list offers only the statuses that list can contain: Nyilvántartások: Aktív, Archivált; Feladatok és események: Nyitott, Ütemezve; Jóváhagyások: Függőben, Jóváhagyva (and Elutasítva when the data can contain it). "Minden állapot" stays first on every list. The design stage lists the real values from the data and types. [desc]
- FR6.2 No offered option can return an empty list by construction for the demo data, and approved requests can be filtered with "Jóváhagyva". [desc]
- FR6.3 Existing filter links keep working: a link with a status value the list no longer offers shows the unfiltered list with a short Hungarian note, not an error. [desc]
- FR6.4 The labels in the filter and on the items use the same Hungarian words (the shared status labels). [assumption]

### FR7 Swap and cancellation requests

- FR7.1 After a successful submit the parent sees a clear confirmation and cannot submit the same request again. [desc]
- FR7.2 A task with a waiting request shows a pending notice on its task page ("Cserekérelem folyamatban" or "Lemondási kérelem folyamatban"), and both request links are hidden while any request is pending. [Q2]
- FR7.3 The request pages ("Cserekérelem", "Lemondási kérelem") of a task with a pending request show the pending notice and a link back to the task instead of the form. [Q2]
- FR7.4 The state words on the parent task list and the task page come from one shared Hungarian label source, so the list and the detail page never disagree. [assumption]
- FR7.5 Existing result states of the request actions (success, validation, denied, conflict, terminal failure) stay and keep their messages. [assumption]

### FR8 Demo data and technical text

- FR8.1 The demo shows only the normal tasks and notifications. The per-browser copies ("– Firefox próba", "– mobil próba") exist only when the server runs in test mode; the browser tests keep their isolation. [Q3]
- FR8.2 On normal screens no technical text appears: no "Korreláció corr-…" line, no scenario selectors ("Kapacitási helyzet", "Forgatókönyv" and their options), no "Verzió: N". [desc]
- FR8.3 In the local demo this material stays reachable inside one collapsed section titled "Fejlesztői részletek" at the bottom of the page, closed by default, so the existing tests and developers still reach it. [Q4]
- FR8.4 Moving the material changes no behaviour: hidden form fields, version checks and scenario handling work as before. [assumption]

### FR9 Empty form submit

- FR9.1 Submitting "Új rekord" or "Új feladat vagy esemény" with an empty required field shows a clear Hungarian message next to the field and in the form's summary, and moves focus to it. Nothing is created. [desc]
- FR9.2 The same messages apply to other required fields that can be empty in these forms and to values that are too long. [assumption]

## Non-Functional Requirements

- NFR1 Accessibility: text contrast at least 4.5:1 and control and focus-indicator contrast at least 3:1; the automated accessibility checks on the parent, admin and teacher flows report no serious or critical violations, including the new pending notice, the greyed card and the back links. [memory:M1]
- NFR2 Keyboard and screen reader: each whole-card control keeps one accessible name; back links, the "Fejlesztői részletek" section and form messages are reachable by keyboard with a visible focus ring; the current menu page is announced; validation messages are announced. [desc]
- NFR3 Touch and layout: every changed control keeps a target of at least 44 by 44 pixels, and every changed screen works from 320 px to desktop without horizontal scrolling. [desc]
- NFR4 Quality gates: strict type checking, lint, format, unit, component and browser tests and the production build pass; line, branch and function coverage stay at or above 80%; each fix has a regression test in the same change. [memory:M1]
- NFR5 Journey tests: a browser test follows the notification journey (open a notification, menu stays on Értesítések, back link goes to the list, the notification is read and greyed, tick and reload persist), and one follows a pending request (submit, notice, no duplicate, links hidden). [desc]
- NFR6 No regression: access rules, session start, filters, mark-as-read and approvals behave as before; tests that mention removed or moved text are updated; stable `data-testid` hooks stay wherever an element still exists. [desc]
- NFR7 Copy: every word added or changed is Hungarian; identifiers stay English. [memory:M1]

## Constraints

- All user-facing text is Hungarian; code identifiers are English. [memory:M1]
- No change to business rules, authorization or data flows; no profile gains access to a page it did not have. [desc]
- Keep the existing design: terracotta palette, logo, cards. [desc]
- Node 24 and npm 11 are required to run the project. [desc]
- Work happens on branch `feature/functional-test-fixes` and merges to `main` through a pull request. [memory:M1]

## Assumptions & Open Questions

- [assumption] Notification opening reuses the existing task page with the notification id as context (Q1 option A); marking read happens on the server when that page is requested and uses the existing read action, with no new data model.
- [assumption] After a successful create the form stays on the page with a confirmation and a link to the list (FR5.3); redirecting to the list is not wanted unless asked.
- [assumption] The Elutasítva status exists in the types but not in the demo data; it is offered in the approvals filter only if the data can contain it (decided at design time from the types).
- [assumption] The test-mode switch for the per-browser copies is an environment variable the Playwright server sets; its name is chosen at design time.
- Open: none that block design.

## Out of Scope

- New features, new pages, new roles, or changes to who may see which page.
- A "mark as unread" action, notification settings, or changes to when notifications are created.
- Redesign beyond the items listed; real authentication; real notification delivery.
- Keyboard-only and screen-reader exploratory testing (not part of the findings list).

## Sources

- [desc]: Initial description: the nine fixes in the request text, the findings of the exploratory test pass, and the user's later decisions (opening a notification marks it read, Értesítések first in the parent menu, read notifications greyed out as a whole card).
- [Q1] to [Q4]: answers in `requirements-analysis-questions.md` (notification context on the task page; pending notice with both links hidden; per-browser copies only in test mode; collapsed "Fejlesztői részletek" section).
- [memory:M1]: the team's practices in `aidlc/spaces/default/memory/team.md` and `project.md` (Hungarian copy, quality gates, accessibility, 80% coverage).
- Codebase facts: code knowledge base `aidlc/spaces/default/codekb/waldorf-community-task-manager/` and the scan handoff `inception/reverse-engineering/developer-scan.md`.
