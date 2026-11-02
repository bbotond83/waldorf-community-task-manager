# Requirements: Sign-out and explanation on the "Nincs jogosultság" screens

Depth: Minimal. Scope: express. Conversation language: English; user-facing copy is Hungarian.

## Intent analysis

Initial description: Add a sign-out button and a short Hungarian explanation to the "Nincs jogosultság" (no access) page. Small feature.

Since PR #2 (commit 1070fd6), sign-in redirects to `/`, which sends a person to their role home. A person who holds a role but has no linked record (for example a parent account without a linked parent record) lands on a "Nincs jogosultság" screen that has no sign-out and no guidance, so they are stuck. The goal is that such a person can always leave the screen (sign out) and knows what to do next (contact a group administrator).

## Functional requirements

- **FR1 Sign-out on the denied screens.** The parent, teacher and admin "Nincs jogosultság" screens each offer a sign-out button. (Q1 = B)
  - FR1.1 The button is the existing `SignOutButton` and the existing `signOutAction`; no new sign-out component or action is written.
  - FR1.2 Activating it ends the session, clears the cookies and lands on the sign-in page (`/bejelentkezes`), exactly as sign-out does elsewhere.
  - FR1.3 The button appears wherever these screens appear, including when a teacher or admin opens a parent page, and in the configuration-error variant. (Q2 = A)
- **FR2 Short Hungarian explanation.** In the no-access state, each of the three screens shows a short Hungarian explanation of what to do: contact a group administrator. (Q1 = B, Q2 = A)
  - FR2.1 The explanation is not shown in the configuration-error variant, which keeps its own message. (Q2 = A)
  - FR2.2 The explanation does not depend on the "back to home" link helping.
- **FR3 Looping "back" link.** On the parent screen, the link "Vissza a biztonságos kezdőoldalra" is not shown when it would point to the screen already displayed. (Q3 = B)
  - FR3.1 When the link points elsewhere (for example a teacher who opened a parent page), it is shown as before with its existing label and test ids.
- **FR4 No regressions on other behaviour.** The heading "Nincs jogosultság", the single `<h1>`, the element `id="hozzaferes-megtagadva"` and existing test ids stay unchanged. The static page `/hozzaferes-megtagadva`, the "no role" branch of `app/page.tsx` and all other screens are unchanged. (Q1 = B, not C)

## Non-functional requirements

- **NFR1 Accessibility.** No serious or critical automated accessibility violations on the changed screens in the critical browser flow (team practice).
- **NFR2 Language.** User-facing text is Hungarian; identifiers are English (team practice).
- **NFR3 Quality gates.** Strict type checking, Prettier and ESLint (zero warnings) pass; at least 80% line, branch and function coverage across production source; the production build and start smoke pass (team practice).
- **NFR4 Tests with the change.** Tests ship in the same change, including a regression test that fails before the change and passes after it (a denied screen with no sign-out). Express strategy: one requirement-driven test per requirement, plus a happy-path test per changed component.
- **NFR5 Security and privacy.** Sign-out reuses the existing server action and its same-origin and cookie handling; no new endpoint, token or stored data. No seeded password is printed in any output.

## Constraints

- Trunk-based: work is delivered as a short-lived branch and squash-merge to `main`. Nothing is committed, pushed or published without the owner's explicit OK.
- Reuse `SignOutButton` (`app/_identity/SignOutButton.tsx`) and `signOutAction` (`app/_identity/actions.ts`); keep module boundaries and colocated test conventions.
- The denied screens render outside `AppShell`; `AppShell` is not introduced for this change.
- Verification runs on a development server on a port other than 3000, which the owner uses.

## Assumptions

- A1 The "page" means the denied screen reached after sign-in by a role holder without a linked record (the parent screen), extended to the teacher and admin screens by the owner's choice (Q1 = B). The static page `/hozzaferes-megtagadva` is not changed (nothing links to it).
- A2 Draft explanation wording (to be finalised in Code Generation by the owner's copy review): "Ehhez a fiókhoz nem tartozik megfelelő profil. Kérje a csoport adminisztrátorát, hogy kapcsolja össze a fiókját, vagy jelentkezzen ki, és lépjen be másik fiókkal." Plain and short, consistent with the existing no-role copy ("Kérje az adminisztrátort, hogy hívja meg.").
- A3 For the teacher and admin screens, the "back" link is left as is unless it points at the page already shown; hiding applies where it would loop (parent confirmed by Q3 = B; teacher link goes to `/`, which loops the same way for a role holder with no usable page, so the same rule applies there). Admin follows its existing link behaviour if it does not loop.
- A4 The reproduction uses a test double (the request double in `tests/support/request-world.ts`) for component and page tests, and a purpose-made account (parent grant with no `parents` row) for the browser check; seeded accounts are unaffected.

## Out of scope

- The static page `/hozzaferes-megtagadva`.
- The "no role" branch of `app/page.tsx` (already has sign-out).
- Merging the three denied screens into one shared component.
- Changing access rules, grants or how the role home is resolved.
- Header sign-out through `AppShell` for denied persons.

## Open questions

- Final Hungarian wording of the explanation (A2) for the owner's confirmation at the Code Generation review.
- Whether the teacher "back" link should also be hidden when it loops (A3 assumes yes).
