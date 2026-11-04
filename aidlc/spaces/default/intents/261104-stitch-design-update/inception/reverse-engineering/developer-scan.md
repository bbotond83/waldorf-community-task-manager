# Developer Scan Handoff

Repo `waldorf-community-task-manager` (unrecorded project-root repo). Intent `stitch-design-update` (record `261104-stitch-design-update`). Focused scan, Standard depth, head commit `251c4b33ec426d5dd0a80105388ed20683f8da44`, branch `docs/design-md`, date 2026-11-04. Read-only run: no test, build or program was executed. Snapshot paths: `app/`, `tests/browser/`, `proxy.ts`.

## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**:
  - `app/globals.css` (all 1418 lines)
  - `app/layout.tsx`
  - `app/page.tsx`
  - `app/bejelentkezes/` (`page.tsx`, `SignInForm.tsx`)
  - `app/_identity/` (`SignOutButton.tsx`, `shell-action.tsx`, `AccessStateExit.tsx`)
  - `app/szulo/` (`layout.tsx`, `feladatok/page.tsx`, `feladatok/[id]/page.tsx`, `feladatok/[id]/csere/page.tsx`, `feladatok/[id]/lemondas/page.tsx`, `ertesitesek/page.tsx`, `cserek/page.tsx`, `_components/ParentMutationForm.tsx`, `ParentStatePanel.tsx`, `PendingRequestNotice.tsx`, `NotificationReadForm.tsx`, `ParentAccessState.tsx`)
  - `app/teacher/` (`layout.tsx`, `schedule/page.tsx`, `schedule/_components/ScheduleCollection.tsx`, `schedule/[id]/page.tsx` first 60 lines, `_components/TeacherAccessState.tsx`)
  - `app/admin/` (`layout.tsx`, `page.tsx`, `jovahagyasok/page.tsx`, `jovahagyasok/[id]/page.tsx`, `_components/ResponsiveCollection.tsx`, `_components/AdminMutationForm.tsx` first 120 lines, `_components/AdminAccessState.tsx` tail)
  - `app/hozzaferes-megtagadva/page.tsx`
  - `app/api/readiness/route.ts`, `app/munkatars/beosztas/route.ts`
  - export lists of `app/szulo/actions.ts`, `app/admin/actions.ts`, `app/admin/advanced-actions.ts`, `app/bejelentkezes/actions.ts`, `app/_identity/actions.ts`
  - the className inventory of every `.tsx` file under `app/` (grep over the whole tree)
  - `proxy.ts`
  - `tests/browser/support/` (`projects.ts`, `seeded-schema.ts`, `scenarios.ts`)
  - `tests/browser/visual-overhaul.spec.ts`, `parent-web.spec.ts`, `navigation-polish.spec.ts` (lines 25-287), `list-polish.spec.ts` (lines 200-440), `functional-fixes.spec.ts` (lines 60-160); grep-level read of every other spec for style, size, axe and class assertions
- **Skimmed only** (shallow, not in the deep set):
  - `src/runtime/` (`AppShell.tsx`, `AppNav.tsx`, `navigation.ts`, `BrandMark.tsx`, `StatusBadge.tsx`, `BackToHomeLink.tsx`), `src/identity/copy.ts` (the `noAccess` block), `src/application/status-labels.ts` (grep only)
  - `package.json`, `next.config.ts`, `playwright.config.ts`, `.prettierrc.json`, `.github/workflows/ci.yml` (job names), `DESIGN.md` (first 60 lines), `public/brand/` (file names)
  - the remaining `app/admin/**` pages and `_components` (class names via grep only), `app/jelszo-visszaallitas/`, `app/meghivas/[token]/` (class names via grep only)
  - `tests/integration/*` and `tests/coverage/*` (matched by grep for class and `toHaveClass` use; not opened)
- **Left out** (not opened, "What to Skip" and the brief): `node_modules/`, `.next/`, `coverage/`, `test-results/`, `playwright-report/`, `qa-results/`, and AI-DLC's own install (`.claude/`, `aidlc/`, `.agents/`).

