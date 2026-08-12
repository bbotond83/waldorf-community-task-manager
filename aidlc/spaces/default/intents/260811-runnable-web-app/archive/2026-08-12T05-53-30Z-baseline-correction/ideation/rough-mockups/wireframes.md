# Rough Wireframes

## Basis

These concepts implement the approved [intent statement](../intent-capture/intent-statement.md), [scope document](../scope-definition/scope-document.md), and [intent backlog](../scope-definition/intent-backlog.md). [intent] [scope] [backlog]

## Screen 1: Task Board — Desktop, Populated

```text
+----------------------------------------------------------------------------------+
| HEADER                                                                           |
| Waldorf közösségi feladatok                         [Helyi bemutató • szintetikus]|
+----------------------------------------------------------------------------------+
| MAIN                                                                             |
| H1 Közösségi feladatok                                                           |
| Rövid leírás: helyi feladatok áttekintése és létrehozása                         |
|                                                                                  |
| +-----------------------------------------------+  +---------------------------+ |
| | H2 Aktuális feladatok                    3 db |  | H2 Új feladat             | |
| |                                               |  |                           | |
| | [KERT] Tavaszi kert rendezése                 |  | Megnevezés *              | |
| |        4 hely                                 |  | [_______________________] | |
| |                                               |  |                           | |
| | [KONYHA] Sütemény az ünnepre                  |  | Kategória *               | |
| |          2 hely                               |  | [Válassz kategóriát… v]   | |
| |                                               |  |                           | |
| | [TEREM] Díszítés                              |  | Férőhely *                | |
| |         3 hely                                |  | [4______________________] | |
| |                                               |  |                           | |
| +-----------------------------------------------+  | [ Feladat létrehozása ]    | |
|                                                    +---------------------------+ |
+----------------------------------------------------------------------------------+
| FOOTER • Az adatok a szerver újraindításakor visszaállnak                        |
+----------------------------------------------------------------------------------+
```

**Accessibility note:** One `h1`, two `h2` headings; `header`, `main`, and `footer` landmarks; keyboard entry begins at the first form field after a skip link; task cards remain non-interactive unless an action is added. [Q6]

## Screen 2: Task Board — Mobile, Populated

```text
+----------------------------------+
| HEADER                           |
| Waldorf közösségi feladatok      |
| Helyi bemutató • szintetikus     |
+----------------------------------+
| MAIN                             |
| H1 Közösségi feladatok           |
| Rövid leírás                     |
|                                  |
| H2 Aktuális feladatok       3 db |
| +------------------------------+ |
| | [KERT] Tavaszi kert rendezése| |
| | 4 hely                       | |
| +------------------------------+ |
| | [KONYHA] Sütemény az ünnepre | |
| | 2 hely                        | |
| +------------------------------+ |
|                                  |
| H2 Új feladat                    |
| Megnevezés *                     |
| [______________________________] |
| Kategória *                      |
| [Válassz kategóriát…       v]   |
| Férőhely *                       |
| [4_____________________________] |
| [   Feladat létrehozása       ] |
+----------------------------------+
| FOOTER • Helyi adatok            |
+----------------------------------+
```

**Accessibility note:** Heading order matches desktop and landmarks remain unchanged; keyboard entry begins at the skip link, then reaches the name field as the first form control after the non-interactive task list; controls use at least 44px touch targets. [Q5] [Q6]

## Screen 3: Validation Error

```text
+-------------------------------------------+
| H2 Új feladat                             |
| [!] Kérjük, javítsd a megjelölt mezőket.  |
|                                           |
| Megnevezés *                              |
| [_______________________________________] |
| Hiba: A megnevezés megadása kötelező.     |
|                                           |
| [ Feladat létrehozása ]                   |
+-------------------------------------------+
```

**Accessibility note:** This state remains inside the page's `main` landmark beneath the existing page `h1` and form `h2`; keyboard entry begins at the focused error summary, then proceeds to the first invalid field; each error is linked to its field and does not rely on color alone. [Q6]

## Screen 4: Creation Success

```text
+------------------------------------------------+
| [✓] A feladat létrejött: "Udvari játékok"      |
+------------------------------------------------+
| H2 Aktuális feladatok                     4 db |
| +--------------------------------------------+ |
| | [UDVAR] Udvari játékok            ÚJ       | |
| | 5 hely                                      | |
| +--------------------------------------------+ |
| | ...seeded tasks...                          | |
+------------------------------------------------+
```

**Accessibility note:** Success remains inside the page's `main` landmark beneath the existing page `h1` and task-list `h2`; keyboard entry remains on the submit button, while a polite live region announces creation and the new task appears first without relying solely on color or animation. [Q2] [Q6]

## Screen 5: Empty and Runtime Error States

```text
EMPTY                                    ERROR
+-----------------------------------+    +-----------------------------------+
| H2 Aktuális feladatok        0 db |    | H2 A feladatok nem tölthetők be   |
| Még nincs feladat.                 |    | Próbáld újra, vagy indítsd újra   |
| Az űrlappal létrehozhatod az elsőt.|    | a helyi fejlesztői szervert.      |
| [ Ugrás az új feladat űrlaphoz ]   |    | [ Újrapróbálás ]                   |
+-----------------------------------+    +-----------------------------------+
```

