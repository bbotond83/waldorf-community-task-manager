# Frontend Components: U2 Identity and access

Four new screens, all Hungarian, plus a sign-out control. They live beside the old picker until U5 (BR2.19). Source: `functional-spec.md` workflows W1, W3, W5, W6 and rules BR2.4, BR2.20.

## Screens

| Route | Component | Purpose |
|---|---|---|
| `/bejelentkezes` | SignInPage | Email and password form; generic error; try-again-later message |
| `/meghivas/<token>` | AcceptInvitationPage | Shows the invitation's role and scope, sets the password, or shows the not-valid screen |
| `/jelszo-visszaallitas` | RequestResetPage | Email field; always the same confirmation message |
| `/jelszo-visszaallitas/uj` | SetNewPasswordPage | New password form for a valid reset link; not-valid screen otherwise |
| (in the existing top bar) | SignOutButton | Ends the current session |

## Component Hierarchy and State

- Each page is a server component that reads the cookie or token and renders a small client form component (`SignInForm`, `AcceptInvitationForm`, `RequestResetForm`, `SetPasswordForm`).
- Form state: field values, a pending flag, and one error message region. No credentials are kept in client state after submit.
- Forms post to server actions that return an explicit result state (success, validation, denied, conflict, retryable, terminal); the client maps each to a Hungarian message.

## Validation (BR2.4)

The password field shows the rule ("legalább 8, legfeljebb 72 karakter, legalább egy betű és egy szám") and checks it before submit; the server checks it again. A field error is linked to its input and announced.

## Copy (Hungarian, fixed)

| Situation | Text |
|---|---|
| Generic sign-in error | Hibás e-mail-cím vagy jelszó. |
| Locked | Túl sok sikertelen próbálkozás. Próbálja újra 15 perc múlva. |
| Reset confirmation | Ha az e-mail-cím ismert, elküldtük a jelszó-visszaállítási levelet. |
| Invitation not valid | Ez a meghívó már nem érvényes. Kérjen újat a csoport adminisztrátorától. |
| Password rule error | A jelszó legalább 8 és legfeljebb 72 karakter legyen, és tartalmazzon betűt és számot. |
| Temporary failure | Átmeneti hiba történt. Próbálja újra. |
| Access denied (detail screen) | Ehhez az adathoz nincs jogosultsága. |

## Accessibility (BR2.20)

Labelled controls, visible focus, keyboard-only operation, errors in a live region and tied to the field, contrast of at least 4.5:1 for text and 3:1 for controls, and the browser flow checked with the automated accessibility scan (no serious or critical findings). Stable `data-testid` values are added to every control.

## API Integration Points

Server actions call the kernel's session, invitation and reset functions; the screens never call the sign-in service or the database directly and never see the service-role key.