### Packages Found
- `app/` — Next.js 16 App Router tree (29 `page.tsx`, 5 `layout.tsx`, 2 route handlers, 99 tracked files) — TypeScript/React 19 — pages, layouts, server actions, `_lib` resolvers, `_components`, one global stylesheet.
- `proxy.ts` — Next 16 request proxy — TypeScript — CSP nonce and session cookie renewal.
- `tests/browser/` — Playwright specs (13 `*.spec.ts`, 4 `support/*.ts`, about 120 declared tests, more through loops) — TypeScript — browser, keyboard and axe checks against the local Supabase stack.
- Route inventory (Hungarian segments): `/` (home resolver), `/bejelentkezes` (sign-in), `/jelszo-visszaallitas` and `/jelszo-visszaallitas/uj` (password reset), `/meghivas/[token]` (invitation), `/hozzaferes-megtagadva` (static denied page, no inbound redirect), parent `/szulo/ertesitesek` (home), `/szulo/feladatok`, `/szulo/feladatok/[id]`, `/szulo/feladatok/[id]/csere`, `/szulo/feladatok/[id]/lemondas`, `/szulo/cserek`; teacher `/teacher/schedule`, `/teacher/schedule/[id]`; admin `/admin`, `/admin/nyilvantartasok(/uj|/[id])`, `/admin/feladatok(/uj|/[id])`, `/admin/jovahagyasok(/[id])`, `/admin/archivum(/[id])`, `/admin/import`, `/admin/emlekeztetok`, `/admin/adatvedelem`, `/admin/beallitasok`; API `/api/readiness`; legacy redirects `/munkatars/beosztas(/[id])`. There is no `/szulo` root page and no screen called "Saját vállalásaim" (grep for "vállalás" over `app/`, `src/`, `tests/` finds nothing).

### Build System
- **Type**: npm scripts around `next build` / `next start`; TypeScript strict; Prettier and ESLint.
- **Config Files**: `app/layout.tsx` (root layout), `next.config.ts` (security headers, `images.qualities [75]`, server-action body limit 6mb), `proxy.ts` (CSP), `playwright.config.ts` (3 projects: chromium port 3100, firefox 3101, mobile-chrome Pixel 7 on 3102, each with its own database schema).
- **Build Dependencies**: `app/globals.css` is imported once by `app/layout.tsx` (line 3); no CSS modules, no CSS-in-JS, no Tailwind, no PostCSS config seen.

### APIs Discovered
- Server actions — `app/szulo/actions.ts` (8: sign-up, swap request, swap response, withdraw, cancellation request, mark notification read, update contribution note), `app/admin/actions.ts` (7), `app/admin/advanced-actions.ts` (9), `app/bejelentkezes/actions.ts` (sign-in), `app/_identity/actions.ts` (sign-out), plus the reset and invitation actions.
- Route handlers — `GET /api/readiness`, `GET /munkatars/beosztas(/[id])` (307 redirect).
- Behaviour that a restyle must not change: forms post through `useActionState`; the swap, cancellation and note forms send a fresh idempotency key from their submit handler (`ParentMutationForm` with `freshIdempotencyKey`); the notification read checkbox submits by `requestSubmit()` on tick.

### Frameworks & Libraries
- Next.js 16.4.2 App Router, React 19 (`useActionState`, `useFormStatus`), `next/image`, `next/link`, zod, Supabase client; no font library, no icon library (status icons are inline SVG in `src/runtime/StatusBadge.tsx`).
- Fonts today: none loaded. `:root` sets the system stack `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (`app/globals.css:21-27`). No `@font-face`, no `next/font`, no font files in the repo. `DESIGN.md` line "No webfonts; keep it that way" contradicts the intent and must be updated with it.
- CSP (`proxy.ts:13-25`): `default-src 'self'`; `script-src 'self' 'nonce-…' 'strict-dynamic'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' blob: data:`; `font-src 'self'`; `connect-src 'self'`; `object-src 'none'`; `frame-ancestors 'none'`; `form-action 'self'`. Self-hosted fonts served from the app origin (for example by `next/font/local`, which emits files under `/_next/static/media` and an inline `@font-face`) fit `font-src 'self'` and `style-src 'unsafe-inline'` without a policy change. The proxy matcher skips `_next/static`, `_next/image`, `api` and prefetch requests, so font files get no CSP header of their own; the document's policy governs them. A Google Fonts link would be blocked.

