# Requirements: Apply the Stitch design to the Waldorf app

Depth: Standard. This is a look-only restyle of an existing, working app. Source tags: `[desc]` = the owner's initial request, `[Q<n>]` = an answer in `requirements-analysis-questions.md`, `[memory:M<n>]` = a rule from the team's recorded practices, `[assumption]` = unconfirmed.

## Intent analysis

The owner wants the running app to look like the design they made in Google Stitch, so they control the look from Stitch instead of from code. [desc]

The change is visual only: new fonts, a shared look in the one stylesheet (`app/globals.css`), then ten starred Stitch screens applied one flow at a time. No new features, the Hungarian copy stays, and all accessibility behaviour stays. [desc]

Success looks like this: the owner compares each restyled screen with its Stitch design by screenshot and approves it, while every existing automated check stays green. [Q5 of practices-discovery, memory:M1]

## Functional requirements

### FR1. Self-hosted fonts

- **FR1.1** The app uses Vollkorn for headings and Karla for body text, as in the Stitch design. [Q2]
- **FR1.2** The font files are stored inside the app and loaded with Next.js's built-in font loading (`next/font/local`). Nothing is loaded from Google or any other outside host. [Q3, desc]
- **FR1.3** The fonts' licence texts (SIL Open Font License) are kept in the repository next to the font files. [assumption: the licence requires it to ship with the files]
- **FR1.4** If a font file fails to load, the page stays readable with a fallback font and no layout breaks. [assumption: standard fallback behaviour]

### FR2. Shared look

- **FR2.1** The shared look (colours, type sizes, card shapes, button shapes, spacing) is defined once in `app/globals.css` and reused by all screens, so screens not restyled on their own (notifications, swap requests, password reset, invitation, most admin pages, teacher schedule) pick it up automatically. [desc, Q5]
- **FR2.2** Font family and the main type sizes become named values, so a later change to the fonts is one edit. [assumption: the code review found the font stack set once with no variable, and repeated size literals]
- **FR2.3** The owner checks the fonts and the shared look on the first slice before any individual screen is restyled. [memory:M1]
- **FR2.4** The ten starred Stitch screens define the target look. Unstarred Stitch screens are not built. [desc]

### FR3. Screens restyled one flow at a time

Each flow is a separate change, and the owner approves it from screenshots before the next starts. [memory:M1]

- **FR3.1** Sign-in and profile selector.
- **FR3.2** Parent task list, with the search and filter form and the empty-result state.
- **FR3.3** Task details and the signup confirmation.
- **FR3.4** Cancel (change signup) and the cancel confirmation.
- **FR3.5** "Saját vállalásaim" is shown on the existing parent task list (`/szulo/feladatok`), as the parent's own signups. No new page or route is added. [Q1]
- **FR3.6** Teacher and admin approvals.

### FR4. Clean-up inside the stylesheet

- **FR4.1** The unused profile-picker styles (about 100 lines: `.selector-*`, `.profile-grid`, `.profile-card*`) are removed in the first step, after a search shows no page or component uses them. [Q6]

### FR5. Behaviour that must not change

- **FR5.1** All user-facing text stays in Hungarian and unchanged. [desc]
- **FR5.2** Keyboard use, visible focus ring, skip link, `aria-` attributes, form errors announced next to the field, and status shown as icon plus word (never colour alone) behave as today. [desc]
- **FR5.3** Class names, `data-testid` values and element sizes that the browser specs assert stay as they are, or the matching specs change in the same pull request. [memory:M1]
- **FR5.4** Long Hungarian words still wrap or hyphenate (no ellipsis), and the layout still has no sideways page scroll at 320 px, 375 px and 200% zoom. [assumption: corner sweep of existing behaviour]
- **FR5.5** The destructive cancel action still asks for confirmation naming the task, and loading, empty and error views remain three distinct views. [assumption: corner sweep of existing behaviour]
- **FR5.6** The app stays light-mode only, and `prefers-reduced-motion` still removes motion. [assumption: current behaviour, from `DESIGN.md`]

### FR6. Tooling added during this work

