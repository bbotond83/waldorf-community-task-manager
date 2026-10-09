# Requirements: Visual overhaul and UX fixes

## Intent Analysis

The Hungarian-language "Waldorf közösségi feladatkezelő" works, but it looks generic and four interaction details get in the way: long role names break mid-word, and three places use a separate button or link where the whole card should be the control. The goal is a calmer, recognisably Cinkotai Waldorf Óvoda look (its logo and building photo, warm colours taken from the building) and cards that are single, obvious, accessible controls. Business rules, access boundaries and data flows do not change. [desc]

Type: UI enhancement and usability fixes on existing code (brownfield). Scope: shared stylesheet, shell/header, profile chooser, parent task list, admin overview. Depth: Minimal.

## Functional Requirements

### FR1 Hungarian line breaking

- FR1.1 The page language stays Hungarian (`lang="hu"`) and body text, headings and card titles use automatic Hungarian hyphenation, replacing the current "break anywhere" rule. [desc] [Q1]
- FR1.2 The four fixed role names (Szülő, Óvónő, Csoportadminisztrátor, Szuperadminisztrátor) carry explicit syllable break points, so they can only break at correct Hungarian syllable boundaries (for example Cso-port-ad-mi-niszt-rá-tor), wherever they are shown (profile chooser, header, greeting). [desc] [Q1]
- FR1.3 A word that cannot be hyphenated is allowed to break only as a last resort, and never leaves a single letter alone on a line (no "Csoportadminisztrát / or"). [desc]

### FR2 Profile chooser cards

- FR2.1 Each role card on the test-profile chooser is itself the button that selects that profile; the separate "Profil használata" button is removed. [desc]
- FR2.2 The card's accessible name states the role (and its short description), for example "Csoportadminisztrátor: Egy kitalált, kijelölt csoport"; activating it by mouse, touch, Enter or Space selects that profile exactly as the old button did. [desc]
- FR2.3 Selecting a profile still starts the session through the existing session endpoint and lands on the same home page as before. [desc]

### FR3 Parent task list

- FR3.1 Each task card in the parent task list is fully clickable and opens that task's detail page; the separate "Részletek" link is removed. [desc]
- FR3.2 The currently chosen status filter is kept when opening a task and when returning (the existing `?allapot=` behaviour is preserved). [desc]
- FR3.3 The card exposes one link with one accessible name (the task title with its date and status), with no nested interactive element. [desc]

### FR4 Group admin overview

- FR4.1 The summary cards on the admin overview are links to the matching list: "Nyitott jóváhagyások" opens the waiting approvals (`/admin/jovahagyasok?state=pending`), "Nyilvántartások" opens `/admin/nyilvantartasok`, "Feladatok és események" opens `/admin/feladatok`. [desc]
- FR4.2 The "Függőben lévő kérelmek" card is removed because it counted the same waiting approvals as "Nyitott jóváhagyások"; three cards remain. [Q2]
- FR4.3 The number on "Nyitott jóváhagyások" equals the number of rows shown on the page it opens (for example 3 and 3). [desc]
- FR4.4 The same overview works for the super administrator, who sees the same cards within their wider scope. [assumption]

### FR5 Branding

- FR5.1 The kindergarten logo (`public/brand/logo.png`, transparent) appears in the header of every page of the application, linking to the user's home page, with the alt text "Cinkotai Waldorf Óvoda". [desc] [Q3]
- FR5.2 The cover photo (`public/brand/cover.jpg`) appears as a large banner on the profile chooser only, and is treated as decoration (empty alt text). It is not used as a background on other pages. [desc] [Q3]
- FR5.3 Both images are committed to the repository (they are untracked today) and served through the application's own origin so the existing content security policy needs no change. [desc]

### FR6 Colour scheme and interaction states