### Test Coverage
- **Test Directories**: `tests/browser/` (this scan); other layers (`tests/unit`, `tests/integration`, `tests/coverage`, `tests/database`) are outside the snapshot.
- **Test Frameworks**: Playwright (`@playwright/test`), `@axe-core/playwright`.
- **Coverage Config**: 80/80/80 floors live in `vitest.config.ts` and the domain test script (not opened).
- **Browser tests a visual change can break** (selectors, sizes, colours):
  - Class selectors: `.admin-collection`, `.admin-collection li a`, `.status-badge`, `.status-badge svg[aria-hidden='true']`, `.parent-state-badge`, `.filter-field`, `.filter-actions` (functional-fixes, list-polish, navigation-polish, admin-core); `toHaveClass(/notification-card-read/)` and `toHaveClass(/button-link/)`; `teacher-web.spec.ts` injects `.teacher-table { font-size: 1.2rem; }`.
  - Computed-style checks: heading outline is `none` after programmatic focus (visual-overhaul 47, navigation-polish 56); focused control outline width at least 3px (navigation-polish 284) and the create buttons show a ring of at least 2px (list-polish 396); the "Új elem" and "Új feladat vagy esemény" links must have the same background colour, text colour and radius as the "Szűrés" button (list-polish 384-393); a read notification card background differs from an unread one (functional-fixes 81-83).
  - Size checks: every menu link at least 44px high (navigation-polish 86); notification checkbox label at least 44x44 (navigation-polish 219); import submit at least 44x44 (admin-advanced 145); teacher card link at least 44px high; the notification card title sits at least 12px from the card's left and top edges at 320px (navigation-polish 251-252); the card's label stays inside the card.
  - Layout checks: no horizontal overflow at 320 and 375px on sign-in, role homes, menu pages (visual-overhaul 10-30, navigation-polish 102-113, list-polish 257-259); no clipped child inside the sign-in panel; every `label[for]` ends above its control and shares its left edge, for 8 forms at 320 and 1280px (list-polish 225-318); filter controls and buttons share one bottom line on desktop and stack with distinct tops at 320px (list-polish 320-342); sign-in heading keeps its Y position when images fail to load (visual-overhaul 83-98, relies on `.brand-mark` aspect ratio); page zoom 2 has no horizontal scroll (parent-web 161-168, teacher-web 105-113).
  - Accessibility: `new AxeBuilder({ page }).analyze()` filtered to serious and critical impact in about 40 places (default rule set, so colour contrast is checked); `directory-coordination.spec.ts` (line 272) and `notifications-import.spec.ts` (line 252) use tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa. A palette or font change must keep text at 4.5:1.
  - Text and role selectors in Hungarian: headings such as "Értesítések", "Családi feladatok", "Beosztás", "Nincs jogosultság", "Biztonságos bejelentkezés"; link names "Vissza a feladatokhoz", "Vissza az értesítésekhez", "Vissza a beosztáshoz"; button texts "Jelentkezem", "Szűrés"; checkbox name `^Olvasottnak jelölöm `; accessible name of an admin list link `Lemondási kérelem – Sütés (Függőben|Jóváhagyva)` (the status icon must stay `aria-hidden`).
  - Test ids: every asserted element has a `data-testid` (for example `sign-in-form`, `sign-in-email`, `sign-out-button`, `duty-card-<id>`, `duty-open-<id>`, `signup-form-submit-button`, `cancellation-request-form-submit-button`, `notification-card-<id>`, `app-shell-navigation`, `app-shell-skip-link`, `app-shell-main`, `brand-link`). A restyle that keeps markup and test ids does not touch them; one that restructures markup must carry them over.
  - Focus behaviour: pages move focus to the `h1` (`tabIndex={-1}` plus `autoFocus`) and `app-shell-main`; skip link targets `#fo-tartalom`; the `[tabindex="-1"]:focus { outline: none }` rule in `globals.css:87-90` is pinned by tests.

### Code Quality Indicators
- **Linting**: ESLint 9 flat config (`eslint.config.mjs`), `--max-warnings=0`, lint scope includes `app` and `proxy.ts` and `tests`; Prettier width 100, double quotes, trailing commas. Prettier also formats `app/globals.css` (the `format:check` script includes `app`; `.prettierignore` does not exclude it); ESLint does not lint CSS and there is no Stylelint.
- **CI/CD**: `.github/workflows/ci.yml` (job names only): `validate` (`npm run verify:local`, every browser on every run) and the build-evidence job.
- **Documentation**: `DESIGN.md` (132 lines, added by the latest commit) describes the visual system in words; `README.md`.
- Strengths seen in `app/`: every page has one `h1` with a focus target; state panels have `role` and `aria-live`; forms carry error summaries linked to fields; 44px minimum targets and focus rings are encoded in CSS; `prefers-reduced-motion` handled (`globals.css:1363-1389`); zero `TODO`, `FIXME`, `eslint-disable` or `@ts-ignore` in `app/`, `proxy.ts`, `tests/browser/`.

