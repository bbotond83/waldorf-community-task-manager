# Requirements Analysis Questions

Request: Add a sign-out button and a short Hungarian explanation to the "Nincs jogosultság" (no access) page. Small feature.

Context from the code scan: a signed-in parent account that has the parent role but no linked parent record is shown the parent "Nincs jogosultság" screen (`ParentAccessState`, no page header, so no sign-out). Teachers and admins have their own, similar denied screens. A fourth static page (`/hozzaferes-megtagadva`) uses the same heading but nothing in the app redirects to it.

## Q1. [Product owner] Which "Nincs jogosultság" screens should get the sign-out button and explanation?

The parent screen is the one a parent without a linked record lands on after sign-in. The teacher and admin screens are near-copies that could trap a person in the same way.

- A. Parent screen only (smallest change; the case you described)
- B. Parent, teacher and admin screens (consistent behaviour for all three role screens)
- C. All of B plus the static page `/hozzaferes-megtagadva`
- X. Other (please specify)

[Answer]: B

## Q2. [Product owner] Should the new explanation also appear when the same screen is shown for other reasons?

The parent screen is also shown to a teacher or admin who opens a parent page by mistake (they have a way back to their own page), and a separate "configuration error" variant reuses the same layout.

- A. Add the sign-out button everywhere the screen appears, but the "what to do" explanation only for the no-access state, not for the configuration-error variant
- B. Add both button and explanation to the no-access state only; leave the configuration-error variant unchanged
- C. Add both to every variant, including the configuration error
- X. Other (please specify)

[Answer]: A

## Q3. [Product owner] What should happen to the existing "Vissza a biztonságos kezdőoldalra" (back to the safe home page) link?

For a parent with no linked record this link points at the same screen, so it just reloads it.

- A. Keep it unchanged (out of scope for this small feature; mention it as a follow-up)
- B. Hide it on the parent screen when it would point back to the same screen
- C. Keep it but leave the decision to a later change, and word the explanation so it does not rely on the link
- X. Other (please specify)

[Answer]: B
