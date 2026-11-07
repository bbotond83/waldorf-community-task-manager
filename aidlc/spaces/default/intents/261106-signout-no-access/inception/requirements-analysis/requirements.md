# Requirements: Sign-out on the "Nincs jogosultság" screen

## Intent analysis

A signed-in person who has an account but no usable profile (for example, a parent account not linked to a parent record) can reach a "Nincs jogosultság" (no access) screen with no way to sign out. They are stuck until they clear their browser cookies. The goal is to give every such person a clear sign-out button and a short Hungarian explanation of what to do.

Type: bug fix (small feature). Depth: Minimal. Scope: one screen plus its tests.

## Functional requirements

- **FR1**: The standalone no-access page `app/hozzaferes-megtagadva/page.tsx` shows a sign-out button.
  - FR1.1: The button is the existing `SignOutButton` component (`app/_identity/SignOutButton.tsx`) and uses the existing `signOutAction`. No new sign-out logic is written.
  - FR1.2: Pressing the button ends the session and returns the person to the sign-in page (`/bejelentkezes`), as it does on the other screens.
- **FR2**: The same screen shows the existing Hungarian guidance text `COPY.noAccess.guidance` (from `src/identity/copy.ts`): "Ehhez a fiókhoz nem tartozik megfelelő profil. Kérje a csoport adminisztrátorát, hogy kapcsolja össze a fiókját, vagy jelentkezzen ki, és lépjen be másik fiókkal."
  - FR2.1: The text is reused as is. No new wording is written.
- **FR3**: The screen keeps its current content: heading "Nincs jogosultság", the existing explanation sentence and the link back to the safe home page.
- **FR4**: Before changing anything, the stuck case is reproduced in the running app, and the screen that actually traps the person is confirmed (see Assumptions).
- **FR5**: Other role screens (parent, teacher, admin, and the home page with no role) already show sign-out. Their behaviour does not change.

## Non-functional requirements

- **NFR1 (accessibility)**: The changed screen has no serious or critical automated accessibility violations (axe, WCAG 2.1 AA).
- **NFR2 (language)**: All user-facing text is Hungarian. Code identifiers are English.
- **NFR3 (quality gates)**: Prettier, ESLint and the strict TypeScript check pass. Automated test coverage stays at or above 80% for lines, branches and functions.
- **NFR4 (regression)**: A regression test fails before the change and passes after it.

## Constraints

- Technical: reuse `SignOutButton` and `signOutAction`; do not write a new sign-out path.
- Process: no commit, push or pull request until the owner approves.
- Environment: the verification server runs on a port other than 3000.

## Assumptions

- **A1**: The standalone page `app/hozzaferes-megtagadva/page.tsx` is the page the owner means. The code scan found no sign-in redirect that sends people there, so the exact path that traps a user is not yet confirmed. FR4 settles this before the code change.
- **A2**: The existing guidance text is good enough for the owner (owner answer Q2 = A).
- **A3**: The proof is an automated test plus a manual check in the running app with a throwaway account (owner answer Q3 = A).

## Out of scope

- Removing the standalone page (owner answer Q1 = B, not C).
- Changing sign-in routing, the "no role" home page, or the parent, teacher and admin screens.
- Any change to the sign-out action itself or to session handling.
- Commits, pushes and pull requests (need separate owner approval).

## Open questions

- None for requirements. The one open point is A1, which is checked in the running app as part of FR4.
