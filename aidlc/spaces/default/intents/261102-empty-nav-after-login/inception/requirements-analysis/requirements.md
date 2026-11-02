# Sign-in Landing Requirements

## Intent Analysis

After a successful sign-in the owner sees no menus, buttons or content, only a sign-out button. The cause, confirmed by reproducing it for super admin, group admin, teacher and parent: the sign-in action returns the browser to `/bejelentkezes`, and that page shows only a "signed in" note and a sign-out button to a signed-in visitor. Nothing sends the person to the home page of their role, where the role's menu lives. The sign-in data (accounts, role grants) and the menu code are correct. This is a focused brownfield bugfix: send a signed-in person to their role's home page, and remove the dead-end screen.

## Sources

- [desc] Initial description: after successful sign-in as super admin, group admin and parent in the local dev app, the page shows no menus, buttons or content, only a logout button; reproduce, find root cause, fix with a regression test that fails before the fix. The owner added in chat: "Teacher should be fixed as well".
- [scope] Workflow-selected scope: bugfix; Minimal depth.
- [Q1] `requirements-analysis-questions.md`, Q1: A, land on the home page of the person's role.
- [Q2] `requirements-analysis-questions.md`, Q2: A, a signed-in visitor of the sign-in page is sent straight to the home page of their role.
- [Q3] `requirements-analysis-questions.md`, Q3: A, the teacher keeps the designed layout with no menu.
- [RE] `aidlc/spaces/default/codekb/waldorf-community-task-manager/architecture.md`, `code-structure.md`, `business-overview.md`: sign-in, shell and role-home interactions.
- [RE-detail] `../reverse-engineering/developer-scan.md`: `signInAction` redirect, signed-in panel, `resolveProductionHome`, tests that pin the current behaviour.
- [memory] `aidlc/spaces/default/memory/team.md` and `project.md`: regression test per defect, 80% coverage floor, Prettier, ESLint, strict types, Hungarian user-facing copy, English identifiers.

## Functional Requirements

### FR1 — Land on the role home after sign-in

**Priority: Must. Sources: [desc], [Q1].**

- **FR1.1:** After a successful sign-in the person ends on the home page of their strongest role: super admin and group admin `/admin`, teacher `/teacher/schedule`, parent `/szulo/ertesitesek`. The destination is the one `/` already resolves; no second copy of the role-to-home rule is added.
- **FR1.2:** Each landing page shows that role's shell: the header with the person's label and the sign-out button, and the role's menu where the role has one (super admin 9 items, group admin 5, parent 3).
- **FR1.3:** An account with no fitting role, or an unavailable sign-in service, still ends on a page that says so (the existing `/` panels) and offers sign-out; it never loops between pages.

Acceptance: Given a seeded super admin, group admin, teacher or parent, when they submit the correct credentials, then they end on their role's home path and see that role's navigation (none for the teacher). Given a valid account without a role grant, when they sign in, then they see the "no role" message and a sign-out button.

### FR2 — No dead-end sign-in page

**Priority: Must. Sources: [Q2].**

- **FR2.1:** A visitor with a valid session who opens `/bejelentkezes` is redirected to `/`, which sends them on to their role's home.
- **FR2.2:** A visitor without a session still sees the sign-in form and the forgotten-password link, unchanged.
- **FR2.3:** The "signed in" note and its Hungarian copy are removed from the sign-in page, because the state it served no longer exists.

Acceptance: Given a signed-in session, when the sign-in address is requested, then the response is a redirect to `/` and no signed-in note is rendered. Given no session, the form renders as before.

### FR3 — Teacher keeps the designed layout

**Priority: Must. Sources: [desc], [Q3].**

- **FR3.1:** The teacher reaches `/teacher/schedule` after sign-in. The teacher menu stays empty by design (`TEACHER_NAVIGATION`); no menu entry is added.

Acceptance: Given a seeded teacher, when they sign in, then they land on the schedule page, which shows the schedule and the sign-out button.

### FR4 — Regression tests and test-suite upkeep

**Priority: Must. Sources: [desc], [memory].**

- **FR4.1:** A regression test for the sign-in action asserts the post-sign-in redirect to `/`. It fails against the current code (redirect to `/bejelentkezes`).
- **FR4.2:** A regression test for the sign-in page asserts that a signed-in visitor is redirected to `/` and a signed-out visitor sees the form. It fails against the current code.
- **FR4.3:** The browser helper `signInAs` and the specs that wait for the removed signed-in panel are updated to wait for the role home instead, so the existing browser suite keeps verifying sign-in.

## Non-Functional Requirements

### NFR1 — Security and privacy

**Priority: Must. Sources: [memory], [RE].**

The change adds no new data access. The redirect target is a fixed internal path; no address taken from the request is used as a redirect target (no open redirect). Cookie handling, token renewal and the content security policy stay as they are. No seeded password is printed or stored in new files.

### NFR2 — Quality gates

**Priority: Must. Sources: [memory].**

Strict type check, Prettier, ESLint, the unit and integration suites and at least 80% line, branch and function coverage stay green. The affected browser specs pass in at least Chromium, and the accessibility check of the landing pages reports no serious or critical violations.

### NFR3 — Language

**Priority: Must. Sources: [memory].**

User-facing text stays Hungarian; identifiers and test names stay English.

## Constraints

- Work on one short-lived branch; nothing is committed or pushed without the owner's approval.
- The password-reset and invitation flows keep ending on `/bejelentkezes` (their tests pin this); with no session there, the sign-in form shows as before.

## Assumptions

- A valid session on `/bejelentkezes` is the only state in which the signed-in note is shown, so redirecting that state to `/` is safe: `/` renders panels (not another redirect) for the no-role and unavailable states, so no redirect loop is possible.
- The teacher's missing menu is a design choice recorded in `src/runtime/navigation.ts`, not a defect, and the owner confirmed it ([Q3]).

## Out of scope

- Remembering the page a person asked for before signing in (rejected in [Q1]).
- Adding a teacher menu ([Q3]).
- Changes to the password-reset or invitation flows, the seed data, or the database.

## Assumptions & Open Questions

None.