- **FR6.1** A CSS linter (Stylelint) checks `app/globals.css` and blocks the merge when it finds errors. [memory:M2]
- **FR6.2** The five tools that float on `latest` (`react`, `react-dom`, `zod`, `@axe-core/playwright`, `@playwright/test`) are pinned to the versions currently installed. [memory:M3]
- **FR6.3** `DESIGN.md` is updated to match the new look, and its "No webfonts" line is replaced by the fonts decision. [memory:M4]

## Non-functional requirements

- **NFR1 Accessibility.** The critical browser flow has no serious or critical automated accessibility violations. Text needs at least 4.5 to 1 contrast, large text and controls at least 3 to 1. If a Stitch colour fails, only that colour is darkened until it passes, and the rest of the Stitch look is kept. [Q4, memory:M1]
- **NFR2 Touch targets.** Every button, link and summary stays at least 44 px tall. [desc]
- **NFR3 Responsive.** Every restyled screen works at 320 px width and at the 44rem breakpoint, as it does now. [desc]
- **NFR4 Performance and privacy.** Fonts are served from the app's own origin, with no third-party request, and the existing Content-Security-Policy (`font-src 'self'`) is not loosened. [desc, memory:M1]
- **NFR5 Existing gates.** Type check, lint, format check, unit tests with 80% line, branch and function coverage, production build, start smoke, the browser specs in all three browser projects, and the dependency scan all stay green. [memory:M1]
- **NFR6 Reviewability.** Each flow's change is small enough for the owner to review from screenshots of the screens it touches. [memory:M1]

## Constraints

- UI-only: no new feature, route, data field or backend change. [desc]
- The one hand-written stylesheet `app/globals.css` stays the single place for styles; colour tokens stay in the form `--name: #rrggbb` inside `:root`, because `tests/unit/design-tokens.test.ts` reads them that way. [memory:M1]
- No automatic picture-comparison tests: the owner reviews by screenshot. [memory:M1]
- Nothing deploys automatically today. The owner verifies changes locally against the local backend. [memory:M5]
- CSS classes stay kebab-case with an area prefix (`parent-`, `teacher-`, `admin-`, `filter-`). [memory:M1]

## Assumptions

- [assumption] The colour values in the Stitch design match the current tokens closely enough that most surfaces change by a small amount; the contrast check will show where they do not.
- [assumption] Stitch's screens at mobile width are the reference for small screens; where a screen has no mobile version, the existing responsive behaviour is kept.
- [assumption] Pinning the five tools means fixing the versions that are installed now, not upgrading them.

## Out of scope

- New features, new pages or routes, including a dedicated "Saját vállalásaim" page. [Q1]
- Unstarred Stitch screens (Stitch's own ideas for future features). [desc]
- Individually restyling notifications, swap requests, password reset, invitation, most admin pages and the teacher schedule beyond what the shared look gives them. [Q5]
- Dark mode, picture-comparison tests, signing or attestation of builds, and any deployment set-up. [memory:M1]
- Rewording any Hungarian text. [desc]

## Open questions

- None that block later stages. The exact version numbers to pin, the Stylelint rule set and the font weights to include are decided during code generation and shown in that stage's plan for approval.

## Sources

- `[desc]` Initial description: the owner's request to apply the Stitch design (project `projects/14373287019289018119`, the ten starred screens) to the existing app.
- `[Q1]` to `[Q6]`: answers in `requirements-analysis-questions.md` (Q1 A, Q2 A, Q3 A, Q4 A, Q5 A, Q6 A).
- `[memory:M1]` to `[memory:M5]`: the team's recorded practices in `aidlc/spaces/default/memory/team.md` (M1 testing posture, thin first slice and owner review; M2 CSS linter; M3 pinned tools; M4 `DESIGN.md` update; M5 local verification, no automatic deployment).
- Code map: `aidlc/spaces/default/codekb/waldorf-community-task-manager/` (styling findings of 2026-11-04).

## Assumptions & Open Questions

- Assumptions: the three listed under `## Assumptions`, plus the inline `[assumption]` items in FR1.3, FR1.4, FR2.2, FR5.4, FR5.5 and FR5.6. They are shown for the owner to correct at the approval gate.
- Open questions: None.