**Accessibility note:** Both states remain within the page's `main` landmark and use an `h2` under the page `h1`; the empty state's keyboard entry begins at the skip link, while a failed load moves focus to the error `h2` and exposes the retry button next; error text does not expose stack traces. [Q6]

## Screen 6: Initial Loading

```text
+--------------------------------------------+
| H2 Aktuális feladatok                      |
| [██████████████████████████████]           |
| [██████████████████████]                   |
| A feladatok betöltése folyamatban…         |
+--------------------------------------------+
```

**Accessibility note:** Loading remains in the page's `main` landmark beneath the existing `h1` and list `h2`; keyboard entry begins at the skip link and focus is not moved while data loads; skeletons are hidden from assistive technology and status text uses a polite live region. [Q6]

## Screen 7: Submission in Progress

```text
+-------------------------------------------+
| H2 Új feladat                             |
| Megnevezés *  [Udvari játékok__________]  |
| Kategória *   [Udvar                  v]  |
| Férőhely *    [5_______________________]  |
| [ Létrehozás folyamatban… ] (disabled)    |
+-------------------------------------------+
```

**Accessibility note:** The form stays in `main` beneath the page `h1` and form `h2`; keyboard entry remains at the submit position after activation, the control exposes a busy state, and duplicate submission is blocked until completion. [Q6]

## Screen 8: Creation Failure

```text
+------------------------------------------------+
| H2 Új feladat                                  |
| [!] A feladatot nem sikerült létrehozni.       |
| Az adatok megmaradtak. Próbáld újra.           |
| [ Újrapróbálás ]                               |
+------------------------------------------------+
```

**Accessibility note:** Failure stays in the page's `main` landmark under the existing `h1` and form `h2`; keyboard entry moves to the focused error summary, then reaches retry; entered values remain intact and the message uses text plus iconography. [Q6]

## Validation Rules

| Field | Accepted value | Rejection message | Rejected-state behavior |
| --- | --- | --- | --- |
| Megnevezés | Non-empty trimmed text, 3–80 characters | Empty: `A megnevezés megadása kötelező.`; otherwise: `A megnevezés 3–80 karakter legyen.` | Preserve entered text and link the field from the error summary |
| Kategória | Explicit selection from `Kert`, `Konyha`, `Terem`, `Udvar`, `Egyéb` | `Válassz kategóriát.` | Preserve a valid selection; identify the select when missing |
| Férőhely | Whole number from 1 through 20 | `A férőhely 1 és 20 közötti egész szám legyen.` | Preserve entered value for correction |

Each field validates on blur after it has been touched and all fields validate on submit; only submit creates the focused error summary. Failed validation never creates a task. [Q2] [Q6]

## Information Architecture

```text
Task Board
├── Product identity and local-data status
├── Page purpose
├── Current tasks
│   ├── Count
│   └── Task summaries
├── New task
│   ├── Name
│   ├── Category
│   ├── Capacity
│   └── Submit feedback
└── Local reset/data-lifetime note
```

The task list remains the primary content area, while task creation is an always-visible supporting panel on wide screens and follows the list on small screens. [Q1] [Q3] [Q5]

## Visual Direction

Use a warm, calm, nature-inspired palette, softly rounded surfaces, restrained illustrative accents, readable type, and modern accessible control states. This is a direction rather than a formal design-system commitment. [Q4]

## Assumptions and Open Questions

None.

## Review

**Verdict: READY**

### Previous Blocker Verification

| Previous blocker | Status | Evidence |
| --- | --- | --- |
| Corrected input bypassed revalidation | Resolved | `user-flow.md` now routes `E2 → S4 → S5 → D2`, so corrected values must pass the same validation decision before task creation. |
| Load retry assumed success | Resolved | The load-error retry now routes `E1 → S2 → D1`, preserving both repeated-failure and success outcomes. |
| Validation feedback and timing were inconsistent | Resolved | The Validation Rules now distinguish empty-name and wrong-length messages, matching Screen 3, and require touched-field blur validation plus all-field submit validation deterministically. |

### Freshness Check

- The single-page desktop and mobile concepts remain aligned with Q1–Q5, including the task-list-first hierarchy, always-visible creation form, responsive layout, and restrained visual direction.
- The happy path and recovery paths are closed and testable for load failure, invalid input, submission in progress, creation failure, success, empty state, and process reset.
- Every screen/state identifies heading structure, landmarks, and a concrete keyboard entry or retained-focus point; error and success feedback meet the Q6 non-color and assistive-announcement expectations.
- Form fields, validation boundaries, messages, preserved-value behavior, duplicate-submit prevention, and rendered task-card data are internally consistent.
- The information architecture and explicit Scope Guard add no untraced feature behavior beyond the cited intent, scope, backlog, and confirmed Q&A.

No blocking findings remain.