- FR6.1 The palette comes from the building photo: terracotta (roof, timber) leads for buttons and links, warm ochre and cream are the surfaces, garden green marks success; the logo purple appears only in the logo. [desc] [Q4]
- FR6.2 All colours are defined once as design tokens in `app/globals.css`; the colours currently hard-coded outside the tokens are replaced by tokens. [assumption]
- FR6.3 Every clickable card and control has visible hover, pressed and keyboard-focus states and a minimum touch target of 44 by 44 pixels. [desc]
- FR6.4 Layouts work from a 320 pixel wide phone to a wide desktop without horizontal scrolling. [desc]

## Non-Functional Requirements

- NFR1 Accessibility: text contrast is at least 4.5:1 and interface-element and focus-indicator contrast at least 3:1 (WCAG 2.2 AA); the automated accessibility checks on the root flow and the admin and teacher areas report no serious or critical violations. [memory:M1]
- NFR2 Keyboard and screen reader: every card control in FR2 to FR4 is reachable and operable by keyboard, has a single accessible name, and shows a visible focus indicator; the "prefers-reduced-motion" setting disables hover and press animation. [desc]
- NFR3 Fonts: no font is loaded from another origin (the content security policy allows only the app's own fonts); system fonts or self-hosted fonts only. [assumption]
- NFR4 Image weight: the cover banner is served resized and compressed for the viewport (not the 672 KB original at full size on a phone). Measurable limit: at most 250 KB transferred for the cover at a 375 px wide viewport on a 2.6x device, served at the default image quality 75 (set at the Code Generation gate after quality 45 looked too soft; verified by the cover-weight browser test, measured 104, 124 and 202 KB at widths 750, 828 and 1080). [assumption]
- NFR5 Quality gates: strict type checking, lint, format, unit and browser tests and the production build all pass; line, branch and function coverage stay at or above 80%; any new component has tests in the same change. [memory:M1]
- NFR6 No regression: existing behaviour of session start, task list filtering, approvals and access checks is unchanged; tests that mention the removed "Profil használata" button, the "Részletek" link on the parent list, and the "Függőben lévő kérelmek" card are updated to the new controls, and stable `data-testid` hooks are kept wherever the element still exists. [desc]

## Constraints

- All user-facing text is Hungarian; code identifiers are English. [memory:M1]
- No change to business rules, authorization or data flows. [desc]
- Node 24 and npm 11 are required to run the project. [desc]
- Work happens on branch `feature/visual-overhaul` and merges to `main` through a short-lived branch and pull request. [memory:M1]
- The logo and the cover photo belong to the kindergarten. [assumption]

## Assumptions & Open Questions

- [assumption] The kindergarten has agreed that its logo and building photo may be used in this application. Owner: the project owner. Not yet confirmed.
- [assumption] Explicit break points in role names must not change how screen readers read the name or how tests match the text; the design stage chooses a mechanism that keeps both.
- [assumption] The admin lists have their own "Részletek" links; they are not part of this request and stay as they are.
- [assumption] The user guide (`HASZNALATI_UTMUTATO_HU.md`) mentions "Profil használata" and is updated with the change.
- Open: exact colour values are chosen at design time from the photo and checked against NFR1.
- Open: whether the teacher home page (a read-only schedule) needs card changes; none requested.

## Out of Scope

- New features, new pages, data or access-rule changes.
- Making the admin list rows (`ResponsiveCollection`) fully clickable.
- Dark mode, web fonts loaded from other sites, animations beyond simple hover and press feedback.
- Using the cover photo on pages other than the profile chooser.
- The production sign-in page content.

## Sources

- [desc]: Initial description: the request text for this piece of work, including its four fixes and the branding direction.
- [Q1] to [Q4]: answers in `requirements-analysis-questions.md` (hyphenation: automatic plus explicit break points; admin cards: merge into one; branding: banner on chooser only; colour: terracotta leads).
- [memory:M1]: the team's practices in `aidlc/spaces/default/memory/team.md` and `project.md` (Hungarian copy, quality gates, accessibility, 80% coverage).
- Codebase facts: code knowledge base `aidlc/spaces/default/codekb/waldorf-community-task-manager/` and the scan handoff `inception/reverse-engineering/developer-scan.md`.