### Technical Debt Signals
- **Stylesheet size and shape**: one 1418-line `app/globals.css`, 16 colour tokens plus `--shadow` and `--radius` on `:root`, no type-scale, spacing or font tokens. Values repeated as literals: `1rem` radius via `--radius` is fine, but `0.5rem` input radius, `999px` pill radius, `44px`, `0.35rem` status-border width and `120ms` transitions are repeated (about 10 to 25 times each). `white` is hard-coded for text on terracotta (button, `.button-link`, `.nav-button[aria-current]`, `.skip-link`). The body background has a hard-coded `rgb(184 102 60 / 18%)` glow.
- **Dead CSS (profile selector)**: `.selector-page`, `.selector-heading`, `.profile-grid`, `.profile-card`, `.profile-card-name`, `.profile-card-summary`, `.selector-hero`, `.selector-cover` and the `.selector-hero .brand-mark` rule (scattered between `globals.css:107` and `:240`, about 100 lines; `.centered-panel` and `.app-shell` share the selector lists at lines 107-117 and are live) have no user in `app/` or `src/` (full-tree grep); they are what is left of the removed profile picker. `.profile-card:hover/active` is also listed in the shared hover rules and the reduced-motion block. The "sign-in/profile selector" screen of the intent is therefore the sign-in page (`app/bejelentkezes/page.tsx`: `centered-panel parent-public-page`, `BrandMark`, `h1`, `SignInForm` with `parent-form identity-form`, forgot link) plus `app/page.tsx` for signed-out visitors (`centered-panel`, `button-link`).
- **Parent form classes reused for sign-in**: the sign-in, reset and invitation forms use `parent-form identity-form`, so a restyle of `.parent-form` (parent task forms) also restyles the identity forms; likewise `.centered-panel` is shared by sign-in, reset, invitation, denied pages, the `/` panels and the admin and teacher access states.
- **Shared selectors couple areas**: the hover and active rules group `.profile-card, .parent-card, .admin-card, .teacher-card, .dashboard-link`; the filter layout groups `.admin-filter, .teacher-filter fieldset, .parent-filter, .advanced-filter`; `.parent-card` is declared three times (lines 847-856, 896-906, 908-913) with later rules overriding `padding`; `.form-hint` is declared twice. Moving to a new look in one flow means editing grouped rules that other flows also use.
- **Unstyled markup**: the empty and no-result states of the parent task list use `ParentStatePanel` (`.parent-state`: heading "Nincs megjeleníthető elem" and the message; test id `duties-empty`) and a bare `<p data-testid="duties-filter-empty">Nincs találat.</p>`; the detail back links and the `/szulo/cserek` link are plain `<a>` without a class; the cancellation and swap pages are a bare `h1` plus the `parent-form`.
- **Stale copy**: `TeacherAccessState` signed-out text says "válasszon óvónői profilt" (profile picker wording) although profiles are gone; `app/hozzaferes-megtagadva/page.tsx` has no inbound redirect (legacy). Not part of this intent, recorded only.
- **No stitch counterpart for "Saját vállalásaim"**: no page, route or string with that name exists. The nearest screens are `/szulo/feladatok` (the family's duties with state badge) and `/szulo/cserek`. A UI-only restyle cannot add the screen; the owner must say which existing screen it maps to.
- **Tests that pin appearance by class name** are listed under Test Coverage; `list-polish.spec.ts` compares the computed look of three different elements, so `button` and `.button-link` must keep one visual definition.
- **`h1` size** is `clamp(2rem, 5vw, 4rem)` for every page including list pages; `hyphens: auto` on `h1, h2, p` with `lang="hu"`. A serif display font with different metrics affects the 320px no-overflow and no-clipping tests.

## Handoff Summary
- **Intent-relevant finding**: The whole look lives in one global stylesheet, `app/globals.css` (imported by `app/layout.tsx:3`), built from 16 colour tokens and class families per area (`parent-*`, `teacher-*`, `admin-*`/`advanced-*`, shell `site-header`/`navigation-panel`/`nav-button`, shared `centered-panel`, `button-link`, `filter-*`, `status-badge`, `notification-*`). No webfont is loaded anywhere (system stack at `globals.css:21-27`); the CSP already allows self-hosted fonts (`proxy.ts:18` `font-src 'self'`) and inline styles, but blocks external font hosts. Roughly 100 lines of profile-picker CSS (between `globals.css:107` and `:240`) are dead. Pages are mostly markup with classes and `data-testid`; the structure and ids can stay while the CSS changes.
- **Risks / follow-up**:
  - Browser tests check computed sizes (44px targets, focus ring at least 3px on menu and cards, outline `none` on focused headings), colours (read card differs from unread; create buttons equal "Szűrés"), label-above-field geometry, and no overflow at 320, 375px and zoom 2. Their class hooks to keep: `.admin-collection`, `.status-badge`, `.parent-state-badge`, `.button-link`, `.notification-card-read`, `.filter-field`, `.filter-actions`, `.brand-mark` aspect ratio.
  - Axe (default rules, wcag22aa in two specs) checks colour contrast, so a new palette from the design needs 4.5:1 for text and 3:1 for UI parts.
  - Shared selectors (`.parent-form` for sign-in and task forms, `.centered-panel` (11 uses in `app/` and `src/`: sign-in, reset, invitation, denied and access states, the `/` panels), grouped hover and filter rules) mean one flow's restyle can change another's; plan each flow's change and re-run the browser suite.
  - `DESIGN.md` says "No webfonts"; update it with the font change. `public/brand/` holds only `logo.png` and `cover.jpg`; the cover is not used by any current page (its CSS `.selector-hero` is dead).
  - "Saját vállalásaim" does not exist as a screen; confirm its mapping before design.
  - Text selectors are Hungarian headings and link names; copy must not change.
